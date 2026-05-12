"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import { upsertBudget, deleteBudget } from "@/app/actions/budgets";
import type { Database } from "@/types/database";

type Budget = Database["public"]["Tables"]["budgets"]["Row"] & {
  category: { name: string; color: string; icon: string | null } | null;
};
type Category = Database["public"]["Tables"]["categories"]["Row"];

interface Props {
  budgets: Budget[];
  categories: Category[];
  spendingMap: Record<string, number>;
}

export function BudgetsClient({ budgets, categories, spendingMap }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await upsertBudget(fd);
    setPending(false);
    if (result?.error) { setError(result.error); return; }
    setShowForm(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить бюджет?")) return;
    await deleteBudget(id);
  }

  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = budgets.reduce((s, b) => s + (spendingMap[b.category_id] ?? 0), 0);

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Бюджеты</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          Добавить бюджет
        </button>
      </div>

      {/* Summary */}
      {budgets.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Суммарный бюджет</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totalBudget)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Потрачено</p>
              <p className={`text-2xl font-bold ${totalSpent > totalBudget ? "text-destructive" : "text-foreground"}`}>
                {formatCurrency(totalSpent)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Budgets list */}
      {!budgets.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-3">Бюджеты не настроены</p>
            <button
              onClick={() => setShowForm(true)}
              className="text-sm text-primary hover:underline"
            >
              Создать первый бюджет
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {budgets.map((b) => {
            const spent = spendingMap[b.category_id] ?? 0;
            const pct = (spent / Number(b.amount)) * 100;
            const over = pct > 100;
            const remaining = Number(b.amount) - spent;
            return (
              <Card key={b.id}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{(b.category as any)?.icon ?? "📁"}</span>
                      <div>
                        <p className="font-medium text-foreground">{(b.category as any)?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground capitalize">{b.period === "monthly" ? "В месяц" : "В год"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${over ? "text-destructive" : "text-muted-foreground"}`}>
                        {formatCurrency(spent)} / {formatCurrency(Number(b.amount))}
                      </span>
                      <button
                        onClick={() => handleDelete(b.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <Progress
                    value={spent}
                    max={Number(b.amount)}
                    barClassName={over ? "bg-destructive" : pct > 80 ? "bg-warning" : "bg-primary"}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {over
                      ? `Превышение: ${formatCurrency(Math.abs(remaining))}`
                      : `Осталось: ${formatCurrency(remaining)}`}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add budget form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-5">
            <h2 className="font-semibold text-foreground mb-4">Новый бюджет</h2>
            {error && (
              <div className="mb-4 bg-destructive/10 text-destructive text-sm rounded-lg p-3">{error}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Категория</label>
                <select name="category_id" required className="w-full px-3 py-2.5 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Лимит, ₽</label>
                <input name="amount" type="number" min="1" required className="w-full px-3 py-2.5 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="10 000" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Период</label>
                <select name="period" className="w-full px-3 py-2.5 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="monthly">Ежемесячный</option>
                  <option value="yearly">Ежегодный</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border text-sm font-medium hover:bg-accent transition-colors">Отмена</button>
                <button type="submit" disabled={pending} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
                  {pending ? "Сохраняем..." : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
