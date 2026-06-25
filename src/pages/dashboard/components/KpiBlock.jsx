import { TrendingUp, TrendingDown } from "lucide-react";

export default function KpiBlock({ icon: Icon, label, value, sub, trend, up, accent }) {
  const colors = {
    blue:    { bg: "bg-blue-50",    icon: "text-blue-600",    ring: "ring-blue-100" },
    green:   { bg: "bg-emerald-50", icon: "text-emerald-600", ring: "ring-emerald-100" },
    red:     { bg: "bg-red-50",     icon: "text-red-500",     ring: "ring-red-100" },
    violet:  { bg: "bg-violet-50",  icon: "text-violet-600",  ring: "ring-violet-100" },
  };
  const c = colors[accent] || colors.blue;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ring-4 ${c.bg} ${c.ring}`}>
          <Icon size={18} className={c.icon} />
        </div>
        {trend && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${up ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
            {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {trend}
          </span>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold tracking-tight text-slate-900">{value}</div>
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mt-0.5">{label}</div>
      </div>
      {sub && <div className="text-xs text-slate-400 border-t border-slate-100 pt-2">{sub}</div>}
    </div>
  );
}
