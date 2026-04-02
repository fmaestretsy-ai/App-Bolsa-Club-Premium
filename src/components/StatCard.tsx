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
    <div className="rounded-xl border border-border bg-card p-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center text-accent-foreground">
          {icon}
        </div>
      </div>
      <p className="mt-2 text-2xl font-bold text-card-foreground">{value}</p>
      {change && <p className={`mt-1 text-sm font-medium ${changeColor}`}>{change}</p>}
    </div>
  );
}
