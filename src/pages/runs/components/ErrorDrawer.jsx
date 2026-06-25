import { X, Loader2, RefreshCw } from "lucide-react";

/**
 * Side drawer showing verification log details (mismatched orders).
 */
export default function ErrorDrawer({
  activeLogId, logDetails, isDetailsLoading,
  onClose, onRetry,
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
      <div className="flex-1" onClick={onClose} />
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Chi tiết đối soát phiên #{activeLogId}</h3>
            <p className="text-xs text-gray-500 mt-0.5">Danh sách các đơn hàng chưa khớp đồng bộ với ERP PDSCH</p>
          </div>
          <button className="p-1 hover:bg-gray-200 rounded-full text-gray-500" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {isDetailsLoading ? (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <Loader2 size={24} className="animate-spin text-blue-600" />
              <span className="text-xs text-gray-400 mt-2">Đang tải dữ liệu đơn hàng...</span>
            </div>
          ) : !logDetails || logDetails.length === 0 ? (
            <div className="text-center py-12 text-gray-400 italic">Không tìm thấy chi tiết đối soát.</div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
                <strong>Lưu ý:</strong> Các đơn hàng đánh dấu <span className="font-bold">Thiếu ERP</span> cần được cập nhật lên ERP trước khi xác thực thành công.
              </div>
              <div className="divide-y divide-gray-100">
                {logDetails.map(detail => (
                  <div key={detail.id} className="py-2.5 flex items-center justify-between text-sm">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-gray-800">{detail.order_id}</span>
                      <span className="text-[10px] text-gray-400">Kiểm tra lúc: {detail.last_checked_at?.slice(11, 19)}</span>
                    </div>
                    {detail.is_matched ? (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-semibold bg-green-50 text-green-700 border border-green-100">✓ Khớp</span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-700 border border-red-100">✗ Thiếu ERP</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3">
          <button
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5"
            onClick={onRetry}
          >
            <RefreshCw size={14} /> Thử lại đối soát
          </button>
          <button
            className="px-4 py-2 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
