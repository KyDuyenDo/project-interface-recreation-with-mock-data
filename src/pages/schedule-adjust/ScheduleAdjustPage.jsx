import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  Undo2, Save, CheckCircle2, AlertCircle, MessageSquare,
  AlertTriangle, Lock, ArrowLeft, ListOrdered, CalendarDays,
  History, Snowflake, Calendar, Info, Table2, Bell, X,
} from "lucide-react";

import { useAuthStore } from "../../store/authStore";
import { usePermissions } from "../../hooks";
import { useRunDetail, useRunOutputOrders, useRunOutputDaily } from "../../hooks/useRuns";
import { wizardStateApi } from "../../api";
import { useToast } from "../../components/ui/overlays";
import { Spinner } from "../../components/ui";
import { fmtDate } from "../../utils";
import ScheduleCalendar from "../ga-config/components/ScheduleCalendar";
import LineSequenceTab  from "../ga-config/components/LineSequenceTab";
import DailyReport      from "../ga-config/components/DailyReport";
import ScheduleTable    from "../ga-config/components/ScheduleTable";

// ── Helpers (same as Step6Edit) ───────────────────────────────────────────────
const PALETTE = [
  "#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444","#ec4899",
  "#8b5cf6","#14b8a6","#f97316","#84cc16","#06b6d4","#d946ef",
  "#3b82f6","#22c55e","#eab308","#fb7185","#a855f7","#0891b2",
];
function hash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
const orderColor = (id) => PALETTE[hash(id || "") % PALETTE.length];

function buildChunksFromDaily(dailyRows, orders) {
  const orderMap = {};
  for (const o of orders) orderMap[o.order_id] = o;
  const result = [];
  for (const r of dailyRows) {
    const oid = r.scbh, qty = r.qty ?? 0;
    if (!oid || !r.date || !r.line || qty <= 0) continue;
    const o = orderMap[oid];
    result.push({
      id: `${oid}|${r.date}|${r.line}`, order_id: oid, article: o?.article ?? "",
      customer: o?.customer ?? "", line: r.line, date: r.date, qty, sizes: r.sizes ?? {},
      color: orderColor(oid), crd: o?.crd ?? null, lpd: o?.lpd ?? null,
      go_start: o?.go_start ?? null, go_end: o?.go_end ?? null,
      sew_start: o?.sew_start ?? null, sew_end: o?.sew_end ?? null,
      is_late: o?.is_late || (o?.crd && r.date > o.crd) || false,
      total_qty: o?.qty_total ?? 0, stage: r.stage ?? null, state: o?.state ?? null,
    });
  }
  return result;
}

function buildChunks(orders) {
  const result = [];
  for (const o of orders) {
    const oid = o.order_id, line = o.line_go ?? o.line_may;
    const start = o.go_start, end = o.go_end;
    if (!oid || !line || !start || !end) continue;
    const color = orderColor(oid), isLate = o.is_late || (o.crd && o.go_end > o.crd);
    const workDays = [];
    const cursor = new Date(start + "T00:00:00Z"), endDate = new Date(end + "T00:00:00Z");
    while (cursor <= endDate) {
      if (cursor.getUTCDay() !== 0) workDays.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    if (!workDays.length) continue;
    const totalQty = o.qty_total ?? 0, perDay = Math.floor(totalQty / workDays.length);
    let remaining = totalQty;
    workDays.forEach((dateStr, i) => {
      const qty = i === workDays.length - 1 ? remaining : perDay;
      remaining -= qty;
      if (qty <= 0) return;
      result.push({
        id: `${oid}|${dateStr}`, order_id: oid, article: o.article ?? "", customer: o.customer ?? "",
        line, date: dateStr, qty, sizes: o.sizes ?? {}, color, crd: o.crd ?? null, lpd: o.lpd ?? null,
        go_start: o.go_start ?? null, go_end: o.go_end ?? null,
        sew_start: o.sew_start ?? null, sew_end: o.sew_end ?? null,
        is_late: isLate, total_qty: totalQty,
      });
    });
  }
  return result;
}

const FROZEN_UNTIL = "2026-06-25";

// ── KPI Pill ──────────────────────────────────────────────────────────────────
function KpiPill({ label, value, color = "slate" }) {
  const cls = {
    slate: "bg-slate-100 text-slate-600",
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700",
    red:   "bg-red-100 text-red-700",
  }[color];
  return (
    <div className={clsx("flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs", cls)}>
      <span className="text-sm font-bold tabular-nums">{value}</span>
      <span className="font-medium opacity-75">{label}</span>
    </div>
  );
}

// ── Inspector panel ───────────────────────────────────────────────────────────
function InspectorPanel({ order, onClose }) {
  const [note, setNote] = useState("");
  const toast = useToast();
  if (!order) return null;
  const isLate = order.crd && order.go_end > order.crd;
  const isFrozen = order.go_start && order.go_start <= FROZEN_UNTIL;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 shrink-0 bg-white">
        <button onClick={onClose} className="rounded-md p-1 hover:bg-slate-100 text-slate-500 transition">
          <ArrowLeft size={15} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-xs font-semibold text-slate-800 truncate">{order.order_id}</div>
          <div className="text-[10px] text-slate-400 truncate">{order.article}</div>
        </div>
        {isLate && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 shrink-0">
            <AlertTriangle size={10} /> Trễ
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5 text-xs bg-white">
        {[
          ["Khách hàng", order.customer || "—"],
          ["Chuyền gò",  order.line_go  || order.line || "—"],
          ["Chuyền may", order.line_may || "—"],
          ["Số lượng",   order.qty_total ? order.qty_total.toLocaleString("vi-VN") + " đôi" : "—"],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <span className="text-slate-400 shrink-0">{k}</span>
            <span className="font-medium text-slate-700 text-right">{v}</span>
          </div>
        ))}
        <hr className="border-slate-100" />
        {[
          ["Bắt đầu gò",  fmtDate(order.go_start), false],
          ["Kết thúc gò", fmtDate(order.go_end),   false],
          ["CRD",         fmtDate(order.crd),       isLate],
        ].map(([k, v, hi]) => (
          <div key={k} className="flex justify-between gap-2">
            <span className="text-slate-400 shrink-0">{k}</span>
            <span className={clsx("font-medium text-right", hi ? "text-red-600" : "text-slate-700")}>{v}</span>
          </div>
        ))}
        <hr className="border-slate-100" />
        {isFrozen ? (
          <div className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
            <Lock size={12} className="text-slate-400 shrink-0 mt-0.5" />
            <p className="text-slate-500 leading-snug">Đơn này đang trong <strong>vùng đóng băng</strong> — đã vào sản xuất.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block font-medium text-slate-600">Ghi chú điều chỉnh</label>
            <textarea
              rows={3} value={note} onChange={e => setNote(e.target.value)}
              placeholder="Lý do điều chỉnh..."
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
            />
            <button
              onClick={() => { toast("Đã lưu ghi chú", "success"); onClose(); }}
              className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition">
              Lưu ghi chú
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Orders table (right panel default) ───────────────────────────────────────
function OrdersTable({ orders, chunks, onSelectOrder }) {
  const [search, setSearch] = useState("");
  const lastDates = useMemo(() => {
    const m = {};
    for (const c of chunks) { if (!m[c.order_id] || c.date > m[c.order_id]) m[c.order_id] = c.date; }
    return m;
  }, [chunks]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? orders.filter(o => o.order_id?.toLowerCase().includes(q) || o.article?.toLowerCase().includes(q)) : orders;
  }, [orders, search]);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-3 py-2 border-b border-slate-200 shrink-0">
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
          Bảng đơn · chuyền của tôi ({orders.length})
        </div>
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Tìm mã đơn..." 
          className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs focus:border-blue-400 focus:bg-white focus:outline-none transition"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">Không có đơn nào</div>
        ) : filtered.map(o => {
          const last = lastDates[o.order_id];
          const isLate = o.crd && last && last > o.crd;
          const isFrozen = o.go_start && o.go_start <= FROZEN_UNTIL;
          return (
            <button
              key={o.order_id} onClick={() => onSelectOrder(o)}
              className="w-full text-left border-b border-slate-100 px-3 py-2.5 hover:bg-blue-50/50 transition">
              <div className="flex items-center gap-2 mb-0.5">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: o.color || "#6366f1" }}
                />
                <span className="font-mono text-xs font-semibold text-slate-800 flex-1 truncate">{o.order_id}</span>
                {isFrozen && <Lock size={11} className="text-slate-300 shrink-0" />}
                {isLate && !isFrozen && (
                  <span className="text-[10px] font-semibold text-red-600 bg-red-50 rounded px-1.5 shrink-0">Trễ</span>
                )}
                {!isLate && !isFrozen && (
                  <span className="text-[10px] font-semibold text-green-600 bg-green-50 rounded px-1.5 shrink-0">OK</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400 ml-4">
                <span className={clsx(
                  "rounded px-1.5 py-0.5 font-semibold",
                  (o.line_go || "").startsWith("A") ? "bg-violet-100 text-violet-600" :
                  (o.line_go || "").startsWith("B") ? "bg-blue-100 text-blue-600" :
                  "bg-teal-100 text-teal-600"
                )}>{o.line_go || o.line || "—"}</span>
                <span>CRD: <strong className={isLate ? "text-red-500" : "text-slate-600"}>{fmtDate(o.crd)}</strong></span>
                <span className="ml-auto">{last ? fmtDate(last) : "—"}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Delay reason color config ─────────────────────────────────────────────────
const DELAY_COLOR_CFG = {
  orange: { badge: "bg-orange-100 text-orange-700 border-orange-200", bar: "border-l-orange-400" },
  amber:  { badge: "bg-amber-100 text-amber-700 border-amber-200",   bar: "border-l-amber-400"  },
  purple: { badge: "bg-purple-100 text-purple-700 border-purple-200", bar: "border-l-purple-400" },
  blue:   { badge: "bg-blue-100 text-blue-700 border-blue-200",      bar: "border-l-blue-400"   },
  red:    { badge: "bg-red-100 text-red-700 border-red-200",         bar: "border-l-red-400"    },
  slate:  { badge: "bg-slate-100 text-slate-600 border-slate-200",   bar: "border-l-slate-300"  },
};

// ── Late order alert card ─────────────────────────────────────────────────────
function LateOrderCard({ order, note, onNoteChange }) {
  const cfg = DELAY_COLOR_CFG[order.delay_color] || DELAY_COLOR_CFG.slate;
  return (
    <div className={clsx(
      "rounded-xl border border-slate-200 border-l-4 bg-white p-4 flex flex-col gap-2.5",
      cfg.bar,
    )}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold text-slate-800">{order.order_id}</span>
            {order.article && <><span className="text-slate-300">·</span><span className="text-xs text-slate-500 truncate">{order.article}</span></>}
            {order.customer && <span className="text-xs text-slate-400 italic truncate">{order.customer}</span>}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px]">
            <span className="text-slate-500">
              CRD: <strong className="text-red-600">{fmtDate(order.crd)}</strong>
            </span>
            {order.go_end && (
              <span className="text-slate-500">
                Gò xong: <strong className="text-slate-700">{fmtDate(order.go_end)}</strong>
              </span>
            )}
            {order.days_late > 0 && (
              <span className="inline-flex items-center gap-1 font-bold text-red-600">
                <AlertCircle size={10} /> +{order.days_late} ngày
              </span>
            )}
          </div>
        </div>
        {order.delay_label && (
          <span className={clsx("shrink-0 rounded-full border text-[10px] font-semibold px-2.5 py-0.5 whitespace-nowrap", cfg.badge)}>
            {order.delay_label}
          </span>
        )}
      </div>

      {/* System delay note */}
      {order.delay_note && (
        <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 leading-relaxed border border-slate-100">
          {order.delay_note}
        </p>
      )}

      {/* Planner note input */}
      <div className="flex items-start gap-2">
        <MessageSquare size={12} className="text-slate-400 shrink-0 mt-2" />
        <textarea
          rows={2}
          value={note}
          onChange={e => onNoteChange(order.order_id, e.target.value)}
          placeholder="Thêm ghi chú xử lý của planner..."
          className="flex-1 text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 placeholder:text-slate-300 transition"
        />
      </div>
    </div>
  );
}

// ── Edit history table ────────────────────────────────────────────────────────
function EditHistorySection({ edits }) {
  const LABELS    = { move: "Di chuyển", add: "Thêm mới", delete: "Xóa", qty_change: "Sửa SL" };
  const ACTION_CLS = {
    move:       "bg-blue-50 text-blue-700",
    add:        "bg-emerald-50 text-emerald-700",
    delete:     "bg-red-50 text-red-700",
    qty_change: "bg-amber-50 text-amber-700",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
        <History size={13} className="text-slate-500" />
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Lịch sử chỉnh sửa phiên này</span>
        {edits.length > 0 && (
          <span className="ml-auto rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5">
            {edits.length} thay đổi
          </span>
        )}
      </div>
      {!edits?.length ? (
        <div className="flex items-center justify-center py-12 text-sm text-slate-400">
          Chưa có chỉnh sửa nào trong phiên này.
        </div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
              <tr>
                {["Giờ", "Mã đơn", "Hành động", "Chuyền cũ → mới", "Ngày cũ → mới", "Người TH"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {edits.map((e, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap font-mono text-[11px]">
                    {e.changed_at ? new Date(e.changed_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono font-bold text-slate-700">{e.order_id || e.chunk_id?.split("|")[0] || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-semibold", ACTION_CLS[e.action] || "bg-slate-100 text-slate-600")}>
                      {LABELS[e.action] || e.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {e.old_line && e.new_line && e.old_line !== e.new_line
                      ? <span>{e.old_line} <span className="text-slate-400 mx-1">→</span><strong className="text-slate-800">{e.new_line}</strong></span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-600">
                    {e.old_date && e.new_date && e.old_date !== e.new_date
                      ? <span>{fmtDate(e.old_date)} <span className="text-slate-400 mx-1">→</span><strong className="text-slate-800">{fmtDate(e.new_date)}</strong></span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{e.changed_by || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main tabs ─────────────────────────────────────────────────────────────────
const MAIN_TABS = [
  { key: "lich",    label: "Lịch sắp xếp",  Icon: Calendar },
  { key: "bang",    label: "Bảng chi tiết",  Icon: Table2 },
  { key: "lineup",  label: "Nối đuôi",       Icon: ListOrdered },
  { key: "daily",   label: "Báo cáo ngày",   Icon: CalendarDays },
  { key: "history", label: "Lịch sử",        Icon: History },
];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ScheduleAdjustPage() {
  const { runId: runIdStr } = useParams();
  const navigate            = useNavigate();
  const ACTIVE_RUN_ID       = parseInt(runIdStr, 10) || 48;

  const perms = usePermissions();
  const toast = useToast();
  const qc    = useQueryClient();

  const lineFilter = perms.myLines?.length ? perms.myLines : null;

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: ordersData, isLoading: ordersLoading } = useRunOutputOrders(ACTIVE_RUN_ID, { page_size: 500 });
  const { data: dailyData,  isLoading: dailyLoading  } = useRunOutputDaily(ACTIVE_RUN_ID);
  const { data: runData                               } = useRunDetail(ACTIVE_RUN_ID);
  const { data: chunkEdits = []                       } = useQuery({
    queryKey: ["chunk-edits", ACTIVE_RUN_ID],
    queryFn:  () => wizardStateApi.getChunkEdits(ACTIVE_RUN_ID),
    staleTime: 0,
  });

  const allOrders = useMemo(() => {
    const raw = ordersData?.orders ?? ordersData?.items ?? [];
    return raw.map(o => ({ ...o, order_id: o.scbh ?? o.order_id, color: orderColor(o.scbh ?? o.order_id ?? "") }));
  }, [ordersData]);

  const dailyRows = useMemo(() => dailyData?.rows ?? [], [dailyData]);
  const apiChunks = useMemo(
    () => dailyRows.length > 0 ? buildChunksFromDaily(dailyRows, allOrders) : buildChunks(allOrders),
    [dailyRows, allOrders]
  );

  // ── State ─────────────────────────────────────────────────────────────────
  const [localChunks, setLocalChunks] = useState(null);
  const [edits,       setEdits]       = useState({});
  const [undoStack,   setUndoStack]   = useState([]);
  const [saveStatus,  setSaveStatus]  = useState("idle");
  const saveTimer = useRef(null);

  const [mainTab,       setMainTab]       = useState("lich");
  const [plannerNotes,  setPlannerNotes]  = useState({});
  const [lateAlertOpen, setLateAlertOpen] = useState(false);

  const hasChanges = localChunks !== null;

  useEffect(() => { setLocalChunks(null); setEdits({}); setUndoStack([]); }, [allOrders]);

  // ── Filtered ──────────────────────────────────────────────────────────────
  const chunks = useMemo(() => {
    const base = localChunks ?? apiChunks;
    return lineFilter?.length ? base.filter(c => lineFilter.includes(c.line)) : base;
  }, [localChunks, apiChunks, lineFilter]);

  const orders = useMemo(() => {
    if (!lineFilter?.length) return allOrders;
    return allOrders.filter(o =>
      lineFilter.includes(o.line_go) || lineFilter.includes(o.line_may) || lineFilter.includes(o.line)
    );
  }, [allOrders, lineFilter]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = orders.length;
    const lastDates = {};
    for (const c of chunks) { if (!lastDates[c.order_id] || c.date > lastDates[c.order_id]) lastDates[c.order_id] = c.date; }
    const late = Object.entries(lastDates).filter(([oid, d]) => {
      const o = orders.find(x => x.order_id === oid);
      return o?.crd && d > o.crd;
    }).length;
    const onTimePct = total > 0 ? Math.round((total - late) / total * 100) : 100;
    const covered = {};
    for (const c of chunks) covered[c.order_id] = (covered[c.order_id] ?? 0) + c.qty;
    const unscheduled = orders.filter(o => o.state !== "IN_PROGRESS" && Math.max(0, (o.qty_total ?? 0) - (covered[o.order_id] ?? 0)) > 0).length;
    return { total, late, onTimePct, unscheduled };
  }, [chunks, orders]);

  const lateOrders = useMemo(() => orders.filter(o => o.is_late && o.delay_reason), [orders]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleChunkChanged = useCallback(async (change) => {
    setUndoStack(s => [...s.slice(-19), localChunks ?? apiChunks]);
    setSaveStatus("saving");
    clearTimeout(saveTimer.current);
    try {
      await wizardStateApi.singleChunkEdit(ACTIVE_RUN_ID, change);
      qc.invalidateQueries({ queryKey: ["chunk-edits", ACTIVE_RUN_ID] });
      setSaveStatus("saved");
      saveTimer.current = setTimeout(() => setSaveStatus("idle"), 2500);
    } catch { setSaveStatus("idle"); }
  }, [localChunks, apiChunks, qc]);

  const handleUndo = () => {
    if (!undoStack.length) return;
    setLocalChunks(undoStack[undoStack.length - 1]);
    setUndoStack(s => s.slice(0, -1));
    toast("Đã hoàn tác", "info");
  };

  const dataLoading = ordersLoading || dailyLoading;
  const runLabel    = runData?.run_label ?? `Run #${ACTIVE_RUN_ID}`;

  return (
    <div className="relative flex flex-col h-full overflow-hidden bg-white">

      {/* ── TOPBAR ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 h-12 flex items-center gap-3 border-b border-slate-200 bg-white px-4">
        {/* Back button */}
        <button
          onClick={() => navigate("/schedule-adjust")}
          className="shrink-0 flex items-center gap-1 rounded-lg px-2 py-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          title="Về danh sách lịch"
        >
          <ArrowLeft size={14} />
        </button>

        {/* Breadcrumb: title + run context */}
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <span
            className="text-xs text-slate-400 hover:text-blue-600 cursor-pointer transition-colors"
            onClick={() => navigate("/schedule-adjust")}
          >
            Điều chỉnh lịch
          </span>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-bold text-slate-800 truncate max-w-[160px]">{runLabel}</span>
          {hasChanges && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold px-2 py-0.5 border border-amber-200 shrink-0">
              Chưa lưu
            </span>
          )}
        </div>

        {/* Line badges */}
        {lineFilter?.length > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            {lineFilter.map(l => (
              <span key={l} className={clsx(
                "rounded px-1.5 py-0.5 text-[10px] font-bold",
                l.startsWith("A") ? "bg-violet-100 text-violet-700" :
                l.startsWith("B") ? "bg-blue-100 text-blue-700" :
                "bg-teal-100 text-teal-700"
              )}>{l}</span>
            ))}
          </div>
        )}

        {/* KPI pills — centered */}
        <div className="flex items-center gap-1.5 mx-auto">
          <KpiPill label="đơn" value={kpis.total} color="slate" />
          <KpiPill label="đúng hạn"
            value={`${kpis.onTimePct}%`}
            color={kpis.onTimePct >= 80 ? "green" : kpis.onTimePct >= 60 ? "amber" : "red"} />
          <KpiPill label="trễ" value={kpis.late} color={kpis.late > 0 ? "red" : "slate"} />
          <KpiPill label="chưa sắp" value={kpis.unscheduled} color={kpis.unscheduled > 0 ? "amber" : "slate"} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {saveStatus === "saving" && <span className="text-xs text-slate-400 mr-1">Đang lưu...</span>}
          {saveStatus === "saved"  && <span className="text-xs text-green-600 flex items-center gap-1 mr-1"><CheckCircle2 size={12}/> Đã lưu</span>}

          <button onClick={handleUndo} disabled={!undoStack.length} title="Hoàn tác"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition">
            <Undo2 size={13} />
            Hoàn tác
            {undoStack.length > 0 && <span className="rounded-full bg-slate-100 text-[10px] px-1.5">{undoStack.length}</span>}
          </button>

          <button onClick={() => toast("Đã lưu nháp lịch điều chỉnh", "success")}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition">
            <Save size={13} />
            Lưu nháp
          </button>

          <button onClick={() => { setLocalChunks(null); setUndoStack([]); toast("Lịch đã được xác nhận và áp dụng", "success"); }}
            disabled={!hasChanges}
            className="flex items-center gap-1.5 rounded-lg border border-blue-600 bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition">
            <CheckCircle2 size={13} />
            Xác nhận lịch
          </button>
        </div>
      </div>

      {/* ── TAB BAR ────────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex items-center">
          {MAIN_TABS.map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setMainTab(key)}
              className={clsx(
                "flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap",
                mainTab === key
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              )}>
              <Icon size={13} />
              {label}
              {key === "history" && chunkEdits.length > 0 && (
                <span className="rounded-full bg-blue-100 text-blue-700 text-[10px] px-1.5 font-bold">{chunkEdits.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {lateOrders.length > 0 && (
            <button
              onClick={() => setLateAlertOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
            >
              <Bell size={12} className="shrink-0" />
              <span>{lateOrders.length} đơn trễ</span>
            </button>
          )}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Snowflake size={11} className="text-blue-400 shrink-0" />
            <span>Đóng băng đến <strong className="text-slate-600">{fmtDate(FROZEN_UNTIL)}</strong></span>
          </div>
        </div>
      </div>

      {/* ── BODY ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden bg-white">
        <div className="flex-1 min-h-0 flex flex-col min-w-0">
          {dataLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Spinner size={32} />
            </div>
          ) : (
            <>
              {/* Calendar tab — ScheduleCalendar manages its own scroll */}
              {mainTab === "lich" && (
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-3">
                  <ScheduleCalendar
                    runId={ACTIVE_RUN_ID}
                    orders={orders}
                    chunks={chunks}
                    initialChunks={apiChunks}
                    setChunks={setLocalChunks}
                    edits={edits}
                    setEdits={setEdits}
                    onChunkChanged={handleChunkChanged}
                    usingFallback={dailyRows.length === 0}
                    hasDailyData={dailyRows.length > 0}
                    viewOnly={false}
                  />
                </div>
              )}

              {/* Bảng chi tiết tab */}
              {mainTab === "bang" && (
                <div className="flex-1 min-h-0 overflow-auto">
                  <div className="p-5">
                    <ScheduleTable chunks={chunks} edits={edits} />
                  </div>
                </div>
              )}

              {/* Nối đuôi tab */}
              {mainTab === "lineup" && (
                <div className="flex-1 min-h-0 overflow-auto">
                  <div className="p-5">
                    <LineSequenceTab runId={ACTIVE_RUN_ID} orders={orders} />
                  </div>
                </div>
              )}

              {/* Báo cáo ngày tab — DailyReport manages its own internal scroll */}
              {mainTab === "daily" && (
                <div className="flex-1 min-h-0 overflow-hidden p-4">
                  <DailyReport runId={ACTIVE_RUN_ID} capacityOverrides={{}} />
                </div>
              )}

              {/* Lịch sử tab — edit history only */}
              {mainTab === "history" && (
                <div className="flex-1 min-h-0 overflow-auto bg-slate-50">
                  <div className="p-5 max-w-5xl">
                    <EditHistorySection edits={chunkEdits} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Late-orders slide-in drawer (right → left) ───────────────────── */}
      {/* Backdrop */}
      <div
        onClick={() => setLateAlertOpen(false)}
        className={clsx(
          "absolute inset-0 z-40 bg-black/20 transition-opacity duration-300",
          lateAlertOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      />
      {/* Panel */}
      <div
        className={clsx(
          "absolute inset-y-0 right-0 z-50 flex w-[400px] max-w-full flex-col bg-white shadow-2xl border-l border-slate-200",
          "transition-transform duration-300 ease-in-out",
          lateAlertOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 shrink-0 bg-white">
          <Bell size={14} className="text-red-500 shrink-0" />
          <span className="flex-1 text-sm font-bold text-slate-800">Đơn trễ hạn — cần xử lý</span>
          <span className="rounded-full bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5">
            {lateOrders.length} đơn
          </span>
          <button
            onClick={() => setLateAlertOpen(false)}
            className="ml-1 rounded-md p-1 hover:bg-slate-100 text-slate-400 transition"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
          {lateOrders.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 mt-2">
              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
              <p className="text-xs font-semibold text-emerald-700">Không có đơn trễ hạn trong lịch này.</p>
            </div>
          ) : lateOrders.map(o => (
            <LateOrderCard
              key={o.order_id}
              order={o}
              note={plannerNotes[o.order_id] ?? ""}
              onNoteChange={(id, v) => setPlannerNotes(n => ({ ...n, [id]: v }))}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
