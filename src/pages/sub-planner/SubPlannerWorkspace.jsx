import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList, CheckCircle2, Clock, X, Package, Calendar,
  Layers, Check, Info, RefreshCw, Loader2, ChevronDown, ChevronUp,
  AlertTriangle, ArrowRight, BarChart2, ShieldAlert, Activity,
  TrendingDown, MessageSquare,
} from "lucide-react";
import { clsx } from "clsx";
import { useAuthStore } from "../../store/authStore";
import { usePermissions } from "../../hooks/usePermissions";
import { http } from "../../api/http";

const BTN = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SM = "inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

// ── Constants ─────────────────────────────────────────────────────────────────
const COL_W = 36; // px per day column in chart
const BAR_MAX_H = 96; // px, max bar height
const CAPACITY_PER_DAY = 1200; // pairs/day per line

const ORDER_PALETTE = [
  "#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444","#ec4899",
  "#8b5cf6","#14b8a6","#f97316","#84cc16","#06b6d4","#d946ef",
  "#3b82f6","#22c55e","#a855f7","#fb923c","#facc15","#34d399",
];

function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
const orderColor = (id) => ORDER_PALETTE[hashStr(id || "") % ORDER_PALETTE.length];

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    pending:   { label: "Chờ xác nhận", cls: "bg-amber-50 text-amber-700 border-amber-200",  Icon: Clock },
    confirmed: { label: "Đã xác nhận",  cls: "bg-green-50 text-green-700 border-green-200",  Icon: CheckCircle2 },
    rejected:  { label: "Đã từ chối",   cls: "bg-red-50 text-red-600 border-red-200",         Icon: X },
  }[status] || { label: "—", cls: "bg-gray-50 text-gray-500 border-gray-200", Icon: Clock };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
      <cfg.Icon size={11} /> {cfg.label}
    </span>
  );
}

// ── Reject dialog ─────────────────────────────────────────────────────────────
const REJECT_REASONS = [
  {
    key: "wrong_model",
    label: "Sai dạng giày",
    desc: "Model này không thuộc chuyền tôi phụ trách hoặc chưa được đào tạo.",
    Icon: ShieldAlert,
    color: "red",
  },
  {
    key: "no_capacity",
    label: "Không đủ năng lực",
    desc: "Chuyền đang quá tải — không thể nhận thêm đơn trong thời gian này.",
    Icon: TrendingDown,
    color: "orange",
  },
];

function RejectDialog({ task, onClose, onReject, isPending }) {
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState("");

  const colorMap = {
    red:    { border: "border-red-300",    bg: "bg-red-50",    text: "text-red-700",    ring: "ring-red-200" },
    orange: { border: "border-orange-300", bg: "bg-orange-50", text: "text-orange-700", ring: "ring-orange-200" },
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="text-sm font-bold text-gray-900">Từ chối đơn hàng</span>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X size={15} /></button>
        </div>

        <div className="p-5 space-y-3">
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600">
            <span className="font-semibold text-gray-800">{task.order_id}</span>
            {task.article && <span className="ml-1 text-gray-400">· {task.article}</span>}
            {task.model && <span className="ml-1">· {task.model}</span>}
          </div>

          <p className="text-xs text-gray-500 font-medium">Chọn lý do từ chối:</p>

          {REJECT_REASONS.map(r => {
            const c = colorMap[r.color];
            const sel = reason === r.key;
            return (
              <button
                key={r.key}
                onClick={() => setReason(r.key)}
                className={clsx(
                  "w-full text-left p-3 rounded-xl border-2 transition-all",
                  sel ? `${c.border} ${c.bg} ring-2 ${c.ring}` : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <r.Icon size={15} className={sel ? c.text : "text-gray-400"} />
                  <span className={clsx("text-sm font-semibold", sel ? c.text : "text-gray-700")}>{r.label}</span>
                  {sel && <Check size={13} className={c.text + " ml-auto"} />}
                </div>
                <p className="text-xs text-gray-500 ml-6">{r.desc}</p>
              </button>
            );
          })}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              <MessageSquare size={11} className="inline mr-1" />Ghi chú thêm (tuỳ chọn)
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-300 resize-none"
              placeholder="Mô tả cụ thể vấn đề để Main Planner xem xét..."
            />
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className={`${BTN_SM} bg-white text-gray-600 border-gray-200 hover:bg-gray-50 flex-1 justify-center`}>
            Huỷ
          </button>
          <button
            disabled={!reason || isPending}
            onClick={() => onReject(task.id, reason, note)}
            className={`${BTN_SM} bg-red-600 text-white border-red-600 hover:bg-red-700 flex-1 justify-center`}
          >
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
            Gửi yêu cầu từ chối
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Order card ────────────────────────────────────────────────────────────────
function OrderCard({ task, onConfirm, onRejectClick, isPending }) {
  const isConfirmed = task.status === "confirmed";
  const isRejected  = task.status === "rejected";
  const isDone      = isConfirmed || isRejected;

  const REASON_LABELS = {
    wrong_model:  "Sai dạng giày",
    no_capacity:  "Không đủ năng lực",
  };

  return (
    <div className={clsx(
      "rounded-xl border overflow-hidden transition-all",
      isConfirmed ? "border-green-200 bg-green-50/30" :
      isRejected  ? "border-red-200 bg-red-50/20 opacity-75" :
      "border-gray-200 bg-white hover:shadow-sm"
    )}>
      {/* Top row */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100/80">
        <div className="flex items-center gap-2.5">
          <div className={clsx(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
            isConfirmed ? "bg-green-100" : isRejected ? "bg-red-100" : "bg-blue-100"
          )}>
            <Package size={14} className={isConfirmed ? "text-green-600" : isRejected ? "text-red-500" : "text-blue-600"} />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">{task.order_id}</div>
            {task.article && <div className="text-xs text-gray-400">{task.article}</div>}
          </div>
        </div>
        <StatusBadge status={task.status} />
      </div>

      {/* Details grid */}
      <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <span className="text-gray-400 block mb-0.5">Dạng giày</span>
          <span className="font-semibold text-gray-800">{task.model || "—"}</span>
        </div>
        <div>
          <span className="text-gray-400 block mb-0.5">Khách hàng</span>
          <span className="font-semibold text-gray-800">{task.customer || "—"}</span>
        </div>
        <div>
          <span className="text-gray-400 block mb-0.5">Chuyền</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Layers size={10} />{task.line_id}
          </span>
        </div>
        <div>
          <span className="text-gray-400 block mb-0.5">CRD</span>
          <span className={clsx(
            "font-semibold",
            task.crd && new Date(task.crd) < new Date() ? "text-red-600" : "text-gray-800"
          )}>{task.crd || "—"}</span>
        </div>
        <div className="col-span-2">
          <span className="text-gray-400 block mb-0.5">Sản lượng</span>
          <span className="font-bold text-gray-900 text-sm">{(task.qty || 0).toLocaleString()} <span className="text-xs font-normal text-gray-400">đôi</span></span>
        </div>
      </div>

      {/* Outcome info */}
      {isConfirmed && task.confirmed_at && (
        <div className="px-4 pb-3 text-xs text-green-600 flex items-center gap-1">
          <CheckCircle2 size={11} /> Xác nhận lúc {task.confirmed_at.slice(0,16).replace("T"," ")}
        </div>
      )}
      {isRejected && task.reject_reason && (
        <div className="px-4 pb-3 text-xs text-red-600 flex items-center gap-1">
          <ShieldAlert size={11} />
          {REASON_LABELS[task.reject_reason] || task.reject_reason}
          {task.note && <span className="text-gray-400 ml-1">— {task.note}</span>}
        </div>
      )}

      {/* Actions */}
      {!isDone && (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50/50">
          <button
            disabled={isPending}
            onClick={() => onRejectClick(task)}
            className={`${BTN_SM} bg-white text-red-600 border-red-200 hover:bg-red-50`}
          >
            <X size={12} /> Từ chối
          </button>
          <div className="flex-1" />
          <button
            disabled={isPending}
            onClick={() => onConfirm(task.id)}
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

// ── Line Capacity Chart ───────────────────────────────────────────────────────
function LineCapacityChart({ lineId, scheduleData }) {
  const scrollRef = useRef(null);
  const todayRef  = useRef(null);

  const days = scheduleData?.days || [];
  const capacity = scheduleData?.capacity_per_day || CAPACITY_PER_DAY;

  // Scroll to today on mount
  useEffect(() => {
    if (todayRef.current && scrollRef.current) {
      const el = todayRef.current;
      const container = scrollRef.current;
      const offset = el.offsetLeft - container.offsetWidth / 2 + COL_W / 2;
      container.scrollLeft = Math.max(0, offset);
    }
  }, [days.length]);

  if (!days.length) {
    return (
      <div className="flex items-center justify-center h-28 text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
        <Activity size={16} className="mr-2 text-gray-300" /> Không có dữ liệu lịch sản xuất
      </div>
    );
  }

  // Build colour map: order_id → color (stable)
  const colorMap = {};
  days.forEach(d => (d.orders || []).forEach(o => {
    if (!colorMap[o.order_id]) colorMap[o.order_id] = orderColor(o.order_id);
  }));

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Chart header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
          <BarChart2 size={13} className="text-blue-500" />
          <span>Lịch chuyền {lineId}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-1.5 rounded bg-gray-200" /> Trống
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-1.5 rounded bg-blue-400" /> Lịch SX
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-0.5 h-3 bg-red-400 rounded" /> Hôm nay
          </span>
          <span className="text-gray-300">Công suất: {capacity.toLocaleString()} đôi/ngày</span>
        </div>
      </div>

      {/* Scrollable chart */}
      <div ref={scrollRef} className="overflow-x-auto select-none" style={{ height: BAR_MAX_H + 36 }}>
        <div className="flex items-end gap-0" style={{ width: days.length * COL_W + 16, padding: "8px 8px 0", height: BAR_MAX_H + 36, position: "relative" }}>
          {/* Capacity guideline */}
          <div
            className="absolute left-2 right-2 border-t border-dashed border-red-200"
            style={{ top: 8 }}
            title="100% capacity"
          />

          {days.map((day, di) => {
            const totalQty = (day.orders || []).reduce((s, o) => s + o.qty, 0);
            const fillPct  = Math.min(totalQty / capacity, 1);
            const isToday  = day.is_today;
            const isPast   = day.is_past;

            // Stack segments
            let accPct = 0;
            const segments = (day.orders || []).map(o => {
              const segPct = Math.min(o.qty / capacity, 1 - accPct);
              const seg = { ...o, pct: segPct, yPct: accPct };
              accPct += segPct;
              return seg;
            });

            const label = isToday ? "HN" : day.date.slice(8); // day of month

            return (
              <div
                key={day.date}
                ref={isToday ? todayRef : undefined}
                className="flex flex-col items-center shrink-0 group"
                style={{ width: COL_W }}
                title={`${day.date} · ${totalQty.toLocaleString()} / ${capacity.toLocaleString()} đôi`}
              >
                {/* Bar */}
                <div
                  className="relative w-full rounded-t-sm overflow-hidden"
                  style={{
                    height: BAR_MAX_H,
                    background: isPast ? "#f1f5f9" : "#e2e8f0",
                    borderLeft: isToday ? "2px solid #ef4444" : undefined,
                    borderRight: isToday ? "2px solid #ef4444" : undefined,
                  }}
                >
                  {segments.map((seg, si) => (
                    <div
                      key={seg.order_id + si}
                      className="absolute left-0 right-0 transition-opacity group-hover:opacity-90"
                      style={{
                        bottom: `${seg.yPct * 100}%`,
                        height: `${seg.pct * 100}%`,
                        background: seg.color || colorMap[seg.order_id],
                        opacity: isPast ? 0.45 : 0.85,
                        minHeight: seg.pct > 0 ? 1 : 0,
                      }}
                    />
                  ))}

                  {/* Overflow indicator */}
                  {fillPct >= 0.95 && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-red-400 opacity-60" />
                  )}

                  {/* Today marker line */}
                  {isToday && (
                    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-red-400" />
                  )}
                </div>

                {/* Label */}
                <div
                  className={clsx(
                    "text-center shrink-0 font-medium",
                    isToday ? "text-red-600 text-[9px] font-bold" : "text-[9px] text-gray-400"
                  )}
                  style={{ lineHeight: "14px", paddingTop: 2 }}
                >
                  {label}
                </div>

                {/* Month label — show on 1st of month */}
                {day.date.slice(8) === "01" && (
                  <div className="text-[8px] text-gray-300 font-medium" style={{ lineHeight: "10px" }}>
                    T{parseInt(day.date.slice(5, 7))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Run group card ────────────────────────────────────────────────────────────
function RunCard({ runId, tasks, scheduleByLine, myLines, onConfirm, onRejectClick, pendingIds }) {
  const [open, setOpen] = useState(true);

  const totalTasks  = tasks.length;
  const pending     = tasks.filter(t => t.status === "pending").length;
  const confirmed   = tasks.filter(t => t.status === "confirmed").length;
  const rejected    = tasks.filter(t => t.status === "rejected").length;
  const allDone     = pending === 0;

  const step2Tasks = tasks.filter(t => t.step === 2);
  const step6Tasks = tasks.filter(t => t.step === 6);

  return (
    <div className={clsx(
      "rounded-2xl border overflow-hidden transition-all",
      allDone ? "border-green-200" : "border-blue-200"
    )}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 bg-white hover:bg-gray-50 transition text-left"
      >
        <div className={clsx(
          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold",
          allDone ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
        )}>
          #{runId}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-900">Run #{runId}</span>
            {pending > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                {pending} chờ xác nhận
              </span>
            )}
            {allDone && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 flex items-center gap-1">
                <CheckCircle2 size={11} /> Hoàn tất
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
            <span>{totalTasks} đơn</span>
            {confirmed > 0 && <span className="text-green-600">✓ {confirmed} đã xác nhận</span>}
            {rejected > 0 && <span className="text-red-500">✗ {rejected} từ chối</span>}
            <span>Chuyền: {myLines.join(", ")}</span>
          </div>
        </div>
        <div className={clsx("transition-transform", open ? "rotate-180" : "")}>
          <ChevronDown size={16} className="text-gray-400" />
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 bg-gray-50/30">
          {/* Line capacity charts */}
          {myLines.length > 0 && (
            <div className="px-5 pt-4 pb-2 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 mb-1">
                <Activity size={13} className="text-blue-500" />
                Lịch sản xuất trên chuyền
              </div>
              {myLines.map(lineId => (
                <LineCapacityChart
                  key={lineId}
                  lineId={lineId}
                  scheduleData={scheduleByLine?.[lineId]}
                />
              ))}
            </div>
          )}

          {/* Step 2 orders */}
          {step2Tasks.length > 0 && (
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Layers size={13} className="text-blue-500" />
                <span className="text-xs font-bold text-gray-700">Đơn hàng cần xác nhận chuyền</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">{step2Tasks.length}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {step2Tasks.map(task => (
                  <OrderCard
                    key={task.id}
                    task={task}
                    onConfirm={onConfirm}
                    onRejectClick={onRejectClick}
                    isPending={pendingIds.has(task.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Step 6 orders */}
          {step6Tasks.length > 0 && (
            <div className="px-5 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={13} className="text-violet-500" />
                <span className="text-xs font-bold text-gray-700">Review lịch sản xuất</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700">{step6Tasks.length}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {step6Tasks.map(task => (
                  <OrderCard
                    key={task.id}
                    task={task}
                    onConfirm={onConfirm}
                    onRejectClick={onRejectClick}
                    isPending={pendingIds.has(task.id)}
                  />
                ))}
              </div>
            </div>
          )}
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

  return (
    <div className="grid grid-cols-4 gap-3 mb-5">
      {[
        { label: "Tổng",         value: total,     cls: "border-blue-200 bg-blue-50 text-blue-700" },
        { label: "Chờ xác nhận", value: pending,   cls: "border-amber-200 bg-amber-50 text-amber-700" },
        { label: "Đã xác nhận",  value: confirmed, cls: "border-green-200 bg-green-50 text-green-700" },
        { label: "Đã từ chối",   value: rejected,  cls: "border-red-200 bg-red-50 text-red-600" },
      ].map(c => (
        <div key={c.label} className={`rounded-xl border px-4 py-3 ${c.cls}`}>
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
  const navigate  = useNavigate();
  const queryClient = useQueryClient();

  const [rejectTarget, setRejectTarget] = useState(null);
  const [pendingIds,   setPendingIds]   = useState(new Set());

  // Fetch tasks
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["my-tasks", user?.username],
    queryFn: () => http.get("/tasks/my", { params: { username: user?.username } }).then(r => r.data),
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Fetch line schedule (capacity chart data)
  const { data: scheduleData } = useQuery({
    queryKey: ["line-schedule", myLines.join(",")],
    queryFn: () => http.get("/lines/schedule", { params: { lines: myLines.join(",") } }).then(r => r.data),
    enabled: myLines.length > 0,
    staleTime: 60000,
  });

  const tasks = data?.items || [];

  const confirmMutation = useMutation({
    mutationFn: ({ id }) =>
      http.post(`/tasks/${id}/confirm`, {}).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason, note }) =>
      http.post(`/tasks/${id}/reject`, { reason, note }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setRejectTarget(null);
    },
  });

  const handleConfirm = useCallback(async (id) => {
    setPendingIds(s => new Set([...s, id]));
    try { await confirmMutation.mutateAsync({ id }); }
    finally { setPendingIds(s => { const n = new Set(s); n.delete(id); return n; }); }
  }, [confirmMutation]);

  const handleReject = useCallback(async (id, reason, note) => {
    setPendingIds(s => new Set([...s, id]));
    try { await rejectMutation.mutateAsync({ id, reason, note }); }
    finally { setPendingIds(s => { const n = new Set(s); n.delete(id); return n; }); }
  }, [rejectMutation]);

  // Group tasks by run_id
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
      <div className="flex flex-col h-full">
        <header className="flex items-center h-14 px-5 border-b border-gray-200 bg-white shrink-0">
          <ClipboardList size={16} className="text-emerald-500 mr-2" />
          <span className="text-sm font-semibold text-gray-900">Công việc của tôi</span>
        </header>
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-sm">
            <ClipboardList size={32} className="mx-auto mb-3 text-gray-200" />
            <div className="text-base font-semibold text-gray-600 mb-1">Trang này chỉ dành cho Sub-Planner</div>
            <button onClick={() => navigate("/")} className={`${BTN} mt-3 bg-white border-gray-200 text-gray-700 hover:bg-gray-50`}>
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
            <ClipboardList size={15} className="text-emerald-500" />
            Công việc của tôi
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            Chuyền: {myLines.join(", ") || "—"} · {user?.full_name}
          </div>
        </div>
        <div className="flex-1" />
        <button onClick={() => refetch()} className={`${BTN_SM} bg-white border-gray-200 text-gray-600 hover:bg-gray-50`}>
          <RefreshCw size={12} /> Làm mới
        </button>
      </header>

      <div className="flex-1 overflow-auto bg-gray-50 p-5">
        <SummaryBar tasks={tasks} />

        {/* Info banner */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-5 flex items-start gap-2.5">
          <Info size={14} className="text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-800">
            <strong>Hướng dẫn:</strong> Kiểm tra biểu đồ lịch sản xuất chuyền của bạn, xem các đơn hàng được phân công và xác nhận hoặc gửi yêu cầu điều chỉnh về Main Planner nếu có vấn đề.
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <Loader2 size={28} className="animate-spin mx-auto text-blue-500 mb-2" />
            <div className="text-sm text-gray-500">Đang tải công việc...</div>
          </div>
        ) : runIds.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <ClipboardList size={32} className="mx-auto mb-3 text-gray-200" />
            <div className="text-base font-semibold text-gray-500 mb-1">Chưa có công việc nào</div>
            <div className="text-sm text-gray-400">Main Planner chưa phân công đơn hàng cho bạn.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {runIds.map(runId => (
              <RunCard
                key={runId}
                runId={runId}
                tasks={tasksByRun[runId]}
                scheduleByLine={scheduleData?.by_line}
                myLines={myLines}
                onConfirm={handleConfirm}
                onRejectClick={setRejectTarget}
                pendingIds={pendingIds}
              />
            ))}
          </div>
        )}
      </div>

      {/* Reject dialog */}
      {rejectTarget && (
        <RejectDialog
          task={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onReject={handleReject}
          isPending={rejectMutation.isPending}
        />
      )}
    </div>
  );
}
