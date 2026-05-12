"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Trash2, PlusCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { createGoal, addToGoal, deleteGoal } from "@/app/actions/goals";
import { useProfile, useGoals } from "@/hooks/use-dashboard-data";
import type { Database } from "@/types/database";

type Goal = Database["public"]["Tables"]["goals"]["Row"];

const GOAL_ICONS = ["🎯", "✈️", "🏠", "🚗", "💍", "📱", "🎓", "🏖️", "💰", "🎸"];

export function GoalsClient() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addAmount, setAddAmount] = useState("");
  const [pending, setPending] = useState(false);

  const { data: profile } = useProfile();
  const { data: goals = [], isLoading } = useGoals(profile?.household_id ?? null);

  async function handleCreateGoal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const result = await createGoal(new FormData(e.currentTarget));
    setPending(false);
    if (result?.success) {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setShowForm(false);
    }
  }

  async function handleAddFunds(goalId: string) {
    const amount = parseFloat(addAmount);
    if (isNaN(amount) || amount <= 0) return;
    setPending(true);
    await addToGoal(goalId, amount);
    queryClient.invalidateQueries({ queryKey: ["goals"] });
    setPending(false);
    setAddingTo(null);
    setAddAmount("");
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить цель?")) return;
    await deleteGoal(id);
    queryClient.invalidateQueries({ queryKey: ["goals"] });
  }

  const typedGoals = goals as Goal[];
  const active = typedGoals.filter((g) => !g.is_completed);
  const completed = typedGoals.filter((g) => g.is_completed);

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Цели накоплений</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} /> Новая цель
        </button>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : (
        <>
          {!typedGoals.length && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-4xl mb-3">🎯</p>
                <p className="font-medium text-foreground mb-1">Поставьте первую цель</p>
                <p className="text-sm text-muted-foreground mb-4">Откладывайте на отпуск, машину или квартиру</p>
                <button onClick={() => setShowForm(true)} className="text-sm text-primary hover:underline">
                  Создать цель
                </button>
              </CardContent>
            </Card>
          )}

          {active.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-4">
              {active.map((g) => {
                const pct = (Number(g.current_amount) / Number(g.target_amount)) * 100;
                const remaining = Number(g.target_amount) - Number(g.current_amount);
                return (
                  <Card key={g.id}>
                    <CardContent className="pt-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{g.icon ?? "🎯"}</span>
                          <div>
                            <p className="font-semibold text-foreground">{g.name}</p>
                            {g.deadline && (
                              <p className="text-xs text-muted-foreground">до {formatDate(g.deadline, "long")}</p>
                            )}
                          </div>
                        </div>
                        <button onClick={() => handleDelete(g.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="font-semibold text-foreground">{formatCurrency(Number(g.current_amount))}</span>
                          <span className="text-muted-foreground">{formatCurrency(Number(g.target_amount))}</span>
                        </div>
                        <Progress value={Number(g.current_amount)} max={Number(g.target_amount)} barClassName="bg-success" />
                        <p className="text-xs text-muted-foreground">Осталось {formatCurrency(remaining)} · {Math.round(pct)}%</p>
                      </div>

                      {addingTo === g.id ? (
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={addAmount}
                            onChange={(e) => setAddAmount(e.target.value)}
                            placeholder="Сумма"
                            className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                          />
                          <button onClick={() => handleAddFunds(g.id)} disabled={pending} className="px-4 py-2 rounded-lg bg-success text-white text-sm font-medium hover:bg-success/90 disabled:opacity-60 transition-colors">+</button>
                          <button onClick={() => { setAddingTo(null); setAddAmount(""); }} className="px-3 py-2 rounded-lg border text-sm hover:bg-accent transition-colors">✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAddingTo(g.id)}
                          className="w-full py-2 rounded-lg border border-success/30 text-success text-sm font-medium hover:bg-success/10 transition-colors flex items-center justify-center gap-2"
                        >
                          <PlusCircle size={15} /> Пополнить
                        </button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">Выполнены</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {completed.map((g) => (
                  <Card key={g.id} className="opacity-60">
                    <CardContent className="pt-5">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{g.icon ?? "🎯"}</span>
                        <div>
                          <p className="font-medium text-foreground line-through">{g.name}</p>
                          <p className="text-xs text-success">Цель достигнута! 🎉</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-5">
            <h2 className="font-semibold text-foreground mb-4">Новая цель</h2>
            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Название цели</label>
                <input name="name" required className="w-full px-3 py-2.5 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Отпуск на море" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Нужная сумма, ₽</label>
                <input name="target_amount" type="number" min="1" required className="w-full px-3 py-2.5 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="150 000" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Дедлайн (необязательно)</label>
                <input name="deadline" type="date" className="w-full px-3 py-2.5 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Иконка</label>
                <div className="flex flex-wrap gap-2">
                  {GOAL_ICONS.map((icon) => (
                    <label key={icon} className="cursor-pointer">
                      <input type="radio" name="icon" value={icon} className="sr-only peer" defaultChecked={icon === "🎯"} />
                      <span className="text-2xl p-2 rounded-lg peer-checked:bg-primary/20 hover:bg-accent transition-colors block">{icon}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border text-sm font-medium hover:bg-accent transition-colors">Отмена</button>
                <button type="submit" disabled={pending} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
                  {pending ? "Создаём..." : "Создать цель"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
