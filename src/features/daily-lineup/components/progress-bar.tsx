import clsx from "clsx";

type Props = {
  present: number;
  required: number;
  barClass: string;
};

export function ProgressBar({ present, required, barClass }: Props) {
  const ratio = required > 0 ? Math.min(present / required, 1.25) : 0;
  const widthPct = Math.max(0, Math.min(ratio * 100, 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
      <div
        className={clsx("h-full rounded-full transition-all", barClass)}
        style={{ width: `${widthPct}%` }}
      />
    </div>
  );
}
