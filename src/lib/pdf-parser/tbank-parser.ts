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

/**
 * Parses T-Bank PDF statement using coordinate-based text extraction.
 * Groups text items by their y-position to reconstruct table rows correctly.
 */
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
          // Normalize y: convert PDF bottom-up to top-down, offset by page
          y: (pageNum - 1) * 10000 + (pageHeight - item.transform[5]),
        });
      }
    }
  }

  return extractTransactions(allItems);
}

function groupByY(items: TextItem[], tolerance = 4): Array<TextItem[]> {
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
const TIME_RE = /^\d{2}:\d{2}$/;
const AMOUNT_RE = /^[-+]?\s*[\d\s]+,\d{2}$/;
const DATE_IN_TEXT_RE = /\b(\d{2})\.(\d{2})\.(\d{4})\b/;

function isDate(s: string) { return DATE_RE.test(s.trim()); }
function isTime(s: string) { return TIME_RE.test(s.trim()); }
function isAmount(s: string) { return AMOUNT_RE.test(s.trim().replace(/\s/g, "")); }
function isSystemText(s: string) {
  return (
    isDate(s) || isTime(s) || isAmount(s) ||
    /^[+-]?\s*\d[\d\s]*$/.test(s) || // plain number
    s.length <= 1
  );
}

function parseAmount(s: string): number {
  return parseFloat(s.replace(/[^0-9,]/g, "").replace(",", ".")) || 0;
}

function parseDate(s: string): string | null {
  const m = s.match(DATE_IN_TEXT_RE);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function extractTransactions(allItems: TextItem[]): ParsedTransaction[] {
  const rows = groupByY(allItems);
  const seen = new Set<string>();
  const transactions: ParsedTransaction[] = [];

  // Find all rows that contain a date — these are transaction anchor rows
  const dateRowIndices: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const hasDate = rows[i].some((it) => isDate(it.text) || DATE_IN_TEXT_RE.test(it.text));
    if (hasDate) dateRowIndices.push(i);
  }

  for (let di = 0; di < dateRowIndices.length; di++) {
    const anchorIdx = dateRowIndices[di];
    // Collect all rows that belong to this transaction (until next date row)
    const nextAnchorIdx = dateRowIndices[di + 1] ?? rows.length;
    const txnRows = rows.slice(anchorIdx, Math.min(anchorIdx + 5, nextAnchorIdx));

    // Flatten all cells
    const allCells = txnRows.flatMap((r) => r.map((it) => it.text));

    // Find date
    let dateStr: string | null = null;
    for (const cell of allCells) {
      dateStr = parseDate(cell);
      if (dateStr) break;
    }
    if (!dateStr) continue;

    // Find amounts (could be debit/credit columns)
    const amounts: Array<{ value: number; raw: string }> = [];
    for (const cell of allCells) {
      const clean = cell.replace(/\s/g, "");
      if (AMOUNT_RE.test(clean)) {
        const v = parseAmount(cell);
        if (v > 0) amounts.push({ value: v, raw: cell });
      }
    }
    if (!amounts.length) continue;

    // Determine type: T-Bank uses separate debit/credit columns
    // Look for sign in the cell text
    let amount = 0;
    let type: "income" | "expense" = "expense";

    const signedAmount = allCells.find((c) => /^[-+]/.test(c.trim()) && AMOUNT_RE.test(c.replace(/\s/g, "")));
    if (signedAmount) {
      amount = parseAmount(signedAmount);
      type = signedAmount.trim().startsWith("+") ? "income" : "expense";
    } else {
      // No sign: T-Bank puts debit in one column, credit in another
      // Strategy: use position — debit column (expense) is usually before credit (income)
      // Use the first amount found; determine type by context
      amount = amounts[0].value;
      // Check for income keywords in adjacent cells
      const hasIncomeKeyword = allCells.some((c) =>
        /зарплат|аванс|пополнен|cashback|кэшбэк|процент|начислен|возврат|refund|перевод.*от/i.test(c)
      );
      type = hasIncomeKeyword ? "income" : "expense";
    }

    if (amount <= 0) continue;

    // Find merchant: the longest text cell that isn't a date/time/amount/system text
    // and isn't from the header area (skip "Дата", "Операция", etc.)
    const skipWords = /^(дата|дебет|кредит|остаток|операция|описание|категори|сумма|бонус|баланс|статус|тип|счёт|счет)$/i;
    const merchants = allCells
      .filter((c) => !isSystemText(c) && !skipWords.test(c.trim()))
      .sort((a, b) => b.length - a.length);

    const merchant = merchants[0]?.trim() ?? "";
    if (!merchant || merchant.length < 2) continue;

    const import_hash = hashString(`${dateStr}${amount}${merchant}`);
    if (seen.has(import_hash)) continue;
    seen.add(import_hash);

    const cleaned = cleanMerchant(merchant);
    transactions.push({
      date: dateStr,
      amount,
      type,
      description: cleaned,
      merchant_name: cleaned,
      import_hash,
    });
  }

  return transactions.sort((a, b) => b.date.localeCompare(a.date));
}

function cleanMerchant(raw: string): string {
  return raw
    .replace(/^(оплата|перевод|покупка|списание|оплата по карте)[:\s]*/i, "")
    .replace(/^(ооо|оао|ип|пао|зао)\s+/i, "")
    .replace(/\*\d{2,}$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}
