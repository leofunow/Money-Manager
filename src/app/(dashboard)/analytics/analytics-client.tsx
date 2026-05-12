"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, daysLeftInMonth } from "@/lib/utils";
import { useMemo, useState } from "react";
import { useProfile, useAccounts, useAnalyticsTransactions } from "@/hooks/use-dashboard-data";

const MONTH_NAMES = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

export function AnalyticsClient() {
  const [activeMonth, setActiveMonth] = useState<number | null>(null);

  const { data: profile } = useProfile();
  const { data: accounts = [] } = useAccounts(profile?.household_id ?? null);
  const accountIds = accounts.map((a) => a.id);
  const { data: transactions = [], isLoading } = useAnalyticsTransactions(accountIds);

  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; income: number; expenses: number; key: string }> = {};
    for (const t of transactions) {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map[key]) map[key] = { key, month: MONTH_NAMES[d.getMonth()], income: 0, expenses: 0 };
      if (t.type === "income") map[key].income += Number(t.amount);
      if (t.type === "expense") map[key].expenses += Number(t.amount);
    }
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [transactions]);

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const selectedKey = activeMonth !== null ? monthlyData[activeMonth]?.key : currentMonthKey;

  const categoryData = useMemo(() => {
    const map: Record<string, { name: string; color: string; icon: string; value: number }> = {};
    for (const t of transactions) {
      if (t.type !== "expense") continue;
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (key !== selectedKey) continue;
      const catName = (t as { category?: { name?: string } | null }).category?.name ?? "Без категории";
      if (!map[catName]) {
        map[catName] = {
          name: catName,
          color: (t as { category?: { color?: string } | null }).category?.color ?? "#94a3b8",
          icon: (t as { category?: { icon?: string | null } | null }).category?.icon ?? "💳",
          value: 0,
        };
      }
      map[catName].value += Number(t.amount);
    }
    return Object.values(map).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [transactions, selectedKey]);

  const trendData = useMemo(() => monthlyData.map((m) => ({ ...m, savings: m.income - m.expenses })), [monthlyData]);

  const currentMonthData = monthlyData.find((m) => m.key === currentMonthKey);
  const daysLeft = daysLeftInMonth();
  const daysPassed = new Date().getDate();
  const dailyBurn = (currentMonthData?.expenses ?? 0) / daysPassed;
  const forecast = (currentMonthData?.expenses ?? 0) + dailyBurn * daysLeft;

  const totalIncome6m = monthlyData.reduce((s, m) => s + m.income, 0);
  const totalExpenses6m = monthlyData.reduce((s, m) => s + m.expenses, 0);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-semibold text-foreground">Аналитика</h1>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-64" />
          <div className="grid lg:grid-cols-2 gap-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card><CardContent className="pt-5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Доходы (6мес)</p>
              <p className="text-xl font-bold text-success">{formatCurrency(totalIncome6m)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Расходы (6мес)</p>
              <p className="text-xl font-bold text-destructive">{formatCurrency(totalExpenses6m)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Сэкономлено</p>
              <p className={`text-xl font-bold ${totalIncome6m - totalExpenses6m >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(totalIncome6m - totalExpenses6m)}
              </p>
            </CardContent></Card>
            <Card><CardContent className="pt-5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Прогноз месяца</p>
              <p className="text-xl font-bold text-warning">{formatCurrency(forecast)}</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Сравнение месяцев</CardTitle></CardHeader>
            <CardContent>
              {!monthlyData.length ? (
                <p className="text-sm text-muted-foreground text-center py-8">Нет данных</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthlyData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}к`} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v) => formatCurrency(Number(v))} />
                    <Bar dataKey="income" name="Доходы" fill="var(--success)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Расходы" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Расходы по категориям</CardTitle></CardHeader>
              <CardContent>
                {!categoryData.length ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Нет данных за этот месяц</p>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <ResponsiveContainer width={180} height={180}>
                      <PieChart>
                        <Pie data={categoryData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                          {categoryData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v) => formatCurrency(Number(v))} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2">
                      {categoryData.map((c, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: c.color }} />
                          <span className="text-sm text-foreground flex-1 truncate">{c.icon} {c.name}</span>
                          <span className="text-sm font-medium text-foreground shrink-0">{formatCurrency(c.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Тренд накоплений</CardTitle></CardHeader>
              <CardContent>
                {!trendData.length ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Нет данных</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}к`} />
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v) => formatCurrency(Number(v))} />
                      <Line type="monotone" dataKey="expenses" name="Расходы" stroke="var(--destructive)" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="income" name="Доходы" stroke="var(--success)" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="savings" name="Накопления" stroke="var(--primary)" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
