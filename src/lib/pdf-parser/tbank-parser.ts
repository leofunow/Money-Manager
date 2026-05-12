import { hashString } from "@/lib/utils";

export interface ParsedTransaction {
  date: string;
  amount: number;
  type: "income" | "expense";
  description: string;
  merchant_name: string;
  import_hash: string;
}

interface TextItem {
  text: string;
  x: number;
  y: number;
}

export async function parseTBankPDF(file: File): Promise<ParsedTransaction[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const allItems: TextItem[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    const pageHeight = viewport.height;

    for (const item of content.items) {
      if ("str" in item && item.str.trim()) {
        allItems.push({
          text: item.str.trim(),
          x: item.transform[4],
          y: (pageNum - 1) * 10000 + (pageHeight - item.transform[5]),
        });
      }
    }
  }

  console.debug("[TBank parser] raw text items:", allItems.length, allItems.slice(0, 40).map(i => `[x=${Math.round(i.x)} y=${Math.round(i.y)}] ${i.text}`));

  return extractTransactions(allItems);
}

function groupByY(items: TextItem[], tolerance = 5): Array<TextItem[]> {
  const rows: Array<{ y: number; items: TextItem[] }> = [];

  for (const item of items) {
    const existing = rows.find((r) => Math.abs(r.y - item.y) <= tolerance);
    if (existing) {
      existing.items.push(item);
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  }

  return rows
    .sort((a, b) => a.y - b.y)
    .map((r) => r.items.sort((a, b) => a.x - b.x));
}

const DATE_RE = /^\d{2}\.\d{2}\.\d{4}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;
// Both "1 200,00" (Russian) and "1 200.00" (international) formats
const AMOUNT_RE = /^[-+]?\s*[\d\s]+[,.]\d{2}$/;
const DATE_IN_TEXT_RE = /\b(\d{2})\.(\d{2})\.(\d{4})\b/;

// Russian month names
const MONTHS_RU: Record<string, string> = {
  "января": "01", "янв": "01",
  "февраля": "02", "фев": "02",
  "марта": "03", "мар": "03",
  "апреля": "04", "апр": "04",
  "мая": "05", "май": "05",
  "июня": "06", "июн": "06",
  "июля": "07", "июл": "07",
  "августа": "08", "авг": "08",
  "сентября": "09", "сен": "09", "сент": "09",
  "октября": "10", "окт": "10",
  "ноября": "11", "ноя": "11", "нояб": "11",
  "декабря": "12", "дек": "12",
};
const DATE_RU_RE = new RegExp(
  `\\b(\\d{1,2})\\s+(${Object.keys(MONTHS_RU).join("|")})\\.?\\s*(\\d{4})?\\b`,
  "i"
);

function isDate(s: string) { return DATE_RE.test(s.trim()); }
function isTime(s: string) { return TIME_RE.test(s.trim()); }
function isAmount(s: string) { return AMOUNT_RE.test(s.trim().replace(/\s/g, "")); }
function isSystemText(s: string) {
  return (
    isDate(s) || isTime(s) || isAmount(s) ||
    /^[+-]?\s*\d[\d\s]*$/.test(s) ||
    s.length <= 1
  );
}

function parseAmount(s: string): number {
  // "1 200,00" → 1200.00  |  "1 200.00" → 1200.00
  const clean = s.replace(/\s/g, "");
  // If comma is decimal separator: "1200,00"
  if (/,\d{2}$/.test(clean)) {
    return parseFloat(clean.replace(/[^0-9,]/g, "").replace(",", ".")) || 0;
  }
  // If period is decimal separator: "1200.00"
  if (/\.\d{2}$/.test(clean)) {
    return parseFloat(clean.replace(/[^0-9.]/g, "")) || 0;
  }
  return parseFloat(clean.replace(/[^0-9]/g, "")) || 0;
}

function parseDate(s: string): string | null {
  // DD.MM.YYYY
  const m = s.match(DATE_IN_TEXT_RE);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  // "27 октября 2024" or "27 окт 2024"
  const mr = s.match(DATE_RU_RE);
  if (mr) {
    const day = mr[1].padStart(2, "0");
    const month = MONTHS_RU[mr[2].toLowerCase()];
    const year = mr[3] ?? new Date().getFullYear().toString();
    if (month) return `${year}-${month}-${day}`;
  }

  return null;
}

// Detect "summary/balance" rows that should not be treated as transactions
const SUMMARY_RE = /^(остаток|баланс|итого|всего|сальдо|входящий|исходящий|opening|closing)/i;

function extractTransactions(allItems: TextItem[]): ParsedTransaction[] {
  const rows = groupByY(allItems);
  const seen = new Set<string>();
  const transactions: ParsedTransaction[] = [];

  // Find date-anchor rows
  const dateRowIndices: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const rowText = rows[i].map(it => it.text).join(" ");
    if (rows[i].some((it) => isDate(it.text) || DATE_IN_TEXT_RE.test(it.text)) ||
        DATE_RU_RE.test(rowText)) {
      // Skip obvious header/summary rows
      if (!SUMMARY_RE.test(rowText)) {
        dateRowIndices.push(i);
      }
    }
  }

  console.debug("[TBank parser] date anchor rows:", dateRowIndices.length);

  for (let di = 0; di < dateRowIndices.length; di++) {
    const anchorIdx = dateRowIndices[di];
    const nextAnchorIdx = dateRowIndices[di + 1] ?? rows.length;
    // Look at up to 8 rows per transaction to capture multi-line descriptions
    const txnRows = rows.slice(anchorIdx, Math.min(anchorIdx + 8, nextAnchorIdx));

    const allCells = txnRows.flatMap((r) => r.map((it) => it.text));

    // Find date
    let dateStr: string | null = null;
    for (const cell of allCells) {
      dateStr = parseDate(cell);
      if (dateStr) break;
    }
    if (!dateStr) continue;

    // Skip summary rows
    if (allCells.some(c => SUMMARY_RE.test(c))) continue;

    // Find all amounts — separate debit/credit from likely balance
    // Balance columns are usually the rightmost (largest x) and largest value
    const amountItems = txnRows.flatMap((r) =>
      r
        .filter(it => AMOUNT_RE.test(it.text.replace(/\s/g, "")))
        .map(it => ({ text: it.text, x: it.x, value: parseAmount(it.text) }))
    ).filter(a => a.value > 0);

    if (!amountItems.length) continue;

    // If multiple amounts, heuristic: the balance is usually the rightmost column
    // Use the leftmost among non-zero amounts as the transaction amount
    const sortedByX = [...amountItems].sort((a, b) => a.x - b.x);
    // If we have >2 amounts, skip the rightmost (likely balance)
    const candidateAmounts = sortedByX.length > 2 ? sortedByX.slice(0, -1) : sortedByX;

    // Determine sign from cell text
    let amount = 0;
    let type: "income" | "expense" = "expense";

    const signedCell = allCells.find((c) => /^[+-]/.test(c.trim()) && AMOUNT_RE.test(c.replace(/\s/g, "")));
    if (signedCell) {
      amount = parseAmount(signedCell);
      type = signedCell.trim().startsWith("+") ? "income" : "expense";
    } else {
      amount = candidateAmounts[0]?.value ?? amountItems[0].value;
      const hasIncomeKeyword = allCells.some((c) =>
        /зарплат|аванс|пополнен|cashback|кэшбэк|процент|начислен|возврат|refund|перевод.*от|зачислен/i.test(c)
      );
      type = hasIncomeKeyword ? "income" : "expense";
    }

    if (amount <= 0) continue;

    // Merchant: longest non-system cell, skipping header words
    const skipWords = /^(дата|дебет|кредит|остаток|операция|описание|категори|сумма|бонус|баланс|статус|тип|счёт|счет|время|период|карта)$/i;
    const merchantCandidates = allCells
      .filter((c) => !isSystemText(c) && !skipWords.test(c.trim()) && !SUMMARY_RE.test(c))
      .sort((a, b) => b.length - a.length);

    // Use the longest candidate; if none, fall back to "Транзакция"
    const rawMerchant = merchantCandidates[0]?.trim() ?? "";
    const merchant = cleanMerchant(rawMerchant) || `Транзакция ${dateStr}`;

    const import_hash = hashString(`${dateStr}${amount}${rawMerchant}`);
    if (seen.has(import_hash)) continue;
    seen.add(import_hash);

    console.debug("[TBank parser] txn:", { date: dateStr, amount, type, merchant, cells: allCells });

    transactions.push({
      date: dateStr,
      amount,
      type,
      description: merchant,
      merchant_name: merchant,
      import_hash,
    });
  }

  return transactions.sort((a, b) => b.date.localeCompare(a.date));
}

function cleanMerchant(raw: string): string {
  return raw
    // Strip leading Russian prepositions often found in T-Bank descriptions
    .replace(/^(в\s+|на\s+|по\s+|для\s+|от\s+)/i, "")
    .replace(/^(оплата|перевод|покупка|списание|оплата по карте|зачисление)[:\s]*/i, "")
    .replace(/^(ооо|оао|ип|пао|зао|nko)\s+/i, "")
    .replace(/\*\d{2,}$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}
