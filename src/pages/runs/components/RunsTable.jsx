import { Package, Loader2, Calendar, AlertTriangle, Eye, Check, Trash2, CheckSquare, Square } from "lucide-react";
import { clsx } from "clsx";
import StatusBadge from "./StatusBadge";

const BTN_SM = "inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export default function RunsTable({
  isLoading, runs, activeTabRuns, activeTab, activeRunId,
  selectedIds, allPageSelected, toggleSelectAll, toggleSelect,
  onNavigateDetail, onAcceptTarget, onDeleteTarget, isMain,
}) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
        <Loader2 size={28} className="animate-spin mx-auto text-blue-500" />
      </div>
    );
  }

  if (activeTabRuns.length === 0) {
    const emptyMessage = {
      draft: "Không có lịch nháp nào đang chờ duyệt.",
      accepted: "Không có lịch nào ở trạng thái đã duyệt.",
      active: "Chưa có lịch chính thức nào hoạt động.",
      running: "Không có lịch nào đang chạy hoặc bị lỗi.",
    }[activeTab] || "Không có lịch nào.";

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 shadow-sm">
        <Package size={28} className="mx-auto mb-2 text-gray-300" />
        <div className="font-semibold text-gray-600">{emptyMessage}</div>
      </div>
    );
  }

  const title = {
    draft: "Lịch nháp — đang chờ duyệt",
    accepted: "Lịch đã duyệt & Đang đối soát",
    active: "Lịch chính thức (Active)",
    running: "Lịch đang chạy & Gặp lỗi",
  }[activeTab] || "Lịch sản xuất";

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {activeTabRuns.length} lịch
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50/70 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
            <th className="px-4 py-3 w-8">
              <button onClick={toggleSelectAll} className="text-gray-400 hover:text-blue-600 transition-colors">
                {allPageSelected
                  ? <CheckSquare size={14} className="text-blue-500" />
                  : <Square size={14} />}
              </button>
            </th>
            <th className="px-3 py-3">#ID</th>
            <th className="px-3 py-3">Nhãn lịch</th>
            {activeTab !== "draft" && activeTab !== "running" && (
              <th className="px-3 py-3">Giai đoạn</th>
            )}
            <th className="px-3 py-3">Trạng thái vòng đời</th>
            {activeTab === "running" && (
              <th className="px-3 py-3">Chi tiết lỗi / Tiến độ</th>
            )}
            <th className="px-3 py-3">Thời gian chạy</th>
            <th className="px-3 py-3 text-right">Tổng đơn</th>
            <th className="px-3 py-3">Tỷ lệ On-Time</th>
            <th className="px-5 py-3 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {runs.map(r => (
            <tr
              key={r.id}
              className={clsx(
                "border-b border-gray-100 last:border-0 hover:bg-gray-50/50 cursor-pointer transition-colors",
                r.id === activeRunId && "bg-green-50/40 hover:bg-green-50/60",
                selectedIds.has(r.id) && "bg-blue-50/50",
              )}
              onClick={() => onNavigateDetail(r.id)}
            >
              <td className="px-4 py-3 w-8" onClick={e => { e.stopPropagation(); toggleSelect(r.id); }}>
                {selectedIds.has(r.id)
                  ? <CheckSquare size={14} className="text-blue-500" />
                  : <Square size={14} className="text-gray-300 hover:text-gray-500" />}
              </td>
              <td className="px-3 py-3 font-bold text-gray-900 w-14">#{r.id}</td>
              <td className="px-3 py-3 text-xs font-medium">
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{r.label}</code>
              </td>
              {activeTab !== "draft" && activeTab !== "running" && (
                <td className="px-3 py-3">
                  {r.period_label ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold text-xs border border-indigo-100 shadow-sm w-fit">
                      <Calendar size={12} className="text-indigo-500 shrink-0" />
                      {r.period_label}
                    </span>
                  ) : (
                    <span className="text-gray-400 font-medium italic">—</span>
                  )}
                </td>
              )}
              <td className="px-3 py-3">
                <StatusBadge run={r} />
              </td>
              {activeTab === "running" && (
                <td className="px-3 py-3 text-xs max-w-[280px]">
                  {r.status === "failed" ? (
                    <div className="flex flex-col gap-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 border border-red-200 shadow-sm w-fit">
                        <AlertTriangle size={11} className="text-red-600 shrink-0" />
                        Lập lịch lỗi
                      </span>
                      {r.error_message ? (
                        <span className="text-xs text-red-600 font-medium line-clamp-2" title={r.error_message}>
                          {r.error_message}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Không có chi tiết lỗi</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200 w-fit">
                        {r.status === "running" ? "Đang giải..." : "Đang chờ..."}
                      </span>
                      {r.step_name && (
                        <span className="text-xs text-blue-600 font-medium">
                          Bước: {r.step_name} ({r.step_progress}%)
                        </span>
                      )}
                    </div>
                  )}
                </td>
              )}
              <td className="px-3 py-3 text-xs text-gray-500">
                {r.started_at?.slice(0, 16).replace("T", " ")}
              </td>
              <td className="px-3 py-3 text-xs text-right font-semibold text-gray-900">
                {r.scheduled_count ?? "—"}
              </td>
              <td className="px-3 py-3 text-xs font-bold">
                {r.on_time_pct != null ? (
                  <span style={{ color: r.on_time_pct >= 80 ? "#047857" : "#b45309" }}>{r.on_time_pct}%</span>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="px-5 py-3 text-right" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    className={`${BTN_SM} bg-white text-gray-700 border-gray-200 hover:bg-gray-50`}
                    onClick={() => onNavigateDetail(r.id)}
                  >
                    <Eye size={12} /> Chi tiết
                  </button>
                  {isMain && r.status === "done" && r.lifecycle_status === "draft" && (
                    <button
                      className={`${BTN_SM} bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-sm`}
                      onClick={() => onAcceptTarget(r)}
                    >
                      <Check size={12} /> Chấp nhận
                    </button>
                  )}
                  {isMain && r.lifecycle_status !== "active" && (
                    <button
                      className={clsx(
                        BTN_SM,
                        r.status === "running" || r.status === "pending"
                          ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                          : "bg-white text-red-600 border-red-200 hover:bg-red-50",
                      )}
                      onClick={() => onDeleteTarget(r)}
                      title={r.status === "running" || r.status === "pending" ? "Xóa bắt buộc" : "Xóa lịch"}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
