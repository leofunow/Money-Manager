import { hashString } from "@/lib/utils";

export interface ParsedTransaction {
  date: string;
  amount: number;
  type: "income" | "expense";
  description: string;
  merchant_name: string;
  import_hash: string;
}

/**
 * Parses T-Bank (Tinkoff) PDF bank statement.
 * The PDF is read entirely in the browser via pdf.js — no data leaves the device.
 *
 * T-Bank statement format (typical rows):
 *   DD.MM.YYYY  Merchant Name  -X XXX,XX ₽  Category
 *   DD.MM.YYYY  Merchant Name  +X XXX,XX ₽  Category
 */
export async function parseTBankPDF(file: File): Promise<ParsedTransaction[]> {
  const pdfjsLib = await import("pdfjs-dist");

  // Use local worker to avoid CDN dependency
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const lines: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    lines.push(pageText);
  }

  const fullText = lines.join("\n");
  return extractTransactions(fullText);
}

function extractTransactions(text: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  // Pattern 1: DD.MM.YYYY followed by description and amount
  // Handles: "15.01.2024  Пятёрочка  -520,00" and "15.01.2024  Зарплата  +45 000,00"
  const patterns = [
    // Standard T-Bank format: date, merchant, signed amount
    /(\d{2}\.\d{2}\.\d{4})\s+(.+?)\s+([-+][\d\s]+[\d,]+)\s*(?:₽|RUB)?/gm,
    // Alternative: date, amount, merchant
    /(\d{2}\.\d{2}\.\d{4})\s+([-+][\d\s]+[\d,]+)\s*(?:₽|RUB)?\s+(.+?)(?=\d{2}\.\d{2}\.\d{4}|$)/gm,
  ];

  const seen = new Set<string>();

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;

    while ((match = pattern.exec(text)) !== null) {
      try {
        const [, dateStr, part1, part2] = match;

        let amountStr: string;
        let merchant: string;

        // Determine which group has the amount
        if (/^[-+]/.test(part1)) {
          amountStr = part1;
          merchant = part2?.trim() ?? "";
        } else {
          amountStr = part2;
          merchant = part1?.trim() ?? "";
        }

        const isNegative = amountStr.startsWith("-");
        const numStr = amountStr.replace(/[^0-9,]/g, "").replace(",", ".");
        const amount = parseFloat(numStr);

        if (isNaN(amount) || amount <= 0) continue;

        // Parse date: DD.MM.YYYY → YYYY-MM-DD
        const [dd, mm, yyyy] = dateStr.split(".");
        const date = `${yyyy}-${mm}-${dd}`;

        // Clean merchant name
        merchant = cleanMerchantName(merchant);
        if (!merchant || merchant.length < 2) continue;

        const type: "income" | "expense" = isNegative ? "expense" : "income";
        const import_hash = hashString(`${date}${amount}${merchant}`);

        if (seen.has(import_hash)) continue;
        seen.add(import_hash);

        transactions.push({
          date,
          amount,
          type,
          description: merchant,
          merchant_name: merchant,
          import_hash,
        });
      } catch {
        // Skip malformed lines
      }
    }
  }

  // Sort by date descending
  return transactions.sort((a, b) => b.date.localeCompare(a.date));
}

function cleanMerchantName(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/^[^а-яёА-ЯЁa-zA-Z0-9]+|[^а-яёА-ЯЁa-zA-Z0-9]+$/g, "")
    .trim()
    .slice(0, 100);
}
