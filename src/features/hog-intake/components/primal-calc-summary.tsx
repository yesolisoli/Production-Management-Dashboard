import clsx from "clsx";

type PrimalCalcSummaryProps = {
  jp: number;
  rwa: number;
  total: number;
};

// Shown in the Farm Delivery Records footer: JP + RWA = Primal Total, laid out
// as a left-aligned equation (small dotted label over a bold number).
export function PrimalCalcSummary({ jp, rwa, total }: PrimalCalcSummaryProps) {
  return (
    <div className="flex items-end justify-end gap-5">
      <Stat label="JP" value={jp} dot="bg-blue-500" />
      <Operator>+</Operator>
      <Stat label="RWA" value={rwa} dot="bg-violet-500" />
      <Operator>=</Operator>
      <Stat label="Primal Total" value={total} />
    </div>
  );
}

function Stat({
  label,
  value,
  dot,
}: {
  label: string;
  value: number;
  dot?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {dot ? (
          <span className={clsx("h-2 w-2 rounded-full", dot)} />
        ) : null}
        {label}
      </span>
      <span className="mt-1 text-4xl font-extrabold leading-none tabular-nums text-slate-900">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

function Operator({ children }: { children: string }) {
  return (
    <span className="pb-1 text-3xl font-light leading-none text-slate-300">
      {children}
    </span>
  );
}
