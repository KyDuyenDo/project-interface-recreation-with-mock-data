import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import {
  CalendarClock, ChevronRight, ChevronLeft, Calendar, TrendingUp,
  Package, AlertCircle, CheckCircle2, FileEdit, Clock, Search, X,
  Filter, SlidersHorizontal,
} from "lucide-react";
import http from "../../api/http";
import { fmtDate } from "../../utils";
import { Spinner } from "../../components/ui";

// ── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 9;

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  active:     { label: "Đang hoạt động", badgeCls: "bg-emerald-100 text-emerald-700 border-emerald-200", borderCls: "border-l-emerald-500", chipCls: "bg-emerald-600 text-white",      Icon: CheckCircle2, iconCls: "text-emerald-500" },
  accepted:   { label: "Đã chấp nhận",   badgeCls: "bg-blue-100 text-blue-700 border-blue-200",         borderCls: "border-l-blue-500",    chipCls: "bg-blue-600 text-white",         Icon: CheckCircle2, iconCls: "text-blue-500"    },
  draft:      { label: "Nháp",            badgeCls: "bg-slate-100 text-slate-600 border-slate-200",      borderCls: "border-l-slate-300",   chipCls: "bg-slate-600 text-white",        Icon: FileEdit,     iconCls: "text-slate-400"  },
  superseded: { label: "Đã thay thế",    badgeCls: "bg-gray-100 text-gray-500 border-gray-200",         borderCls: "border-l-gray-300",    chipCls: "bg-gray-500 text-white",         Icon: Clock,        iconCls: "text-gray-400"   },
  failed:     { label: "Lỗi",            badgeCls: "bg-red-100 text-red-600 border-red-200",             borderCls: "border-l-red-400",     chipCls: "bg-red-500 text-white",          Icon: AlertCircle,  iconCls: "text-red-400"    },
};

const STATUS_KEYS = Object.keys(STATUS_CFG);

// ── Run card ──────────────────────────────────────────────────────────────────
function RunCard({ run, onClick }) {
  const cfg  = STATUS_CFG[run.lifecycle_status] || STATUS_CFG.draft;
  const late = run.n_orders != null && run.on_time_pct != null
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

      <div className="h-px bg-slate-100 mx-4" />

      <div className="grid grid-cols-3 divide-x divide-slate-100">
        <div className="flex flex-col items-center py-3 px-2 gap-0.5">
          <span className="text-lg font-bold text-slate-700 leading-tight">{run.n_orders ?? "—"}</span>
          <span className="text-[10px] text-slate-400 flex items-center gap-1"><Package size={9} /> Tổng đơn</span>
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
          <span className="text-[10px] text-slate-400 flex items-center gap-1"><TrendingUp size={9} /> Đúng hạn</span>
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
          <span className="text-[10px] text-slate-400 flex items-center gap-1"><AlertCircle size={9} /> Trễ hạn</span>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-100">
        <span className="text-[10px] text-slate-400">{run.created_at ? fmtDate(run.created_at) : ""}</span>
        <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 group-hover:gap-2 transition-all">
          Mở lịch <ChevronRight size={12} />
        </span>
      </div>
    </button>
  );
}

// ── Pagination controls ───────────────────────────────────────────────────────
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const delta = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  return (
    <div className="flex items-center justify-center gap-1 py-6">
      <button
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
      >
        <ChevronLeft size={13} /> Trước
      </button>

      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-2 text-slate-300 text-xs">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={clsx(
              "min-w-[30px] h-[30px] rounded-lg text-xs font-semibold transition",
              p === page
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {p}
          </button>
        )
      )}

      <button
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
      >
        Sau <ChevronRight size={13} />
      </button>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ hasFilter }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
      <CalendarClock size={40} strokeWidth={1.2} />
      {hasFilter ? (
        <>
          <p className="text-sm font-medium text-slate-500">Không tìm thấy lịch nào</p>
          <p className="text-xs">Thử thay đổi bộ lọc hoặc từ khoá tìm kiếm</p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-slate-500">Chưa có lịch nào</p>
          <p className="text-xs">Chạy GA để tạo lịch mới</p>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ScheduleAdjustListPage() {
  const navigate = useNavigate();

  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [page,         setPage]         = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["schedule-adjust-runs"],
    queryFn:  async () => (await http.get("/runs")).data,
    staleTime: 30_000,
  });

  const allRuns = useMemo(() => (data?.items || []).filter(r => r.status === "done"), [data]);

  // Unique periods for dropdown
  const periods = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const r of allRuns) {
      if (r.period_label && !seen.has(r.period_label)) {
        seen.add(r.period_label);
        result.push(r.period_label);
      }
    }
    return result.sort((a, b) => b.localeCompare(a));
  }, [allRuns]);

  // Summary KPIs (always from unfiltered set)
  const summary = useMemo(() => {
    const total  = allRuns.length;
    const active = allRuns.filter(r => r.lifecycle_status === "active").length;
    const late   = allRuns.reduce((acc, r) => {
      if (r.n_orders == null || r.on_time_pct == null) return acc;
      return acc + Math.max(0, Math.round(r.n_orders * (1 - r.on_time_pct / 100)));
    }, 0);
    return { total, active, late };
  }, [allRuns]);

  // Apply filters
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRuns.filter(r => {
      if (statusFilter !== "all" && r.lifecycle_status !== statusFilter) return false;
      if (periodFilter !== "all" && r.period_label !== periodFilter) return false;
      if (q && !`${r.label || ""} ${r.id}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allRuns, search, statusFilter, periodFilter]);

  const hasFilter = search !== "" || statusFilter !== "all" || periodFilter !== "all";

  // Paginate
  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage    = Math.min(page, totalPages);
  const pageRuns    = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // When a filter changes, reset to page 1
  const applyStatus = (s) => { setStatusFilter(s); setPage(1); };
  const applyPeriod = (p) => { setPeriodFilter(p); setPage(1); };
  const applySearch = (v) => { setSearch(v);        setPage(1); };

  const clearAll = () => { setSearch(""); setStatusFilter("all"); setPeriodFilter("all"); setPage(1); };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">

      {/* ── Topbar ── */}
      <div className="shrink-0 h-12 flex items-center gap-3 border-b border-slate-200 bg-white px-5">
        <CalendarClock size={15} className="text-blue-600 shrink-0" />
        <span className="text-sm font-bold text-slate-800">Điều chỉnh lịch</span>
        <span className="text-slate-200 text-lg">·</span>
        <span className="text-xs text-slate-400">Chọn lịch để điều chỉnh</span>

        <div className="ml-auto flex items-center gap-4 text-xs text-slate-500">
          <span><strong className="text-slate-700">{summary.total}</strong> lịch</span>
          {summary.active > 0 && (
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              {summary.active} đang hoạt động
            </span>
          )}
          {summary.late > 0 && (
            <span className="flex items-center gap-1 text-red-600 font-semibold">
              <AlertCircle size={11} />
              {summary.late} đơn trễ
            </span>
          )}
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-3 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => applySearch(e.target.value)}
            placeholder="Tìm theo tên hoặc ID…"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-8 py-1.5 text-xs focus:border-blue-400 focus:bg-white focus:outline-none transition"
          />
          {search && (
            <button onClick={() => applySearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Status chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium mr-0.5">
            <SlidersHorizontal size={11} /> Trạng thái:
          </span>
          <button
            onClick={() => applyStatus("all")}
            className={clsx(
              "rounded-full px-3 py-0.5 text-[11px] font-semibold border transition",
              statusFilter === "all"
                ? "bg-slate-700 text-white border-slate-700"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-400",
            )}
          >
            Tất cả
          </button>
          {STATUS_KEYS.map(key => {
            const cfg = STATUS_CFG[key];
            const active = statusFilter === key;
            return (
              <button
                key={key}
                onClick={() => applyStatus(key)}
                className={clsx(
                  "rounded-full px-3 py-0.5 text-[11px] font-semibold border transition",
                  active
                    ? clsx(cfg.chipCls, "border-transparent")
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-400",
                )}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Period selector */}
        {periods.length > 1 && (
          <div className="flex items-center gap-1.5 ml-auto">
            <Filter size={11} className="text-slate-400 shrink-0" />
            <select
              value={periodFilter}
              onChange={e => applyPeriod(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs focus:border-blue-400 focus:bg-white focus:outline-none transition"
            >
              <option value="all">Tất cả giai đoạn</option>
              {periods.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        )}

        {/* Clear all */}
        {hasFilter && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition"
          >
            <X size={11} /> Xoá bộ lọc
          </button>
        )}
      </div>

      {/* ── Result count row ── */}
      {hasFilter && !isLoading && (
        <div className="shrink-0 bg-blue-50 border-b border-blue-100 px-5 py-1.5 flex items-center gap-2 text-[11px] text-blue-700">
          <Filter size={11} />
          <span>
            Đang lọc — hiển thị <strong>{filtered.length}</strong> / {summary.total} lịch
            {filtered.length > 0 && ` · Trang ${safePage}/${totalPages}`}
          </span>
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex-1 min-h-0 overflow-auto bg-slate-50">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Spinner size={28} />
          </div>
        ) : pageRuns.length === 0 ? (
          <EmptyState hasFilter={hasFilter} />
        ) : (
          <div className="px-6 py-5 max-w-5xl">
            {/* Period group label (only when not filtering by period) */}
            {!hasFilter || periodFilter === "all" ? (
              (() => {
                const groups = {};
                pageRuns.forEach(r => {
                  const k = r.period_label || "Khác";
                  if (!groups[k]) groups[k] = [];
                  groups[k].push(r);
                });
                return Object.entries(groups)
                  .sort((a, b) => b[0].localeCompare(a[0]))
                  .map(([period, runs]) => (
                    <section key={period} className="mb-8">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="w-1 h-4 rounded-full bg-blue-500 inline-block" />
                          <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider">{period}</h2>
                        </div>
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-[11px] text-slate-400 font-medium">{runs.length} lịch</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {runs.map(run => (
                          <RunCard key={run.id} run={run} onClick={() => navigate(`/schedule-adjust/${run.id}`)} />
                        ))}
                      </div>
                    </section>
                  ));
              })()
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {pageRuns.map(run => (
                  <RunCard key={run.id} run={run} onClick={() => navigate(`/schedule-adjust/${run.id}`)} />
                ))}
              </div>
            )}

            <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
