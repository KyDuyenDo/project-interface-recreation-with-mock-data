import { useState, useMemo } from "react";
import {
  Search, ChevronLeft, ChevronRight, Loader2, X,
  FileSpreadsheet, AlertTriangle, Plus, ArrowRight, ArrowLeft,
  Wand2, Eye,
} from "lucide-react";
import { ordersApi, wizardApi } from "../../../api";
import ExcelImportModal from "../components/ExcelImportModal";

const BTN    = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SM = "inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const PAGE_SIZE = 15;

// ─── Single orders panel (regular or GC) ─────────────────────────────────────
function OrdersPanel({ title, type, orders, onAdd, onRemove, onMoveToOther, readOnly = false }) {
  const [inputCode,    setInputCode]    = useState("");
  const [inputLoading, setInputLoading] = useState(false);
  const [addError,     setAddError]     = useState("");
  const [search,       setSearch]       = useState("");
  const [page,         setPage]         = useState(1);
  const [showImport,   setShowImport]   = useState(false);

  const isGc = type === "gc";

  // Total quantity
  const totalQty = useMemo(
    () => orders.reduce((s, o) => s + (parseInt(o.order?.PAIRQTY || 0, 10) || 0), 0),
    [orders],
  );

  // Filter — search across order_id, ARTICLE, DAOMH, XieMing
  const filtered = useMemo(() => {
    if (!search) return orders;
    const q = search.toLowerCase();
    return orders.filter(o =>
      o.order_id.toLowerCase().includes(q) ||
      (o.order?.ARTICLE                     || "").toLowerCase().includes(q) ||
      (o.order?.DAOMH_  || o.order?.DAOMH   || "").toLowerCase().includes(q) ||
      (o.order?.XieMing_ || o.order?.XieMing || "").toLowerCase().includes(q)
    );
  }, [orders, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageOrders = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Manual add
  async function handleAddCode() {
    const code = inputCode.trim().toUpperCase();
    if (!code) return;
    if (orders.some(o => o.order_id === code)) {
      setAddError("Mã đã có trong danh sách"); return;
    }
    setInputLoading(true); setAddError("");
    try {
      const check = await ordersApi.bulkLookup([code]);
      if (!check.found?.length) {
        setAddError("Không tìm thấy mã này trong hệ thống"); return;
      }
      const res = await ordersApi.list({
        order_ids: [code], include_sizes: false, page_size: 1,
      });
      const item = res?.items?.[0];
      if (item) { onAdd(item); setInputCode(""); }
      else setAddError("Không lấy được chi tiết đơn hàng");
    } catch {
      setAddError("Lỗi kết nối — vui lòng thử lại");
    } finally {
      setInputLoading(false);
    }
  }

  function handleImportConfirm(_foundIds, orderDetails) {
    setShowImport(false);
    const existing = new Set(orders.map(o => o.order_id));
    (orderDetails || [])
      .filter(o => o.order_id && !existing.has(o.order_id))
      .forEach(item => onAdd(item));
  }

  // Color theme
  const accent = isGc
    ? { border: "border-orange-200", headBg: "bg-orange-50/50 border-orange-100", inputRing: "focus:ring-orange-400", addBtn: "bg-orange-600 text-white border-orange-600 hover:bg-orange-700", importBtn: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100" }
    : { border: "border-blue-200",   headBg: "bg-blue-50/50 border-blue-100",     inputRing: "focus:ring-blue-400",   addBtn: "bg-blue-600 text-white border-blue-600 hover:bg-blue-700",     importBtn: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100" };

  return (
    <div className={`bg-white rounded-xl border ${accent.border} shadow-sm flex flex-col h-full min-h-0`}>

      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-3 border-b rounded-t-xl ${accent.headBg}`}>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900">{title}</div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {orders.length > 0 && (
              <span className={`text-xs font-medium ${isGc ? "text-orange-600" : "text-blue-600"}`}>
                {orders.length} đơn
              </span>
            )}
            {totalQty > 0 && (
              <span className="text-xs text-gray-400">
                · {totalQty.toLocaleString()} đôi
              </span>
            )}
          </div>
        </div>
        {!readOnly && (
          <button
            onClick={() => setShowImport(true)}
            className={`${BTN_SM} ${accent.importBtn} shrink-0`}>
            <FileSpreadsheet size={12} /> Import Excel
          </button>
        )}
      </div>

      {/* Input row — hidden in read-only */}
      {!readOnly && (
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex gap-2">
            <input
              className={`flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 ${accent.inputRing}`}
              placeholder="Nhập mã đơn hàng, Enter để thêm…"
              value={inputCode}
              onChange={e => { setInputCode(e.target.value); setAddError(""); }}
              onKeyDown={e => e.key === "Enter" && handleAddCode()}
            />
            <button
              disabled={!inputCode.trim() || inputLoading}
              onClick={handleAddCode}
              className={`${BTN_SM} ${accent.addBtn}`}>
              {inputLoading
                ? <Loader2 size={12} className="animate-spin" />
                : <Plus size={12} />}
              Thêm
            </button>
          </div>
          {addError && (
            <div className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
              <AlertTriangle size={10} /> {addError}
            </div>
          )}
        </div>
      )}

      {/* Search bar */}
      {orders.length > 5 && (
        <div className="px-4 py-2 border-b border-gray-100">
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300"
              placeholder="Tìm theo mã đơn, Article, DAOMH, Model…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {orders.length === 0 ? (
          <div className="py-14 text-center text-gray-400">
            <div className="text-4xl mb-3 opacity-20">{isGc ? "🏭" : "📦"}</div>
            <div className="text-sm font-medium text-gray-500">Chưa có đơn hàng</div>
            <div className="text-xs mt-1">Nhập mã, import Excel, hoặc dùng "Phân loại tự động" bên trên</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide">ORDERNO</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide">Article</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide">DAOMH</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wide">Model</th>
                <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-400 uppercase tracking-wide">Qty</th>
                <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-400 uppercase tracking-wide">CRD</th>
                <th className="w-14" />
              </tr>
            </thead>
            <tbody>
              {pageOrders.map(o => (
                <tr
                  key={o.order_id}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 font-mono text-xs font-semibold text-gray-900">{o.order_id}</td>
                  <td className="px-3 py-2 text-xs text-gray-600 font-mono">{o.order?.ARTICLE ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 font-mono">{o.order?.DAOMH_ || o.order?.DAOMH || "—"}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 max-w-[110px] truncate" title={o.order?.XieMing_ || o.order?.XieMing}>{o.order?.XieMing_ || o.order?.XieMing || "—"}</td>
                  <td className="px-3 py-2 text-xs text-right text-gray-700">{(o.order?.PAIRQTY || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs text-center text-gray-500">{(o.order?.DUEDT ?? "—").slice(0, 10)}</td>
                  {!readOnly && (
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {onMoveToOther && (
                          <button
                            className={`transition-colors ${isGc ? "text-gray-300 hover:text-blue-500" : "text-gray-300 hover:text-orange-500"}`}
                            onClick={() => onMoveToOther(o)}
                            title={isGc ? "Chuyển sang đơn thường" : "Chuyển sang đơn gia công"}>
                            {isGc ? <ArrowLeft size={12} /> : <ArrowRight size={12} />}
                          </button>
                        )}
                        <button
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          onClick={() => onRemove(o.order_id)}
                          title="Xóa khỏi danh sách">
                          <X size={12} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
          <span>{filtered.length} đơn · Trang {page}/{totalPages}</span>
          <div className="flex gap-1">
            <button
              className={`${BTN_SM} bg-white text-gray-600 border-gray-200 hover:bg-gray-50`}
              disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={12} />
            </button>
            <button
              className={`${BTN_SM} bg-white text-gray-600 border-gray-200 hover:bg-gray-50`}
              disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}

      {showImport && (
        <ExcelImportModal
          onClose={() => setShowImport(false)}
          onConfirm={handleImportConfirm}
        />
      )}
    </div>
  );
}

// ─── Main Step1Orders ─────────────────────────────────────────────────────────
export default function Step1Orders({
  regularOrders, setRegularOrders,
  gcOrders, setGcOrders,
  onPrev, onNext,
  readOnly = false,
}) {
  const canAdvance = regularOrders.length > 0 || gcOrders.length > 0;

  const [showAutoImport, setShowAutoImport] = useState(false);
  const [classifying,    setClassifying]    = useState(false);
  const [classifyResult, setClassifyResult] = useState(null); // {regular: n, gc: n} last run

  function addTo(setter) {
    return (item) => setter(prev =>
      prev.some(o => o.order_id === item.order_id) ? prev : [...prev, item]
    );
  }
  function removeFrom(setter) {
    return (id) => setter(prev => prev.filter(o => o.order_id !== id));
  }

  function moveToGc(item) {
    setRegularOrders(prev => prev.filter(o => o.order_id !== item.order_id));
    setGcOrders(prev => prev.some(o => o.order_id === item.order_id) ? prev : [...prev, item]);
  }
  function moveToRegular(item) {
    setGcOrders(prev => prev.filter(o => o.order_id !== item.order_id));
    setRegularOrders(prev => prev.some(o => o.order_id === item.order_id) ? prev : [...prev, item]);
  }

  // Auto-classify import: call API, distribute to panels
  async function handleAutoImportConfirm(_foundIds, orderDetails) {
    setShowAutoImport(false);
    if (!orderDetails?.length) return;

    const allExisting = new Set([
      ...regularOrders.map(o => o.order_id),
      ...gcOrders.map(o => o.order_id),
    ]);
    const newItems = orderDetails.filter(o => o.order_id && !allExisting.has(o.order_id));
    if (!newItems.length) return;

    setClassifying(true);
    setClassifyResult(null);
    try {
      const body = {
        orders: newItems.map(o => ({
          order_id:    o.order_id,
          article:     o.order?.ARTICLE                      || "",
          cutting_die: o.order?.DAOMH_ || o.order?.DAOMH    || "",
        })),
      };
      const res       = await wizardApi.classifyOrders(body);
      const clsMap    = res?.classifications || {};

      const toRegular = [];
      const toGc      = [];
      for (const item of newItems) {
        const key = (item.order_id || "").toString().toUpperCase();
        if (clsMap[key]?.type === "gc") toGc.push(item);
        else toRegular.push(item);
      }
      if (toRegular.length) setRegularOrders(prev => [...prev, ...toRegular]);
      if (toGc.length)      setGcOrders(prev => [...prev, ...toGc]);
      setClassifyResult({ regular: toRegular.length, gc: toGc.length });
    } catch {
      // fallback: all go to regular
      setRegularOrders(prev => [...prev, ...newItems]);
      setClassifyResult({ regular: newItems.length, gc: 0 });
    } finally {
      setClassifying(false);
    }
  }

  return (
    <div className="max-w-[1180px] mx-auto flex-1 min-h-0 flex flex-col overflow-hidden gap-3">
      {readOnly && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg shrink-0">
          <Eye size={12} /> Kế hoạch đã chạy — chỉ xem, không thể chỉnh sửa
        </div>
      )}

      {/* Description + auto-classify */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 shrink-0">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900">Bước 1 · Chọn đơn cần lập lịch</div>
            <div className="text-xs text-gray-500 mt-1">
              Import toàn bộ và để hệ thống tự phân loại đơn thường / gia công theo lịch sử PDSCH + SCBB.
              Có thể điều chỉnh thủ công bằng mũi tên hoặc nhập mã trực tiếp vào từng khung.
            </div>
            {classifyResult && !classifying && (
              <div className="mt-2 flex items-center gap-2 text-xs text-green-700">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 font-medium">
                  ✓ Đã phân loại: {classifyResult.regular} thường · {classifyResult.gc} gia công
                </span>
              </div>
            )}
          </div>
          {!readOnly && (
            <button
              disabled={classifying}
              onClick={() => setShowAutoImport(true)}
              className={`${BTN} shrink-0 ${classifying
                ? "bg-purple-50 text-purple-400 border-purple-200 cursor-not-allowed"
                : "bg-purple-600 text-white border-purple-600 hover:bg-purple-700"
              }`}>
              {classifying
                ? <><Loader2 size={14} className="animate-spin" /> Đang phân loại…</>
                : <><Wand2 size={14} /> Import & Phân loại tự động</>}
            </button>
          )}
        </div>
      </div>

      {/* Two panels */}
      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        <OrdersPanel
          title="Đơn hàng thường"
          type="regular"
          orders={regularOrders}
          onAdd={addTo(setRegularOrders)}
          onRemove={removeFrom(setRegularOrders)}
          onMoveToOther={moveToGc}
          readOnly={readOnly}
        />
        <OrdersPanel
          title="Đơn hàng gia công"
          type="gc"
          orders={gcOrders}
          onAdd={addTo(setGcOrders)}
          onRemove={removeFrom(setGcOrders)}
          onMoveToOther={moveToRegular}
          readOnly={readOnly}
        />
      </div>

      {/* Actions */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-3 flex items-center gap-3 shrink-0">
        <button
          className={`${BTN} bg-white text-gray-700 border-gray-200 hover:bg-gray-50`}
          onClick={onPrev} disabled>
          <ChevronLeft size={14} /> Bước trước
        </button>

        {!canAdvance && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            <AlertTriangle size={12} />
            Thêm ít nhất một đơn hàng để tiếp tục
          </div>
        )}

        <div className="flex-1" />

        {canAdvance && (
          <span className="text-xs text-gray-400">
            {regularOrders.length > 0 && `${regularOrders.length} thường`}
            {regularOrders.length > 0 && gcOrders.length > 0 && " · "}
            {gcOrders.length > 0 && `${gcOrders.length} gia công`}
          </span>
        )}

        <button
          className={`${BTN} bg-blue-600 text-white border-blue-600 hover:bg-blue-700`}
          disabled={!canAdvance}
          onClick={onNext}>
          Bước tiếp <ChevronRight size={14} />
        </button>
      </div>

      {/* Auto-import modal */}
      {showAutoImport && (
        <ExcelImportModal
          onClose={() => setShowAutoImport(false)}
          onConfirm={handleAutoImportConfirm}
        />
      )}
    </div>
  );
}
