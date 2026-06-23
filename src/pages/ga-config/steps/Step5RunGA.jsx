import { useState } from "react";
import { ChevronLeft, ChevronRight, Play, AlertTriangle, Info, Check, Loader2 } from "lucide-react";
import { useCreateRun, useRunStatus, useRunDetail } from "../../../hooks/useRuns";

const BTN  = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_LG = "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border text-base font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const INPUT  = "px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors";
const BADGE  = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium";

const PIPELINE_STEPS = [
  "Kiểm tra ERP", "Tải năng lực chuyền", "TailFollowAllocator",
  "ILS Optimizer", "Phân bổ size", "Lưu kết quả",
];

export default function Step5RunGA({
  selectedIds, excludeLines, materialEtaOverrides,
  priorityConfig,
  gcDateOverrides,
  workingHoursPerDay,
  label, setLabel, runId, setRunId,
  draftRunId,
  onPrev, onNext, canAdvance,
}) {
  const createRun = useCreateRun();
  const [submitError, setSubmitError] = useState(null);
  const isRunActive = !!runId;
  const { data: statusData } = useRunStatus(runId, isRunActive);
  const { data: runData }    = useRunDetail(runId);

  const status      = statusData?.status ?? runData?.status;
  const currentStep = statusData?.current_step ?? runData?.step_progress ?? 0;
  const stepName    = statusData?.step_name ?? runData?.step_name ?? "—";
  const progressPct = statusData?.progress_pct ?? (status === "done" ? 100 : 0);
  const isDone      = status === "done";
  const isFailed    = status === "failed";
  const isRunning   = status === "running" || status === "pending";

  async function handleStart() {
    setSubmitError(null);

    const body = {
      label: label || `Kế hoạch ${new Date().toLocaleDateString("vi-VN")}`,
      horizon_days: 90, report_window_days: 90,
      working_hours_per_day: workingHoursPerDay ?? 8,
      order_ids:          selectedIds.size > 0 ? [...selectedIds] : undefined,
      exclude_lines:      excludeLines.size > 0 ? [...excludeLines] : undefined,
      material_etas:      Object.keys(materialEtaOverrides).length > 0 ? materialEtaOverrides : undefined,
      priority_config:    Object.keys(priorityConfig || {}).length > 0 ? priorityConfig : undefined,
      gc_date_overrides:  Object.keys(gcDateOverrides || {}).length > 0 ? gcDateOverrides : undefined,
      draft_run_id:       draftRunId || undefined,
    };
    try {
      const run = await createRun.mutateAsync(body);
      setRunId(run.id);
    } catch (err) {
      setSubmitError(err?.response?.data?.detail ?? err?.message ?? "Lỗi khi khởi chạy lập lịch");
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm max-w-3xl mx-auto">
      {/* Head */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <div className="text-sm font-semibold text-gray-900">Bước 5 · Chạy lịch</div>
          <div className="text-xs text-gray-500 mt-0.5">TailFollowAllocator → ILS → SizeSequencer · 6 bước · chạy ngầm</div>
        </div>
        {isRunActive && (
          <span className={`${BADGE} ml-auto ${isRunning ? "bg-amber-100 text-amber-700" : isDone ? "bg-green-100 text-green-700" : isFailed ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
            <span className={`w-1.5 h-1.5 rounded-full bg-current ${isRunning ? "animate-pulse" : ""}`} />
            {isRunning ? "Đang chạy" : isDone ? "Hoàn thành" : isFailed ? "Lỗi" : status}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-6">
        {!isRunActive ? (
          <>
            {/* Pre-launch summary */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-5">
              {[
                { label: "Đơn cần sắp",    value: selectedIds.size > 0 ? selectedIds.size : "Tất cả NEW" },
                { label: "Loại trừ chuyền", value: excludeLines.size },
                { label: "Mô hình ưu tiên", value: Object.keys(priorityConfig || {}).length > 0 ? `${Object.keys(priorityConfig).length} dạng giày` : "Mặc định" },
                { label: "NVL override",    value: Object.keys(materialEtaOverrides).length },
                { label: "Ngày GC",         value: Object.keys(gcDateOverrides || {}).length > 0 ? `${Object.keys(gcDateOverrides).length} đơn` : "DB" },
              ].map(({ label: lb, value }) => (
                <div key={lb} className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide">{lb}</div>
                  <div className="text-lg font-bold text-gray-900 mt-1">{value}</div>
                </div>
              ))}
            </div>

            <div className="mb-4">
              <label className="text-xs font-medium text-gray-600 block mb-1">Nhãn kế hoạch</label>
              <input
                className={`${INPUT} w-full`}
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="VD: Kế hoạch tháng 6 · Q2/2026"
                maxLength={80}
              />
            </div>

            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm bg-blue-50 text-blue-800 border border-blue-100 mb-4">
              <Info size={14} className="shrink-0 mt-0.5" />
              Giải thuật: <strong>TailFollowAllocator → ILS (SWAP/RELOCATE/REORDER) → SizeSequencer</strong> · 6 bước · chạy ngầm
            </div>

            {submitError && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm bg-red-50 text-red-700 border border-red-100 mb-4">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {submitError}
              </div>
            )}

            <div className="text-center">
              <button
                className={`${BTN_LG} bg-blue-600 text-white border-blue-600 hover:bg-blue-700`}
                disabled={createRun.isPending}
                onClick={handleStart}>
                {createRun.isPending
                  ? <><Loader2 size={16} className="animate-spin" /> Đang khởi chạy…</>
                  : <><Play size={16} /> Khởi chạy lịch</>}
              </button>
              <div className="mt-2 text-xs text-gray-400">Bạn có thể chuyển trang khác — kết quả vẫn được lưu lại</div>
            </div>
          </>
        ) : (
          /* Live progress */
          <div>
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Run #{runId}</div>
                <div className="text-lg font-bold text-gray-900 mt-1">{label || runData?.label}</div>
              </div>
              <div className="text-center">
                <div className="text-5xl font-bold text-blue-600 tracking-tight">
                  {Math.round(progressPct)}<span className="text-2xl text-gray-400 font-normal">%</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">{stepName}</div>
              </div>
              <div className="w-24" />
            </div>

            {/* Progress bar */}
            <div className="bg-gray-100 rounded-full overflow-hidden h-3 mb-5">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.round(progressPct)}%` }}
              />
            </div>

            {/* Pipeline steps */}
            <div className="flex flex-col gap-2">
              {PIPELINE_STEPS.map((lbl, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0
                    ${i < currentStep
                      ? "bg-blue-600 text-white"
                      : i === currentStep && isRunning
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-400"}`}>
                    {i < currentStep ? "✓" : i + 1}
                  </div>
                  <span className={i < currentStep ? "text-gray-900" : "text-gray-400"}>{lbl}</span>
                </div>
              ))}
            </div>

            {isFailed && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm bg-red-50 text-red-700 border border-red-100 mt-4">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                {statusData?.error_message ?? "Lập lịch thất bại"}
              </div>
            )}
            {isDone && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm bg-green-50 text-green-700 border border-green-100 mt-4">
                <Check size={14} className="shrink-0 mt-0.5" />
                Lịch đã được tính xong! Sang bước tiếp để xem kết quả và chỉnh sửa.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 px-5 py-3 border-t border-gray-100 bg-gray-50">
        <button
          className={`${BTN} bg-white text-gray-700 border-gray-200 hover:bg-gray-50`}
          onClick={onPrev}
          disabled={isRunning}>
          <ChevronLeft size={14} /> Bước trước
        </button>
        <div className="flex-1" />
        {!canAdvance && isRunActive && (
          <span className="text-xs text-gray-400">Chờ lịch hoàn thành để tiếp tục…</span>
        )}
        <button
          className={`${BTN} ${canAdvance ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700" : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"}`}
          onClick={canAdvance ? onNext : undefined}
          disabled={!canAdvance}>
          {!canAdvance && isRunActive
            ? <><Loader2 size={14} className="animate-spin" /> Đang chạy…</>
            : <>Bước tiếp <ChevronRight size={14} /></>}
        </button>
      </div>
    </div>
  );
}
