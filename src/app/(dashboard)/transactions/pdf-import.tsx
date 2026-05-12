"use client";

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, Upload, Check, AlertCircle, RefreshCw } from "lucide-react";
import { parseTBankPDF, type ParsedTransaction } from "@/lib/pdf-parser/tbank-parser";
import { bulkImportTransactions } from "@/app/actions/transactions";
import { formatCurrency } from "@/lib/utils";
import type { Database } from "@/types/database";

type Account = Database["public"]["Tables"]["accounts"]["Row"];
type Category = Database["public"]["Tables"]["categories"]["Row"];

interface Props {
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
}

type ImportState = "idle" | "parsing" | "categorizing" | "preview" | "importing" | "done";

interface PreviewRow extends ParsedTransaction {
  category_id: string | null;
  category_name: string | null;
}

export function PdfImport({ accounts, categories, onClose }: Props) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ImportState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [selectedAccount, setSelectedAccount] = useState(accounts[0]?.id ?? "");
  const [importedCount, setImportedCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Пожалуйста, загрузите PDF-файл");
      return;
    }

    setError(null);
    setState("parsing");

    try {
      const parsed = await parseTBankPDF(file);
      if (!parsed.length) {
        setError("Не удалось найти транзакции в файле. Убедитесь, что это выписка Т-Банка.");
        setState("idle");
        return;
      }

      setState("categorizing");

      // AI categorization
      const merchants = parsed.map((t) => t.merchant_name);
      let categoryMap: Record<string, string | null> = {};

      try {
        const resp = await fetch("/api/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ merchants, categories }),
        });
        if (resp.ok) {
          const data = await resp.json() as { results: Array<{ merchant: string; category: string | null }> };
          for (const r of data.results) categoryMap[r.merchant] = r.category;
        }
      } catch {
        // Proceed without AI categories
      }

      const preview: PreviewRow[] = parsed.map((t) => {
        const catName = categoryMap[t.merchant_name] ?? null;
        const cat = categories.find((c) => c.name === catName) ?? null;
        return {
          ...t,
          category_id: cat?.id ?? null,
          category_name: cat?.name ?? null,
        };
      });

      setRows(preview);
      setState("preview");
    } catch (err) {
      setError("Ошибка при чтении файла. Попробуйте другой PDF.");
      setState("idle");
    }
  }

  async function handleImport() {
    if (!selectedAccount) { setError("Выберите счёт"); return; }
    setState("importing");

    const result = await bulkImportTransactions(
      rows.map((r) => ({
        account_id: selectedAccount,
        amount: r.amount,
        description: r.description,
        merchant_name: r.merchant_name,
        date: r.date,
        type: r.type,
        import_hash: r.import_hash,
        category_id: r.category_id,
      }))
    );

    if (result.error) {
      setError(result.error);
      setState("preview");
      return;
    }

    setImportedCount(result.imported ?? 0);
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["monthSpending"] });
    setState("done");
  }

  function updateCategory(idx: number, categoryId: string) {
    setRows((prev) => {
      const next = [...prev];
      const cat = categories.find((c) => c.id === categoryId);
      next[idx] = { ...next[idx], category_id: categoryId || null, category_name: cat?.name ?? null };
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h2 className="font-semibold text-foreground">Импорт выписки Т-Банка</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Privacy notice */}
          <div className="flex gap-3 p-3 bg-success/10 border border-success/20 rounded-xl text-sm text-success">
            <Check size={16} className="shrink-0 mt-0.5" />
            <span>
              <strong>Приватно:</strong> PDF обрабатывается прямо в браузере. Файл не покидает ваше устройство.
            </span>
          </div>

          {error && (
            <div className="flex gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Idle: upload zone */}
          {state === "idle" && (
            <>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) handleFile(f);
                }}
                className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <Upload size={32} className="mx-auto text-muted-foreground mb-3" />
                <p className="font-medium text-foreground">Перетащите PDF или нажмите для выбора</p>
                <p className="text-sm text-muted-foreground mt-1">Выписка Т-Банка в формате PDF</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Счёт для импорта</label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Loading states */}
          {(state === "parsing" || state === "categorizing") && (
            <div className="text-center py-10">
              <RefreshCw size={32} className="mx-auto text-primary animate-spin mb-3" />
              <p className="font-medium text-foreground">
                {state === "parsing" ? "Читаем PDF..." : "Определяем категории..."}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {state === "parsing"
                  ? "Файл обрабатывается на вашем устройстве"
                  : "AI анализирует названия магазинов"}
              </p>
            </div>
          )}

          {/* Preview */}
          {state === "preview" && (
            <>
              <p className="text-sm text-muted-foreground">
                Найдено транзакций: <strong className="text-foreground">{rows.length}</strong>.
                Проверьте и скорректируйте категории при необходимости.
              </p>
              <div className="divide-y border rounded-xl overflow-hidden">
                {rows.map((row, i) => (
                  <div key={row.import_hash} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{row.merchant_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(row.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <select
                      value={row.category_id ?? ""}
                      onChange={(e) => updateCategory(i, e.target.value)}
                      className="text-xs px-2 py-1.5 rounded-lg border bg-background max-w-36 focus:outline-none"
                    >
                      <option value="">Без категории</option>
                      {categories.filter((c) => c.type === row.type).map((c) => (
                        <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                      ))}
                    </select>
                    <span
                      className={`text-sm font-semibold shrink-0 ${
                        row.type === "income" ? "text-success" : "text-foreground"
                      }`}
                    >
                      {row.type === "income" ? "+" : "−"}{formatCurrency(row.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Done */}
          {state === "done" && (
            <div className="text-center py-10">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-success" />
              </div>
              <p className="text-xl font-semibold text-foreground">Импорт завершён!</p>
              <p className="text-muted-foreground mt-1">
                Загружено транзакций: <strong>{importedCount}</strong>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {state === "preview" && (
          <div className="px-5 py-4 border-t shrink-0 flex gap-3">
            <button
              onClick={() => setState("idle")}
              className="flex-1 py-2.5 rounded-xl border text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Назад
            </button>
            <button
              onClick={handleImport}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Импортировать {rows.length} транзакций
            </button>
          </div>
        )}

        {state === "done" && (
          <div className="px-5 py-4 border-t shrink-0">
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Готово
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
