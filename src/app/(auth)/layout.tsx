export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-white text-2xl font-bold mb-4 shadow-lg">
            FF
          </div>
          <h1 className="text-2xl font-bold text-foreground">FinFamily</h1>
          <p className="text-muted-foreground text-sm mt-1">Семейный финансовый дашборд</p>
        </div>
        <div className="bg-card rounded-2xl shadow-xl border p-8">{children}</div>
      </div>
    </div>
  );
}
