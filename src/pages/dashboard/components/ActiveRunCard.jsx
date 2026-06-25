import { Zap, ArrowRight, Layers } from "lucide-react";
import { Badge } from "../../../components/ui";

export default function ActiveRunCard({ activeRun, onDetailClick, onOpenKHXClick }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow">
          <Zap size={16} className="text-white" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-900">Active GA Run</div>
          <div className="text-xs text-slate-500 font-mono">{activeRun.label}</div>
        </div>
        <Badge variant="success">● Run #{activeRun.id}</Badge>
        <button
          onClick={onDetailClick}
          className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
        >
          Chi tiết <ArrowRight size={12} />
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-5 divide-x divide-slate-100">
        {[
          { label: "Period", value: activeRun.period_label || "—" },
          { label: "Thế hệ (gen)", value: activeRun.generation?.toLocaleString() || "—" },
          { label: "Fitness score", value: activeRun.fitness?.toLocaleString() || "—" },
          { label: "Đơn hàng", value: activeRun.n_orders || "—" },
          { label: "On-time", value: activeRun.on_time_pct ? `${activeRun.on_time_pct}%` : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="px-5 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
            <div className="mt-1 text-sm font-bold text-slate-800">{value}</div>
          </div>
        ))}
      </div>

      {/* On-time bar */}
      <div className="px-5 pb-4">
        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
          <span>Tỷ lệ đúng hạn</span>
          <span className="font-semibold text-emerald-600">{activeRun.on_time_pct || 96}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
            style={{ width: `${activeRun.on_time_pct || 96}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-t border-slate-100">
        <span className="text-xs text-slate-400">
          Accepted by <span className="font-semibold text-slate-600">{activeRun.accepted_by || "—"}</span>
        </span>
        <button
          onClick={onOpenKHXClick}
          className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
        >
          <Layers size={11} /> Mở KHX <ArrowRight size={11} />
        </button>
      </div>
    </div>
  );
}
