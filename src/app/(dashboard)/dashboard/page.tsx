import { createClient } from "@/lib/supabase/server";
import { formatCurrency, getMonthBounds, daysLeftInMonth } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingDown, TrendingUp, Wallet, ArrowRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Database } from "@/types/database";

type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];
type BudgetRow = Database["public"]["Tables"]["budgets"]["Row"] & {
  category: { name: string; color: string; icon: string | null } | null;
};
type GoalRow = Database["public"]["Tables"]["goals"]["Row"];
type TxnRow = Database["public"]["Tables"]["transactions"]["Row"] & {
  category: { name: string; color: string; icon: string | null } | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("user_id", user.id)
    .single();

  const profile = profileData as { household_id: string | null } | null;

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

  const { start, end } = getMonthBounds();
  const startStr = start.toISOString().split("T")[0];
  const endStr = end.toISOString().split("T")[0];

  const { data: accountsData } = await supabase
    .from("accounts")
    .select("id, balance")
    .eq("household_id", profile.household_id);

  const accounts = (accountsData ?? []) as Pick<AccountRow, "id" | "balance">[];
  const accountIds = accounts.map((a) => a.id);

  const { data: txnsData } = accountIds.length
    ? await supabase
        .from("transactions")
        .select("amount, type")
        .in("account_id", accountIds)
        .gte("date", startStr)
        .lte("date", endStr)
    : { data: [] };

  const txns = (txnsData ?? []) as Pick<Database["public"]["Tables"]["transactions"]["Row"], "amount" | "type">[];

  const income = txns.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expenses = txns.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);

  const { data: budgetsData } = await supabase
    .from("budgets")
    .select(`id, category_id, amount, category:categories(name, color, icon)`)
    .eq("household_id", profile.household_id)
    .eq("period", "monthly");

  const budgets = (budgetsData ?? []) as unknown as BudgetRow[];

  const { data: catSpendingData } = accountIds.length
    ? await supabase
        .from("transactions")
        .select("category_id, amount")
        .in("account_id", accountIds)
        .gte("date", startStr)
        .lte("date", endStr)
        .eq("type", "expense")
    : { data: [] };

  const catSpending = (catSpendingData ?? []) as Pick<Database["public"]["Tables"]["transactions"]["Row"], "category_id" | "amount">[];

  const spendingMap = catSpending.reduce<Record<string, number>>((acc, t) => {
    if (t.category_id) acc[t.category_id] = (acc[t.category_id] ?? 0) + Number(t.amount);
    return acc;
  }, {});

  const { data: goalsData } = await supabase
    .from("goals")
    .select("id, name, icon, current_amount, target_amount")
    .eq("household_id", profile.household_id)
    .eq("is_completed", false)
    .order("created_at", { ascending: false })
    .limit(3);

  const goals = (goalsData ?? []) as Pick<GoalRow, "id" | "name" | "icon" | "current_amount" | "target_amount">[];

  const { data: recentData } = accountIds.length
    ? await supabase
        .from("transactions")
        .select(`id, amount, type, date, description, merchant_name, category:categories(name, color, icon)`)
        .in("account_id", accountIds)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5)
    : { data: [] };

  const recentTxns = (recentData ?? []) as unknown as TxnRow[];

  const daysLeft = daysLeftInMonth();
  const dailyBurn = expenses / (new Date().getDate() || 1);
  const forecast = expenses + dailyBurn * daysLeft;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Дашборд</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}
        </p>
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
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Доходы</span>
              <TrendingUp size={16} className="text-success" />
            </div>
            <p className="text-2xl font-bold text-success">{formatCurrency(income)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Прогноз</span>
              <span className="text-xs text-muted-foreground">{daysLeft}д</span>
            </div>
            <p className="text-2xl font-bold text-warning">{formatCurrency(forecast)}</p>
            <p className="text-xs text-muted-foreground mt-1">к концу месяца</p>
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
            {!budgets.length ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">Бюджеты не созданы</p>
                <Link href="/budgets" className="text-xs text-primary hover:underline">Создать первый бюджет</Link>
              </div>
            ) : (
              <div className="space-y-4">
                {budgets.slice(0, 5).map((b) => {
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
            {!goals.length ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">Целей нет</p>
                <Link href="/goals" className="text-xs text-primary hover:underline">Создать цель</Link>
              </div>
            ) : (
              <div className="space-y-4">
                {goals.map((g) => {
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
          {!recentTxns.length ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-3">Транзакций пока нет</p>
              <Link href="/transactions" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Добавить первую транзакцию <ArrowRight size={12} />
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {recentTxns.map((t) => (
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
                      {t.category?.name ?? "Без категории"} · {new Date(t.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
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
