import { ArrowLeft, Download, Check, RefreshCw, Loader2, CheckCircle } from "lucide-react";
import StatusBadge from "./StatusBadge";

const BTN = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * Top header bar for RunDetailPage.
 * Shows run info, status badges, and lifecycle action buttons.
 */
export default function RunDetailHeader({
  run, isLive, isMain,
  verifyRunMutation,
  onNavigateBack, onShowCompare, onAcceptRun,
  onStartVerification,
}) {
  return (
    <header className="flex items-center h-14 px-5 border-b border-gray-200 bg-white shrink-0 gap-3">
      <div>
        <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-transparent text-xs text-gray-500 hover:bg-gray-100"
            onClick={onNavigateBack}>
            <ArrowLeft size={13} /> Lập lịch
          </button>
          #{run.id} · {run.label}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          Tạo {run.started_at?.slice(0, 16).replace("T", " ")} · {run.scheduled_count ?? "—"} đơn
        </div>
      </div>
      <div className="flex-1" />
      <StatusBadge run={run} />
      {isLive && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />polling
        </span>
      )}

      {isMain && run.lifecycle_status === "draft" && run.status === "done" && (
        <>
          <button
            className={`${BTN} bg-white text-blue-600 border-blue-200 hover:bg-blue-50 shadow-sm`}
            onClick={onShowCompare}
          >
            <RefreshCw size={14} /> Xem diff so với hiện hành
          </button>
          <button className={`${BTN} bg-blue-600 text-white border-blue-600 hover:bg-blue-700`} onClick={onAcceptRun}>
            <Check size={14} /> Accept lịch
          </button>
        </>
      )}

      {isMain && run.lifecycle_status === "accepted" && (
        <button
          className={`${BTN} bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-sm`}
          onClick={onStartVerification}
          disabled={verifyRunMutation.isPending}
        >
          {verifyRunMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Verify ERP Sync (Đối soát)
        </button>
      )}

      {run.lifecycle_status === "verifying" && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-yellow-200 text-sm font-medium bg-yellow-50 text-yellow-800 animate-pulse">
          <Loader2 size={14} className="animate-spin" /> Đang đối soát ERP...
        </span>
      )}

      {run.lifecycle_status === "active" && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
          <CheckCircle size={12} className="mr-1" /> Active · Đã đồng bộ ERP
        </span>
      )}

      {run.lifecycle_status === "archived" && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
          Lưu trữ (Archived)
        </span>
      )}

      <button className={`${BTN} bg-white text-gray-700 border-gray-200 hover:bg-gray-50`}>
        <Download size={14} /> Export
      </button>
    </header>
  );
}
