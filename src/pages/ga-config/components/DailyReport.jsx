import { useState, useMemo } from "react";
import { Search, Calendar, Loader2, Info } from "lucide-react";
import { useRunScheduleDay, useRunOutputLineload, useLineWithRunning } from "../../../hooks/useRuns";

const BADGE = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium";

export default function DailyReport({ runId }) {
  const [selectedDate,    setSelectedDate]    = useState("");
  const [selectedLine,    setSelectedLine]    = useState(null);
  const [selectedDepName, setSelectedDepName] = useState(null);
  const [selectedOrder,   setSelectedOrder]   = useState(null);
  const [dateFilter,      setDateFilter]      = useState("");
  const [searchQ,         setSearchQ]         = useState("");

  const { data: lineloadData, isLoading: llLoading } = useRunOutputLineload(runId);
  const { data: dayData,      isLoading: dayLoading } = useRunScheduleDay(runId, selectedDate || undefined);
  const { data: erpData }                             = useLineWithRunning(runId, selectedLine, selectedDate || undefined);
  const erpRunning      = erpData?.running_orders  ?? [];
  const committedOrders = erpData?.committed_orders ?? [];

  const gridRows = useMemo(() => {
    const rows = lineloadData?.rows ?? lineloadData?.items ?? [];
    if (!rows.length) return [];
    let filtered = rows;
    if (dateFilter) filtered = filtered.filter(r => r.date?.startsWith(dateFilter));
    if (searchQ) {
      const q = searchQ.toLowerCase();
      filtered = filtered.filter(r => r.line?.toLowerCase().includes(q) || r.date?.includes(q));
    }
    return [...filtered].sort((a, b) => {
      const d = (a.date || "").localeCompare(b.date || "");
      return d !== 0 ? d : (a.line || "").localeCompare(b.line || "");
    });
  }, [lineloadData, dateFilter, searchQ]);

  const { frozenOrders, futureOrders, newOrders: dayNewOrders } = useMemo(() => {
    if (!dayData?.lines || !selectedLine) return { frozenOrders: [], futureOrders: [], newOrders: [] };
    const lineData = dayData.lines.find(l => l.line === selectedLine);
    if (!lineData) return { frozenOrders: [], futureOrders: [], newOrders: [] };
    const all = [...(lineData.sew_orders || []), ...(lineData.go_orders || [])];
    return {
      frozenOrders:  all.filter(o => o.is_frozen),
      futureOrders:  all.filter(o => !o.is_frozen && o.state === "FUTURE_PLANNED"),
      newOrders:     all.filter(o => !o.is_frozen && o.state !== "FUTURE_PLANNED"),
    };
  }, [dayData, selectedLine]);

  const allDates = useMemo(() => {
    const set = new Set(gridRows.map(r => r.date).filter(Boolean));
    return [...set].sort();
  }, [gridRows]);

  const handleRowClick = (row) => {
    setSelectedDate(row.date);
    setSelectedLine(row.line);
    setSelectedDepName(row.dep_name ?? row.line);
    setSelectedOrder(null);
  };

  if (llLoading) {
    return (
      <div className="py-12 text-center">
        <Loader2 size={24} className="animate-spin mx-auto text-blue-500" />
        <div className="text-sm text-gray-500 mt-2">Đang tải báo cáo ngày…</div>
      </div>
    );
  }

  const totalRows = (lineloadData?.rows ?? lineloadData?.items ?? []).length;

  if (!totalRows) {
    return (
      <div className="py-12 text-center text-gray-400">
        <Calendar size={28} className="mx-auto mb-2" />
        <div className="font-semibold text-gray-600">Chưa có dữ liệu báo cáo ngày</div>
      </div>
    );
  }

  return (
    <div className="flex gap-4" style={{ minHeight: 420 }}>
      {/* ── LEFT PANEL ── */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <strong className="text-sm text-gray-900">Báo cáo theo ngày × chuyền</strong>
          <div className="relative ml-auto">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
            <input
              className="pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ width: 160 }}
              placeholder="Tìm chuyền / ngày..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
            />
          </div>
          <input type="date"
            className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
          />
        </div>

        <div className="max-h-[calc(100vh-220px)] overflow-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b border-gray-200">
                {["NGÀY SX", "CHUYỀN", "SẢN LƯỢNG", "MỤC TIÊU", "CHÊNH", ""].map((h, i) => (
                  <th key={i} className={`px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide
                    ${i >= 2 ? "text-right" : "text-left"} ${i === 5 ? "w-16" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gridRows.slice(0, 300).map((r, i) => {
                const dep     = r.dep_name ?? r.line;
                const target  = r.day_capacity ?? 0;
                const actual  = r.total_qty ?? 0;
                const diff    = actual - target;
                const utilPct = target > 0 ? Math.min(actual / target, 1) : 0;
                const isSelected = r.date === selectedDate && r.line === selectedLine;

                return (
                  <tr key={`${r.date}-${r.line}-${r.stage}-${i}`}
                    className={`border-b border-gray-50 last:border-0 cursor-pointer transition-colors
                      ${isSelected ? "bg-blue-50 border-l-2 border-l-blue-500" : "hover:bg-gray-50"}`}
                    onClick={() => handleRowClick(r)}>
                    <td className="px-3 py-2 text-xs text-gray-700 font-medium">{r.date}</td>
                    <td className="px-3 py-2 text-xs">
                      <code className="bg-gray-100 px-1.5 py-0.5 rounded text-[11px] text-gray-700 font-bold">{dep}</code>
                    </td>
                    <td className="px-3 py-2 text-xs font-bold text-right text-gray-900">
                      {actual.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs text-right text-gray-500">
                      {target > 0 ? target.toLocaleString() : "—"}
                    </td>
                    <td className={`px-3 py-2 text-xs font-bold text-right ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-gray-400"}`}>
                      {target > 0 ? (diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {target > 0 && (
                        <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-blue-400" style={{ width: `${utilPct * 100}%` }} />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-gray-400 mt-1.5 px-1 flex gap-3">
          <span>{gridRows.length}/{totalRows} dòng · {allDates.length} ngày</span>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="w-[400px] shrink-0">
        {!selectedDate || !selectedLine ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
            <div className="text-center">
              <Calendar size={24} className="mx-auto mb-2 opacity-50" />
              <div>Chọn 1 dòng bên trái để xem chi tiết</div>
            </div>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {(() => {
              const selRow = gridRows.find(r => r.date === selectedDate && r.line === selectedLine);
              return (
                <RightPanelHeader
                  date={selectedDate}
                  line={selectedDepName ?? selectedLine}
                  actual={selRow?.total_qty ?? 0}
                  target={selRow?.day_capacity ?? 0}
                  frozenCount={frozenOrders.length}
                  futureCount={futureOrders.length}
                  newCount={dayNewOrders.length}
                />
              );
            })()}
            {dayLoading ? (
              <div className="py-8 text-center">
                <Loader2 size={18} className="animate-spin mx-auto text-blue-500" />
              </div>
            ) : (
              <div className="max-h-[calc(100vh-280px)] overflow-auto">
                {erpRunning.length > 0     && <ErpRunningSection rows={erpRunning} date={selectedDate} />}
                {frozenOrders.length > 0   && (
                  <OrderSection title="Đơn đang chạy (giữ nguyên)" orders={frozenOrders}
                    selectedOrder={selectedOrder} onSelect={setSelectedOrder} rowStyle="frozen" />
                )}
                {futureOrders.length > 0   && (
                  <OrderSection title="Đơn tương lai (PDSCH)" orders={futureOrders}
                    selectedOrder={selectedOrder} onSelect={setSelectedOrder} rowStyle="future" />
                )}
                {dayNewOrders.length > 0   && (
                  <OrderSection title="Đơn mới sắp xếp" orders={dayNewOrders}
                    selectedOrder={selectedOrder} onSelect={setSelectedOrder} rowStyle="new" />
                )}
                {committedOrders.length > 0 && <CommittedOrderSection orders={committedOrders} />}
                {erpRunning.length === 0 && frozenOrders.length === 0 && dayNewOrders.length === 0 && committedOrders.length === 0 && (
                  <div className="py-8 text-center">
                    <div className="text-gray-400 text-xs">Không có đơn được ghi nhận cho</div>
                    <code className="text-blue-600 text-xs font-bold mt-0.5 block">{selectedDepName ?? selectedLine}</code>
                    <div className="text-[10px] text-gray-400 mt-2 mx-4">
                      Có thể chuyền này chỉ có dữ liệu tải phân xưởng (lineload) nhưng chưa có đơn chi tiết,
                      hoặc đây là dữ liệu từ chuyền gò (không có đơn may riêng).
                    </div>
                  </div>
                )}
              </div>
            )}
            {selectedOrder?.sizes && Object.keys(selectedOrder.sizes).length > 0 && (
              <SizeBreakdownTable orderId={selectedOrder.order_id} sizes={selectedOrder.sizes} />
            )}
            {selectedOrder && (!selectedOrder.sizes || Object.keys(selectedOrder.sizes).length === 0) && (
              <NoSizeExplanation order={selectedOrder} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Right panel header ────────────────────────────────────────────────────────

function RightPanelHeader({ date, line, actual, target, frozenCount, futureCount, newCount }) {
  const utilPct = target > 0 ? actual / target : 0;

  return (
    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="text-sm font-bold text-gray-900">
          {date} · <code className="text-blue-700">{line}</code>
        </div>
      </div>

      {target > 0 ? (
        <>
          <div className="flex justify-between text-[11px] text-gray-500 mb-1">
            <span>
              <span className="font-semibold text-gray-800">{actual.toLocaleString()}</span>
              {" "}/ mục tiêu {target.toLocaleString()}
            </span>
            <span className={`font-bold ${utilPct >= 0.95 ? "text-green-600" : utilPct >= 0.75 ? "text-blue-600" : "text-orange-500"}`}>
              {Math.round(utilPct * 100)}%
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all bg-blue-400" style={{ width: `${Math.min(utilPct * 100, 120)}%` }} />
          </div>
          <div className="flex gap-3 mt-1.5 text-[10px] text-gray-500">
            {frozenCount  > 0 && <span className="text-orange-600">{frozenCount} đơn đang chạy</span>}
            {futureCount  > 0 && <span className="text-purple-600">{futureCount} đơn tương lai</span>}
            {newCount     > 0 && <span className="text-blue-600">{newCount} đơn mới</span>}
          </div>
        </>
      ) : (
        <div className="text-[11px] text-gray-400">
          {frozenCount  > 0 && <span className="text-orange-600 mr-2">{frozenCount} đơn đang chạy</span>}
          {futureCount  > 0 && <span className="text-purple-600 mr-2">{futureCount} đơn tương lai</span>}
          {newCount     > 0 && <span className="text-blue-600">{newCount} đơn mới</span>}
        </div>
      )}
    </div>
  );
}

// ── Size helpers ──────────────────────────────────────────────────────────────

function parseSizeForSort(key) {
  const s = String(key).trim().toUpperCase();
  if (s.endsWith("K")) { const n = parseFloat(s.slice(0, -1)); return isNaN(n) ? Infinity : 1000 + n; }
  const n = parseFloat(s);
  return isNaN(n) ? Infinity : n;
}

function formatSizeLabel(key) { return String(key).trim(); }

// ── No-size explanation ───────────────────────────────────────────────────────

const IS_GC_LINE = (line) => /^JAZ|^GC/i.test(line ?? "");

function NoSizeExplanation({ order }) {
  const isGo  = order.stage === "A" || order.stage === "GO";
  const isGc  = IS_GC_LINE(order.line ?? "");
  const isFrz = order.is_frozen;

  let icon  = <Info size={12} className="shrink-0 mt-0.5 text-gray-400" />;
  let color = "bg-gray-50 border-gray-200 text-gray-500";
  let msg;

  if (isGo) {
    color = "bg-orange-50 border-orange-200 text-orange-700";
    icon  = <Info size={12} className="shrink-0 mt-0.5 text-orange-400" />;
    msg   = (
      <>
        Đơn ở <strong>giai đoạn gò (A)</strong> — chưa có dữ liệu size cho ngày may tương ứng.
        Xem size tổng hợp trong tab <em>Bảng chi tiết</em>.
      </>
    );
  } else if (isGc) {
    color = "bg-purple-50 border-purple-200 text-purple-700";
    icon  = <Info size={12} className="shrink-0 mt-0.5 text-purple-400" />;
    msg   = (
      <>
        Đơn <strong>gia công ngoài (GC)</strong> — size do đơn vị gia công quản lý,
        hệ thống chưa có dữ liệu phân tích size ngày may cho đơn này.
      </>
    );
  } else if (isFrz) {
    color = "bg-amber-50 border-amber-200 text-amber-700";
    icon  = <Info size={12} className="shrink-0 mt-0.5 text-amber-400" />;
    msg   = (
      <>
        Đơn <strong>đang chạy (frozen)</strong> — dữ liệu size không được lưu cho
        ngày đã sản xuất. Kiểm tra ERP để xem phân tích size thực tế.
      </>
    );
  } else {
    msg   = (
      <>
        <strong>Chưa có dữ liệu size</strong> — đơn mới chưa được phân tích size,
        hoặc không tìm thấy dữ liệu trong DE_ORDERD / SCBBSS.
      </>
    );
  }

  return (
    <div className={`border-t border-gray-200`}>
      <div className={`mx-4 my-3 flex items-start gap-2 px-3 py-2.5 rounded-lg border text-xs ${color}`}>
        {icon}
        <div className="leading-relaxed">{msg}</div>
      </div>
    </div>
  );
}

// ── Size breakdown ────────────────────────────────────────────────────────────

function SizeBreakdownTable({ orderId, sizes }) {
  const entries = Object.entries(sizes).filter(([, qty]) => Number(qty) > 0)
    .sort(([a], [b]) => parseSizeForSort(a) - parseSizeForSort(b));
  const total   = entries.reduce((s, [, q]) => s + Number(q), 0);
  const qEntries = entries.filter(([k]) => !String(k).toUpperCase().endsWith("K"));
  const kEntries = entries.filter(([k]) =>  String(k).toUpperCase().endsWith("K"));

  return (
    <div className="border-t border-gray-200">
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <div className="text-xs font-bold text-gray-700">Cỡ giày · <span className="text-blue-700">{orderId}</span></div>
        <div className="text-[10px] text-gray-400">
          {qEntries.length > 0 && <span className="mr-2 text-gray-600">{qEntries.length} cỡ thường</span>}
          {kEntries.length > 0 && <span className="text-purple-600">{kEntries.length} cỡ K</span>}
          <span className="ml-2 font-semibold text-gray-700">{total.toLocaleString()} đôi</span>
        </div>
      </div>
      <div className="max-h-[180px] overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase text-left">CỠ</th>
              <th className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase text-right">SỐ ĐÔI</th>
              <th className="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase text-right w-16">%</th>
            </tr>
          </thead>
          <tbody>
            {qEntries.length > 0 && kEntries.length > 0 && (
              <tr className="bg-blue-50"><td colSpan={3} className="px-4 py-0.5 text-[9px] font-bold text-blue-600 uppercase tracking-wide">Cỡ thường (Q)</td></tr>
            )}
            {qEntries.map(([size, qty]) => (
              <tr key={size} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-1.5 font-bold text-gray-900">{formatSizeLabel(size)}</td>
                <td className="px-4 py-1.5 text-right font-medium text-gray-700">{Number(qty).toLocaleString()}</td>
                <td className="px-4 py-1.5 text-right text-gray-400 text-[10px]">
                  {total > 0 ? `${Math.round(Number(qty) / total * 100)}%` : "—"}
                </td>
              </tr>
            ))}
            {kEntries.length > 0 && (
              <tr className="bg-purple-50"><td colSpan={3} className="px-4 py-0.5 text-[9px] font-bold text-purple-600 uppercase tracking-wide">Cỡ trẻ em (K)</td></tr>
            )}
            {kEntries.map(([size, qty]) => (
              <tr key={size} className="border-b border-gray-50 last:border-0 hover:bg-purple-50">
                <td className="px-4 py-1.5 font-bold text-purple-800">{formatSizeLabel(size)}</td>
                <td className="px-4 py-1.5 text-right font-medium text-purple-700">{Number(qty).toLocaleString()}</td>
                <td className="px-4 py-1.5 text-right text-purple-400 text-[10px]">
                  {total > 0 ? `${Math.round(Number(qty) / total * 100)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── ERP actual production ─────────────────────────────────────────────────────

function ErpRunningSection({ rows, date }) {
  const byOrder = useMemo(() => {
    const map = {};
    for (const r of rows) {
      if (!map[r.scbh]) map[r.scbh] = { ...r };
      else map[r.scbh].actual_qty += r.actual_qty;
    }
    return Object.values(map);
  }, [rows]);

  return (
    <div>
      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-700 border-b border-amber-100 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
        Đang sản xuất thực tế (ERP)
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase text-left">MÃ ĐƠN</th>
            <th className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase text-right">SL {date || "NGÀY ĐÓ"}</th>
            <th className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase text-right">CÒN LẠI</th>
          </tr>
        </thead>
        <tbody>
          {byOrder.map((r) => {
            const pct = r.order_qty > 0 ? Math.round((r.remaining_qty / r.order_qty) * 100) : null;
            const badgeColor = pct == null ? "bg-gray-100 text-gray-500" : pct > 60 ? "bg-red-100 text-red-700" : pct > 30 ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700";
            return (
              <tr key={r.scbh} className="border-b border-amber-50 hover:bg-amber-50/50">
                <td className="px-3 py-1.5 font-mono font-bold text-amber-900">
                  {r.scbh}<span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                </td>
                <td className="px-3 py-1.5 text-right font-medium text-gray-800">{r.actual_qty.toLocaleString()}</td>
                <td className="px-3 py-1.5 text-right">
                  {r.remaining_qty != null ? (
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${badgeColor}`}>
                      {r.remaining_qty.toLocaleString()} đôi{pct != null && <span className="ml-1 opacity-70">({pct}%)</span>}
                    </span>
                  ) : <span className="text-gray-400">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Committed orders ──────────────────────────────────────────────────────────

function CommittedOrderSection({ orders }) {
  return (
    <div>
      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide bg-purple-50 text-purple-700 border-b border-purple-100 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />
        Đơn cũ đang chạy trên chuyền
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase text-left">MÃ ĐƠN</th>
            <th className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase text-left">ARTICLE</th>
            <th className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase text-right">ĐÃ MAY</th>
            <th className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase text-right">CÒN LẠI</th>
            <th className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase text-left">LPD</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const pct = o.order_qty > 0 ? Math.round((o.actual_sew_qty / o.order_qty) * 100) : null;
            const rem = o.remaining_sew_qty;
            const remBadge = rem == null ? "bg-gray-100 text-gray-500" : rem > 2000 ? "bg-red-100 text-red-700" : rem > 500 ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700";
            return (
              <tr key={o.scbh} className="border-b border-purple-50 hover:bg-purple-50/40">
                <td className="px-3 py-1.5 font-mono font-bold text-purple-900 text-[11px]">{o.scbh}</td>
                <td className="px-3 py-1.5 text-gray-600 text-[11px]">{o.article ?? "—"}</td>
                <td className="px-3 py-1.5 text-right text-gray-700">
                  {o.actual_sew_qty.toLocaleString()}{pct != null && <span className="ml-1 text-gray-400 text-[10px]">({pct}%)</span>}
                </td>
                <td className="px-3 py-1.5 text-right">
                  {rem != null ? (
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${remBadge}`}>{rem.toLocaleString()}</span>
                  ) : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-3 py-1.5 text-gray-500 text-[10px]">{o.lpd ? String(o.lpd) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Order section (frozen / new) ──────────────────────────────────────────────

const STAGE_META = {
  SEW:  { label: "May",  short: "S", cls: "bg-blue-100 text-blue-700",   dot: "bg-blue-500"   },
  "C+S":{ label: "May",  short: "S", cls: "bg-blue-100 text-blue-700",   dot: "bg-blue-500"   },
  S:    { label: "May",  short: "S", cls: "bg-blue-100 text-blue-700",   dot: "bg-blue-500"   },
  GO:   { label: "Gò",   short: "A", cls: "bg-orange-100 text-orange-700", dot: "bg-orange-400" },
  A:    { label: "Gò",   short: "A", cls: "bg-orange-100 text-orange-700", dot: "bg-orange-400" },
};

function OrderSection({ title, orders, selectedOrder, onSelect, rowStyle }) {
  const isFrozen = rowStyle === "frozen";
  const isFuture = rowStyle === "future";

  // Detect if section is go-only (all orders are stage A/GO)
  const allGo = orders.length > 0 && orders.every(o => o.stage === "A" || o.stage === "GO");
  const hasGC = orders.some(o => IS_GC_LINE(o.line ?? ""));

  return (
    <div>
      <div className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide flex items-center gap-2
        ${isFrozen ? "bg-orange-50 text-orange-700 border-b border-orange-100"
          : isFuture ? "bg-purple-50 text-purple-700 border-b border-purple-100"
          : "bg-blue-50 text-blue-700 border-b border-blue-100"}`}>
        <span>{title}</span>
        {allGo && (
          <span className="ml-auto flex items-center gap-1 font-normal text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />Toàn bộ đang gò (A)
          </span>
        )}
        {hasGC && !allGo && (
          <span className="ml-auto flex items-center gap-1 font-normal text-[9px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">GC</span>
        )}
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase text-left">MÃ ĐƠN</th>
            <th className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase text-left">ARTICLE</th>
            <th className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase text-right">SL NGÀY</th>
            <th className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase text-left">G.ĐOẠN</th>
            <th className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase text-left">CRD</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o, i) => {
            const isActive  = selectedOrder?.order_id === o.order_id && selectedOrder?.stage === o.stage;
            const stageMeta = STAGE_META[o.stage] ?? { label: o.stage ?? "?", short: "?", cls: "bg-gray-100 text-gray-500", dot: "bg-gray-400" };
            const isGC      = IS_GC_LINE(o.line ?? "");
            const noSizes   = !o.sizes || Object.keys(o.sizes).length === 0;
            const isSewStage = o.stage === "SEW" || o.stage === "S" || o.stage === "C+S";

            return (
              <tr key={`${o.order_id}-${o.stage}-${i}`}
                className={`border-b border-gray-50 cursor-pointer transition-colors
                  ${isActive
                    ? (isFrozen ? "bg-orange-100" : isFuture ? "bg-purple-100" : "bg-blue-100")
                    : (isFrozen ? "hover:bg-orange-50" : isFuture ? "hover:bg-purple-50" : "hover:bg-blue-50")}`}
                onClick={() => onSelect(o)}>

                <td className={`px-3 py-1.5 font-mono font-bold ${isFrozen ? "text-orange-800" : isFuture ? "text-purple-800" : "text-blue-700"}`}>
                  <div className="flex items-center gap-1.5">
                    {o.order_id}
                    {isFrozen && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" title="Đang chạy" />}
                    {isFuture && <span className="text-[8px] font-bold text-purple-600 bg-purple-100 px-1 py-0.5 rounded leading-none" title="Đơn tương lai từ PDSCH">TL</span>}
                    {isGC && <span className="text-[8px] font-bold text-purple-600 bg-purple-100 px-1 py-0.5 rounded leading-none">GC</span>}
                    {noSizes && isSewStage && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Chưa có dữ liệu size" />
                    )}
                  </div>
                </td>

                <td className="px-3 py-1.5 text-gray-600 max-w-[90px]">
                  <div className="truncate text-[11px]" title={o.article}>{o.article || "—"}</div>
                </td>

                <td className="px-3 py-1.5 font-bold text-gray-900 text-right">{(o.qty ?? 0).toLocaleString()}</td>

                <td className="px-3 py-1.5">
                  <span className={`${BADGE} ${stageMeta.cls}`} title={stageMeta.label}>
                    <span className={`w-1.5 h-1.5 rounded-full ${stageMeta.dot}`} />
                    {stageMeta.short}
                  </span>
                </td>

                <td className="px-3 py-1.5 text-gray-500 text-[10px]">{o.crd ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
