import { useState, useRef, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Layers, BarChart2, Activity, CheckCircle2, X, Clock,
  Package, Calendar, AlertTriangle, Check, Loader2, ShieldAlert,
  TrendingDown, MessageSquare, ChevronRight, Info, Users,
} from "lucide-react";
import { clsx } from "clsx";
import { useAuthStore } from "../../store/authStore";
import { usePermissions } from "../../hooks/usePermissions";
import { http } from "../../api/http";

const BTN = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SM = "inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

// ── Constants ──────────────────────────────────────────────────────────────────
const COL_W        = 34;
const BAR_MAX_H    = 88;
const CAPACITY_DAY = 1200;

const PALETTE = [
  "#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444","#ec4899",
  "#8b5cf6","#14b8a6","#f97316","#84cc16","#06b6d4","#d946ef",
];
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
const orderColor = id => PALETTE[hashStr(id || "") % PALETTE.length];

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    pending:   { label: "Chờ xác nhận", cls: "bg-amber-50 text-amber-700 border-amber-200",  Icon: Clock },
    confirmed: { label: "Đã xác nhận",  cls: "bg-green-50 text-green-700 border-green-200",  Icon: CheckCircle2 },
    rejected:  { label: "Đã từ chối",   cls: "bg-red-50 text-red-600 border-red-200",         Icon: AlertTriangle },
  }[status] || { label: "—", cls: "bg-gray-50 text-gray-500 border-gray-200", Icon: Clock };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      <cfg.Icon size={11} /> {cfg.label}
    </span>
  );
}

// ── Capacity chart ─────────────────────────────────────────────────────────────
function CapacityChart({ lineId, scheduleData }) {
  const scrollRef = useRef(null);
  const todayRef  = useRef(null);
  const days = scheduleData?.days || [];
  const cap  = scheduleData?.capacity_per_day || CAPACITY_DAY;

  useEffect(() => {
    if (todayRef.current && scrollRef.current) {
      const el = todayRef.current;
      const c  = scrollRef.current;
      c.scrollLeft = Math.max(0, el.offsetLeft - c.offsetWidth / 2 + COL_W / 2);
    }
  }, [days.length]);

  if (!days.length) {
    return (
      <div className="flex items-center justify-center h-28 text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
        <Activity size={15} className="mr-2 text-gray-300" /> Không có dữ liệu lịch
      </div>
    );
  }

  // Stable colour per order
  const colourMap = {};
  days.forEach(d => (d.orders || []).forEach(o => {
    if (!colourMap[o.order_id]) colourMap[o.order_id] = orderColor(o.order_id);
  }));

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Legend header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
          <BarChart2 size={13} className="text-blue-500" />
          Biểu đồ công suất · {lineId}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded bg-gray-200 inline-block" /> Trống</span>
          <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded bg-blue-400 inline-block" /> Lịch SX</span>
          <span className="flex items-center gap-1"><span className="w-0.5 h-3 rounded bg-red-400 inline-block" /> Hôm nay</span>
          <span className="text-gray-300">Công suất: {cap.toLocaleString()} đôi/ngày</span>
        </div>
      </div>

      {/* Scroll area */}
      <div ref={scrollRef} className="overflow-x-auto select-none" style={{ height: BAR_MAX_H + 34 }}>
        <div
          className="flex items-end"
          style={{ width: days.length * COL_W + 16, padding: "6px 8px 0", height: BAR_MAX_H + 34, position: "relative" }}
        >
          {/* 100% cap guide */}
          <div className="absolute left-2 right-2 border-t border-dashed border-red-200" style={{ top: 6 }} />

          {days.map((day, di) => {
            const total   = (day.orders || []).reduce((s, o) => s + o.qty, 0);
            const fillPct = Math.min(total / cap, 1);
            const isToday = day.is_today;
            const isPast  = day.is_past;

            let accPct = 0;
            const segs = (day.orders || []).map(o => {
              const p = Math.min(o.qty / cap, 1 - accPct);
              const s = { ...o, p, yPct: accPct, color: colourMap[o.order_id] };
              accPct += p;
              return s;
            });

            return (
              <div
                key={day.date}
                ref={isToday ? todayRef : undefined}
                className="flex flex-col items-center shrink-0 group"
                style={{ width: COL_W }}
                title={`${day.date} · ${total.toLocaleString()} / ${cap.toLocaleString()} đôi`}
              >
                <div
                  className="relative w-full rounded-t-sm overflow-hidden"
                  style={{
                    height: BAR_MAX_H,
                    background: isPast ? "#f1f5f9" : "#e2e8f0",
                    borderLeft:  isToday ? "2px solid #ef4444" : undefined,
                    borderRight: isToday ? "2px solid #ef4444" : undefined,
                  }}
                >
                  {segs.map((seg, si) => (
                    <div
                      key={seg.order_id + si}
                      className="absolute left-0 right-0"
                      style={{
                        bottom: `${seg.yPct * 100}%`,
                        height: `${seg.p * 100}%`,
                        background: seg.color,
                        opacity: isPast ? 0.4 : 0.82,
                        minHeight: seg.p > 0 ? 1 : 0,
                      }}
                    />
                  ))}
                  {fillPct >= 0.95 && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-red-400 opacity-60" />
                  )}
                  {isToday && (
                    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-red-400" />
                  )}
                </div>
                <div
                  className={clsx(
                    "text-center font-medium",
                    isToday ? "text-red-600 text-[9px] font-bold" : "text-[9px] text-gray-400"
                  )}
                  style={{ lineHeight: "14px", paddingTop: 2 }}
                >
                  {isToday ? "HN" : day.date.slice(8)}
                </div>
                {day.date.slice(8) === "01" && (
                  <div className="text-[8px] text-gray-300" style={{ lineHeight: "10px" }}>
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

// ── Orders table ───────────────────────────────────────────────────────────────
function OrdersTable({ orders, isSupport }) {
  if (!orders.length) {
    return (
      <div className="flex items-center justify-center py-6 text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
        Không có đơn hàng {isSupport ? "phụ" : "chính"} nào
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-3 py-2 text-left font-semibold text-gray-500">Mã đơn</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-500">Article</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-500">Model</th>
            <th className="px-3 py-2 text-right font-semibold text-gray-500">Sản lượng</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-500">Deadline</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-500">Ngày SX</th>
            {isSupport && <th className="px-3 py-2 text-left font-semibold text-gray-500">Chuyền chính</th>}
            <th className="px-3 py-2 text-left font-semibold text-gray-500">TT</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o, i) => (
            <tr key={o.id} className={clsx("border-b border-gray-100 hover:bg-blue-50/30 transition-colors", i % 2 === 0 ? "bg-white" : "bg-gray-50/40")}>
              <td className="px-3 py-2 font-mono font-bold text-blue-700">{o.order_id || "—"}</td>
              <td className="px-3 py-2 text-gray-600">{o.article || "—"}</td>
              <td className="px-3 py-2 font-medium text-gray-800">{o.model || "—"}</td>
              <td className="px-3 py-2 text-right font-semibold text-gray-900">
                {o.qty ? o.qty.toLocaleString() : "—"}
                <span className="text-gray-400 font-normal ml-0.5">đôi</span>
              </td>
              <td className={clsx(
                "px-3 py-2 font-medium",
                o.crd && new Date(o.crd) < new Date() ? "text-red-600" : "text-gray-700"
              )}>{fmtDate(o.crd)}</td>
              <td className="px-3 py-2 text-gray-500">
                {o.prod_start ? `${fmtDate(o.prod_start)} → ${fmtDate(o.prod_end)}` : "—"}
              </td>
              {isSupport && (
                <td className="px-3 py-2">
                  {o.main_line_id ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                      <Layers size={9} /> {o.main_line_id}
                    </span>
                  ) : "—"}
                </td>
              )}
              <td className="px-3 py-2"><StatusBadge status={o.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Line info panel ────────────────────────────────────────────────────────────
function LineInfoPanel({ lineId, tasks, scheduleData }) {
  const cap       = scheduleData?.capacity_per_day ?? CAPACITY_DAY;
  const days      = scheduleData?.days ?? [];
  // Today's load
  const todayDay  = days.find(d => d.is_today);
  const todayQty  = todayDay ? todayDay.orders.reduce((s, o) => s + o.qty, 0) : 0;
  const utilPct   = Math.round((todayQty / cap) * 100);

  const totalQty  = tasks.filter(t => t.order_id).reduce((s, t) => s + (t.qty || 0), 0);
  const pending   = tasks.filter(t => t.status === "pending").length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-6">
      <div>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Mã chuyền</div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-bold bg-blue-100 text-blue-700 border border-blue-200">
            <Layers size={12} /> {lineId}
          </span>
        </div>
      </div>
      <div>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Công suất mục tiêu</div>
        <div className="text-sm font-bold text-gray-800">{cap.toLocaleString()} <span className="font-normal text-gray-400 text-xs">đôi/ngày</span></div>
      </div>
      <div>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Sử dụng hôm nay</div>
        <div className="flex items-center gap-2">
          <div className="text-sm font-bold text-gray-800">{utilPct}%</div>
          <div className="w-20 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={clsx("h-full rounded-full", utilPct > 90 ? "bg-red-400" : utilPct > 70 ? "bg-amber-400" : "bg-green-400")}
              style={{ width: `${Math.min(utilPct, 100)}%` }}
            />
          </div>
        </div>
      </div>
      <div>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Tổng sản lượng phân công</div>
        <div className="text-sm font-bold text-gray-800">{totalQty.toLocaleString()} <span className="font-normal text-gray-400 text-xs">đôi</span></div>
      </div>
      <div>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Trạng thái</div>
        <StatusBadge status={pending > 0 ? "pending" : "confirmed"} />
      </div>
    </div>
  );
}

// ── Reject dialog ─────────────────────────────────────────────────────────────
const REJECT_REASONS = [
  {
    key:   "wrong_model",
    label: "Sai dạng giày",
    desc:  "Model được phân công không phù hợp với năng lực của chuyền.",
    Icon:  ShieldAlert,
    color: "red",
  },
  {
    key:   "no_capacity",
    label: "Không đủ năng lực",
    desc:  "Sản lượng vượt quá công suất của chuyền trong giai đoạn này.",
    Icon:  TrendingDown,
    color: "orange",
  },
];

function RejectDialog({ lineId, onClose, onReject, isPending }) {
  const [reason, setReason] = useState(null);
  const [note,   setNote]   = useState("");
  const colorMap = {
    red:    { border: "border-red-300",    bg: "bg-red-50",    text: "text-red-700",    ring: "ring-red-200" },
    orange: { border: "border-orange-300", bg: "bg-orange-50", text: "text-orange-700", ring: "ring-orange-200" },
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="text-sm font-bold text-gray-900">Từ chối kế hoạch · {lineId}</span>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X size={15} /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-500">Chọn lý do để gửi yêu cầu điều chỉnh đến Main Planner:</p>
          {REJECT_REASONS.map(r => {
            const c = colorMap[r.color];
            const sel = reason === r.key;
            return (
              <button key={r.key} onClick={() => setReason(r.key)}
                className={clsx("w-full text-left p-3 rounded-xl border-2 transition-all",
                  sel ? `${c.border} ${c.bg} ring-2 ${c.ring}` : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                )}>
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
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-300 resize-none"
              placeholder="Mô tả chi tiết vấn đề để Main Planner xem xét..."
            />
          </div>
        </div>
        <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className={`${BTN_SM} bg-white text-gray-600 border-gray-200 hover:bg-gray-50 flex-1 justify-center`}>Huỷ</button>
          <button disabled={!reason || isPending} onClick={() => onReject(reason, note)}
            className={`${BTN_SM} bg-red-600 text-white border-red-600 hover:bg-red-700 flex-1 justify-center`}>
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
            Gửi yêu cầu từ chối
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Evaluation (accept / reject) panel ───────────────────────────────────────
function EvaluationPanel({ lineId, tasks, runId, step, onAction, isPending }) {
  const [showReject, setShowReject] = useState(false);
  const allConfirmed = tasks.every(t => t.status === "confirmed");
  const anyRejected  = tasks.some(t => t.status === "rejected");
  const pending      = tasks.filter(t => t.status === "pending").length;

  const REASON_LABELS = { wrong_model: "Sai dạng giày", no_capacity: "Không đủ năng lực" };
  const rejectedTask = tasks.find(t => t.status === "rejected" && t.reject_reason);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
        <CheckCircle2 size={13} className="text-emerald-500" />
        <span className="text-xs font-bold text-gray-700">Đánh giá kế hoạch</span>
      </div>
      <div className="p-4">
        {allConfirmed ? (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
            <CheckCircle2 size={15} /> Đã xác nhận chuyền có thể thực hiện kế hoạch
          </div>
        ) : anyRejected ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <AlertTriangle size={15} />
              Đã gửi từ chối
              {rejectedTask?.reject_reason && (
                <span className="ml-1 font-semibold">"{ REASON_LABELS[rejectedTask.reject_reason] || rejectedTask.reject_reason}"</span>
              )}
            </div>
            <p className="text-xs text-gray-400">Main Planner đã được thông báo và sẽ điều chỉnh kế hoạch.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              {pending} đơn hàng chờ xác nhận. Xác nhận chuyền có thể thực hiện hoặc gửi yêu cầu điều chỉnh.
            </p>
            <div className="flex gap-2">
              <button
                disabled={isPending}
                onClick={() => setShowReject(true)}
                className={`${BTN} bg-white text-red-600 border-red-200 hover:bg-red-50`}
              >
                <X size={14} /> Từ chối — yêu cầu điều chỉnh
              </button>
              <div className="flex-1" />
              <button
                disabled={isPending}
                onClick={() => onAction("confirmed", null, "")}
                className={`${BTN} bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700`}
              >
                {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Chấp nhận kế hoạch
              </button>
            </div>
          </div>
        )}
      </div>
      {showReject && (
        <RejectDialog
          lineId={lineId}
          onClose={() => setShowReject(false)}
          onReject={(reason, note) => { onAction("rejected", reason, note); setShowReject(false); }}
          isPending={isPending}
        />
      )}
    </div>
  );
}

// ── Line tab content ───────────────────────────────────────────────────────────
function LineTab({ lineId, tasks, scheduleData, runId, step }) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [isPending, setIsPending] = useState(false);

  const approveMutation = useMutation({
    mutationFn: ({ status, reason, note }) =>
      http.post(`/runs/${runId}/step-approvals`, {
        step,
        planner_username: user?.username,
        line_id: lineId,
        status,
        reject_reason: reason,
        note,
      }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const handleAction = async (status, reason, note) => {
    setIsPending(true);
    try { await approveMutation.mutateAsync({ status, reason, note }); }
    finally { setIsPending(false); }
  };

  const primaryOrders = tasks.filter(t => !t.is_support && t.order_id);
  const supportOrders = tasks.filter(t =>  t.is_support && t.order_id);

  return (
    <div className="space-y-4">
      {/* A. Line info */}
      <LineInfoPanel lineId={lineId} tasks={tasks} scheduleData={scheduleData} />

      {/* B. Capacity chart */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <BarChart2 size={13} className="text-blue-500" />
          <span className="text-xs font-bold text-gray-700">Biểu đồ công suất</span>
        </div>
        <CapacityChart lineId={lineId} scheduleData={scheduleData} />
      </div>

      {/* C. Primary orders */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Package size={13} className="text-blue-500" />
          <span className="text-xs font-bold text-gray-700">Đơn hàng chuyền chính</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">{primaryOrders.length}</span>
        </div>
        <OrdersTable orders={primaryOrders} isSupport={false} />
      </div>

      {/* D. Support orders */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Users size={13} className="text-violet-500" />
          <span className="text-xs font-bold text-gray-700">Đơn hàng chuyền phụ</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700">{supportOrders.length}</span>
          <span className="text-[10px] text-gray-400">(chuyền này hỗ trợ chuyền khác)</span>
        </div>
        <OrdersTable orders={supportOrders} isSupport={true} />
      </div>

      {/* E. Evaluation */}
      <EvaluationPanel
        lineId={lineId}
        tasks={tasks}
        runId={runId}
        step={step}
        onAction={handleAction}
        isPending={isPending}
      />
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function RunDetailForSub() {
  const { runId } = useParams();
  const navigate  = useNavigate();
  const { user }  = useAuthStore();
  const { isSub, myLines } = usePermissions();

  const [activeTab, setActiveTab] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["my-tasks", user?.username],
    queryFn: () => http.get("/tasks/my", { params: { username: user?.username } }).then(r => r.data),
    enabled: !!user,
  });

  const allTasks = data?.items || [];
  const runTasks = allTasks.filter(t => String(t.run_id) === String(runId));
  const meta     = runTasks[0];

  // Lines that appear in this run's tasks
  const lines = useMemo(() =>
    [...new Set(runTasks.map(t => t.line_id).filter(Boolean))].sort(),
    [runTasks]
  );

  // Default to first tab
  useEffect(() => {
    if (lines.length && !activeTab) setActiveTab(lines[0]);
  }, [lines, activeTab]);

  // Fetch line schedule data for all lines in this run
  const { data: scheduleData } = useQuery({
    queryKey: ["line-schedule", lines.join(",")],
    queryFn: () => http.get("/lines/schedule", { params: { lines: lines.join(",") } }).then(r => r.data),
    enabled: lines.length > 0,
    staleTime: 60000,
  });

  const step = runTasks[0]?.step ?? 2;

  if (!isSub) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-gray-50">
        <span className="text-sm text-gray-400">Chỉ dành cho Sub-Planner</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center h-14 px-5 border-b border-gray-200 bg-white">
          <Loader2 size={18} className="animate-spin text-blue-500" />
        </div>
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <Loader2 size={24} className="animate-spin text-blue-400" />
        </div>
      </div>
    );
  }

  if (!runTasks.length) {
    return (
      <div className="flex flex-col h-full">
        <header className="flex items-center h-14 px-5 border-b border-gray-200 bg-white gap-3">
          <button onClick={() => navigate("/my-tasks")} className={`${BTN_SM} bg-white border-gray-200 text-gray-600 hover:bg-gray-50`}>
            <ArrowLeft size={13} /> Quay lại
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <AlertTriangle size={32} className="mx-auto mb-3 text-amber-300" />
            <div className="text-sm font-semibold text-gray-500">Run #{runId} không tìm thấy</div>
          </div>
        </div>
      </div>
    );
  }

  const activeLineTasks = activeTab ? runTasks.filter(t => t.line_id === activeTab) : [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="shrink-0 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3 h-14 px-5">
          <button onClick={() => navigate("/my-tasks")} className={`${BTN_SM} bg-white border-gray-200 text-gray-600 hover:bg-gray-50`}>
            <ArrowLeft size={13} /> Danh sách
          </button>
          <div className="h-4 w-px bg-gray-200" />
          <div>
            <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
              Run #{runId}
              <span className="text-xs font-mono font-normal text-gray-400">{meta?.run_label}</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
              <Calendar size={10} /> {meta?.period_label}
              <span className="text-gray-200">·</span>
              <Layers size={10} /> {lines.join(", ")}
            </div>
          </div>
        </div>

        {/* Line tabs */}
        <div className="flex items-center gap-0 px-5 overflow-x-auto border-t border-gray-100">
          {lines.map(lineId => {
            const lineTasks = runTasks.filter(t => t.line_id === lineId);
            const pending   = lineTasks.filter(t => t.status === "pending").length;
            const isActive  = activeTab === lineId;
            return (
              <button
                key={lineId}
                onClick={() => setActiveTab(lineId)}
                className={clsx(
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap",
                  isActive
                    ? "border-blue-600 text-blue-700 bg-blue-50/50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                )}
              >
                <Layers size={12} />
                {lineId}
                {pending > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 ml-0.5">
                    {pending}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Tab content */}
      <div className="flex-1 overflow-auto bg-gray-50 p-5">
        {activeTab && (
          <LineTab
            key={activeTab}
            lineId={activeTab}
            tasks={activeLineTasks}
            scheduleData={scheduleData?.by_line?.[activeTab]}
            runId={runId}
            step={step}
          />
        )}
      </div>
    </div>
  );
}
