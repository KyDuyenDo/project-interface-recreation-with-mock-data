import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "../../../hooks";
import { useRunDetail, useRunOutputOrders, useRunOutputDaily } from "../../../hooks/useRuns";
import { wizardStateApi } from "../../../api";
import { useToast } from "../../../components/ui/overlays";

const PALETTE = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899",
  "#8b5cf6", "#14b8a6", "#f97316", "#84cc16", "#06b6d4", "#d946ef",
  "#3b82f6", "#22c55e", "#eab308", "#fb7185", "#a855f7", "#0891b2",
];

function hash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
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
      id: `${oid}|${r.date}|${r.line}`,
      order_id: oid,
      article: o?.article ?? "",
      customer: o?.customer ?? "",
      line: r.line,
      date: r.date,
      qty,
      sizes: r.sizes ?? {},
      color: orderColor(oid),
      crd: o?.crd ?? null,
      lpd: o?.lpd ?? null,
      go_start: o?.go_start ?? null,
      go_end: o?.go_end ?? null,
      sew_start: o?.sew_start ?? null,
      sew_end: o?.sew_end ?? null,
      is_late: o?.is_late || (o?.crd && r.date > o.crd) || false,
      total_qty: o?.qty_total ?? 0,
      stage: r.stage ?? null,
      state: o?.state ?? null,
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
        id: `${oid}|${dateStr}`,
        order_id: oid,
        article: o.article ?? "",
        customer: o.customer ?? "",
        line,
        date: dateStr,
        qty,
        sizes: o.sizes ?? {},
        color,
        crd: o.crd ?? null,
        lpd: o.lpd ?? null,
        go_start: o.go_start ?? null,
        go_end: o.go_end ?? null,
        sew_start: o.sew_start ?? null,
        sew_end: o.sew_end ?? null,
        is_late: isLate,
        total_qty: totalQty,
      });
    });
  }
  return result;
}

export function useScheduleAdjust() {
  const { runId: runIdStr } = useParams();
  const navigate = useNavigate();
  const ACTIVE_RUN_ID = parseInt(runIdStr, 10) || 48;

  const perms = usePermissions();
  const toast = useToast();
  const qc = useQueryClient();

  const lineFilter = perms.myLines?.length ? perms.myLines : null;

  // ── Query calls ──
  const { data: ordersData, isLoading: ordersLoading } = useRunOutputOrders(ACTIVE_RUN_ID, { page_size: 500 });
  const { data: dailyData, isLoading: dailyLoading } = useRunOutputDaily(ACTIVE_RUN_ID);
  const { data: runData } = useRunDetail(ACTIVE_RUN_ID);
  const { data: chunkEdits = [] } = useQuery({
    queryKey: ["chunk-edits", ACTIVE_RUN_ID],
    queryFn: () => wizardStateApi.getChunkEdits(ACTIVE_RUN_ID),
    staleTime: 0,
  });

  const allOrders = useMemo(() => {
    const raw = ordersData?.orders ?? ordersData?.items ?? [];
    return raw.map(o => ({
      ...o,
      order_id: o.scbh ?? o.order_id,
      color: orderColor(o.scbh ?? o.order_id ?? ""),
    }));
  }, [ordersData]);

  const dailyRows = useMemo(() => dailyData?.rows ?? [], [dailyData]);
  const apiChunks = useMemo(
    () => (dailyRows.length > 0 ? buildChunksFromDaily(dailyRows, allOrders) : buildChunks(allOrders)),
    [dailyRows, allOrders]
  );

  // ── States ──
  const [localChunks, setLocalChunks] = useState(null);
  const [edits, setEdits] = useState({});
  const [undoStack, setUndoStack] = useState([]);
  const [saveStatus, setSaveStatus] = useState("idle");
  const saveTimer = useRef(null);

  const [mainTab, setMainTab] = useState("lich");
  const [plannerNotes, setPlannerNotes] = useState({});
  const [lateAlertOpen, setLateAlertOpen] = useState(false);

  const hasChanges = localChunks !== null;

  useEffect(() => {
    setLocalChunks(null);
    setEdits({});
    setUndoStack([]);
  }, [allOrders]);

  // ── Filtering ──
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

  // ── KPIs ──
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
    const onTimePct = total > 0 ? Math.round(((total - late) / total) * 100) : 100;
    const covered = {};
    for (const c of chunks) covered[c.order_id] = (covered[c.order_id] ?? 0) + c.qty;
    const unscheduled = orders.filter(
      o => o.state !== "IN_PROGRESS" && Math.max(0, (o.qty_total ?? 0) - (covered[o.order_id] ?? 0)) > 0
    ).length;
    return { total, late, onTimePct, unscheduled };
  }, [chunks, orders]);

  const lateOrders = useMemo(() => orders.filter(o => o.is_late && o.delay_reason), [orders]);

  // ── Handlers ──
  const handleChunkChanged = useCallback(
    async (change) => {
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
    },
    [localChunks, apiChunks, qc, ACTIVE_RUN_ID]
  );

  const handleUndo = () => {
    if (!undoStack.length) return;
    setLocalChunks(undoStack[undoStack.length - 1]);
    setUndoStack(s => s.slice(0, -1));
    toast("Đã hoàn tác", "info");
  };

  const dataLoading = ordersLoading || dailyLoading;
  const runLabel = runData?.run_label ?? `Run #${ACTIVE_RUN_ID}`;

  return {
    runId: ACTIVE_RUN_ID,
    navigate,
    lineFilter,
    orders,
    chunks,
    apiChunks,
    chunkEdits,
    localChunks,
    setLocalChunks,
    edits,
    setEdits,
    undoStack,
    saveStatus,
    mainTab,
    setMainTab,
    plannerNotes,
    setPlannerNotes,
    lateAlertOpen,
    setLateAlertOpen,
    hasChanges,
    kpis,
    lateOrders,
    handleChunkChanged,
    handleUndo,
    dataLoading,
    runLabel,
    toast,
    dailyRows,
  };
}
