import { Clock, ChevronRight, Activity, Plus } from "lucide-react";

function RunStatusBadge({ status }) {
  const cfg = {
    accepted:  { label: "Accepted",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    active:    { label: "Active",    cls: "bg-blue-50 text-blue-700 border-blue-200" },
    running:   { label: "Running",   cls: "bg-amber-50 text-amber-700 border-amber-200" },
    done:      { label: "Done",      cls: "bg-slate-100 text-slate-600 border-slate-200" },
    failed:    { label: "Failed",    cls: "bg-red-50 text-red-600 border-red-200" },
    superseded:{ label: "Superseded",cls: "bg-slate-100 text-slate-400 border-slate-200" },
  };
  const c = cfg[status] || cfg.done;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${c.cls}`}>
      {c.label}
    </span>
  );
}

export default function RecentRuns({ recentRuns, onRunClick, onAllRunsClick, onCreateRunClick }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <Clock size={14} className="text-slate-400" />
        <span className="flex-1 text-sm font-bold text-slate-800">Runs gần đây</span>
        <button onClick={onAllRunsClick} className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-0.5">
          Xem tất cả <ChevronRight size={12} />
        </button>
      </div>
      <div className="flex-1 divide-y divide-slate-100">
        {recentRuns.map(r => (
          <button
            key={r.id}
            onClick={() => onRunClick(r.id)}
            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition text-left group"
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${
              r.lifecycle_status === "active" || r.is_accepted
                ? "bg-blue-100 text-blue-700"
                : r.status === "failed"
                ? "bg-red-100 text-red-600"
                : "bg-slate-100 text-slate-500"
            }`}>
              {r.id}
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-xs font-semibold text-slate-700 font-mono">#{r.id} {r.label?.slice(0, 20)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{r.period_label} · gen {r.generation}</div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <RunStatusBadge status={r.lifecycle_status || r.status} />
              {r.on_time_pct && (
                <span className="text-[10px] font-semibold text-emerald-600">{r.on_time_pct}%</span>
              )}
            </div>
          </button>
        ))}
        {recentRuns.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-400">
            <Activity size={24} className="mx-auto mb-2 text-slate-200" />
            Chưa có run nào
          </div>
        )}
      </div>
      <div className="border-t border-slate-100 px-5 py-3 bg-slate-50 rounded-b-2xl">
        <button
          onClick={onCreateRunClick}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
        >
          <Plus size={12} /> Tạo GA Run mới
        </button>
      </div>
    </div>
  );
}
