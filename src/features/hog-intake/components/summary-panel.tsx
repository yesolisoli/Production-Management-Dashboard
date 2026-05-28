import clsx from "clsx";
import { AlertTriangle } from "lucide-react";
import type { HogIntakeTotals } from "../calculations";

type SummaryPanelProps = {
  totals: HogIntakeTotals;
  sideOrders: number;
};

type Card = {
  label: string;
  value: number;
  tone: "neutral" | "accent" | "warning";
  warning?: boolean;
};

export function SummaryPanel({ totals, sideOrders }: SummaryPanelProps) {
  const cards: Card[] = [
    { label: "Total Hogs", value: totals.totalHogs, tone: "neutral" },
    { label: "Side Orders", value: sideOrders, tone: "accent" },
    {
      label: "For Cutting",
      value: totals.forCutting,
      tone: totals.overSold ? "warning" : "neutral",
      warning: totals.overSold,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <SummaryCard key={card.label} card={card} />
      ))}
    </div>
  );
}

function SummaryCard({ card }: { card: Card }) {
  return (
    <div
      className={clsx(
        "rounded-2xl border bg-white p-5 shadow-sm",
        card.tone === "warning" && "border-red-200 bg-red-50",
      )}
    >
      <div className="flex items-center justify-between">
        <p
          className={clsx(
            "text-sm font-medium",
            card.tone === "warning" ? "text-red-700" : "text-slate-500",
          )}
        >
          {card.label}
        </p>
        {card.warning ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-red-700">
            <AlertTriangle size={14} />
            Over sold
          </span>
        ) : null}
      </div>
      <p
        className={clsx(
          "mt-2 text-3xl font-bold tabular-nums",
          card.tone === "warning" ? "text-red-700" : "text-slate-900",
        )}
      >
        {card.value}
      </p>
    </div>
  );
}
