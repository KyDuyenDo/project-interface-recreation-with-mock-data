import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  Undo2, Eye, Save, CheckCircle2, ChevronLeft, ChevronRight,
  AlertTriangle, Info, Layers, Lock, ArrowLeft,
  ListOrdered, CalendarDays, History, X, Snowflake,
} from "lucide-react";

import { useAuthStore } from "../../store/authStore";
import { usePermissions } from "../../hooks";
import { useRunDetail, useRunOutputOrders, useRunOutputDaily } from "../../hooks/useRuns";
import { wizardStateApi } from "../../api";
import { useToast } from "../../components/ui/overlays";
import { Spinner } from "../../components/ui";
import ScheduleCalendar from "../ga-config/components/ScheduleCalendar";
import LineSequenceTab  from "../ga-config/components/LineSequenceTab";
import DailyReport      from "../ga-config/components/DailyReport";
import { fmtDate } from "../../utils";

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
    const oid = r.scbh;
    const qty = r.qty ?? 0;
    if (!oid || !r.date || !r.line || qty <= 0) continue;
    const o = orderMap[oid];
    result.push({
      id: `${oid}|${r.date}|${r.line}`,
      order_id: oid, article: o?.article ?? "", customer: o?.customer ?? "",
      line: r.line, date: r.date, qty, sizes: r.sizes ?? {}, color: orderColor(oid),
      crd: o?.crd ?? null, lpd: o?.lpd ?? null,
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
    const oid  = o.order_id;
    const line = o.line_go ?? o.line_may;
    const start = o.go_start, end = o.go_end;
    if (!oid || !line || !start || !end) continue;
    const color = orderColor(oid);
    const isLate = o.is_late || (o.crd && o.go_end > o.crd);
    const workDays = [];
    const cursor = new Date(start + "T00:00:00Z");
    const endDate = new Date(end + "T00:00:00Z");
    while (cursor <= endDate) {
      if (cursor.getUTCDay() !== 0) workDays.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    if (!workDays.length) continue;
    const totalQty = o.qty_total ?? 0;
    const perDay = Math.floor(totalQty / workDays.length);
    let remaining = totalQty;
    workDays.forEach((dateStr, i) => {
      const qty = i === workDays.length - 1 ? remaining : perDay;
      remaining -= qty;
      if (qty <= 0) return;
      result.push({
        id: `${oid}|${dateStr}`, order_id: oid, article: o.article ?? "",
        customer: o.customer ?? "", line, date: dateStr, qty, sizes: o.sizes ?? {},
        color, crd: o.crd ?? null, lpd: o.lpd ?? null,
        go_start: o.go_start ?? null, go_end: o.go_end ?? null,
        sew_start: o.sew_start ?? null, sew_end: o.sew_end ?? null,
        is_late: isLate, total_qty: totalQty,
      });
    });
  }
  return result;
}

const FROZEN_UNTIL = "2026-06-25"; // 2 ngày đầu từ hôm nay (2026-06-23)

// ── KPI Pill ─────────────────────────────────────────────────────────────────
function KpiPill({ label, value, color = "slate" }) {
  const colors = {
    slate:  "bg-slate-100 text-slate-700",
    green:  "bg-green-100 text-green-700",
    amber:  "bg-amber-100 text-amber-700",
    red:    "bg-red-100 text-red-700",
    blue:   "bg-blue-100 text-blue-700",
  };
  return (
    <div className={clsx("flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold", colors[color])}>
      <span className="text-base font-bold tabular-nums">{value}</span>
      <span className="text-xs font-medium opacity-80">{label}</span>
    </div>
  );
}

// ── Inspector panel (right panel when an order is selected) ───────────────────
function InspectorPanel({ order, onClose }) {
  const [note, setNote] = useState("");
  const toast = useToast();

  if (!order) return null;
  const isLate = order.crd && order.go_end > order.crd;

  const handleSave = () => {
    toast("Đã lưu ghi chú điều chỉnh", "success");
    onClose();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 shrink-0">
        <button onClick={onClose} className="rounded-md p-1 hover:bg-slate-100 text-slate-500">
          <ArrowLeft size={15} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-xs font-semibold text-slate-800 truncate">{order.order_id}</div>
          <div className="text-[10px] text-slate-400 truncate">{order.article}</div>
        </div>
        {isLate && (
          <span className="shrink-0 flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
            <AlertTriangle size={10} /> Trễ
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
        <InfoRow label="Khách hàng" value={order.customer || "—"} />
        <InfoRow label="Chuyền gò" value={order.line_go || order.line || "—"} />
        <InfoRow label="Chuyền may" value={order.line_may || "—"} />
        <InfoRow label="SL" value={order.qty_total ? order.qty_total.toLocaleString("vi-VN") + " đôi" : "—"} />
        <hr className="border-slate-100" />
        <InfoRow label="Ngày bắt đầu gò" value={fmtDate(order.go_start)} />
        <InfoRow label="Ngày kết thúc gò" value={fmtDate(order.go_end)} />
        <InfoRow label="CRD (Deadline)" value={fmtDate(order.crd)} highlight={isLate} />
        <hr className="border-slate-100" />

        {order.go_start <= FROZEN_UNTIL ? (
          <div className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
            <Lock size={13} className="text-slate-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500">Đơn này đang trong <strong>vùng đóng băng</strong> — đã vào sản xuất, không thể điều chỉnh.</p>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Ghi chú điều chỉnh</label>
              <textarea
                rows={3}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Lý do điều chỉnh, ghi chú cho Main Planner..."
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
              />
            </div>
            <button
              onClick={handleSave}
              className="w-full rounded-lg border border-blue-600 bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition">
              Lưu ghi chú
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-400 shrink-0">{label}</span>
      <span className={clsx("text-xs font-medium text-right", highlight ? "text-red-600" : "text-slate-700")}>{value}</span>
    </div>
  );
}

// ── Orders mini-table (right panel default mode) ───────────────────────────────
function OrdersTable({ orders, chunks, onSelectOrder }) {
  const [search, setSearch] = useState("");

  const lastDates = useMemo(() => {
    const m = {};
    for (const c of chunks) {
      if (!m[c.order_id] || c.date > m[c.order_id]) m[c.order_id] = c.date;
    }
    return m;
  }, [chunks]);

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter(o =>
      o.order_id?.toLowerCase().includes(q) || o.article?.toLowerCase().includes(q)
    );
  }, [orders, search]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-slate-200 shrink-0">
        <div className="text-xs font-semibold text-slate-600 mb-2">Bảng chi tiết đơn — chuyền của tôi</div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm mã đơn..."
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">Không có đơn nào</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                {["Mã đơn", "Chuyền", "Kết thúc", "CRD", "TT"].map(h => (
                  <th key={h} className="border-b border-slate-200 px-2 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => {
                const lastDate = lastDates[o.order_id];
                const isLate = o.crd && lastDate && lastDate > o.crd;
                const isFrozen = o.go_start && o.go_start <= FROZEN_UNTIL;
                return (
                  <tr
                    key={o.order_id}
                    onClick={() => onSelectOrder(o)}
                    className="border-b border-slate-100 hover:bg-blue-50/30 cursor-pointer transition-colors">
                    <td className="px-2 py-2">
                      <div className="font-mono font-semibold text-slate-800 truncate max-w-[80px]">{o.order_id}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[80px]">{o.article}</div>
                    </td>
                    <td className="px-2 py-2">
                      <span className={clsx(
                        "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold",
                        o.line_go?.startsWith("A") ? "bg-violet-100 text-violet-700" :
                        o.line_go?.startsWith("B") ? "bg-blue-100 text-blue-700" :
                        "bg-teal-100 text-teal-700"
                      )}>{o.line_go || o.line || "—"}</span>
                    </td>
                    <td className="px-2 py-2 font-mono text-slate-600">{fmtDate(lastDate)}</td>
                    <td className={clsx("px-2 py-2 font-mono", isLate ? "text-red-600 font-semibold" : "text-slate-600")}>{fmtDate(o.crd)}</td>
                    <td className="px-2 py-2">
                      {isFrozen ? (
                        <span title="Trong vùng đóng băng"><Lock size={11} className="text-slate-400" /></span>
                      ) : isLate ? (
                        <span className="text-[10px] font-semibold text-red-600 bg-red-50 rounded px-1">Trễ</span>
                      ) : (
                        <span className="text-[10px] font-semibold text-green-600 bg-green-50 rounded px-1">OK</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Diff drawer (Xem thay đổi) ─────────────────────────────────────────────────
function DiffDrawer({ edits, onClose }) {
  const ACTION_LABELS = { move: "Di chuyển", add: "Thêm mới", delete: "Xóa", qty_change: "Sửa SL" };
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-white border-t border-slate-200 shadow-xl" style={{ height: "40vh" }}>
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <div className="font-semibold text-slate-800">Xem thay đổi trong phiên này</div>
        <button onClick={onClose} className="rounded-md p-1 hover:bg-slate-100 text-slate-500"><X size={16} /></button>
      </div>
      <div className="overflow-auto h-[calc(40vh-53px)] p-4">
        {!edits?.length ? (
          <div className="py-10 text-center text-sm text-slate-400">Chưa có thay đổi nào trong phiên này.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                {["Thời gian", "Mã đơn", "Hành động", "Chuyền cũ", "Chuyền mới", "Ngày cũ", "Ngày mới", "Người thực hiện"].map(h => (
                  <th key={h} className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {edits.map((e, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-500">{e.changed_at ? new Date(e.changed_at).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td className="px-3 py-2 font-mono font-semibold text-slate-700">{e.order_id || e.chunk_id?.split("|")[0] || "—"}</td>
                  <td className="px-3 py-2"><span className="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-[10px] font-semibold">{ACTION_LABELS[e.action] || e.action}</span></td>
                  <td className="px-3 py-2 text-slate-500">{e.old_line || "—"}</td>
                  <td className="px-3 py-2 text-slate-600 font-medium">{e.new_line || "—"}</td>
                  <td className="px-3 py-2 font-mono text-slate-500">{fmtDate(e.old_date)}</td>
                  <td className="px-3 py-2 font-mono text-slate-600 font-medium">{fmtDate(e.new_date)}</td>
                  <td className="px-3 py-2 text-slate-500">{e.changed_by || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── History log (left panel tab) ───────────────────────────────────────────────
function HistoryLog({ edits }) {
  const ACTION_LABELS = { move: "Di chuyển", add: "Thêm mới", delete: "Xóa", qty_change: "Sửa SL" };
  if (!edits?.length) {
    return <div className="py-10 text-center text-xs text-slate-400">Chưa có chỉnh sửa nào.</div>;
  }
  return (
    <div className="divide-y divide-slate-100">
      {[...edits].reverse().map((e, i) => (
        <div key={i} className="px-3 py-2.5">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 rounded-full px-1.5 py-0.5">
              {ACTION_LABELS[e.action] || e.action}
            </span>
            <span className="font-mono text-[10px] font-semibold text-slate-700">{e.order_id || e.chunk_id?.split("|")[0]}</span>
          </div>
          <div className="text-[10px] text-slate-500 leading-snug">
            {e.old_line && e.new_line && e.old_line !== e.new_line && (
              <span>{e.old_line} → {e.new_line} · </span>
            )}
            {e.old_date && e.new_date && e.old_date !== e.new_date && (
              <span>{fmtDate(e.old_date)} → {fmtDate(e.new_date)} · </span>
            )}
            <span className="text-slate-400">{e.changed_by || "—"}</span>
          </div>
          {e.changed_at && (
            <div className="text-[9px] text-slate-300 mt-0.5">
              {new Date(e.changed_at).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── LEFT PANEL ICON TAB ────────────────────────────────────────────────────────
const LEFT_TABS = [
  { key: "lineup", icon: ListOrdered,  label: "Nối đuôi" },
  { key: "daily",  icon: CalendarDays, label: "Báo cáo ngày" },
  { key: "history",icon: History,       label: "Lịch sử" },
];

// ── Main Page ─────────────────────────────────────────────────────────────────
const ACTIVE_RUN_ID = 48;

export default function ScheduleAdjustPage() {
  const { user } = useAuthStore();
  const perms    = usePermissions();
  const toast    = useToast();
  const qc       = useQueryClient();

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

  // ── Local state ───────────────────────────────────────────────────────────
  const [localChunks,  setLocalChunks] = useState(null);
  const [edits,        setEdits]       = useState({});
  const [undoStack,    setUndoStack]   = useState([]);
  const [saveStatus,   setSaveStatus]  = useState("idle"); // idle|saving|saved
  const saveTimer = useRef(null);

  const [leftTab,       setLeftTab]       = useState("lineup");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed,setRightCollapsed]= useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDiff,      setShowDiff]      = useState(false);

  const hasChanges = localChunks !== null;

  useEffect(() => { setLocalChunks(null); setEdits({}); setUndoStack([]); }, [allOrders]);

  // ── Filtered by sub-planner lines ─────────────────────────────────────────
  const chunks = useMemo(() => {
    const base = localChunks ?? apiChunks;
    if (!lineFilter?.length) return base;
    return base.filter(c => lineFilter.includes(c.line));
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
    for (const c of chunks) {
      if (!lastDates[c.order_id] || c.date > lastDates[c.order_id]) lastDates[c.order_id] = c.date;
    }
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

  // ── Chunk changed handler ─────────────────────────────────────────────────
  const handleChunkChanged = useCallback(async (change) => {
    setUndoStack(s => [...s.slice(-19), localChunks ?? apiChunks]);
    setSaveStatus("saving");
    clearTimeout(saveTimer.current);
    try {
      await wizardStateApi.singleChunkEdit(ACTIVE_RUN_ID, change);
      qc.invalidateQueries({ queryKey: ["chunk-edits", ACTIVE_RUN_ID] });
      setSaveStatus("saved");
      saveTimer.current = setTimeout(() => setSaveStatus("idle"), 2500);
    } catch {
      setSaveStatus("idle");
    }
  }, [localChunks, apiChunks, qc]);

  const handleUndo = () => {
    if (!undoStack.length) return;
    setLocalChunks(undoStack[undoStack.length - 1]);
    setUndoStack(s => s.slice(0, -1));
    toast("Đã hoàn tác", "info");
  };

  const handleSaveDraft = () => {
    toast("Đã lưu nháp lịch điều chỉnh", "success");
  };

  const handleConfirm = () => {
    setLocalChunks(null);
    setUndoStack([]);
    toast("Lịch điều chỉnh đã xác nhận và áp dụng", "success");
  };

  const dataLoading = ordersLoading || dailyLoading;
  const runLabel    = runData?.run_label ?? `Run #${ACTIVE_RUN_ID}`;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      {/* ── TOPBAR ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-2.5 h-[52px]">
        {/* Context */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-slate-800 whitespace-nowrap">Điều chỉnh lịch sản xuất</span>
          <span className="text-slate-400">/</span>
          <span className="text-xs text-slate-500 truncate max-w-[160px]">{runLabel}</span>
          {hasChanges && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold px-2 py-0.5 border border-amber-200 shrink-0">
              Có thay đổi chưa lưu
            </span>
          )}
        </div>

        {/* Line filter badge */}
        {lineFilter && (
          <div className="flex items-center gap-1 flex-wrap shrink-0">
            {lineFilter.map(l => (
              <span key={l} className={clsx(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                l.startsWith("A") ? "bg-violet-100 text-violet-700" :
                l.startsWith("B") ? "bg-blue-100 text-blue-700" :
                "bg-teal-100 text-teal-700"
              )}>{l}</span>
            ))}
          </div>
        )}

        {/* KPI pills */}
        <div className="flex items-center gap-1.5 mx-auto">
          <KpiPill label="Đơn" value={kpis.total} color="slate" />
          <KpiPill label="Đúng hạn" value={`${kpis.onTimePct}%`} color={kpis.onTimePct >= 80 ? "green" : kpis.onTimePct >= 60 ? "amber" : "red"} />
          <KpiPill label="Trễ" value={kpis.late} color={kpis.late > 0 ? "red" : "slate"} />
          <KpiPill label="Chưa sắp" value={kpis.unscheduled} color={kpis.unscheduled > 0 ? "amber" : "slate"} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {saveStatus === "saving" && <span className="text-xs text-slate-400">Đang lưu...</span>}
          {saveStatus === "saved"  && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 size={12} /> Đã lưu</span>}

          <button
            onClick={handleUndo}
            disabled={!undoStack.length}
            title={`Hoàn tác (${undoStack.length} bước)`}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition">
            <Undo2 size={13} />
            Hoàn tác {undoStack.length > 0 && <span className="rounded-full bg-slate-100 px-1.5 text-[10px]">{undoStack.length}</span>}
          </button>

          <button
            onClick={() => setShowDiff(v => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition">
            <Eye size={13} />
            Xem thay đổi {chunkEdits.length > 0 && <span className="rounded-full bg-blue-100 text-blue-700 px-1.5 text-[10px]">{chunkEdits.length}</span>}
          </button>

          <button
            onClick={handleSaveDraft}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition">
            <Save size={13} />
            Lưu nháp
          </button>

          <button
            onClick={handleConfirm}
            disabled={!hasChanges}
            className="flex items-center gap-1.5 rounded-lg border border-blue-600 bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition">
            <CheckCircle2 size={13} />
            Xác nhận lịch
          </button>
        </div>
      </div>

      {/* ── BODY ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* LEFT PANEL */}
        <div className={clsx(
          "flex shrink-0 border-r border-slate-200 bg-white transition-all duration-200 overflow-hidden",
          leftCollapsed ? "w-10" : "w-72"
        )}>
          {/* Icon tabs (vertical) */}
          <div className="flex flex-col items-center border-r border-slate-100 py-2 gap-1 w-10 shrink-0">
            {LEFT_TABS.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                title={label}
                onClick={() => { setLeftTab(key); setLeftCollapsed(false); }}
                className={clsx(
                  "rounded-lg p-2 transition",
                  leftTab === key && !leftCollapsed ? "bg-blue-50 text-blue-700" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                )}>
                <Icon size={16} />
              </button>
            ))}
            <div className="mt-auto">
              <button
                title={leftCollapsed ? "Mở panel" : "Thu gọn"}
                onClick={() => setLeftCollapsed(v => !v)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                {leftCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </button>
            </div>
          </div>

          {/* Panel content */}
          {!leftCollapsed && (
            <div className="flex-1 overflow-hidden flex flex-col min-w-0">
              <div className="px-3 py-2.5 border-b border-slate-100 shrink-0">
                <div className="text-xs font-semibold text-slate-600">
                  {LEFT_TABS.find(t => t.key === leftTab)?.label}
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                {leftTab === "lineup" && (
                  <LineSequenceTab runId={ACTIVE_RUN_ID} orders={orders} />
                )}
                {leftTab === "daily" && (
                  <DailyReport runId={ACTIVE_RUN_ID} capacityOverrides={{}} />
                )}
                {leftTab === "history" && (
                  <HistoryLog edits={chunkEdits} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* MAIN — ScheduleCalendar */}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          {/* Frozen zone banner */}
          <div className="shrink-0 flex items-center gap-2 bg-slate-800/5 border-b border-slate-200 px-4 py-1.5">
            <Snowflake size={12} className="text-blue-400 shrink-0" />
            <span className="text-xs text-slate-500">
              <strong className="text-slate-700">Vùng đóng băng</strong> — các ngày trước {fmtDate(FROZEN_UNTIL)} đã vào sản xuất, không thể thay đổi.
              Bạn chỉ chỉnh sửa được từ <strong>{fmtDate(FROZEN_UNTIL)}</strong> trở đi.
            </span>
          </div>

          {dataLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Spinner size={32} />
            </div>
          ) : (
            <div className="flex-1 overflow-hidden">
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
        </div>

        {/* RIGHT PANEL */}
        <div className={clsx(
          "flex shrink-0 border-l border-slate-200 bg-white transition-all duration-200 overflow-hidden",
          rightCollapsed ? "w-10" : "w-80"
        )}>
          {/* Collapse toggle */}
          <div className="flex flex-col items-center border-r border-slate-100 py-2 w-10 shrink-0">
            <button
              title={rightCollapsed ? "Mở panel" : "Thu gọn"}
              onClick={() => setRightCollapsed(v => !v)}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
              {rightCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
            {selectedOrder && !rightCollapsed && (
              <button
                title="Đóng inspector"
                onClick={() => setSelectedOrder(null)}
                className="mt-1 rounded-lg p-2 text-blue-500 hover:bg-blue-50 transition">
                <ArrowLeft size={14} />
              </button>
            )}
          </div>

          {/* Panel content */}
          {!rightCollapsed && (
            <div className="flex-1 overflow-hidden flex flex-col min-w-0">
              {selectedOrder ? (
                <InspectorPanel
                  order={selectedOrder}
                  onClose={() => setSelectedOrder(null)}
                />
              ) : (
                <OrdersTable
                  orders={orders}
                  chunks={chunks}
                  onSelectOrder={setSelectedOrder}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* DIFF DRAWER */}
      {showDiff && <DiffDrawer edits={chunkEdits} onClose={() => setShowDiff(false)} />}
    </div>
  );
}
