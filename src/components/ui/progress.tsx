import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
}

export function Progress({ value, max = 100, className, barClassName }: ProgressProps) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className={cn("h-2 bg-secondary rounded-full overflow-hidden", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", barClassName ?? "bg-primary")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
