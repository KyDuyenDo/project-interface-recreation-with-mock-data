import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList, CheckCircle2, Clock, AlertTriangle, Layers,
  RefreshCw, Loader2, ChevronRight, Calendar, Package, BarChart2,
  Zap, TrendingUp, User,
} from "lucide-react";
import { clsx } from "clsx";
import { useAuthStore } from "../../store/authStore";
import { usePermissions } from "../../hooks/usePermissions";
import { http } from "../../api/http";

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

function runStatus(tasks) {
  if (tasks.every(t => t.status === "confirmed")) return "confirmed";
  if (tasks.some(t => t.status === "rejected")) return "rejected";
  return "pending";
}

function RunStatusBadge({ tasks }) {
  const s = runStatus(tasks);
  const cfg = {
    pending:   { label: "Chờ xác nhận", cls: "bg-amber-50 text-amber-700 border-amber-200",  Icon: Clock },
    confirmed: { label: "Đã xác nhận",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: CheckCircle2 },
    rejected:  { label: "Có từ chối",   cls: "bg-red-50 text-red-600 border-red-200",        Icon: AlertTriangle },
  }[s];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      <cfg.Icon size={11} /> {cfg.label}
    </span>
  );
}

function RunCard({ runId, tasks, onClick }) {
  const lines     = [...new Set(tasks.map(t => t.line_id))].filter(Boolean).sort();
  const meta      = tasks[0];
  const totalOrders = tasks.filter(t => t.order_id).length;
  const totalQty    = tasks.reduce((s, t) => s + (t.qty || 0), 0);
  const pending    = tasks.filter(t => t.status === "pending").length;
  const confirmed  = tasks.filter(t => t.status === "confirmed").length;
  const rejected   = tasks.filter(t => t.status === "rejected").length;
  const s = runStatus(tasks);
  const pct = Math.round(((confirmed + rejected) / tasks.length) * 100);

  const borderCls = s === "confirmed" ? "border-emerald-200 hover:border-emerald-300"
    : s === "rejected" ? "border-red-200 hover:border-red-300"
    : "border-blue-200 hover:border-blue-300";
  const headerBg = s === "confirmed" ? "from-emerald-50 to-green-50 border-emerald-100"
    : s === "rejected" ? "from-red-50 to-rose-50 border-red-100"
    : "from-blue-50 to-indigo-50 border-blue-100";
  const iconBg = s === "confirmed" ? "bg-emerald-500"
    : s === "rejected" ? "bg-red-500"
    : "bg-blue-600";

  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full text-left rounded-2xl border bg-white shadow-sm hover:shadow-md transition-all group overflow-hidden",
        borderCls
      )}
    >
      {/* Card Header */}
      <div className={`px-5 py-4 border-b bg-gradient-to-r ${headerBg}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0 shadow ${iconBg}`}>
              #{runId}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">Run #{runId}</div>
              <div className="text-[11px] text-slate-400 font-mono">{meta?.run_label || "—"}</div>
            </div>
          </div>
          <RunStatusBadge tasks={tasks} />
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-3.5">

        {/* Meta info */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Calendar size={11} className="text-slate-300 shrink-0" />
            {meta?.period_label || fmtDate(meta?.run_started_at)}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Clock size={11} className="text-slate-300 shrink-0" />
            {timeAgo(meta?.run_started_at)}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Package size={11} className="text-slate-300 shrink-0" />
            {totalOrders} đơn hàng
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <BarChart2 size={11} className="text-slate-300 shrink-0" />
            {totalQty.toLocaleString()} đôi
          </div>
        </div>

        {/* Lines */}
        <div>
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Chuyền phân công</div>
          <div className="flex gap-1.5 flex-wrap">
            {lines.map(l => (
              <span key={l} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                <Layers size={9} /> {l}
              </span>
            ))}
          </div>
        </div>

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-slate-400">Tiến độ xác nhận</span>
            <span className="text-[10px] font-bold text-slate-600">{confirmed + rejected}/{tasks.length} ({pct}%)</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex">
            {confirmed > 0 && (
              <div className="h-full bg-emerald-400 transition-all" style={{ width: `${(confirmed / tasks.length) * 100}%` }} />
            )}
            {rejected > 0 && (
              <div className="h-full bg-red-400 transition-all" style={{ width: `${(rejected / tasks.length) * 100}%` }} />
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            {confirmed > 0 && <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"/>{confirmed} xác nhận</span>}
            {rejected > 0  && <span className="flex items-center gap-1 text-[10px] text-red-500 font-medium"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>{rejected} từ chối</span>}
            {pending > 0   && <span className="flex items-center gap-1 text-[10px] text-amber-600 font-medium"><span className="w-2 h-2 rounded-full bg-amber-300 inline-block"/>{pending} chờ</span>}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={clsx(
        "flex items-center justify-between px-5 py-3 border-t text-xs",
        s === "pending" ? "bg-blue-50/40 border-blue-100" : "bg-slate-50 border-slate-100"
      )}>
        <span className={clsx("font-semibold", pending > 0 ? "text-amber-600" : "text-slate-400")}>
          {pending > 0 ? `${pending} chờ xác nhận` : "Hoàn tất"}
        </span>
        <span className="flex items-center gap-1 font-semibold text-blue-600 group-hover:gap-2 transition-all">
          Xem chi tiết <ChevronRight size={13} />
        </span>
      </div>
    </button>
  );
}

function SummaryStats({ tasksByRun }) {
  const runs     = Object.values(tasksByRun);
  const total    = runs.length;
  const pending  = runs.filter(t => runStatus(t) === "pending").length;
  const done     = runs.filter(t => runStatus(t) === "confirmed").length;
  const rejected = runs.filter(t => runStatus(t) === "rejected").length;
  const totalTasks = runs.flat().length;
  const doneTasks  = runs.flat().filter(t => t.status !== "pending").length;
  const overallPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const stats = [
    { label: "Tổng Runs",    value: total,    Icon: Zap,         bg: "bg-slate-50",    border: "border-slate-200", text: "text-slate-700",    iconCls: "text-slate-400"   },
    { label: "Chờ xác nhận", value: pending,  Icon: Clock,       bg: "bg-amber-50",    border: "border-amber-200", text: "text-amber-700",    iconCls: "text-amber-500"   },
    { label: "Đã xác nhận",  value: done,     Icon: CheckCircle2,bg: "bg-emerald-50",  border: "border-emerald-200",text: "text-emerald-700",  iconCls: "text-emerald-500" },
    { label: "Có từ chối",   value: rejected, Icon: AlertTriangle,bg: "bg-red-50",     border: "border-red-200",  text: "text-red-600",      iconCls: "text-red-400"     },
  ];

  return (
    <div className="space-y-3 mb-6">
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map(({ label, value, Icon, bg, border, text, iconCls }) => (
          <div key={label} className={`rounded-xl border px-4 py-4 flex items-center gap-3 ${bg} ${border}`}>
            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
              <Icon size={16} className={iconCls} />
            </div>
            <div>
              <div className={`text-2xl font-bold ${text}`}>{value}</div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Overall progress bar */}
      {total > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <TrendingUp size={12} className="text-blue-500" /> Tiến độ tổng thể
            </span>
            <span className="text-xs font-bold text-slate-700">{doneTasks}/{totalTasks} nhiệm vụ · {overallPct}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-emerald-400 rounded-full transition-all"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

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
      <div className="flex flex-col h-full items-center justify-center bg-slate-50">
        <ClipboardList size={32} className="mx-auto mb-3 text-slate-200" />
        <div className="text-base font-semibold text-slate-500">Trang này chỉ dành cho Sub-Planner</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <header className="flex items-center h-16 px-6 border-b border-slate-200 bg-white shrink-0 gap-4 shadow-sm">
        <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow">
          <User size={16} className="text-white" />
        </div>
        <div>
          <div className="text-sm font-bold text-slate-900">Công việc của tôi</div>
          <div className="text-xs text-slate-400">
            {user?.full_name}
            {myLines.length > 0 && (
              <span className="ml-2">
                · Chuyền:&nbsp;
                {myLines.map(l => (
                  <span key={l} className="inline-flex items-center gap-0.5 mx-0.5 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                    <Layers size={8} /> {l}
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition shadow-sm"
        >
          <RefreshCw size={12} /> Làm mới
        </button>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        ) : runIds.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-20 text-center max-w-lg mx-auto mt-16">
            <ClipboardList size={36} className="mx-auto mb-3 text-slate-200" />
            <div className="text-base font-semibold text-slate-500 mb-1">Chưa có Run nào</div>
            <div className="text-sm text-slate-400">Main Planner chưa phân công Run nào cho bạn.</div>
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
