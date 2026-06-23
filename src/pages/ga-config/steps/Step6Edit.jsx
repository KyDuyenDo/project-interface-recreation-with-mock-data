import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Info, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import SubPlannerDispatchPanel from "../../../components/dispatch/SubPlannerDispatchPanel";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRunDetail, useRunOutputOrders, useRunOutputDaily } from "../../../hooks/useRuns";
import { wizardStateApi } from "../../../api";
import ScheduleCalendar from "../components/ScheduleCalendar";
import ScheduleTracking from "../components/ScheduleTracking";
import ScheduleTable    from "../components/ScheduleTable";
import DailyReport      from "../components/DailyReport";
import LineSequenceTab  from "../components/LineSequenceTab";

const BTN   = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const BADGE = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium";

const SUBTABS = [
  { key: "overview", label: "Tổng quan"    },
  { key: "lich",     label: "Lịch sắp xếp" },
  { key: "bang",     label: "Bảng chi tiết" },
  { key: "daily",    label: "Báo cáo ngày"  },
  { key: "lineup",   label: "Nối đuôi"      },
  { key: "history",  label: "Lịch sử"       },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// Build chunks from backend /output/daily — same data source as DailyReport.
// Each row is one (order, date, line) with actual GA-computed qty + sizes.
function buildChunksFromDaily(dailyRows, orders) {
  const orderMap = {};
  for (const o of orders) orderMap[o.order_id] = o;
  const result = [];
  for (const r of dailyRows) {
    const oid = r.scbh;
    const qty = r.qty ?? 0;
    if (!oid || !r.date || !r.line || qty <= 0) continue;
    const o     = orderMap[oid];
    const color = orderColor(oid);
    const crd   = o?.crd ?? null;
    result.push({
      id:        `${oid}|${r.date}|${r.line}`,
      order_id:  oid,
      article:   o?.article   ?? "",
      customer:  o?.customer  ?? "",
      line:      r.line,
      date:      r.date,
      qty,
      sizes:     r.sizes      ?? {},
      color,
      crd,
      lpd:       o?.lpd       ?? null,
      go_start:  o?.go_start  ?? null,
      go_end:    o?.go_end    ?? null,
      sew_start: o?.sew_start ?? null,
      sew_end:   o?.sew_end   ?? null,
      is_late:   o?.is_late || (crd && r.date > crd) || false,
      total_qty: o?.qty_total ?? 0,
      stage:     r.stage      ?? null,
      state:     o?.state     ?? null,
    });
  }
  return result;
}

// Fallback: evenly distribute qty across working days when /output/daily unavailable.
function buildChunks(orders) {
  const result = [];
  for (const o of orders) {
    const oid   = o.order_id;
    const line  = o.line_go ?? o.line_may;
    const start = o.go_start;
    const end   = o.go_end;
    if (!oid || !line || !start || !end) continue;
    const color    = orderColor(oid);
    const isLate   = o.is_late || (o.crd && o.go_end > o.crd);
    const workDays = [];
    const cursor   = new Date(start + "T00:00:00Z");
    const endDate  = new Date(end   + "T00:00:00Z");
    while (cursor <= endDate) {
      if (cursor.getUTCDay() !== 0) workDays.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    if (workDays.length === 0) continue;
    const totalQty = o.qty_total ?? 0;
    const perDay   = Math.floor(totalQty / workDays.length);
    let remaining  = totalQty;
    workDays.forEach((dateStr, i) => {
      const qty = i === workDays.length - 1 ? remaining : perDay;
      remaining -= qty;
      if (qty <= 0) return;
      result.push({
        id: `${oid}|${dateStr}`, order_id: oid,
        article: o.article ?? "", customer: o.customer ?? "",
        line, date: dateStr, qty, sizes: o.sizes ?? {}, color,
        crd: o.crd ?? null, lpd: o.lpd ?? null,
        go_start: o.go_start ?? null, go_end: o.go_end ?? null,
        sew_start: o.sew_start ?? null, sew_end: o.sew_end ?? null,
        is_late: isLate, total_qty: totalQty,
      });
    });
  }
  return result;
}

// ─── Step6Edit ───────────────────────────────────────────────────────────────

const ACTION_LABELS = {
  move:       "Di chuyển",
  add:        "Thêm mới",
  delete:     "Xóa",
  qty_change: "Sửa số lượng",
};

export default function Step6Edit({ runId, capacityOverrides, onPrev, onNext }) {
  const [tab,          setTab]          = useState("overview");
  const [localChunks,  setLocalChunks]  = useState(null);
  const [edits,        setEdits]        = useState({});
  const [showTracking, setShowTracking] = useState(false);
  const queryClient = useQueryClient();

  // ── Auto-save indicator ───────────────────────────────────────────────────
  const [autoSaveStatus, setAutoSaveStatus] = useState("idle"); // 'idle'|'saving'|'saved'
  const autoSaveTimer = useRef(null);

  // ── Per-edit real-time save ───────────────────────────────────────────────
  const handleChunkChanged = useCallback(async (change) => {
    if (!runId) return;
    setAutoSaveStatus("saving");
    clearTimeout(autoSaveTimer.current);
    try {
      await wizardStateApi.singleChunkEdit(runId, change);
      queryClient.invalidateQueries({ queryKey: ["chunk-edits", runId] });
      setAutoSaveStatus("saved");
      autoSaveTimer.current = setTimeout(() => setAutoSaveStatus("idle"), 2500);
    } catch {
      setAutoSaveStatus("idle");
    }
  }, [runId, queryClient]);

  // ── Chunk edit history ────────────────────────────────────────────────────
  const { data: chunkEdits = [], isLoading: chunkEditsLoading } = useQuery({
    queryKey: ["chunk-edits", runId],
    queryFn:  () => wizardStateApi.getChunkEdits(runId),
    enabled:  !!runId,
    staleTime: 0,
  });

  const { data: runData }                              = useRunDetail(runId);
  const { data: ordersData, isLoading: ordersLoading } = useRunOutputOrders(runId, { page_size: 500 });
  const { data: dailyData,  isLoading: dailyLoading  } = useRunOutputDaily(runId);

  // Normalize: scbh → order_id, assign color
  const orders = useMemo(() => {
    const raw = ordersData?.orders ?? ordersData?.items ?? [];
    return raw.map(o => ({
      ...o,
      order_id: o.scbh ?? o.order_id,
      color:    orderColor(o.scbh ?? o.order_id ?? ""),
    }));
  }, [ordersData]);

  const dailyRows = useMemo(() => dailyData?.rows ?? [], [dailyData]);

  // Use backend daily allocation when available (matches DailyReport exactly).
  // Fall back to evenly-distributed frontend computation when not yet stored.
  const apiChunks = useMemo(
    () => dailyRows.length > 0
      ? buildChunksFromDaily(dailyRows, orders)
      : buildChunks(orders),
    [dailyRows, orders],
  );
  const chunks    = localChunks ?? apiChunks;
  const dataLoading = ordersLoading || dailyLoading;

  // Reset edits when source orders change
  useEffect(() => { setLocalChunks(null); setEdits({}); }, [orders]);

  // Late count: order whose last chunk date > crd
  const lateCount = useMemo(() => {
    const lastDates = {};
    for (const c of chunks) {
      if (!lastDates[c.order_id] || c.date > lastDates[c.order_id]) lastDates[c.order_id] = c.date;
    }
    return Object.entries(lastDates).filter(([oid, last]) => {
      const o = orders.find(x => x.order_id === oid);
      return o?.crd && last > o.crd;
    }).length;
  }, [chunks, orders]);

  // Unscheduled count: orders with remaining qty > 0 (excludes IN_PROGRESS)
  const unscheduledCount = useMemo(() => {
    const covered = {};
    for (const c of chunks) covered[c.order_id] = (covered[c.order_id] ?? 0) + c.qty;
    return orders.filter(o => {
      if (o.state === "IN_PROGRESS") return false;
      return Math.max(0, (o.qty_total ?? 0) - (covered[o.order_id] ?? 0)) > 0;
    }).length;
  }, [chunks, orders]);

  if (!runId) return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm max-w-[1180px] mx-auto">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="text-sm font-semibold text-gray-900">Bước 6 · Chỉnh sửa lịch</div>
      </div>
      <div className="p-5">
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm bg-amber-50 text-amber-800 border border-amber-100">
          <Info size={14} className="shrink-0 mt-0.5" /> Chưa có lịch — quay lại bước Chạy lịch
        </div>
      </div>
      <div className="flex items-center gap-3 px-5 py-3 border-t border-gray-100 bg-gray-50">
        <button className={`${BTN} bg-white text-gray-700 border-gray-200 hover:bg-gray-50`} onClick={onPrev}>
          <ChevronLeft size={14} /> Bước trước
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm max-w-[1480px] mx-auto h-full flex flex-col min-h-0">
      {/* Head */}
      <div className="px-5 py-4 border-b border-gray-100 shrink-0">
        <div className="text-sm font-semibold text-gray-900">Bước 6 · Chỉnh sửa lịch</div>
        <div className="text-xs text-gray-500 mt-0.5">Review kết quả · tinh chỉnh nếu cần trước khi xác nhận</div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-stretch border-b border-gray-200 bg-gray-50 px-4 shrink-0">
        <div className="flex overflow-x-auto flex-1">
          {SUBTABS.map(t => (
            <button key={t.key}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap
                ${tab === t.key ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              onClick={() => setTab(t.key)}>
              {t.label}
              {t.key === "history" && chunkEdits.length > 0 && (
                <span className={`ml-1.5 ${BADGE} bg-gray-100 text-gray-600`}>{chunkEdits.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Notification icons — chỉ hiện khi ở tab Lịch sắp xếp */}
        {tab === "lich" && !dataLoading && (
          <div className="flex items-center gap-1 pl-2 pr-1 border-l border-gray-200 shrink-0">
            <button
              title={lateCount > 0 ? `${lateCount} đơn trễ hạn` : "Không có đơn trễ"}
              onClick={() => setShowTracking(v => !v)}
              className={`relative flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${showTracking
                  ? "bg-red-100 text-red-700"
                  : lateCount > 0
                    ? "bg-red-50 text-red-600 hover:bg-red-100"
                    : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`}>
              <AlertTriangle size={14} />
              {lateCount > 0 && <span>{lateCount}</span>}
            </button>
            {unscheduledCount > 0 && (
              <button
                title={`${unscheduledCount} đơn chưa sắp xong`}
                onClick={() => setShowTracking(v => !v)}
                className={`relative flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${showTracking
                    ? "bg-amber-100 text-amber-700"
                    : "bg-amber-50 text-amber-600 hover:bg-amber-100"}`}>
                <Info size={14} />
                <span>{unscheduledCount}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Body — flex-1 fills remaining height; each tab scrolls inside */}
      <div className="flex-1 min-h-0 overflow-y-auto p-5">

        {/* ── Overview ─────────────────────────────────────────────────────── */}
        {tab === "overview" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: "Đơn đã lập", value: runData?.scheduled_count || orders.length },
                { label: "On-time",    value: runData?.on_time_pct
                    ? `${runData.on_time_pct}%`
                    : orders.length > 0
                      ? `${Math.round((orders.length - lateCount) / orders.length * 100)}%`
                      : "—" },
                { label: "Đơn trễ",   value: lateCount, danger: lateCount > 0 },
                { label: "Fitness",    value: runData?.fitness?.toLocaleString() ?? "—" },
              ].map(({ label, value, danger }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
                  <div className={`text-2xl font-bold mt-1 ${danger ? "text-red-600" : "text-gray-900"}`}>{value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { key: "lich",    label: "Lịch sắp xếp", sub: "Xem & chỉnh lịch · theo dõi tiến độ tích hợp", cls: "bg-blue-50 text-blue-700"    },
                { key: "bang",    label: "Bảng chi tiết", sub: "Toàn bộ chunk nhóm theo chuyền",              cls: "bg-purple-50 text-purple-700" },
                { key: "daily",   label: "Báo cáo ngày",  sub: "Drill ngày × chuyền → đơn & size",            cls: "bg-green-50 text-green-700"  },
                { key: "lineup",  label: "Nối đuôi",       sub: "Thứ tự đơn hàng trên từng chuyền",            cls: "bg-amber-50 text-amber-700"   },
              ].map(({ key, label, sub, cls }) => (
                <button key={key}
                  className="bg-white rounded-xl border border-gray-200 p-4 text-left hover:shadow-sm transition-shadow"
                  onClick={() => setTab(key)}>
                  <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold mb-2 ${cls}`}>{label}</span>
                  <div className="text-xs text-gray-500">{sub}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Lịch sắp xếp ─────────────────────────────────────────────────── */}
        {tab === "lich" && (
          dataLoading ? (
            <div className="py-16 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-500" /></div>
          ) : (
            <ScheduleCalendar
              runId={runId}
              orders={orders}
              chunks={chunks}
              initialChunks={apiChunks}
              setChunks={setLocalChunks}
              edits={edits}
              setEdits={setEdits}
              onChunkChanged={handleChunkChanged}
              usingFallback={dailyRows.length === 0 && orders.length > 0}
              hasDailyData={dailyRows.length > 0}
            />
          )
        )}

        {/* ── Bảng chi tiết ────────────────────────────────────────────────── */}
        {tab === "bang" && (
          dataLoading ? (
            <div className="py-16 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-500" /></div>
          ) : (
            <ScheduleTable chunks={chunks} edits={edits} />
          )
        )}

        {/* ── Báo cáo ngày ─────────────────────────────────────────────────── */}
        {tab === "daily" && (
          <DailyReport runId={runId} capacityOverrides={capacityOverrides} />
        )}

        {/* ── Nối đuôi ─────────────────────────────────────────────────────── */}
        {tab === "lineup" && (
          <LineSequenceTab runId={runId} orders={orders} />
        )}

        {/* ── Lịch sử chỉnh sửa ────────────────────────────────────────────── */}
        {tab === "history" && (
          chunkEditsLoading ? (
            <div className="py-16 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-500" /></div>
          ) : chunkEdits.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">Chưa có chỉnh sửa nào được ghi nhận.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-3 py-2 border border-gray-100 font-medium">Thời gian</th>
                    <th className="text-left px-3 py-2 border border-gray-100 font-medium">Đơn hàng</th>
                    <th className="text-left px-3 py-2 border border-gray-100 font-medium">Hành động</th>
                    <th className="text-left px-3 py-2 border border-gray-100 font-medium">Chuyền</th>
                    <th className="text-left px-3 py-2 border border-gray-100 font-medium">Ngày</th>
                    <th className="text-left px-3 py-2 border border-gray-100 font-medium">Số lượng</th>
                    <th className="text-left px-3 py-2 border border-gray-100 font-medium">Người sửa</th>
                  </tr>
                </thead>
                <tbody>
                  {chunkEdits.map(e => (
                    <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 border border-gray-100 whitespace-nowrap text-gray-500">
                        {e.edited_at ? e.edited_at.replace("T", " ").slice(0, 16) : "—"}
                      </td>
                      <td className="px-3 py-2 border border-gray-100 font-mono font-medium text-gray-800">{e.order_id}</td>
                      <td className="px-3 py-2 border border-gray-100">
                        <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                          e.action === "delete" ? "bg-red-100 text-red-700" :
                          e.action === "add"    ? "bg-green-100 text-green-700" :
                          "bg-blue-100 text-blue-700"
                        }`}>
                          {ACTION_LABELS[e.action] ?? e.action}
                        </span>
                      </td>
                      <td className="px-3 py-2 border border-gray-100 text-gray-700">
                        {e.old_line && e.old_line !== e.new_line ? (
                          <><span className="text-red-500 line-through">{e.old_line}</span>{" → "}<span className="text-green-700 font-medium">{e.new_line}</span></>
                        ) : (e.new_line ?? e.old_line ?? "—")}
                      </td>
                      <td className="px-3 py-2 border border-gray-100 text-gray-700 whitespace-nowrap">
                        {e.old_date && e.old_date !== e.new_date ? (
                          <><span className="text-red-500 line-through">{e.old_date}</span>{" → "}<span className="text-green-700 font-medium">{e.new_date}</span></>
                        ) : (e.new_date ?? e.old_date ?? "—")}
                      </td>
                      <td className="px-3 py-2 border border-gray-100 text-gray-700">
                        {e.old_qty != null && e.old_qty !== e.new_qty ? (
                          <><span className="text-red-500 line-through">{e.old_qty}</span>{" → "}<span className="text-green-700 font-medium">{e.new_qty}</span></>
                        ) : (e.new_qty ?? e.old_qty ?? "—")}
                      </td>
                      <td className="px-3 py-2 border border-gray-100 text-gray-500">{e.edited_by ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Floating tracking panel — mở khi bấm icon thông báo */}
      {showTracking && (
        <>
          {/* Backdrop mờ */}
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setShowTracking(false)} />
          {/* Panel */}
          <div className="fixed z-50 top-[60px] right-4 w-[720px] max-w-[calc(100vw-2rem)] max-h-[80vh]
                          bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 shrink-0">
              <AlertTriangle size={15} className="text-red-500 shrink-0" />
              <span className="text-sm font-semibold text-gray-900">Theo dõi tiến độ</span>
              {lateCount > 0 && (
                <span className={`${BADGE} bg-red-100 text-red-700`}>{lateCount} trễ</span>
              )}
              {unscheduledCount > 0 && (
                <span className={`${BADGE} bg-amber-100 text-amber-700`}>{unscheduledCount} chưa xong</span>
              )}
              <div className="flex-1" />
              <button
                className="text-gray-400 hover:text-gray-700 text-lg leading-none px-1"
                onClick={() => setShowTracking(false)}>✕</button>
            </div>
            <div className="overflow-y-auto p-4">
              <ScheduleTracking orders={orders} chunks={chunks} />
            </div>
          </div>
        </>
      )}

      {/* Sub-planner dispatch tracking — Step 6 review */}
      {runId && (
        <div className="px-5 pb-4 shrink-0">
          <SubPlannerDispatchPanel runId={runId} dispatchStep={6} />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-3 px-5 py-3 border-t border-gray-100 bg-gray-50 shrink-0">
        <button className={`${BTN} bg-white text-gray-700 border-gray-200 hover:bg-gray-50`} onClick={onPrev}>
          <ChevronLeft size={14} /> Bước trước
        </button>
        <div className="flex-1" />
        {autoSaveStatus === "saving" && (
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <Loader2 size={12} className="animate-spin" /> Đang lưu…
          </span>
        )}
        {autoSaveStatus === "saved" && (
          <span className="flex items-center gap-1.5 text-xs text-green-600">
            <CheckCircle2 size={12} /> Đã lưu
          </span>
        )}
        <button className={`${BTN} bg-blue-600 text-white border-blue-600 hover:bg-blue-700`} onClick={onNext}>
          Bước tiếp <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
