"use client";

import { useActionState } from "react";
import Link from "next/link";
import { register } from "@/app/actions/auth";

export default function RegisterPage() {
  const [state, action, pending] = useActionState(register, undefined);

  return (
    <form action={action} className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Создать аккаунт</h2>
        <p className="text-sm text-muted-foreground mt-1">Начните управлять семейным бюджетом</p>
      </div>

      {state?.error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3">
          {state.error}
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-medium text-foreground">Имя</label>
        <input id="name" name="name" type="text" autoComplete="name" required
          className="w-full px-3 py-2.5 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          placeholder="Иван" />
      </div>

      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required
          className="w-full px-3 py-2.5 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          placeholder="you@example.com" />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium text-foreground">Пароль</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={6}
          className="w-full px-3 py-2.5 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          placeholder="Минимум 6 символов" />
      </div>

      <button type="submit" disabled={pending}
        className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-medium rounded-lg transition-colors">
        {pending ? "Создаём аккаунт..." : "Зарегистрироваться"}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">Войти</Link>
      </p>
    </form>
  );
}
