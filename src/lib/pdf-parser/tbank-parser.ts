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

  return extractTransactions(allItems);
}

// ─── Column boundaries for T-Bank "Справка о движении средств" ───────────────
// x≈56:  operation date (DD.MM.YYYY) and time (HH:MM) on next row
// x≈199: amount with explicit sign (+/-) and period decimal, e.g. "-459.00"
// x≈389: description (may span multiple rows)
const COL_DATE   = { min: 40,  max: 115 }; // x=56
const COL_AMOUNT = { min: 185, max: 265 }; // x=199 (first amount column only)
const COL_DESC   = { min: 375, max: 499 }; // x=389

function inCol(x: number, col: { min: number; max: number }) {
  return x >= col.min && x < col.max;
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

const DATE_RE    = /^\d{2}\.\d{2}\.\d{4}$/;
// T-Bank amounts: explicit + or - sign, space thousands sep, period decimal
// e.g. "-459.00", "-2 000.00", "+1 657 344.41"
const SIGNED_AMOUNT_RE = /^[+-][\d\s]+\.\d{2}$/;

function parseDate(s: string): string | null {
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parseAmount(s: string): number {
  // "-2 000.00" → 2000.00
  return parseFloat(s.replace(/\s/g, "").replace(/[^0-9.]/g, "")) || 0;
}

function extractTransactions(allItems: TextItem[]): ParsedTransaction[] {
  const rows = groupByY(allItems);
  const seen = new Set<string>();
  const transactions: ParsedTransaction[] = [];

  // A row is a transaction anchor iff it has:
  //   1. A DD.MM.YYYY date in the date column (x≈56)
  //   2. A signed amount (+/-) in the amount column (x≈199)
  // This precisely excludes header rows (no amount) and summary rows (amount at x=126, not x=199)
  const anchorIndices: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const hasDate   = row.some(it => inCol(it.x, COL_DATE)   && DATE_RE.test(it.text));
    const hasAmount = row.some(it => inCol(it.x, COL_AMOUNT)  && SIGNED_AMOUNT_RE.test(it.text.replace(/\s/g, "")));
    if (hasDate && hasAmount) anchorIndices.push(i);
  }

  for (let ai = 0; ai < anchorIndices.length; ai++) {
    const startIdx = anchorIndices[ai];
    const endIdx   = anchorIndices[ai + 1] ?? rows.length;
    // Collect rows belonging to this transaction (up to 8, stop at next anchor)
    const txnRows  = rows.slice(startIdx, Math.min(startIdx + 8, endIdx));

    // ── Date ──────────────────────────────────────────────────────────────────
    const dateItem = txnRows[0].find(it => inCol(it.x, COL_DATE) && DATE_RE.test(it.text));
    if (!dateItem) continue;
    const dateStr = parseDate(dateItem.text);
    if (!dateStr) continue;

    // ── Amount + type ─────────────────────────────────────────────────────────
    const amtItem = txnRows[0].find(it => inCol(it.x, COL_AMOUNT) && SIGNED_AMOUNT_RE.test(it.text.replace(/\s/g, "")));
    if (!amtItem) continue;
    const amount = parseAmount(amtItem.text);
    if (amount <= 0) continue;
    const type: "income" | "expense" = amtItem.text.trim().startsWith("+") ? "income" : "expense";

    // ── Description: join all items from the description column ───────────────
    // Limit to rows within 60 y-units of the anchor to exclude page footers
    const anchorY = txnRows[0][0]?.y ?? 0;
    const descParts = txnRows
      .filter(row => row[0] && (row[0].y - anchorY) < 60)
      .flatMap(row => row.filter(it => inCol(it.x, COL_DESC)))
      .map(it => it.text.trim())
      .filter(Boolean);
    const rawDesc = descParts.join(" ");

    const merchant = cleanMerchant(rawDesc) || `Транзакция ${dateStr}`;

    const import_hash = hashString(`${dateStr}${amount}${rawDesc}`);
    if (seen.has(import_hash)) continue;
    seen.add(import_hash);

    transactions.push({ date: dateStr, amount, type, description: merchant, merchant_name: merchant, import_hash });
  }

  return transactions.sort((a, b) => b.date.localeCompare(a.date));
}

function cleanMerchant(raw: string): string {
  let s = raw.trim();

  // "Оплата в MERCHANT [City RUS]"  →  "MERCHANT"
  // "Покупка в MERCHANT"            →  "MERCHANT"
  // "Оплата услуг в MERCHANT"       →  "MERCHANT"
  const inMatch = s.match(/^(?:оплата(?:\s+услуг)?|покупка|списание)\s+в\s+(.+)/i);
  if (inMatch) {
    s = inMatch[1];
    // Strip trailing "City RUS" / "CITY RUS" (T-Bank appends city+country for foreign txns)
    s = s.replace(/\s+(?:\S+\s+)?RUS$/i, "").trim();
  } else if (/^(?:оплата)\s+услуг\s+/i.test(s)) {
    // "Оплата услуг mBank.MTS" → "mBank.MTS"
    s = s.replace(/^(?:оплата)\s+услуг\s+/i, "");
  } else if (/^пополнение/i.test(s)) {
    // "Пополнение. Система быстрых платежей" → "Пополнение СБП"
    s = /система\s+быстрых\s+платежей|СБП/i.test(s) ? "Пополнение СБП" : s.replace(/^пополнение[.:\s]*/i, "Пополнение: ");
  } else if (/^(?:внутрибанковский|внутренний)\s+перевод/i.test(s)) {
    // "Внутрибанковский перевод с договора N" → "Перевод договор N"
    s = s.replace(/^(?:внутрибанковский|внутренний)\s+перевод\s+(?:[сc]\s+|на\s+)?договора?\s*/i, "Перевод договор ");
  } else if (/^внешний\s+перевод\s+по\s+номеру\s+телефона/i.test(s)) {
    // "Внешний перевод по номеру телефона +7..." → "Перевод тел: +7..."
    s = s.replace(/^внешний\s+перевод\s+по\s+номеру\s+телефона\s*/i, "Перевод тел: ");
  }

  // Strip nested "оплата " prefix (T-Bank merchant names sometimes start with it)
  s = s.replace(/^оплата\s+/i, "");

  // Strip legal form prefix
  s = s.replace(/^(?:ооо|оао|зао|пао|ип)\s+/i, "");

  // Strip card-number suffix like "*1234"
  s = s.replace(/\*\d{2,}$/g, "");

  return s.replace(/\s+/g, " ").trim().slice(0, 100);
}
