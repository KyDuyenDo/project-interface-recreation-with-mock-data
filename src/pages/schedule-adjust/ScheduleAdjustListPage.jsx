import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import {
  CalendarClock, ChevronRight, Calendar, TrendingUp,
  Package, AlertCircle, CheckCircle2, FileEdit, Clock,
} from "lucide-react";
import http from "../../api/http";
import { fmtDate } from "../../utils";
import { Spinner } from "../../components/ui";

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  active:     { label: "Đang hoạt động", badgeCls: "bg-emerald-100 text-emerald-700 border-emerald-200", borderCls: "border-l-emerald-500", Icon: CheckCircle2, iconCls: "text-emerald-500" },
  accepted:   { label: "Đã chấp nhận",   badgeCls: "bg-blue-100 text-blue-700 border-blue-200",         borderCls: "border-l-blue-500",    Icon: CheckCircle2, iconCls: "text-blue-500"    },
  draft:      { label: "Nháp",            badgeCls: "bg-slate-100 text-slate-600 border-slate-200",      borderCls: "border-l-slate-300",   Icon: FileEdit,     iconCls: "text-slate-400"  },
  superseded: { label: "Đã thay thế",    badgeCls: "bg-gray-100 text-gray-500 border-gray-200",         borderCls: "border-l-gray-300",    Icon: Clock,        iconCls: "text-gray-400"   },
  failed:     { label: "Lỗi",            badgeCls: "bg-red-100 text-red-600 border-red-200",             borderCls: "border-l-red-400",     Icon: AlertCircle,  iconCls: "text-red-400"    },
};

// ── Run card ──────────────────────────────────────────────────────────────────
function RunCard({ run, onClick }) {
  const cfg   = STATUS_CFG[run.lifecycle_status] || STATUS_CFG.draft;
  const late  = run.n_orders != null && run.on_time_pct != null
    ? Math.max(0, Math.round(run.n_orders * (1 - run.on_time_pct / 100)))
    : null;
  const onTimePct = run.on_time_pct;

  return (
    <button
      onClick={onClick}
      className={clsx(
        "group w-full text-left rounded-xl border border-l-4 bg-white",
        "hover:shadow-md hover:-translate-y-px transition-all duration-150",
        "flex flex-col gap-0 overflow-hidden",
        cfg.borderCls,
        run.lifecycle_status === "superseded" && "opacity-60",
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-800 truncate">{run.label || `Run #${run.id}`}</p>
          <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
            <Calendar size={10} className="shrink-0" />
            {run.period_label}
            <span className="text-slate-200">·</span>
            ID #{run.id}
          </p>
        </div>
        <span className={clsx(
          "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
          cfg.badgeCls,
        )}>
          {cfg.label}
        </span>
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-100 mx-4" />

      {/* Stats grid */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 px-0 py-0">
        <div className="flex flex-col items-center py-3 px-2 gap-0.5">
          <span className="text-lg font-bold text-slate-700 leading-tight">
            {run.n_orders ?? "—"}
          </span>
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Package size={9} /> Tổng đơn
          </span>
        </div>
        <div className="flex flex-col items-center py-3 px-2 gap-0.5">
          <span className={clsx(
            "text-lg font-bold leading-tight",
            onTimePct == null ? "text-slate-400" :
            onTimePct >= 90   ? "text-emerald-600" :
            onTimePct >= 75   ? "text-amber-600"   : "text-red-600",
          )}>
            {onTimePct != null ? `${onTimePct}%` : "—"}
          </span>
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <TrendingUp size={9} /> Đúng hạn
          </span>
        </div>
        <div className="flex flex-col items-center py-3 px-2 gap-0.5">
          <span className={clsx(
            "text-lg font-bold leading-tight",
            late == null ? "text-slate-400" :
            late === 0   ? "text-slate-400" :
            late <= 5    ? "text-amber-600" : "text-red-600",
          )}>
            {late ?? "—"}
          </span>
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <AlertCircle size={9} /> Trễ hạn
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-100">
        <span className="text-[10px] text-slate-400">
          {run.created_at ? fmtDate(run.created_at) : ""}
        </span>
        <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 group-hover:gap-2 transition-all">
          Mở lịch <ChevronRight size={12} />
        </span>
      </div>
    </button>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
      <CalendarClock size={40} strokeWidth={1.2} />
      <p className="text-sm font-medium text-slate-500">Chưa có lịch nào</p>
      <p className="text-xs">Chạy GA để tạo lịch mới</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ScheduleAdjustListPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["schedule-adjust-runs"],
    queryFn: async () => {
      const res = await http.get("/runs");
      return res.data;
    },
    staleTime: 30_000,
  });

  const allRuns = data?.items || [];
  const runs = allRuns.filter(r => r.status === "done");

  const groups = useMemo(() => {
    const map = {};
    runs.forEach(r => {
      const key = r.period_label || "Khác";
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [runs]);

  // Summary counts
  const totalRuns   = runs.length;
  const activeRuns  = runs.filter(r => r.lifecycle_status === "active").length;
  const lateTotal   = runs.reduce((acc, r) => {
    if (r.n_orders == null || r.on_time_pct == null) return acc;
    return acc + Math.max(0, Math.round(r.n_orders * (1 - r.on_time_pct / 100)));
  }, 0);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">

      {/* ── Topbar ── */}
      <div className="shrink-0 h-12 flex items-center gap-3 border-b border-slate-200 bg-white px-5">
        <CalendarClock size={15} className="text-blue-600 shrink-0" />
        <span className="text-sm font-bold text-slate-800">Điều chỉnh lịch</span>
        <span className="text-slate-200 text-lg">·</span>
        <span className="text-xs text-slate-400">Chọn lịch để điều chỉnh</span>

        <div className="ml-auto flex items-center gap-4 text-xs text-slate-500">
          <span><strong className="text-slate-700">{totalRuns}</strong> lịch</span>
          {activeRuns > 0 && (
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              {activeRuns} đang hoạt động
            </span>
          )}
          {lateTotal > 0 && (
            <span className="flex items-center gap-1 text-red-600 font-semibold">
              <AlertCircle size={11} />
              {lateTotal} đơn trễ
            </span>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 min-h-0 overflow-auto bg-slate-50">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Spinner size={28} />
          </div>
        ) : runs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="px-6 py-5 space-y-8 max-w-5xl">
            {groups.map(([period, periodRuns]) => (
              <section key={period}>
                {/* Period header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-1 h-4 rounded-full bg-blue-500 inline-block" />
                    <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      {period}
                    </h2>
                  </div>
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-[11px] text-slate-400 font-medium">
                    {periodRuns.length} lịch
                  </span>
                </div>

                {/* Cards grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {periodRuns.map(run => (
                    <RunCard
                      key={run.id}
                      run={run}
                      onClick={() => navigate(`/schedule-adjust/${run.id}`)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
