import { Trash2, AlertTriangle, Loader2 } from "lucide-react";

const BTN = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export default function BulkDeleteDialog({ selectedRuns, isPending, onClose, onConfirm }) {
  const activeCount   = selectedRuns.filter(r => r.lifecycle_status === "active").length;
  const runningCount  = selectedRuns.filter(r => r.status === "running" || r.status === "pending").length;
  const deletable     = selectedRuns.filter(r => r.lifecycle_status !== "active");
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <Trash2 size={16} className="text-red-500 shrink-0" />
          <div className="text-sm font-semibold text-gray-900">
            Xóa {deletable.length} lịch
          </div>
        </div>
        <div className="px-5 py-4 space-y-3">
          {activeCount > 0 && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm bg-orange-50 text-orange-800 border border-orange-200">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>
                <strong>{activeCount} lịch đang Active</strong> sẽ bị bỏ qua — không thể xóa lịch chính thức.
              </span>
            </div>
          )}
          {runningCount > 0 && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>
                <strong>{runningCount} lịch đang chạy</strong> sẽ bị xóa bắt buộc — tiến trình GA sẽ dừng.
              </span>
            </div>
          )}
          <p className="text-sm text-gray-600">
            Xóa <strong>{deletable.length} lịch</strong>? Thao tác <strong>không thể hoàn tác</strong>.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button className={`${BTN} bg-white text-gray-700 border-gray-200 hover:bg-gray-50`} onClick={onClose}>
            Hủy
          </button>
          <button
            className={`${BTN} bg-red-600 text-white border-red-600 hover:bg-red-700`}
            disabled={isPending || deletable.length === 0}
            onClick={onConfirm}
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Xóa {deletable.length} lịch
          </button>
        </div>
      </div>
    </div>
  );
}
