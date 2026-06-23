import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList, CheckCircle2, Clock, AlertTriangle, ChevronRight,
  Package, Calendar, User, Layers, Check, X, Edit3, Save,
  ArrowRight, Info, RefreshCw, Loader2, Eye
} from "lucide-react";
import { clsx } from "clsx";
import { useAuthStore } from "../../store/authStore";
import { usePermissions } from "../../hooks/usePermissions";
import { http } from "../../api/http";

const BTN = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SM = "inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const STEP_META = {
  2: { label: "Ưu tiên & Chuyền", color: "blue",   Icon: Layers,       desc: "Xác nhận sản lượng và chuyền được phân công" },
  6: { label: "Review lịch",       color: "violet", Icon: Calendar,     desc: "Kiểm tra và xác nhận lịch sản xuất trên chuyền của bạn" },
};

const STATUS_META = {
  pending:   { label: "Chờ xác nhận", color: "amber",  Icon: Clock },
  confirmed: { label: "Đã xác nhận",  color: "green",  Icon: CheckCircle2 },
  rejected:  { label: "Đã từ chối",   color: "red",    Icon: X },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  const colors = {
    amber:  "bg-amber-50 text-amber-700 border-amber-200",
    green:  "bg-green-50 text-green-700 border-green-200",
    red:    "bg-red-50 text-red-600 border-red-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colors[m.color]}`}>
      <m.Icon size={11} />
      {m.label}
    </span>
  );
}

function StepFilter({ step, setStep, counts }) {
  const steps = [
    { key: "all", label: "Tất cả" },
    { key: "2", label: "Step 2 · Chuyền" },
    { key: "6", label: "Step 6 · Review lịch" },
  ];
  return (
    <div className="flex gap-1 flex-wrap">
      {steps.map(s => (
        <button
          key={s.key}
          onClick={() => setStep(s.key)}
          className={clsx(
            "px-3 py-1.5 rounded-lg text-sm font-medium transition border",
            step === s.key
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
          )}
        >
          {s.label}
          {counts[s.key] > 0 && (
            <span className={clsx(
              "ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
              step === s.key ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600"
            )}>
              {counts[s.key]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function StatusFilter({ status, setStatus }) {
  return (
    <div className="flex gap-1">
      {[
        { key: "all", label: "Tất cả" },
        { key: "pending", label: "Chờ" },
        { key: "confirmed", label: "Đã xác nhận" },
      ].map(s => (
        <button
          key={s.key}
          onClick={() => setStatus(s.key)}
          className={clsx(
            "px-2.5 py-1 rounded-md text-xs font-medium transition border",
            status === s.key
              ? "bg-slate-800 text-white border-slate-800"
              : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

// ── Task Card for Step 2 ──────────────────────────────────────────────────────
function Step2TaskCard({ task, onConfirm, onReject, isPending }) {
  const [qtyOverride, setQtyOverride] = useState(task.qty_override ?? task.qty ?? "");
  const [note, setNote] = useState(task.note || "");
  const [editing, setEditing] = useState(false);

  const isConfirmed = task.status === "confirmed";
  const isRejected  = task.status === "rejected";
  const isDone = isConfirmed || isRejected;

  return (
    <div className={clsx(
      "bg-white rounded-xl border overflow-hidden transition-all",
      isConfirmed ? "border-green-200 bg-green-50/20" :
      isRejected  ? "border-red-200 bg-red-50/20 opacity-70" :
      "border-gray-200 hover:shadow-sm"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <Package size={14} className="text-blue-600" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">{task.order_id}</div>
            <div className="text-xs text-gray-500">{task.article}</div>
          </div>
        </div>
        <StatusBadge status={task.status} />
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2.5">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-gray-400 block mb-0.5">Dạng giày</span>
            <span className="font-medium text-gray-800">{task.model || "—"}</span>
          </div>
          <div>
            <span className="text-gray-400 block mb-0.5">Khách hàng</span>
            <span className="font-medium text-gray-800">{task.customer || "—"}</span>
          </div>
          <div>
            <span className="text-gray-400 block mb-0.5">Chuyền</span>
            <span className="inline-flex items-center gap-1 font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
              <Layers size={11} />{task.line_id}
            </span>
          </div>
          <div>
            <span className="text-gray-400 block mb-0.5">CRD</span>
            <span className="font-medium text-gray-800">{task.crd || "—"}</span>
          </div>
        </div>

        {/* Qty section */}
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-gray-600">Sản lượng</span>
            {!isDone && (
              <button
                onClick={() => setEditing(e => !e)}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Edit3 size={11} /> Chỉnh sửa
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div>
              <span className="text-xs text-gray-400">Gốc: </span>
              <span className="text-sm font-bold text-gray-900">{(task.qty || 0).toLocaleString()}</span>
              <span className="text-xs text-gray-400 ml-1">đôi</span>
            </div>
            {(task.qty_override != null || editing) && (
              <div className="flex items-center gap-1">
                <ArrowRight size={12} className="text-gray-300" />
                {editing && !isDone ? (
                  <input
                    type="number"
                    value={qtyOverride}
                    onChange={e => setQtyOverride(e.target.value)}
                    className="w-24 border border-blue-300 rounded px-2 py-1 text-xs font-bold text-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="SL mới"
                  />
                ) : task.qty_override != null ? (
                  <span className="text-sm font-bold text-blue-700">{task.qty_override.toLocaleString()}</span>
                ) : null}
                {editing && !isDone && <span className="text-xs text-gray-400">đôi</span>}
              </div>
            )}
          </div>
        </div>

        {/* Note */}
        {!isDone && editing && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Ghi chú (tuỳ chọn)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 resize-none"
              placeholder="Ghi chú cho Main Planner..."
            />
          </div>
        )}

        {isConfirmed && task.confirmed_at && (
          <div className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle2 size={11} />
            Đã xác nhận lúc {task.confirmed_at.slice(0, 16).replace("T", " ")}
          </div>
        )}
        {isRejected && task.note && (
          <div className="text-xs text-red-600 flex items-center gap-1">
            <X size={11} /> Lý do: {task.note}
          </div>
        )}
      </div>

      {/* Actions */}
      {!isDone && (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50/50">
          <button
            disabled={isPending}
            onClick={() => onReject(task.id, note)}
            className={`${BTN_SM} bg-white text-red-600 border-red-200 hover:bg-red-50`}
          >
            <X size={12} /> Từ chối
          </button>
          <div className="flex-1" />
          <button
            disabled={isPending}
            onClick={() => { setEditing(false); onConfirm(task.id, qtyOverride !== "" ? parseInt(qtyOverride) : null, note); }}
            className={`${BTN_SM} bg-green-600 text-white border-green-600 hover:bg-green-700`}
          >
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Xác nhận
          </button>
        </div>
      )}
    </div>
  );
}

// ── Task Card for Step 6 ──────────────────────────────────────────────────────
function Step6TaskCard({ task, allLineTasks, onConfirmAll, onRejectAll, isPending }) {
  const lineTasks = allLineTasks.filter(t => t.line_id === task.line_id && t.step === 6);
  const totalTasks = lineTasks.length;
  const confirmedCount = lineTasks.filter(t => t.status === "confirmed").length;
  const allDone = totalTasks > 0 && lineTasks.every(t => t.status === "confirmed" || t.status === "rejected");
  const allConfirmed = totalTasks > 0 && lineTasks.every(t => t.status === "confirmed");
  const [note, setNote] = useState("");

  // Only show the first task per line (as a group card)
  if (task !== lineTasks[0]) return null;

  return (
    <div className={clsx(
      "bg-white rounded-xl border overflow-hidden transition-all",
      allConfirmed ? "border-green-200 bg-green-50/20" :
      allDone      ? "border-gray-200 opacity-70" :
      "border-violet-200 hover:shadow-sm"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-violet-100 bg-violet-50/30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
            <Calendar size={14} className="text-violet-600" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">Chuyền {task.line_id}</div>
            <div className="text-xs text-gray-500">Review lịch sản xuất · Run #{task.run_id}</div>
          </div>
        </div>
        {allConfirmed ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
            <CheckCircle2 size={11} /> Đã xác nhận
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={11} /> Chờ review
          </span>
        )}
      </div>

      {/* Progress */}
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Tiến độ xác nhận</span>
          <span className="font-semibold text-gray-700">{confirmedCount}/{totalTasks}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-violet-400 rounded-full transition-all"
            style={{ width: totalTasks ? `${(confirmedCount / totalTasks) * 100}%` : "0%" }}
          />
        </div>

        <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2.5 text-xs text-violet-700">
          <Info size={12} className="inline mr-1.5 shrink-0" />
          Kiểm tra lịch sản xuất trên chuyền <strong>{task.line_id}</strong> cho Run <strong>#{task.run_id}</strong>. Xác nhận khi lịch đã chính xác.
        </div>

        {!allDone && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Ghi chú (tuỳ chọn)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-violet-300 resize-none"
              placeholder="Ghi chú hoặc vấn đề cần điều chỉnh..."
            />
          </div>
        )}

        {allConfirmed && task.confirmed_at && (
          <div className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle2 size={11} />
            Xác nhận hoàn tất lúc {lineTasks.find(t => t.confirmed_at)?.confirmed_at?.slice(0, 16).replace("T", " ")}
          </div>
        )}
      </div>

      {/* Actions */}
      {!allDone && (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50/50">
          <button
            disabled={isPending}
            onClick={() => onRejectAll(lineTasks.map(t => t.id), note)}
            className={`${BTN_SM} bg-white text-red-600 border-red-200 hover:bg-red-50`}
          >
            <X size={12} /> Báo lỗi
          </button>
          <div className="flex-1" />
          <button
            disabled={isPending}
            onClick={() => onConfirmAll(lineTasks.map(t => t.id), note)}
            className={`${BTN_SM} bg-violet-600 text-white border-violet-600 hover:bg-violet-700`}
          >
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Xác nhận lịch
          </button>
        </div>
      )}
    </div>
  );
}

// ── Summary bar ────────────────────────────────────────────────────────────────
function SummaryBar({ tasks }) {
  const total     = tasks.length;
  const pending   = tasks.filter(t => t.status === "pending").length;
  const confirmed = tasks.filter(t => t.status === "confirmed").length;
  const rejected  = tasks.filter(t => t.status === "rejected").length;

  const cards = [
    { label: "Tổng công việc", value: total,     color: "blue"  },
    { label: "Chờ xác nhận",   value: pending,   color: "amber" },
    { label: "Đã xác nhận",    value: confirmed, color: "green" },
    { label: "Đã từ chối",     value: rejected,  color: "red"   },
  ];

  const colorMap = {
    blue:  "border-blue-200 text-blue-700 bg-blue-50",
    amber: "border-amber-200 text-amber-700 bg-amber-50",
    green: "border-green-200 text-green-700 bg-green-50",
    red:   "border-red-200 text-red-600 bg-red-50",
  };

  return (
    <div className="grid grid-cols-4 gap-3 mb-5">
      {cards.map(c => (
        <div key={c.label} className={`rounded-xl border px-4 py-3 ${colorMap[c.color]}`}>
          <div className="text-2xl font-bold">{c.value}</div>
          <div className="text-xs mt-0.5 font-medium opacity-80">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function SubPlannerWorkspace() {
  const { user } = useAuthStore();
  const { isSub, myLines } = usePermissions();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [stepFilter,   setStepFilter]   = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pendingIds,   setPendingIds]   = useState(new Set());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["my-tasks", user?.username],
    queryFn: () => http.get("/tasks/my", { params: { username: user?.username } }).then(r => r.data),
    enabled: !!user,
    refetchInterval: 30000,
  });

  const tasks = data?.items || [];

  const confirmMutation = useMutation({
    mutationFn: ({ id, qtyOverride, note }) =>
      http.post(`/tasks/${id}/confirm`, { qty_override: qtyOverride, note }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }) =>
      http.post(`/tasks/${id}/reject`, { note }).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-tasks"] }),
  });

  const handleConfirm = async (id, qtyOverride, note) => {
    setPendingIds(s => new Set([...s, id]));
    try { await confirmMutation.mutateAsync({ id, qtyOverride, note }); }
    finally { setPendingIds(s => { const n = new Set(s); n.delete(id); return n; }); }
  };

  const handleReject = async (id, note) => {
    setPendingIds(s => new Set([...s, id]));
    try { await rejectMutation.mutateAsync({ id, note }); }
    finally { setPendingIds(s => { const n = new Set(s); n.delete(id); return n; }); }
  };

  const handleConfirmAll = async (ids, note) => {
    for (const id of ids) await handleConfirm(id, null, note);
  };

  const handleRejectAll = async (ids, note) => {
    for (const id of ids) await handleReject(id, note);
  };

  // Filter tasks
  const filtered = useMemo(() => {
    let t = tasks;
    if (stepFilter !== "all") t = t.filter(x => String(x.step) === stepFilter);
    if (statusFilter !== "all") t = t.filter(x => x.status === statusFilter);
    return t;
  }, [tasks, stepFilter, statusFilter]);

  // Count by step
  const counts = useMemo(() => ({
    all: tasks.filter(t => t.status === "pending").length,
    "2": tasks.filter(t => t.step === 2 && t.status === "pending").length,
    "6": tasks.filter(t => t.step === 6 && t.status === "pending").length,
  }), [tasks]);

  // Group step-6 tasks by line (to avoid duplicates)
  const step6Lines = useMemo(() => {
    const seen = new Set();
    return filtered.filter(t => {
      if (t.step !== 6) return false;
      if (seen.has(t.line_id)) return false;
      seen.add(t.line_id);
      return true;
    });
  }, [filtered]);

  const step2Tasks = filtered.filter(t => t.step === 2);
  const displayTasks = stepFilter === "6" ? step6Lines : stepFilter === "2" ? step2Tasks : null;

  if (!isSub) {
    return (
      <div className="flex flex-col h-full">
        <header className="flex items-center h-14 px-5 border-b border-gray-200 bg-white shrink-0">
          <div className="text-sm font-semibold text-gray-900">Công việc của tôi</div>
        </header>
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <ClipboardList size={28} className="text-gray-400" />
            </div>
            <div className="text-base font-semibold text-gray-700 mb-1">Không có quyền truy cập</div>
            <div className="text-sm text-gray-500">Trang này chỉ dành cho Sub-Planner.</div>
            <button onClick={() => navigate("/")} className={`${BTN} mt-4 bg-white border-gray-200 text-gray-700 hover:bg-gray-50`}>
              Về Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center h-14 px-5 border-b border-gray-200 bg-white shrink-0 gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardList size={16} className="text-emerald-500" />
            Công việc của tôi
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            Chuyền: {myLines.join(", ") || "—"} · {user?.full_name}
          </div>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => refetch()}
          className={`${BTN_SM} bg-white border-gray-200 text-gray-600 hover:bg-gray-50`}
        >
          <RefreshCw size={12} /> Làm mới
        </button>
      </header>

      <div className="flex-1 overflow-auto bg-gray-50 p-5">
        {/* Summary */}
        <SummaryBar tasks={tasks} />

        {/* Info banner */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-5 flex items-start gap-3">
          <Info size={15} className="text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-800">
            <strong>Hướng dẫn:</strong> Xem các đơn hàng được phân công cho chuyền của bạn.
            Kiểm tra sản lượng, chỉnh sửa nếu cần, và xác nhận để Main Planner tiếp tục lập lịch.
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <StepFilter step={stepFilter} setStep={(s) => { setStepFilter(s); }} counts={counts} />
          <div className="w-px h-5 bg-gray-200" />
          <StatusFilter status={statusFilter} setStatus={setStatusFilter} />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
            <Loader2 size={28} className="animate-spin mx-auto text-blue-500 mb-2" />
            <div className="text-sm text-gray-500">Đang tải công việc...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
            <ClipboardList size={32} className="mx-auto mb-3 text-gray-200" />
            <div className="text-base font-semibold text-gray-500 mb-1">Không có công việc nào</div>
            <div className="text-sm text-gray-400">
              {statusFilter !== "all" ? "Thử bỏ bộ lọc trạng thái để xem tất cả." : "Chưa có công việc được phân công."}
            </div>
          </div>
        ) : (
          <>
            {/* Step 2 tasks */}
            {(stepFilter === "all" || stepFilter === "2") && step2Tasks.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Layers size={15} className="text-blue-500" />
                  <h3 className="text-sm font-bold text-gray-800">Step 2 — Ưu tiên & Chuyền</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    {step2Tasks.length} đơn
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {step2Tasks.map(task => (
                    <Step2TaskCard
                      key={task.id}
                      task={task}
                      onConfirm={handleConfirm}
                      onReject={handleReject}
                      isPending={pendingIds.has(task.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Step 6 tasks — grouped by line */}
            {(stepFilter === "all" || stepFilter === "6") && step6Lines.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={15} className="text-violet-500" />
                  <h3 className="text-sm font-bold text-gray-800">Step 6 — Review lịch</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                    {step6Lines.length} chuyền
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {step6Lines.map(task => (
                    <Step6TaskCard
                      key={`${task.line_id}-${task.run_id}`}
                      task={task}
                      allLineTasks={tasks}
                      onConfirmAll={handleConfirmAll}
                      onRejectAll={handleRejectAll}
                      isPending={pendingIds.has(task.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
