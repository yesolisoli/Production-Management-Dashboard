import clsx from "clsx";
import {
  Award,
  ClipboardList,
  PiggyBank,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { HogIntakeTotals } from "../calculations";

type SummaryPanelProps = {
  totals: HogIntakeTotals;
  sideOrders: number;
};

type Tone = "blue" | "amber" | "emerald" | "violet" | "red";

type Card = {
  label: string;
  value: number;
  tone: Tone;
  icon: LucideIcon;
};

const ICON_TONES: Record<
  Tone,
  { chipBg: string; chipFg: string }
> = {
  blue: { chipBg: "bg-blue-50", chipFg: "text-blue-500" },
  amber: { chipBg: "bg-amber-50", chipFg: "text-amber-500" },
  emerald: { chipBg: "bg-emerald-50", chipFg: "text-emerald-500" },
  violet: { chipBg: "bg-violet-50", chipFg: "text-violet-500" },
  red: { chipBg: "bg-red-50", chipFg: "text-red-500" },
};

export function SummaryPanel({ totals, sideOrders }: SummaryPanelProps) {
  const forCuttingTone: Tone = totals.overSold ? "red" : "emerald";

  const cards: Card[] = [
    {
      label: "TOTAL HOGS",
      value: totals.totalHogs,
      tone: "blue",
      icon: PiggyBank,
    },
    {
      label: "SIDE ORDERS",
      value: sideOrders,
      tone: "amber",
      icon: ClipboardList,
    },
    {
      label: "FOR CUTTING (TODAY)",
      value: totals.forCutting,
      tone: forCuttingTone,
      icon: Wrench,
    },
    {
      label: "YIELD TOTAL",
      value: totals.yieldTotal,
      tone: "violet",
      icon: Award,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <SummaryCard key={card.label} card={card} />
      ))}
    </div>
  );
}

function SummaryCard({ card }: { card: Card }) {
  const Icon = card.icon;
  const tone = ICON_TONES[card.tone];
  const valueClass =
    card.tone === "red" ? "text-red-700" : "text-slate-900";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {card.label}
        </p>
        <span
          className={clsx(
            "flex h-6 w-6 items-center justify-center rounded-md",
            tone.chipBg,
          )}
        >
          <Icon size={13} className={tone.chipFg} strokeWidth={2} />
        </span>
      </div>
      <p className="mt-1.5 flex items-baseline gap-1.5">
        <span className={clsx("text-2xl font-extrabold tabular-nums leading-none", valueClass)}>
          {card.value.toLocaleString()}
        </span>
        <span className="text-xs font-medium text-slate-400">head</span>
      </p>
    </div>
  );
}
