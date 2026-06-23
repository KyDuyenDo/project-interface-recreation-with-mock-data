import { useState } from "react";
import { X, Search, Play, Loader2 } from "lucide-react";
import { useOrders } from "../../../hooks/useOrders";

const BTN    = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SM = "inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const INPUT  = "px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors";

const PAGE_SIZE = 20;

export default function NewOrdersDialog({ onClose, onStartPlan }) {
  const [search, setSearch] = useState("");
  const [page,   setPage]   = useState(1);

  const { data, isLoading } = useOrders({
    statuses: ["N"], search: search || undefined,
    page, page_size: PAGE_SIZE, include_sizes: false,
  });
  const orders     = data?.items ?? [];
  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-3xl overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <div className="text-sm font-semibold text-gray-900">Đơn hàng mới ({total.toLocaleString()})</div>
            <div className="text-xs text-gray-500 mt-0.5">Đơn đã nhận từ ERP nhưng chưa được đưa vào kế hoạch (status N)</div>
          </div>
          <button className={`${BTN} border-transparent bg-transparent text-gray-400 hover:bg-gray-100 p-1.5`} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="relative inline-flex items-center">
              <span className="absolute left-2.5 text-gray-400 pointer-events-none"><Search size={13} /></span>
              <input
                className={`${INPUT} pl-8`}
                style={{ width: 260 }}
                placeholder="Tìm mã đơn / article / khách…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <div className="flex-1" />
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              {total.toLocaleString()} đơn
            </span>
          </div>

          <div className="max-h-[55vh] overflow-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="bg-gray-50 border-b border-gray-200">
                  {["Order", "Article", "Khách", "Qty", "CRD", "Nhận lúc"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400">
                    <Loader2 size={20} className="animate-spin mx-auto text-blue-500" />
                  </td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-sm text-gray-400">Không có đơn nào</td></tr>
                ) : orders.map(o => (
                  <tr key={o.order_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-3 py-2 font-semibold text-sm text-gray-900">{o.order_id}</td>
                    <td className="px-3 py-2">
                      <code className="bg-gray-100 px-1.5 py-0.5 rounded text-[11px] text-gray-700">{o.article ?? "—"}</code>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{o.customer ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-right font-medium text-gray-900">{(o.qty ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs text-gray-700">{o.crd ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-gray-400">{o.order_dt ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs text-gray-500">
              <span>Trang {page}/{totalPages}</span>
              <div className="flex gap-1">
                <button className={`${BTN_SM} bg-white text-gray-700 border-gray-200 hover:bg-gray-50`} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
                <button className={`${BTN_SM} bg-white text-gray-700 border-gray-200 hover:bg-gray-50`} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button className={`${BTN} bg-white text-gray-700 border-gray-200 hover:bg-gray-50`} onClick={onClose}>Đóng</button>
          <button className={`${BTN} bg-blue-600 text-white border-blue-600 hover:bg-blue-700`} onClick={onStartPlan}>
            <Play size={14} /> Tạo kế hoạch cho {total.toLocaleString()} đơn
          </button>
        </div>
      </div>
    </div>
  );
}
