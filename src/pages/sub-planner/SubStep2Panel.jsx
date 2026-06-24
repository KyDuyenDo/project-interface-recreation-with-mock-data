/**
 * SubStep2Panel — reusable panel for Sub-Planner Step 2 (Capacity / Approval)
 * Embedded in RunDetailPage for the sub-planner view of a run's step 2.
 * Logic extracted from RunDetailForSub.jsx.
 */
import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Layers, BarChart2, Activity, CheckCircle2, X, Clock,
  Package, AlertTriangle, Check, Loader2, ShieldAlert,
  TrendingDown, MessageSquare, Users, Send, RotateCcw,
} from "lucide-react";
import { clsx } from "clsx";
import { useAuthStore } from "../../store/authStore";
import { http } from "../../api/http";

const BTN_SM = "inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_XS = "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const COL_W     = 40;
const BAR_MAX_H = 160;
const CAPACITY_DAY = 1200;
const Y_AXIS_W  = 44;
const GRID_LINES = [0.25, 0.5, 0.75, 1.0];

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

const REJECT_REASONS = [
  { key: "wrong_model",  label: "Sai dạng giày",    desc: "Model được phân công không phù hợp với năng lực của chuyền.", Icon: ShieldAlert, color: "red" },
  { key: "no_capacity",  label: "Không đủ năng lực", desc: "Sản lượng vượt quá công suất của chuyền trong giai đoạn này.", Icon: TrendingDown, color: "orange" },
];
const REASON_LABEL = { wrong_model: "Sai dạng giày", no_capacity: "Không đủ năng lực" };

// ── Local decision badge ──────────────────────────────────────────────────────
function DecisionBadge({ decision }) {
  if (!decision || decision.status === null) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border bg-gray-50 text-gray-400 border-gray-200">
        <Clock size={10} /> Chưa đánh giá
      </span>
    );
  }
  if (decision.status === "accepted") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
        <CheckCircle2 size={10} /> Dự kiến chấp nhận
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border bg-red-50 text-red-600 border-red-200">
      <AlertTriangle size={10} /> Dự kiến từ chối
    </span>
  );
}

// ── Reject dialog ─────────────────────────────────────────────────────────────
function RejectDialog({ orderId, orderLabel, onClose, onConfirm }) {
  const [reason, setReason] = useState(null);
  const [note,   setNote]   = useState("");
  const colorMap = {
    red:    { border: "border-red-300",    bg: "bg-red-50",    text: "text-red-700",    ring: "ring-red-200" },
    orange: { border: "border-orange-300", bg: "bg-orange-50", text: "text-orange-700", ring: "ring-orange-200" },
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <div>
              <div className="text-sm font-bold text-gray-900">Từ chối đơn hàng</div>
              <div className="text-[11px] text-gray-400 font-mono">{orderLabel || orderId}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X size={15} /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-500">Chọn lý do từ chối đơn hàng này:</p>
          {REJECT_REASONS.map(r => {
            const c = colorMap[r.color];
            const sel = reason === r.key;
            return (
              <button key={r.key} onClick={() => setReason(r.key)}
                className={clsx("w-full text-left p-3 rounded-xl border-2 transition-all",
                  sel ? `${c.border} ${c.bg} ring-2 ${c.ring}` : "border-gray-200 hover:border-gray-300 hover:bg-gray-50")}>
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
              placeholder="Mô tả chi tiết vấn đề..." />
          </div>
        </div>
        <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className={`${BTN_SM} bg-white text-gray-600 border-gray-200 hover:bg-gray-50 flex-1 justify-center`}>Huỷ</button>
          <button disabled={!reason} onClick={() => { onConfirm(reason, note); onClose(); }}
            className={`${BTN_SM} bg-red-600 text-white border-red-600 hover:bg-red-700 flex-1 justify-center`}>
            <X size={12} /> Xác nhận từ chối
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Capacity chart ─────────────────────────────────────────────────────────────
function CapacityChart({ lineId, scheduleData }) {
  const scrollRef = useRef(null);
  const todayRef  = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const days = scheduleData?.days || [];
  const cap  = scheduleData?.capacity_per_day || CAPACITY_DAY;
  const CHART_H = BAR_MAX_H;
  const LABEL_H = 36;
  const TOTAL_H = CHART_H + LABEL_H;

  useEffect(() => {
    if (todayRef.current && scrollRef.current) {
      const el = todayRef.current;
      const c  = scrollRef.current;
      c.scrollLeft = Math.max(0, el.offsetLeft - c.offsetWidth / 2 + COL_W / 2);
    }
  }, [days.length]);

  if (!days.length) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200 gap-2">
        <Activity size={16} className="text-gray-300" /> Không có dữ liệu lịch sản xuất
      </div>
    );
  }

  const colourMap = {};
  days.forEach(d => (d.orders || []).forEach(o => {
    if (!colourMap[o.order_id]) colourMap[o.order_id] = orderColor(o.order_id);
  }));
  const legendOrders = [];
  const seen = new Set();
  days.forEach(d => (d.orders || []).forEach(o => {
    if (!seen.has(o.order_id)) { seen.add(o.order_id); legendOrders.push(o); }
  }));

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
          <BarChart2 size={14} className="text-blue-500" />
          Biểu đồ công suất · <span className="text-blue-600">{lineId}</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-200 inline-block border border-slate-300" />Trống</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-400 inline-block opacity-80" />Lịch SX</span>
          <span className="flex items-center gap-1.5"><span className="w-0.5 h-3.5 rounded-full bg-red-500 inline-block" />Hôm nay</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded-full bg-red-300 inline-block border-dashed border-t border-red-300" />100% công suất</span>
          <span className="font-semibold text-gray-400">{cap.toLocaleString()} đôi/ngày</span>
        </div>
      </div>
      <div className="flex" style={{ height: TOTAL_H + 8 }}>
        <div className="shrink-0 relative border-r border-gray-100" style={{ width: Y_AXIS_W, height: TOTAL_H + 8 }}>
          <div className="absolute inset-0 pt-1 pb-9 flex flex-col justify-between items-end pr-2">
            {[...GRID_LINES].reverse().map(pct => (
              <div key={pct} className="text-[9px] text-gray-400 font-medium leading-none">{Math.round(cap * pct / 1000)}k</div>
            ))}
            <div className="text-[9px] text-gray-300 font-medium leading-none">0</div>
          </div>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden select-none relative" style={{ height: TOTAL_H + 8 }}>
          <div className="absolute inset-0 pt-1 pointer-events-none" style={{ width: Math.max(days.length * COL_W + 16, 100) }}>
            {GRID_LINES.map(pct => (
              <div key={pct} className="absolute left-0 right-0"
                style={{ top: `${(1 - pct) * CHART_H + 4}px`, borderTop: pct === 1 ? "1.5px dashed #fca5a5" : "1px dashed #e5e7eb" }} />
            ))}
          </div>
          <div className="flex items-end relative" style={{ width: days.length * COL_W + 16, paddingLeft: 8, paddingRight: 8, paddingTop: 4, height: TOTAL_H + 8 }}>
            {days.map((day, di) => {
              const total   = (day.orders || []).reduce((s, o) => s + o.qty, 0);
              const fillPct = Math.min(total / cap, 1);
              const isToday = day.is_today;
              const isPast  = day.is_past;
              const isFirst = day.date.slice(8) === "01";
              const monthNum = parseInt(day.date.slice(5, 7));
              const dayNum   = day.date.slice(8);
              let accPct = 0;
              const segs = (day.orders || []).map(o => {
                const p = Math.min(o.qty / cap, 1 - accPct);
                const s = { ...o, p, yPct: accPct, color: colourMap[o.order_id] };
                accPct += p;
                return s;
              });
              return (
                <div key={day.date} ref={isToday ? todayRef : undefined}
                  className="flex flex-col items-center shrink-0 relative group" style={{ width: COL_W }}
                  onMouseEnter={() => setTooltip({ day, total })} onMouseLeave={() => setTooltip(null)}>
                  {isFirst && di > 0 && <div className="absolute left-0 top-0 bottom-9 w-px bg-blue-200 z-10" />}
                  {isToday && <div className="absolute inset-0 bottom-0 rounded-sm" style={{ background: "rgba(239,68,68,0.04)", top: 0, bottom: LABEL_H - 4 }} />}
                  <div className="relative shrink-0 overflow-hidden group-hover:ring-1 group-hover:ring-blue-300 transition-all"
                    style={{ width: COL_W - 4, height: CHART_H, background: isPast ? "#f1f5f9" : "#f0f4f8", borderRadius: "3px 3px 0 0", border: isToday ? "1.5px solid #ef4444" : "1px solid transparent" }}>
                    {segs.map((seg, si) => (
                      <div key={seg.order_id + si} className="absolute left-0 right-0 transition-opacity"
                        style={{ bottom: `${seg.yPct * 100}%`, height: `${seg.p * 100}%`, background: seg.color, opacity: isPast ? 0.35 : 0.85, minHeight: seg.p > 0 ? 2 : 0 }} />
                    ))}
                    {fillPct >= 1 && <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-500 opacity-80" />}
                    {isToday && <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-red-400 opacity-60" />}
                  </div>
                  <div className="flex flex-col items-center justify-start pt-1" style={{ height: LABEL_H }}>
                    {isToday ? (
                      <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-red-500 text-white leading-none">HN</span>
                    ) : (
                      <span className={clsx("text-[9px] leading-none font-medium", isPast ? "text-gray-300" : "text-gray-500")}>{dayNum}</span>
                    )}
                    {isFirst && <span className="text-[9px] font-bold text-blue-400 leading-none mt-0.5">T{monthNum}</span>}
                  </div>
                </div>
              );
            })}
          </div>
          {tooltip && (
            <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-gray-900 text-white text-[11px] rounded-lg px-3 py-2 shadow-lg whitespace-nowrap" style={{ minWidth: 160 }}>
              <div className="font-bold mb-1">{tooltip.day.date}</div>
              <div className="flex items-center gap-1">
                <span className="text-gray-400">Sản lượng:</span>
                <span className="font-semibold">{tooltip.total.toLocaleString()}</span>
                <span className="text-gray-400">/ {cap.toLocaleString()} đôi</span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-gray-700 overflow-hidden">
                <div className={clsx("h-full rounded-full", tooltip.total / cap >= 1 ? "bg-red-400" : tooltip.total / cap >= 0.75 ? "bg-amber-400" : "bg-emerald-400")}
                  style={{ width: `${Math.min(tooltip.total / cap, 1) * 100}%` }} />
              </div>
              <div className="text-gray-400 text-[10px] mt-0.5">{Math.round(tooltip.total / cap * 100)}% công suất</div>
            </div>
          )}
        </div>
      </div>
      {legendOrders.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2 border-t border-gray-100 bg-gray-50/50">
          {legendOrders.map(o => (
            <span key={o.order_id} className="flex items-center gap-1.5 text-[10px] text-gray-600">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: colourMap[o.order_id], opacity: 0.85 }} />
              <span className="font-mono font-semibold">{o.order_id}</span>
              {o.model && <span className="text-gray-400">· {o.model}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Line info panel ────────────────────────────────────────────────────────────
function LineInfoPanel({ lineId, tasks, scheduleData, decisions }) {
  const cap      = scheduleData?.capacity_per_day ?? CAPACITY_DAY;
  const days     = scheduleData?.days ?? [];
  const todayDay = days.find(d => d.is_today);
  const todayQty = todayDay ? todayDay.orders.reduce((s, o) => s + o.qty, 0) : 0;
  const utilPct  = Math.round((todayQty / cap) * 100);
  const totalQty = tasks.filter(t => t.order_id).reduce((s, t) => s + (t.qty || 0), 0);
  const orderTasks  = tasks.filter(t => t.order_id);
  const evaluated   = orderTasks.filter(t => decisions[t.order_id]?.status !== null && decisions[t.order_id]?.status !== undefined).length;
  const total       = orderTasks.length;
  const allDone     = evaluated === total && total > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center justify-between shadow-sm">
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">MÃ CHUYỀN</div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-bold bg-blue-100 text-blue-700 border border-blue-200">
            <Layers size={12} /> {lineId}
          </span>
        </div>

        <div className="h-8 w-px bg-gray-200 hidden sm:block" />

        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">CÔNG SUẤT MỤC TIÊU</div>
          <div className="text-sm font-bold text-gray-800">
            {cap.toLocaleString()} <span className="font-normal text-gray-400 text-[10px]">đôi/ngày</span>
          </div>
        </div>

        <div className="h-8 w-px bg-gray-200 hidden sm:block" />

        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">SỬ DỤNG HÔM NAY</div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-bold text-gray-800">{utilPct}%</div>
            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={clsx(
                  "h-full rounded-full",
                  utilPct > 90 ? "bg-red-400" : utilPct > 70 ? "bg-amber-400" : "bg-emerald-400"
                )}
                style={{ width: `${Math.min(utilPct, 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="h-8 w-px bg-gray-200 hidden sm:block" />

        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">TỔNG SẢN LƯỢNG PHÂN CÔNG</div>
          <div className="text-sm font-bold text-gray-800">
            {totalQty.toLocaleString()} <span className="font-normal text-gray-400 text-[10px]">đôi</span>
          </div>
        </div>
      </div>

      <div className="text-right mt-3 md:mt-0">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">ĐÁNH GIÁ ĐƠN HÀNG</div>
        {allDone ? (
          <div className="text-xs font-bold text-emerald-600 flex items-center justify-end gap-1">
            <CheckCircle2 size={12} className="text-emerald-500 stroke-[3px]" />
            <span>{evaluated}/{total} đơn đã xử lý — Sẵn sàng gửi</span>
          </div>
        ) : (
          <div className="text-xs font-bold text-blue-600 flex items-center justify-end gap-1">
            <Clock size={12} className="text-blue-500" />
            <span>{evaluated}/{total} đơn đã xử lý</span>
          </div>
        )}
        <div className="mt-1.5 w-48 h-1.5 bg-gray-100 rounded-full overflow-hidden ml-auto">
          <div
            className={clsx(
              "h-full rounded-full transition-all",
              allDone ? "bg-emerald-500" : "bg-blue-500"
            )}
            style={{ width: total > 0 ? `${(evaluated / total) * 100}%` : "0%" }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Orders table ──────────────────────────────────────────────────────────────
function OrdersTable({ orders, isSupport, decisions, onAccept, onReject, onUndo, submitted }) {
  const [rejectTarget, setRejectTarget] = useState(null);
  if (!orders.length) {
    return (
      <div className="flex items-center justify-center py-6 text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
        Không có đơn hàng {isSupport ? "phụ" : "chính"} nào
      </div>
    );
  }
  return (
    <>
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
              <th className="px-3 py-2 text-left font-semibold text-gray-500 min-w-[200px]">Đánh giá</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, i) => {
              const dec = decisions[o.order_id] || { status: null };
              const isEvaluated = dec.status !== null && dec.status !== undefined;
              return (
                <tr key={o.id || o.order_id}
                  className={clsx("border-b border-gray-100 transition-colors",
                    dec.status === "accepted" ? "bg-emerald-50/40" :
                    dec.status === "rejected" ? "bg-red-50/30" :
                    i % 2 === 0 ? "bg-white hover:bg-blue-50/20" : "bg-gray-50/40 hover:bg-blue-50/20"
                  )}>
                  <td className="px-3 py-2.5 font-mono font-bold text-blue-700">{o.order_id || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600">{o.article || "—"}</td>
                  <td className="px-3 py-2.5 font-medium text-gray-800">{o.model || "—"}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
                    {o.qty ? o.qty.toLocaleString() : "—"}
                    <span className="text-gray-400 font-normal ml-0.5">đôi</span>
                  </td>
                  <td className={clsx("px-3 py-2.5 font-medium",
                    o.crd && new Date(o.crd) < new Date() ? "text-red-600" : "text-gray-700"
                  )}>{fmtDate(o.crd)}</td>
                  <td className="px-3 py-2.5 text-gray-500">
                    {o.prod_start ? `${fmtDate(o.prod_start)} → ${fmtDate(o.prod_end)}` : "—"}
                  </td>
                  {isSupport && (
                    <td className="px-3 py-2.5">
                      {o.main_line_id ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                          <Layers size={9} /> {o.main_line_id}
                        </span>
                      ) : "—"}
                    </td>
                  )}
                  <td className="px-3 py-2.5">
                    {submitted ? (
                      <DecisionBadge decision={dec} />
                    ) : !isEvaluated ? (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => onAccept(o.order_id)}
                          className={`${BTN_XS} bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100`}>
                          <Check size={10} /> Chấp nhận
                        </button>
                        <button onClick={() => setRejectTarget(o)}
                          className={`${BTN_XS} bg-red-50 text-red-600 border-red-200 hover:bg-red-100`}>
                          <X size={10} /> Từ chối
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <DecisionBadge decision={dec} />
                        {dec.status === "rejected" && dec.reason && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-600 border border-red-200 font-medium">
                            {REASON_LABEL[dec.reason] || dec.reason}
                          </span>
                        )}
                        <button onClick={() => onUndo(o.order_id)}
                          className={`${BTN_XS} bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100`} title="Hoàn tác đánh giá">
                          <RotateCcw size={9} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rejectTarget && (
        <RejectDialog
          orderId={rejectTarget.order_id}
          orderLabel={`${rejectTarget.order_id} · ${rejectTarget.model || ""}`}
          onClose={() => setRejectTarget(null)}
          onConfirm={(reason, note) => { onReject(rejectTarget.order_id, reason, note); setRejectTarget(null); }}
        />
      )}
    </>
  );
}

// ── Line content ──────────────────────────────────────────────────────────────
function LineContent({ lineId, tasks, scheduleData, decisions, onDecide, submitted }) {
  const primaryOrders = tasks.filter(t => !t.is_support && t.order_id);
  const supportOrders = tasks.filter(t =>  t.is_support && t.order_id);
  const handleAccept  = (orderId) => onDecide(lineId, orderId, "accepted", null, "");
  const handleReject  = (orderId, reason, note) => onDecide(lineId, orderId, "rejected", reason, note);
  const handleUndo    = (orderId) => onDecide(lineId, orderId, null, null, "");
  const allOrders     = [...primaryOrders, ...supportOrders];
  const evaluated     = allOrders.filter(o => decisions[o.order_id]?.status).length;
  const total         = allOrders.length;
  const pendingCount  = total - evaluated;
  const handleAcceptAll = () => {
    allOrders.forEach(o => { if (!decisions[o.order_id]?.status) onDecide(lineId, o.order_id, "accepted", null, ""); });
  };

  return (
    <div className="space-y-4">
      <LineInfoPanel lineId={lineId} tasks={tasks} scheduleData={scheduleData} decisions={decisions} />
      <div>
        <div className="flex items-center gap-2 mb-2">
          <BarChart2 size={13} className="text-blue-500" />
          <span className="text-xs font-bold text-gray-700">Biểu đồ công suất</span>
        </div>
        <CapacityChart lineId={lineId} scheduleData={scheduleData} />
      </div>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Package size={13} className="text-blue-500" />
          <span className="text-xs font-bold text-gray-700">Đơn hàng chuyền chính</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">{primaryOrders.length}</span>
          {!submitted && pendingCount > 0 && (
            <button onClick={handleAcceptAll}
              className={`${BTN_XS} ml-auto bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100`}>
              <Check size={9} /> Chấp nhận tất cả chưa đánh giá
            </button>
          )}
        </div>
        <OrdersTable orders={primaryOrders} isSupport={false} decisions={decisions}
          onAccept={handleAccept} onReject={handleReject} onUndo={handleUndo} submitted={submitted} />
      </div>
      {supportOrders.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users size={13} className="text-violet-500" />
            <span className="text-xs font-bold text-gray-700">Đơn hàng chuyền phụ</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700">{supportOrders.length}</span>
            <span className="text-[10px] text-gray-400">(chuyền này hỗ trợ chuyền khác)</span>
          </div>
          <OrdersTable orders={supportOrders} isSupport={true} decisions={decisions}
            onAccept={handleAccept} onReject={handleReject} onUndo={handleUndo} submitted={submitted} />
        </div>
      )}
    </div>
  );
}

// ── Final submit panel ─────────────────────────────────────────────────────────
function FinalSubmitPanel({ runId, lines, runTasks, allDecisions, step, user, onSubmitSuccess }) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const submitMutation = useMutation({
    mutationFn: ({ lineDecisions }) =>
      http.post(`/runs/${runId}/step-approvals`, {
        step, planner_username: user?.username, final_submit: true, line_decisions: lineDecisions,
      }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      onSubmitSuccess();
    },
  });

  const lineStats = lines.map(lineId => {
    const tasks    = runTasks.filter(t => t.line_id === lineId && t.order_id);
    const decs     = allDecisions[lineId] || {};
    const total    = tasks.length;
    const accepted = tasks.filter(t => decs[t.order_id]?.status === "accepted").length;
    const rejected = tasks.filter(t => decs[t.order_id]?.status === "rejected").length;
    const evaluated = accepted + rejected;
    const pct = total > 0 ? Math.round((evaluated / total) * 100) : 0;
    return { lineId, total, accepted, rejected, evaluated, pct };
  });

  const grandTotal     = lineStats.reduce((s, l) => s + l.total, 0);
  const grandEvaluated = lineStats.reduce((s, l) => s + l.evaluated, 0);
  const grandAccepted  = lineStats.reduce((s, l) => s + l.accepted, 0);
  const grandRejected  = lineStats.reduce((s, l) => s + l.rejected, 0);
  const grandPending   = grandTotal - grandEvaluated;
  const canSubmit      = grandPending === 0 && grandTotal > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const lineDecisions = lines.map(lineId => {
        const tasks = runTasks.filter(t => t.line_id === lineId && t.order_id);
        const decs  = allDecisions[lineId] || {};
        return {
          line_id: lineId,
          orders:  tasks.map(t => ({ order_id: t.order_id, status: decs[t.order_id]?.status || "accepted", reason: decs[t.order_id]?.reason || null, note: decs[t.order_id]?.note || "" })),
        };
      });
      await submitMutation.mutateAsync({ lineDecisions });
    } catch (e) {
      console.error("Submit failed:", e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50 text-xs font-bold text-gray-700">
        <Send size={13} className="text-blue-500" />
        <span>Gửi kết quả cho Main Planner</span>
      </div>
      <div className="p-5 space-y-4">
        {/* Progress bar per line */}
        <div className="space-y-3">
          {lineStats.map(stat => (
            <div key={stat.lineId} className="flex items-center gap-3 text-xs">
              <span className="w-16 font-bold text-gray-700">{stat.lineId}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden relative">
                <div
                  className={clsx(
                    "h-full rounded-full transition-all",
                    stat.pct === 100 ? "bg-emerald-500" : "bg-blue-500"
                  )}
                  style={{ width: `${stat.pct}%` }}
                />
              </div>
              <span className="w-20 text-right font-medium">
                {stat.pct === 100 ? (
                  <span className="text-emerald-600 font-bold flex items-center justify-end gap-1">
                    ✓ Hoàn tất
                  </span>
                ) : (
                  <span className="text-gray-500">{stat.evaluated}/{stat.total} đơn</span>
                )}
              </span>
            </div>
          ))}
        </div>

        {/* Bottom bar with summary and submit button */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex items-center gap-4 text-xs font-medium text-gray-600">
            <span>Tổng: <strong className="text-gray-900">{grandTotal} đơn</strong></span>
            <span>Chấp nhận: <strong className="text-emerald-600">{grandAccepted}</strong></span>
            <span>Từ chối: <strong className={grandRejected > 0 ? "text-red-600" : "text-gray-900"}>{grandRejected}</strong></span>
          </div>

          <button
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
            className={clsx(
              "px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm",
              canSubmit
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200",
            )}
          >
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            <span>Gửi kết quả cho Main Planner</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main SubStep2Panel export ─────────────────────────────────────────────────
export default function SubStep2Panel({ runId, myLines, dispatchStep = 2 }) {
  const { user } = useAuthStore();
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const [allDecisions,  setAllDecisions]  = useState({});
  const [submitted,     setSubmitted]     = useState(false);

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ["my-tasks", user?.username],
    queryFn:  () => http.get("/tasks/my", { params: { username: user?.username } }).then(r => r.data),
    enabled:  !!user,
    refetchInterval: 30000,
  });

  const runTasks = useMemo(() => {
    const items = tasksData?.items || [];
    return items.filter(t => t.run_id === runId);
  }, [tasksData, runId]);

  const lines = useMemo(() => {
    const lids = [...new Set(runTasks.map(t => t.line_id).filter(Boolean))].sort();
    // Intersect with myLines if provided
    if (myLines && myLines.length > 0) return lids.filter(l => myLines.includes(l));
    return lids;
  }, [runTasks, myLines]);

  const activeLineId = lines[activeLineIdx] || null;
  const activeTasks  = useMemo(() => runTasks.filter(t => t.line_id === activeLineId), [runTasks, activeLineId]);

  // Check if already submitted
  const { data: submitStatus } = useQuery({
    queryKey:  ["step-submit-status", runId, dispatchStep, user?.username],
    queryFn:   () => http.get(`/runs/${runId}/step-approvals`, { params: { step: dispatchStep, username: user?.username } }).then(r => r.data),
    enabled:   !!runId && !!user,
    staleTime: 30_000,
  });
  const alreadySubmitted = submitStatus?.status === "confirmed" || submitted;

  // Fetch schedule for each line
  const { data: scheduleData } = useQuery({
    queryKey: ["sub-schedule", runId, activeLineId],
    queryFn:  () => http.get(`/runs/${runId}/sub-schedule/${activeLineId}`).then(r => r.data),
    enabled:  !!runId && !!activeLineId,
    staleTime: 60_000,
  });

  const lineDecisions = allDecisions[activeLineId] || {};

  const handleDecide = (lineId, orderId, status, reason, note) => {
    setAllDecisions(prev => ({
      ...prev,
      [lineId]: {
        ...(prev[lineId] || {}),
        [orderId]: status === null ? { status: null } : { status, reason, note },
      },
    }));
  };

  if (tasksLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 size={24} className="animate-spin text-blue-500" />
        <span className="ml-2 text-sm text-gray-500">Đang tải công việc…</span>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400">
        <Layers size={28} className="mb-2 text-gray-200" />
        <div className="text-sm font-semibold text-gray-500">Chưa có phân công nào</div>
        <div className="text-xs mt-1">Main Planner chưa gửi công việc cho bước này</div>
      </div>
    );
  }

  // Count confirmed/rejected per line
  const getLineStatus = (lineId) => {
    const lineTasks = runTasks.filter(t => t.line_id === lineId && t.order_id);
    const decs      = allDecisions[lineId] || {};
    const evaluated = lineTasks.filter(t => decs[t.order_id]?.status).length;
    const total     = lineTasks.length;
    return { evaluated, total, done: evaluated === total && total > 0 };
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Line tab bar (matches RunDetailForSub style) ── */}
      <div className="shrink-0 bg-white border-b border-gray-200">
        <div className="flex items-center gap-0 px-5 overflow-x-auto">
          {lines.map((lineId, idx) => {
            const { evaluated, total, done } = getLineStatus(lineId);
            const isActive = idx === activeLineIdx;
            return (
              <button
                key={lineId}
                onClick={() => setActiveLineIdx(idx)}
                className={clsx(
                  "flex items-center gap-1.5 px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap",
                  isActive
                    ? "border-blue-600 text-blue-600 bg-blue-50/10"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50",
                )}
              >
                <Layers size={13} className={isActive ? "text-blue-600" : "text-gray-400"} />
                <span>{lineId}</span>
                {done ? (
                  <Check size={13} className="text-emerald-500 stroke-[3px]" />
                ) : (
                  <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                    {evaluated}/{total}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="flex-1 overflow-auto bg-gray-50 p-5">
        <div className="space-y-4">
          {/* Active line content */}
          {activeLineId && (
            <LineContent
              lineId={activeLineId}
              tasks={activeTasks}
              scheduleData={scheduleData}
              decisions={lineDecisions}
              onDecide={handleDecide}
              submitted={alreadySubmitted}
            />
          )}

          {/* Submit panel */}
          {!alreadySubmitted && lines.length > 0 && (
            <FinalSubmitPanel
              runId={runId}
              lines={lines}
              runTasks={runTasks}
              allDecisions={allDecisions}
              step={dispatchStep}
              user={user}
              onSubmitSuccess={() => setSubmitted(true)}
            />
          )}

          {alreadySubmitted && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 font-semibold">
              <CheckCircle2 size={16} className="text-emerald-500" />
              Bạn đã gửi xác nhận cho Main Planner. Kết quả đã được ghi nhận.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
