/**
 * Step 4 — Ngày dự kiến thu gia công
 *
 * Shows all GC (outsource) orders.  User can enter:
 *   - ngày bắt đầu gia công  (gc_start_date)
 *   - ngày kết thúc gia công (gc_end_date)
 * either by typing directly in each row or via bulk Excel import.
 *
 * Props:
 *   gcOrders         — array of items { order_id, order: {ARTICLE, XieMing_, PAIRQTY, DUEDT} }
 *   gcDateOverrides  — {order_id: {start_date?, end_date?}}
 *   setGcDateOverrides — state setter
 *   onPrev / onNext  — navigation
 */
import { useState, useMemo } from "react";
import {
  FileSpreadsheet, Search, Info, ChevronLeft, ChevronRight,
  X, CalendarDays, Eye,
} from "lucide-react";
import ExcelGCDatesModal from "../components/ExcelGCDatesModal";

const PAGE_SIZE = 20;

const BTN = [
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm",
  "transition-colors font-medium",
].join(" ");

const BTN_SM = [
  "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-xs",
  "transition-colors font-medium",
].join(" ");

const INPUT_DATE = [
  "px-2 py-1 rounded-md border border-gray-200 text-xs bg-white",
  "focus:outline-none focus:ring-1 focus:ring-orange-400 focus:border-orange-400",
].join(" ");

export default function Step4GCDates({
  gcOrders = [],
  gcDateOverrides = {},
  setGcDateOverrides,
  onPrev,
  onNext,
  readOnly = false,
}) {
  const [showImport, setShowImport] = useState(false);
  const [search,     setSearch]     = useState("");
  const [page,       setPage]       = useState(1);

  const gcOrderIds = useMemo(
    () => new Set(gcOrders.map(o => String(o.order_id).toUpperCase())),
    [gcOrders],
  );

  function setDate(id, field, value) {
    setGcDateOverrides(prev => {
      const cur = prev[id] || {};
      if (!value) {
        const next = { ...cur };
        delete next[field];
        if (Object.keys(next).length === 0) {
          const all = { ...prev };
          delete all[id];
          return all;
        }
        return { ...prev, [id]: next };
      }
      return { ...prev, [id]: { ...cur, [field]: value } };
    });
  }

  function clearRow(id) {
    setGcDateOverrides(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  const filtered = useMemo(() => {
    if (!search) return gcOrders;
    const q = search.toLowerCase();
    return gcOrders.filter(o =>
      String(o.order_id).toLowerCase().includes(q) ||
      String(o.order?.ARTICLE || "").toLowerCase().includes(q) ||
      String(o.order?.XieMing_ || o.order?.XieMing || "").toLowerCase().includes(q),
    );
  }, [gcOrders, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filledCount = Object.keys(gcDateOverrides).filter(
    id => gcDateOverrides[id]?.start_date || gcDateOverrides[id]?.end_date,
  ).length;

  function handleImportConfirm(datesMap) {
    setGcDateOverrides(prev => ({ ...prev, ...datesMap }));
    setShowImport(false);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm max-w-[1180px] mx-auto flex flex-col h-full">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-100 shrink-0">
        <CalendarDays size={18} className="text-orange-500 shrink-0" />
        <div>
          <div className="text-sm font-semibold text-gray-900">Bước 4 · Ngày gia công</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Nhập ngày dự kiến bắt đầu & kết thúc gia công cho các đơn GC.
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {readOnly && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200">
              <Eye size={11} /> Chỉ xem
            </span>
          )}
          {filledCount > 0 && (
            <span className="text-xs text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full font-medium">
              {filledCount} / {gcOrders.length} đã nhập
            </span>
          )}
          {gcOrders.length > 0 && !readOnly && (
            <button
              className={`${BTN_SM} bg-green-50 text-green-700 border-green-200 hover:bg-green-100`}
              onClick={() => setShowImport(true)}
            >
              <FileSpreadsheet size={13} /> Import Excel
            </button>
          )}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto p-5">
        {gcOrders.length === 0 ? (
          <div className="flex items-start gap-2 px-3 py-3 rounded-lg text-sm bg-amber-50 text-amber-800 border border-amber-100">
            <Info size={15} className="shrink-0 mt-0.5" />
            Chưa có đơn gia công — vui lòng quay lại Bước 1 và chọn đơn GC.
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-3 mb-3">
              <div className="relative flex-1 max-w-xs">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Tìm mã đơn, article, model…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <div className="text-xs text-gray-500">
                {gcOrders.length} đơn GC
                {search && filtered.length !== gcOrders.length && (
                  <span className="ml-1 text-blue-600">· {filtered.length} khớp</span>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 w-32">Mã đơn</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 w-24">Article</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Model</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500 w-20">SL</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-500 w-24">CRD</th>
                    <th className="px-3 py-2 text-center font-medium text-orange-600 w-40">Bắt đầu GC</th>
                    <th className="px-3 py-2 text-center font-medium text-orange-600 w-40">Kết thúc GC</th>
                    <th className="px-3 py-2 w-7" />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(o => {
                    const id    = String(o.order_id);
                    const dates = gcDateOverrides[id] || {};
                    const hasAny = !!(dates.start_date || dates.end_date);
                    return (
                      <tr
                        key={id}
                        className={`border-b border-gray-50 last:border-0 transition-colors ${
                          hasAny ? "bg-orange-50/30 hover:bg-orange-50/60" : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-3 py-2 font-mono font-semibold text-gray-900 whitespace-nowrap">{id}</td>
                        <td className="px-3 py-2 text-gray-700">{o.order?.ARTICLE || "—"}</td>
                        <td className="px-3 py-2 text-gray-600 max-w-[200px] truncate">
                          {o.order?.XieMing_ || o.order?.XieMing || "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                          {parseInt(o.order?.PAIRQTY || 0, 10).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-400">
                          {(o.order?.DUEDT || "—").toString().slice(0, 10)}
                        </td>

                        {/* Start date */}
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="date"
                              className={INPUT_DATE}
                              value={dates.start_date || ""}
                              disabled={readOnly}
                              onChange={e => setDate(id, "start_date", e.target.value)}
                            />
                            {dates.start_date && !readOnly && (
                              <button
                                className="text-gray-300 hover:text-gray-500 transition-colors"
                                onClick={() => setDate(id, "start_date", "")}
                              >
                                <X size={11} />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* End date */}
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="date"
                              className={INPUT_DATE}
                              value={dates.end_date || ""}
                              disabled={readOnly}
                              onChange={e => setDate(id, "end_date", e.target.value)}
                            />
                            {dates.end_date && !readOnly && (
                              <button
                                className="text-gray-300 hover:text-gray-500 transition-colors"
                                onClick={() => setDate(id, "end_date", "")}
                              >
                                <X size={11} />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Clear row */}
                        <td className="px-1 py-2 text-center">
                          {hasAny && !readOnly && (
                            <button
                              className="text-gray-200 hover:text-red-400 transition-colors"
                              title="Xoá ngày hàng này"
                              onClick={() => clearRow(id)}
                            >
                              <X size={11} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-3">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-2 py-1 rounded border border-gray-200 text-xs text-gray-600 disabled:opacity-40 hover:bg-gray-50"
                >
                  <ChevronLeft size={12} />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const pg = totalPages <= 7 ? i + 1 : Math.max(1, Math.min(totalPages - 6, page - 3)) + i;
                  return (
                    <button
                      key={pg}
                      onClick={() => setPage(pg)}
                      className={`px-2.5 py-1 rounded border text-xs transition-colors ${
                        pg === page
                          ? "bg-blue-500 text-white border-blue-500"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {pg}
                    </button>
                  );
                })}
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-2 py-1 rounded border border-gray-200 text-xs text-gray-600 disabled:opacity-40 hover:bg-gray-50"
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Footer navigation ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-3 border-t border-gray-100 bg-gray-50 shrink-0">
        <button
          className={`${BTN} border-gray-200 text-gray-700 bg-white hover:bg-gray-50`}
          onClick={onPrev}
        >
          <ChevronLeft size={15} /> Bước trước
        </button>
        <div className="flex-1" />
        <button
          className={`${BTN} border-blue-500 text-white bg-blue-500 hover:bg-blue-600`}
          onClick={onNext}
        >
          Bước tiếp <ChevronRight size={15} />
        </button>
      </div>

      {/* ── Import modal ───────────────────────────────────────────────────── */}
      {showImport && (
        <ExcelGCDatesModal
          gcOrderIds={gcOrderIds}
          onConfirm={handleImportConfirm}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
