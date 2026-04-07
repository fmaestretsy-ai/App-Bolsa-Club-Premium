import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "gain" | "loss" | "neutral";
  icon: ReactNode;
}

export function StatCard({ title, value, change, changeType = "neutral", icon }: StatCardProps) {
  const changeColor = changeType === "gain" ? "text-gain" : changeType === "loss" ? "text-loss" : "text-neutral-val";

  return (
    <div className="stat-card group">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary transition-colors group-hover:bg-primary/15">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-card-foreground">{value}</p>
      {change && (
        <p className={`mt-1 text-sm font-semibold ${changeColor}`}>{change}</p>
      )}
    </div>
  );
}
