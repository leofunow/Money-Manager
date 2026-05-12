"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createHousehold, createAccount } from "@/app/actions/household";
import { Plus, Users, CreditCard, User, Copy, Check } from "lucide-react";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"] & {
  household?: { id: string; name: string } | null;
};
type Account = Database["public"]["Tables"]["accounts"]["Row"];

interface Props {
  profile: Profile | null;
  accounts: Account[];
  members: Array<{ role: string; profile?: { display_name: string | null } | null }>;
  userEmail: string;
  inviteUrl?: string;
}

export function SettingsClient({ profile, accounts, members, userEmail, inviteUrl }: Props) {
  const [showCreateHH, setShowCreateHH] = useState(false);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function copyInvite() {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const household = profile?.household;

  async function handleCreateHousehold(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await createHousehold(new FormData(e.currentTarget));
    setPending(false);
    if (result?.error) { setError(result.error); return; }
    setShowCreateHH(false);
    setMsg("Домохозяйство создано!");
  }

  async function handleCreateAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await createAccount(new FormData(e.currentTarget));
    setPending(false);
    if (result?.error) { setError(result.error); return; }
    setShowCreateAccount(false);
    setMsg("Счёт добавлен!");
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold text-foreground">Настройки</h1>

      {msg && (
        <div className="bg-success/10 text-success text-sm rounded-lg p-3 border border-success/20">
          {msg}
        </div>
      )}

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User size={16} /> Профиль
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
              {(profile?.display_name ?? userEmail).charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-foreground">{profile?.display_name ?? "—"}</p>
              <p className="text-sm text-muted-foreground">{userEmail}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Household */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users size={16} /> Домохозяйство
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!household ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-4">
                Домохозяйство — это группа вашей семьи. Создайте его, чтобы начать.
              </p>
              <button
                onClick={() => setShowCreateHH(true)}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Создать домохозяйство
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{household.name}</p>
                  <p className="text-sm text-muted-foreground">{members.length} участников</p>
                </div>
              </div>
              {members.length > 0 && (
                <div className="divide-y">
                  {members.map((m, i) => (
                    <div key={i} className="py-2 flex items-center justify-between">
                      <span className="text-sm text-foreground">
                        {m.profile?.display_name ?? "Пользователь"}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {m.role === "admin" ? "Администратор" : "Участник"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {inviteUrl && (
                <button
                  onClick={copyInvite}
                  className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border hover:bg-accent transition-colors w-full"
                >
                  {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                  {copied ? "Ссылка скопирована!" : "Скопировать ссылку-приглашение"}
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accounts */}
      {household && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard size={16} /> Счета
            </CardTitle>
            <button
              onClick={() => setShowCreateAccount(true)}
              className="flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
            >
              <Plus size={14} /> Добавить
            </button>
          </CardHeader>
          <CardContent>
            {!accounts.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">Счетов нет</p>
            ) : (
              <div className="divide-y">
                {accounts.map((a) => (
                  <div key={a.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{a.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.type === "personal" ? "Личный" : "Общий"} · {a.currency}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {Number(a.balance).toLocaleString("ru-RU")} ₽
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Household Modal */}
      {showCreateHH && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-5">
            <h2 className="font-semibold text-foreground mb-4">Создать домохозяйство</h2>
            {error && <div className="mb-4 text-destructive text-sm bg-destructive/10 rounded-lg p-3">{error}</div>}
            <form onSubmit={handleCreateHousehold} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Название</label>
                <input name="name" required placeholder="Семья Ивановых" className="w-full px-3 py-2.5 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCreateHH(false)} className="flex-1 py-2.5 rounded-xl border text-sm font-medium hover:bg-accent transition-colors">Отмена</button>
                <button type="submit" disabled={pending} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
                  {pending ? "Создаём..." : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Account Modal */}
      {showCreateAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-5">
            <h2 className="font-semibold text-foreground mb-4">Добавить счёт</h2>
            {error && <div className="mb-4 text-destructive text-sm bg-destructive/10 rounded-lg p-3">{error}</div>}
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Название счёта</label>
                <input name="name" required placeholder="Карта Т-Банк" className="w-full px-3 py-2.5 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Тип</label>
                <select name="type" className="w-full px-3 py-2.5 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="personal">Личный</option>
                  <option value="shared">Общий (семейный)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Начальный баланс, ₽</label>
                <input name="balance" type="number" defaultValue="0" className="w-full px-3 py-2.5 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCreateAccount(false)} className="flex-1 py-2.5 rounded-xl border text-sm font-medium hover:bg-accent transition-colors">Отмена</button>
                <button type="submit" disabled={pending} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
                  {pending ? "Добавляем..." : "Добавить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
