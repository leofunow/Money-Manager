"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { Plus, Upload, Search, Trash2, Edit2 } from "lucide-react";
import { TransactionForm } from "./transaction-form";
import { PdfImport } from "./pdf-import";
import { deleteTransaction } from "@/app/actions/transactions";
import { useQueryClient } from "@tanstack/react-query";
import {
  useProfile,
  useAccounts,
  useCategories,
  useTransactions,
} from "@/hooks/use-dashboard-data";
import type { Database } from "@/types/database";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"] & {
  category: { name: string; color: string; icon: string | null } | null;
  account: { name: string } | null;
};
type Account = Database["public"]["Tables"]["accounts"]["Row"];
type Category = Database["public"]["Tables"]["categories"]["Row"];

export function TransactionsClient() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");

  const { data: profile } = useProfile();
  const householdId = profile?.household_id ?? null;
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts(householdId);
  const accountIds = accounts.map((a) => a.id);
  const { data: categories = [] } = useCategories(householdId);
  const { data: transactions = [], isLoading: txLoading } = useTransactions(accountIds);

  const isLoading = !profile || accountsLoading;

  const filtered = (transactions as unknown as Transaction[]).filter((t) => {
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.description.toLowerCase().includes(q) ||
        (t.merchant_name ?? "").toLowerCase().includes(q) ||
        (t.category?.name ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  async function handleDelete(id: string) {
    if (!confirm("Удалить транзакцию?")) return;
    await deleteTransaction(id);
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["monthSpending"] });
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Транзакции</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <Upload size={16} />
            <span className="hidden sm:block">Импорт PDF</span>
          </button>
          <button
            onClick={() => { setEditTx(null); setShowForm(true); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} />
            <span className="hidden sm:block">Добавить</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="flex rounded-lg border overflow-hidden bg-background">
          {(["all", "expense", "income"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setTypeFilter(v)}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                typeFilter === v ? "bg-primary text-white" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {v === "all" ? "Все" : v === "expense" ? "Расходы" : "Доходы"}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions list */}
      <Card>
        <CardContent className="p-0">
          {isLoading || txLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : !filtered.length ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Транзакций не найдено
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-5 py-3.5 group hover:bg-accent/50 transition-colors">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                    style={{ backgroundColor: `${t.category?.color ?? "#94a3b8"}20` }}
                  >
                    {t.category?.icon ?? "💳"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {t.merchant_name || t.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.category?.name ?? "Без категории"} · {t.account?.name ?? "—"} ·{" "}
                      {new Date(t.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                      {t.is_shared && " · Общая"}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold shrink-0 ${t.type === "income" ? "text-success" : "text-foreground"}`}>
                    {t.type === "income" ? "+" : "−"}{formatCurrency(Number(t.amount))}
                  </span>
                  <div className="hidden group-hover:flex items-center gap-1">
                    <button
                      onClick={() => { setEditTx(t); setShowForm(true); }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <TransactionForm
          accounts={accounts as Account[]}
          categories={categories as Category[]}
          editTransaction={editTx}
          onClose={() => { setShowForm(false); setEditTx(null); }}
        />
      )}

      {showImport && (
        <PdfImport
          accounts={accounts as Account[]}
          categories={categories as Category[]}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
