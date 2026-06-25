import { clsx } from "clsx";

export default function KpiPill({ label, value, color = "slate" }) {
  const cls = {
    slate: "bg-slate-100 text-slate-600",
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
  }[color];

  return (
    <div className={clsx("flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs", cls)}>
      <span className="text-sm font-bold tabular-nums">{value}</span>
      <span className="font-medium opacity-75">{label}</span>
    </div>
  );
}
