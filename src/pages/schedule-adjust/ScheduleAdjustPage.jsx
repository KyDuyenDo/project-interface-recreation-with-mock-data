import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  Undo2, Eye, Save, CheckCircle2, ChevronLeft, ChevronRight,
  AlertTriangle, Lock, ArrowLeft, ListOrdered, CalendarDays,
  History, X, Snowflake, Calendar, Info, Table2,
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

// ── History log ───────────────────────────────────────────────────────────────
function HistoryLog({ edits }) {
  const LABELS = { move: "Di chuyển", add: "Thêm mới", delete: "Xóa", qty_change: "Sửa SL" };
  if (!edits?.length)
    return <div className="flex items-center justify-center h-40 text-sm text-slate-400">Chưa có chỉnh sửa nào.</div>;
  return (
    <div className="divide-y divide-slate-100">
      {[...edits].reverse().map((e, i) => (
        <div key={i} className="px-4 py-3">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 rounded-full px-2 py-0.5">
              {LABELS[e.action] || e.action}
            </span>
            <span className="font-mono text-xs font-semibold text-slate-700">{e.order_id || e.chunk_id?.split("|")[0]}</span>
            <span className="ml-auto text-[10px] text-slate-400">
              {e.changed_at ? new Date(e.changed_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : ""}
            </span>
          </div>
          <div className="text-[10px] text-slate-500">
            {e.old_line !== e.new_line && e.old_line && e.new_line && `${e.old_line} → ${e.new_line} · `}
            {e.old_date !== e.new_date && e.old_date && e.new_date && `${fmtDate(e.old_date)} → ${fmtDate(e.new_date)} · `}
            {e.changed_by || ""}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Diff drawer ───────────────────────────────────────────────────────────────
function DiffDrawer({ edits, onClose }) {
  const LABELS = { move: "Di chuyển", add: "Thêm mới", delete: "Xóa", qty_change: "Sửa SL" };
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-white border-t-2 border-slate-200 shadow-2xl rounded-t-2xl" style={{ height: "45vh" }}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Eye size={15} className="text-slate-500" />
          <span className="font-semibold text-sm text-slate-800">Xem thay đổi trong phiên</span>
          {edits.length > 0 && (
            <span className="rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold px-2 py-0.5">{edits.length}</span>
          )}
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100 text-slate-500 transition"><X size={15} /></button>
      </div>
      <div className="overflow-auto" style={{ height: "calc(45vh - 53px)" }}>
        {!edits?.length ? (
          <div className="flex items-center justify-center h-full text-sm text-slate-400">Chưa có thay đổi nào.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                {["Giờ", "Mã đơn", "Hành động", "Chuyền cũ → mới", "Ngày cũ → mới", "Người TH"].map(h => (
                  <th key={h} className="border-b border-slate-200 px-4 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {edits.map((e, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                    {e.changed_at ? new Date(e.changed_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono font-semibold text-slate-700">{e.order_id || e.chunk_id?.split("|")[0] || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-[10px] font-semibold">
                      {LABELS[e.action] || e.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {e.old_line && e.new_line && e.old_line !== e.new_line
                      ? <span>{e.old_line} <span className="text-slate-400">→</span> <strong>{e.new_line}</strong></span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-600">
                    {e.old_date && e.new_date && e.old_date !== e.new_date
                      ? <span>{fmtDate(e.old_date)} <span className="text-slate-400">→</span> <strong>{fmtDate(e.new_date)}</strong></span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{e.changed_by || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
const ACTIVE_RUN_ID = 48;

export default function ScheduleAdjustPage() {
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

  const [mainTab,  setMainTab]  = useState("lich");
  const [showDiff, setShowDiff] = useState(false);

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
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">

      {/* ── TOPBAR ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 h-[52px] flex items-center gap-3 border-b border-slate-200 bg-white px-4">
        {/* Title + run context */}
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <span className="text-sm font-bold text-slate-800">Điều chỉnh lịch</span>
          <span className="text-slate-300">/</span>
          <span className="text-xs text-slate-500 truncate max-w-[140px]">{runLabel}</span>
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

          <button onClick={() => setShowDiff(v => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition">
            <Eye size={13} />
            Xem thay đổi
            {chunkEdits.length > 0 && <span className="rounded-full bg-blue-100 text-blue-700 text-[10px] px-1.5">{chunkEdits.length}</span>}
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
        <div className="flex items-center gap-0">
          {MAIN_TABS.map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setMainTab(key)}
              className={clsx(
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                mainTab === key
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              )}>
              <Icon size={14} />
              {label}
              {key === "history" && chunkEdits.length > 0 && (
                <span className="rounded-full bg-slate-100 text-slate-600 text-[10px] px-1.5 font-semibold">{chunkEdits.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Snowflake size={12} className="text-blue-400 shrink-0" />
          <span>Đóng băng đến <strong className="text-slate-600">{fmtDate(FROZEN_UNTIL)}</strong></span>
        </div>
      </div>

      {/* ── BODY ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* MAIN CONTENT AREA (tabs) */}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          {dataLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Spinner size={32} />
            </div>
          ) : (
            <>
              {/* Calendar tab */}
              {mainTab === "lich" && (
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

              {/* Bảng chi tiết tab */}
              {mainTab === "bang" && (
                <div className="flex-1 overflow-auto bg-white">
                  <ScheduleTable chunks={chunks} edits={edits} />
                </div>
              )}

              {/* Lineup tab */}
              {mainTab === "lineup" && (
                <div className="flex-1 overflow-auto bg-white">
                  <LineSequenceTab runId={ACTIVE_RUN_ID} orders={orders} />
                </div>
              )}

              {/* Daily report tab */}
              {mainTab === "daily" && (
                <div className="flex-1 overflow-auto bg-white">
                  <DailyReport runId={ACTIVE_RUN_ID} capacityOverrides={{}} />
                </div>
              )}

              {/* History tab */}
              {mainTab === "history" && (
                <div className="flex-1 overflow-auto bg-white">
                  {chunkEdits.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-60 gap-2 text-slate-400">
                      <History size={32} strokeWidth={1.5} />
                      <p className="text-sm">Chưa có thay đổi nào trong phiên này.</p>
                    </div>
                  ) : (
                    <div className="max-w-3xl mx-auto py-4">
                      <HistoryLog edits={chunkEdits} />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

      </div>

      {/* DIFF DRAWER */}
      {showDiff && <DiffDrawer edits={chunkEdits} onClose={() => setShowDiff(false)} />}
    </div>
  );
}
