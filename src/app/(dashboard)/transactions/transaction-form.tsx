"use client";

import { useActionState, useState } from "react";
import { createTransaction, updateTransaction } from "@/app/actions/transactions";
import { X } from "lucide-react";
import type { Database } from "@/types/database";

type Account = Database["public"]["Tables"]["accounts"]["Row"];
type Category = Database["public"]["Tables"]["categories"]["Row"];
type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

interface Props {
  accounts: Account[];
  categories: Category[];
  editTransaction?: Transaction | null;
  onClose: () => void;
}

export function TransactionForm({ accounts, categories, editTransaction, onClose }: Props) {
  const [txType, setTxType] = useState<"income" | "expense">(
    editTransaction?.type === "income" ? "income" : "expense"
  );

  const filteredCategories = categories.filter((c) => c.type === txType);

  const action = editTransaction
    ? updateTransaction.bind(null, editTransaction.id)
    : createTransaction;

  const [state, formAction, pending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      const result = await action(formData);
      if (result?.success) onClose();
      return result;
    },
    undefined
  );

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-foreground">
            {editTransaction ? "Изменить транзакцию" : "Новая транзакция"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <X size={18} />
          </button>
        </div>

        <form action={formAction} className="p-5 space-y-4">
          {state?.error && (
            <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3">
              {state.error}
            </div>
          )}

          {/* Type toggle */}
          <div className="flex rounded-xl border overflow-hidden bg-secondary p-1 gap-1">
            {(["expense", "income"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTxType(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  txType === t
                    ? "bg-white dark:bg-card shadow text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {t === "expense" ? "Расход" : "Доход"}
              </button>
            ))}
          </div>
          <input type="hidden" name="type" value={txType} />

          {/* Amount */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Сумма, ₽</label>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              defaultValue={editTransaction ? String(editTransaction.amount) : ""}
              className="w-full px-3 py-2.5 rounded-lg border bg-background text-foreground text-lg font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="0"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Описание</label>
            <input
              name="description"
              type="text"
              required
              defaultValue={editTransaction?.description ?? ""}
              className="w-full px-3 py-2.5 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Пятёрочка, Яндекс.Такси..."
            />
          </div>

          {/* Date */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Дата</label>
            <input
              name="date"
              type="date"
              required
              defaultValue={editTransaction?.date ?? today}
              className="w-full px-3 py-2.5 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Category */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Категория</label>
            <select
              name="category_id"
              defaultValue={editTransaction?.category_id ?? ""}
              className="w-full px-3 py-2.5 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Без категории</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Account */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Счёт</label>
            <select
              name="account_id"
              required
              defaultValue={editTransaction?.account_id ?? accounts[0]?.id ?? ""}
              className="w-full px-3 py-2.5 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Is shared */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              name="is_shared"
              type="checkbox"
              value="true"
              defaultChecked={editTransaction?.is_shared ?? false}
              className="w-4 h-4 rounded accent-primary"
            />
            <span className="text-sm text-foreground">Общая семейная трата</span>
          </label>

          <button
            type="submit"
            disabled={pending}
            className="w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {pending ? "Сохраняем..." : editTransaction ? "Сохранить" : "Добавить"}
          </button>
        </form>
      </div>
    </div>
  );
}
