"use client";

import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingDown, TrendingUp, Wallet, ArrowRight } from "lucide-react";
import Link from "next/link";
import {
  useProfile,
  useAccounts,
  useBudgets,
  useGoals,
  useTransactions,
  useLast30DaysSpending,
} from "@/hooks/use-dashboard-data";

export function DashboardClient() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const householdId = profile?.household_id ?? null;

  const { data: accounts = [], isLoading: accountsLoading } = useAccounts(householdId);
  const accountIds = accounts.map((a) => a.id);

  const { data: monthTxns = [], isLoading: monthLoading } = useLast30DaysSpending(accountIds);
  const { data: budgets = [], isLoading: budgetsLoading } = useBudgets(householdId);
  const { data: goals = [], isLoading: goalsLoading } = useGoals(householdId);
  const { data: recentTxns = [], isLoading: recentLoading } = useTransactions(accountIds);

  const isLoading = profileLoading || accountsLoading;

  if (isLoading) return <DashboardSkeleton />;

  if (!profile?.household_id) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="text-center py-16">
          <div className="text-5xl mb-4">👋</div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Добро пожаловать!</h1>
          <p className="text-muted-foreground mb-6">
            Для начала создайте домохозяйство — это группа вашей семьи.
          </p>
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-primary/90 transition-colors"
          >
            Создать домохозяйство <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  const income = monthTxns.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expenses = monthTxns.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);

  const spendingMap = monthTxns
    .filter((t) => t.type === "expense")
    .reduce<Record<string, number>>((acc, t) => {
      const catId = (t as { category_id?: string | null }).category_id;
      if (catId) acc[catId] = (acc[catId] ?? 0) + Number(t.amount);
      return acc;
    }, {});

  const dailyAvg = expenses / 30;

  const top5Recent = (recentTxns as unknown as Array<{
    id: string; amount: number; type: string; date: string;
    description: string; merchant_name: string | null;
    category: { name: string; color: string; icon: string | null } | null;
  }>).slice(0, 5);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Дашборд</h1>
        <p className="text-sm text-muted-foreground">последние 30 дней</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Баланс</span>
              <Wallet size={16} className="text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(totalBalance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Расходы</span>
              <TrendingDown size={16} className="text-destructive" />
            </div>
            <p className="text-2xl font-bold text-destructive">{formatCurrency(expenses)}</p>
            <p className="text-xs text-muted-foreground mt-1">за 30 дней</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Доходы</span>
              <TrendingUp size={16} className="text-success" />
            </div>
            <p className="text-2xl font-bold text-success">{formatCurrency(income)}</p>
            <p className="text-xs text-muted-foreground mt-1">за 30 дней</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">В день</span>
              <span className="text-xs text-muted-foreground">avg</span>
            </div>
            <p className="text-2xl font-bold text-warning">{formatCurrency(dailyAvg)}</p>
            <p className="text-xs text-muted-foreground mt-1">средний расход</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Budgets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Бюджеты</CardTitle>
            <Link href="/budgets" className="text-xs text-primary hover:underline">Все</Link>
          </CardHeader>
          <CardContent>
            {budgetsLoading ? (
              <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : !budgets.length ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">Бюджеты не созданы</p>
                <Link href="/budgets" className="text-xs text-primary hover:underline">Создать первый бюджет</Link>
              </div>
            ) : (
              <div className="space-y-4">
                {(budgets as unknown as Array<{
                  id: string; category_id: string; amount: number;
                  category: { name: string; color: string; icon: string | null } | null;
                }>).slice(0, 5).map((b) => {
                  const spent = spendingMap[b.category_id] ?? 0;
                  const over = spent > Number(b.amount);
                  return (
                    <div key={b.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{b.category?.icon ?? "📁"}</span>
                          <span className="text-sm font-medium text-foreground">{b.category?.name ?? "—"}</span>
                        </div>
                        <span className={`text-xs font-medium ${over ? "text-destructive" : "text-muted-foreground"}`}>
                          {formatCurrency(spent)} / {formatCurrency(Number(b.amount))}
                        </span>
                      </div>
                      <Progress value={spent} max={Number(b.amount)} barClassName={over ? "bg-destructive" : "bg-primary"} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Goals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Цели</CardTitle>
            <Link href="/goals" className="text-xs text-primary hover:underline">Все</Link>
          </CardHeader>
          <CardContent>
            {goalsLoading ? (
              <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : !goals.length ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">Целей нет</p>
                <Link href="/goals" className="text-xs text-primary hover:underline">Создать цель</Link>
              </div>
            ) : (
              <div className="space-y-4">
                {(goals as unknown as Array<{
                  id: string; name: string; icon: string | null;
                  current_amount: number; target_amount: number; is_completed: boolean;
                }>).slice(0, 3).filter((g) => !g.is_completed).map((g) => {
                  const pct = (Number(g.current_amount) / Number(g.target_amount)) * 100;
                  return (
                    <div key={g.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{g.icon ?? "🎯"}</span>
                          <span className="text-sm font-medium text-foreground">{g.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{Math.round(pct)}%</span>
                      </div>
                      <Progress value={Number(g.current_amount)} max={Number(g.target_amount)} barClassName="bg-success" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatCurrency(Number(g.current_amount))} из {formatCurrency(Number(g.target_amount))}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Последние транзакции</CardTitle>
          <Link href="/transactions" className="text-xs text-primary hover:underline">Все</Link>
        </CardHeader>
        <CardContent>
          {recentLoading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : !top5Recent.length ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-3">Транзакций пока нет</p>
              <Link href="/transactions" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Добавить первую транзакцию <ArrowRight size={12} />
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {top5Recent.map((t) => (
                <div key={t.id} className="py-3 flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                    style={{ backgroundColor: `${t.category?.color ?? "#94a3b8"}20` }}
                  >
                    {t.category?.icon ?? "💳"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{t.merchant_name || t.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.category?.name ?? "Без категории"} ·{" "}
                      {new Date(t.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold shrink-0 ${t.type === "income" ? "text-success" : "text-foreground"}`}>
                    {t.type === "income" ? "+" : "−"}{formatCurrency(Number(t.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="space-y-1">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="pt-5"><Skeleton className="h-16" /></CardContent></Card>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card><CardContent className="pt-5 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</CardContent></Card>
        <Card><CardContent className="pt-5 space-y-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</CardContent></Card>
      </div>
    </div>
  );
}
