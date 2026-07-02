import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "destructive";
  hint?: string;
}) {
  const toneClasses: Record<string, string> = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-panel">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", toneClasses[tone])}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </div>
  );
}
