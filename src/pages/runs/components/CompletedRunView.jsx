import { Check, AlertTriangle } from "lucide-react";
import StatusBadge from "./StatusBadge";

const PIPELINE_STEPS = [
  "ERP sync", "Năng lực chuyền", "TailFollowAllocator",
  "ILS Optimizer", "Phân bổ size", "Lưu kết quả",
];

/**
 * Dashboard-like summary for a completed GA run (step 5 view).
 * Shows KPI cards, pipeline progress, warnings, verification logs, algo info, and run params.
 */
export default function CompletedRunView({ run, warnings, publishLogs, onShowLogDetails, onRetryVerification, onShowCompare, onAccept, isMain }) {
  const progressPct = run.status === "done" ? 100 : 0;

  return (
    <div className="absolute inset-0 overflow-auto p-5 bg-gray-50">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        {[
          { label: "Đơn đã lập", value: run.scheduled_count ?? "—", delta: "Hoàn thành", up: true },
          { label: "On-time",    value: run.on_time_pct != null ? `${run.on_time_pct}%` : "—", delta: run.on_time_count != null ? `${run.on_time_count} đơn` : "", up: true },
          { label: "Cảnh báo",  value: warnings.length, delta: warnings.length ? "Cần xem lại" : "Không có vấn đề", up: !warnings.length, danger: warnings.length > 0 },
          { label: "Thời gian", value: run.runtime_seconds != null ? `${run.runtime_seconds.toFixed(1)}s` : "—", delta: "TailFollow + ILS", up: true },
        ].map(({ label, value, delta, up, danger }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
            <div className={`text-2xl font-bold mt-1 ${danger ? "text-red-600" : "text-gray-900"}`}>{value}</div>
            {delta && (
              <div className={`text-xs mt-1 flex items-center gap-1 ${up ? "text-green-600" : "text-red-500"}`}>
                {up ? <Check size={11} /> : <AlertTriangle size={11} />} {delta}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pipeline progress */}
      <div className="bg-white rounded-xl border border-gray-200 mb-4">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
          <div className="text-sm font-semibold text-gray-900">Tiến trình pipeline</div>
        </div>
        <div className="p-5">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>Lưu kết quả</span>
            <span>{PIPELINE_STEPS.length}/{PIPELINE_STEPS.length}</span>
          </div>
          <div className="bg-gray-100 rounded-full overflow-hidden h-2 mb-4">
            <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex flex-col gap-2">
            {PIPELINE_STEPS.map((label, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-blue-600 text-white">✓</div>
                <span className="text-gray-900">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Warnings inline */}
      {warnings.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 mb-4">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
            <div className="text-sm font-semibold text-gray-900">Cảnh báo &amp; ERP drift</div>
            <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{warnings.length} mục</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {["Loại", "Mức độ", "Mô tả", "Đơn hàng"].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {warnings.map((w, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-2 font-semibold text-sm">{w.kind}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                      ${w.severity === "high" ? "bg-red-100 text-red-700" : w.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />{w.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">{w.message}</td>
                  <td className="px-3 py-2 text-xs font-mono text-gray-500">{w.order_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Verification logs */}
      <div className="bg-white rounded-xl border border-gray-200 mb-4 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900 flex items-center justify-between">
          <span>Lịch sử đối soát đồng bộ ERP</span>
          <span className="text-xs text-gray-400 font-normal">Phiên gần nhất</span>
        </div>
        <div className="p-5">
          {!publishLogs || publishLogs.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Chưa thực hiện phiên đối soát nào cho bản chạy này.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {publishLogs.map(log => (
                <div key={log.id} className="flex items-center justify-between text-sm p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-gray-900 flex items-center gap-2">
                      Phiên #{log.id}
                      <span className="text-xs font-normal text-gray-500">({log.checked_at?.slice(0, 16).replace("T", " ")})</span>
                    </span>
                    <span className="text-xs text-gray-600 mt-1">Kết quả: {log.matched_count}/{log.total_records} đơn khớp</span>
                    <span className="text-[11px] text-gray-500 italic mt-0.5">{log.verification_note}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={log.status} />
                    {(log.status === "partial" || log.status === "not_found") && (
                      <button
                        className="px-2 py-1 text-xs bg-white hover:bg-gray-100 border border-gray-200 rounded text-gray-600"
                        onClick={() => onShowLogDetails(log.id)}
                      >Xem lỗi</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Algorithm info */}
      <div className="bg-white rounded-xl border border-gray-200 mb-4">
        <div className="px-5 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Thuật toán</div>
        <div className="p-5">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">Phase 1</dt><dd className="text-gray-900">TailFollowAllocator — gán chuyền theo đuôi + cân bằng tải</dd>
            <dt className="text-gray-500">Phase 2</dt><dd className="text-gray-900">ILS (SWAP / RELOCATE / REORDER) — thoát local optima</dd>
            <dt className="text-gray-500">Phase 3</dt><dd className="text-gray-900">SizeSequencer — phân bổ size theo ngày (K/Q từ DE_ORDERM)</dd>
            <dt className="text-gray-500">Fitness</dt><dd className="font-medium text-gray-900">{run.fitness != null ? run.fitness.toLocaleString() : "—"}</dd>
          </dl>
        </div>
      </div>

      {/* Thông số */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Thông số lập lịch</div>
        <div className="p-5">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">Thuật toán</dt><dd className="text-gray-900">TailFollowAllocator + ILS</dd>
            <dt className="text-gray-500">Horizon</dt><dd className="text-gray-900">{run.config_json?.horizon_days ?? 90} ngày</dd>
            <dt className="text-gray-500">Cửa sổ năng lực</dt><dd className="text-gray-900">{run.config_json?.report_window_days ?? 90} ngày</dd>
            <dt className="text-gray-500">Đơn đầu vào</dt><dd className="text-gray-900">{run.config_json?.order_ids ? `${run.config_json.order_ids.length} đơn (chọn thủ công)` : "Tất cả đơn NEW"}</dd>
            <dt className="text-gray-500">Thời gian chạy</dt><dd className="text-gray-900">{run.runtime_seconds != null ? `${run.runtime_seconds.toFixed(1)}s` : "—"}</dd>
            <dt className="text-gray-500">Tạo bởi</dt><dd className="text-gray-900">{run.triggered_by ?? "—"}</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}
