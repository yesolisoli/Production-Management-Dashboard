"use client";

export function StatCard({ label, value, color = "text-slate-900", bg = "bg-slate-50", labelColor = "text-slate-500", borderColor = "border-slate-200", accent }: { label: string; value: string | number; color?: string; bg?: string; labelColor?: string; borderColor?: string; accent?: string }) {
  return (
    <div className={`relative rounded-lg border p-3 ${bg} ${borderColor}`}>
      {accent && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-2/3 w-1 rounded-r-full"
          style={{ backgroundColor: accent }}
        />
      )}
      <p className={`text-xs font-medium ${labelColor}`}>{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
