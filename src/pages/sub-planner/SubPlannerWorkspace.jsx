import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList, CheckCircle2, Clock, X, Layers, RefreshCw,
  Loader2, ChevronRight, Calendar, Package, BarChart2, AlertTriangle,
} from "lucide-react";
import { clsx } from "clsx";
import { useAuthStore } from "../../store/authStore";
import { usePermissions } from "../../hooks/usePermissions";
import { http } from "../../api/http";

const BTN_SM = "inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "vừa xong";
  if (h < 24) return `${h} giờ trước`;
  return `${Math.floor(h / 24)} ngày trước`;
}

// ── Run status derived from its tasks ─────────────────────────────────────────
function runStatus(tasks) {
  if (tasks.every(t => t.status === "confirmed")) return "confirmed";
  if (tasks.some(t => t.status === "rejected"))   return "rejected";
  return "pending";
}

function RunStatusBadge({ tasks }) {
  const s = runStatus(tasks);
  const cfg = {
    pending:   { label: "Chờ xác nhận", cls: "bg-amber-50 text-amber-700 border-amber-200",  Icon: Clock },
    confirmed: { label: "Đã xác nhận",  cls: "bg-green-50 text-green-700 border-green-200",  Icon: CheckCircle2 },
    rejected:  { label: "Có từ chối",   cls: "bg-red-50 text-red-600 border-red-200",         Icon: AlertTriangle },
  }[s];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      <cfg.Icon size={11} /> {cfg.label}
    </span>
  );
}

// ── Run card ───────────────────────────────────────────────────────────────────
function RunCard({ runId, tasks, onClick }) {
  const lines = [...new Set(tasks.map(t => t.line_id))].filter(Boolean).sort();
  const meta = tasks[0];
  const totalOrders = tasks.filter(t => t.order_id).length;
  const totalQty    = tasks.reduce((s, t) => s + (t.qty || 0), 0);
  const pending  = tasks.filter(t => t.status === "pending").length;
  const confirmed = tasks.filter(t => t.status === "confirmed").length;
  const rejected  = tasks.filter(t => t.status === "rejected").length;
  const s = runStatus(tasks);

  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full text-left rounded-2xl border overflow-hidden bg-white shadow-sm hover:shadow-md transition-all group",
        s === "confirmed" ? "border-green-200" :
        s === "rejected"  ? "border-red-200" :
        "border-blue-200 hover:border-blue-300"
      )}
    >
      {/* Card header */}
      <div className={clsx(
        "px-5 py-4 border-b",
        s === "confirmed" ? "bg-green-50/60 border-green-100" :
        s === "rejected"  ? "bg-red-50/40 border-red-100" :
        "bg-blue-50/50 border-blue-100"
      )}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={clsx(
              "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0",
              s === "confirmed" ? "bg-green-100 text-green-700" :
              s === "rejected"  ? "bg-red-100 text-red-600" :
              "bg-blue-100 text-blue-700"
            )}>
              #{runId}
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">Run #{runId}</div>
              <div className="text-xs text-gray-400 font-mono mt-0.5">{meta?.run_label || "—"}</div>
            </div>
          </div>
          <RunStatusBadge tasks={tasks} />
        </div>
      </div>

      {/* Card body */}
      <div className="px-5 py-4 space-y-4">
        {/* Info row */}
        <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar size={11} className="text-gray-400" />
            {meta?.period_label || "—"}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={11} className="text-gray-400" />
            {timeAgo(meta?.run_started_at)}
          </span>
          <span className="flex items-center gap-1">
            <Package size={11} className="text-gray-400" />
            {totalOrders} đơn hàng
          </span>
          <span className="flex items-center gap-1">
            <BarChart2 size={11} className="text-gray-400" />
            {totalQty.toLocaleString()} đôi
          </span>
        </div>

        {/* Lines */}
        <div>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Chuyền được phân công</div>
          <div className="flex gap-1.5 flex-wrap">
            {lines.map(l => (
              <span key={l} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                <Layers size={10} /> {l}
              </span>
            ))}
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
            <span>Tiến độ xác nhận</span>
            <span>{confirmed}/{tasks.length}</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden flex">
            {confirmed > 0 && (
              <div className="h-full bg-green-400 transition-all" style={{ width: `${(confirmed / tasks.length) * 100}%` }} />
            )}
            {rejected > 0 && (
              <div className="h-full bg-red-400 transition-all" style={{ width: `${(rejected / tasks.length) * 100}%` }} />
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={clsx(
        "flex items-center justify-between px-5 py-3 border-t text-xs",
        s === "pending" ? "bg-blue-50/30 border-blue-100" : "bg-gray-50 border-gray-100"
      )}>
        <span className={clsx(
          "font-medium",
          pending > 0 ? "text-amber-600" : "text-gray-400"
        )}>
          {pending > 0 ? `${pending} chờ xác nhận` : "Hoàn tất"}
        </span>
        <span className="flex items-center gap-1 text-blue-600 font-semibold group-hover:gap-2 transition-all">
          Xem chi tiết <ChevronRight size={13} />
        </span>
      </div>
    </button>
  );
}

// ── Summary stats ──────────────────────────────────────────────────────────────
function SummaryStats({ tasksByRun }) {
  const runs    = Object.values(tasksByRun);
  const total   = runs.length;
  const pending = runs.filter(tasks => runStatus(tasks) === "pending").length;
  const done    = runs.filter(tasks => runStatus(tasks) === "confirmed").length;
  const rejected = runs.filter(tasks => runStatus(tasks) === "rejected").length;

  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {[
        { label: "Tổng Runs",      value: total,    cls: "border-slate-200 bg-white text-slate-700" },
        { label: "Chờ xác nhận",   value: pending,  cls: "border-amber-200 bg-amber-50 text-amber-700" },
        { label: "Đã xác nhận",    value: done,     cls: "border-green-200 bg-green-50 text-green-700" },
        { label: "Có từ chối",     value: rejected, cls: "border-red-200 bg-red-50 text-red-600" },
      ].map(c => (
        <div key={c.label} className={`rounded-xl border px-4 py-3 ${c.cls}`}>
          <div className="text-2xl font-bold">{c.value}</div>
          <div className="text-xs mt-0.5 font-medium opacity-75">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function SubPlannerWorkspace() {
  const { user } = useAuthStore();
  const { isSub, myLines } = usePermissions();
  const navigate = useNavigate();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["my-tasks", user?.username],
    queryFn: () => http.get("/tasks/my", { params: { username: user?.username } }).then(r => r.data),
    enabled: !!user,
    refetchInterval: 30000,
  });

  const tasks = data?.items || [];

  const tasksByRun = useMemo(() => {
    const map = {};
    tasks.forEach(t => {
      if (!map[t.run_id]) map[t.run_id] = [];
      map[t.run_id].push(t);
    });
    return map;
  }, [tasks]);

  const runIds = Object.keys(tasksByRun).map(Number).sort((a, b) => b - a);

  if (!isSub) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-gray-50">
        <ClipboardList size={32} className="mx-auto mb-3 text-gray-200" />
        <div className="text-base font-semibold text-gray-500">Trang này chỉ dành cho Sub-Planner</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center h-14 px-5 border-b border-gray-200 bg-white shrink-0 gap-3">
        <ClipboardList size={15} className="text-emerald-500" />
        <div>
          <div className="text-sm font-bold text-gray-900">Công việc của tôi</div>
          <div className="text-xs text-gray-400">{user?.full_name} · Chuyền: {myLines.join(", ") || "—"}</div>
        </div>
        <div className="flex-1" />
        <button onClick={() => refetch()} className={`${BTN_SM} bg-white border-gray-200 text-gray-600 hover:bg-gray-50`}>
          <RefreshCw size={12} /> Làm mới
        </button>
      </header>

      <div className="flex-1 overflow-auto bg-gray-50 p-5">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={24} className="animate-spin text-blue-500" />
          </div>
        ) : runIds.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <ClipboardList size={32} className="mx-auto mb-3 text-gray-200" />
            <div className="text-base font-semibold text-gray-500 mb-1">Chưa có Run nào</div>
            <div className="text-sm text-gray-400">Main Planner chưa phân công Run nào cho bạn.</div>
          </div>
        ) : (
          <>
            <SummaryStats tasksByRun={tasksByRun} />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {runIds.map(runId => (
                <RunCard
                  key={runId}
                  runId={runId}
                  tasks={tasksByRun[runId]}
                  onClick={() => navigate(`/my-tasks/${runId}`)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
