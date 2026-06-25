/**
 * SubStep2Panel — reusable panel for Sub-Planner Step 2 (Capacity / Approval)
 * Embedded in RunDetailPage for the sub-planner view of a run's step 2.
 * Logic extracted from RunDetailForSub.jsx.
 */
import { Layers, CheckCircle2, Check, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { useQueryClient } from "@tanstack/react-query";

// ─── Custom Hook ─────────────────────────────────────────────────────────────
import { useSubStep2Data } from "./hooks/useSubStep2Data";

// ─── Shared Components ────────────────────────────────────────────────────────
import LineTab from "./components/LineTab";
import FinalSubmitPanel from "./components/FinalSubmitPanel";

export default function SubStep2Panel({ runId, myLines, dispatchStep = 2 }) {
  const queryClient = useQueryClient();
  const {
    user,
    activeLineIdx,
    setActiveLineIdx,
    allDecisions,
    submitted,
    setSubmitted,
    tasksLoading,
    runTasks,
    lines,
    activeLineId,
    activeTasks,
    alreadySubmitted,
    scheduleData,
    lineDecisions,
    handleDecide,
    getLineStatus,
  } = useSubStep2Data({ runId, myLines, dispatchStep });

  if (tasksLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 size={24} className="animate-spin text-blue-500" />
        <span className="ml-2 text-sm text-gray-500">Đang tải công việc…</span>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400">
        <Layers size={28} className="mb-2 text-gray-200" />
        <div className="text-sm font-semibold text-gray-500">Chưa có phân công nào</div>
        <div className="text-xs mt-1">Main Planner chưa gửi công việc cho bước này</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ── Line tab bar ── */}
      <div className="shrink-0 bg-white border-b border-gray-200">
        <div className="flex items-center gap-0 px-5 overflow-x-auto">
          {lines.map((lineId, idx) => {
            const { evaluated, total, done } = getLineStatus(lineId);
            const isActive = idx === activeLineIdx;
            return (
              <button
                key={lineId}
                onClick={() => setActiveLineIdx(idx)}
                className={clsx(
                  "flex items-center gap-1.5 px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap",
                  isActive
                    ? "border-blue-600 text-blue-600 bg-blue-50/10"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50",
                )}
              >
                <Layers size={13} className={isActive ? "text-blue-600" : "text-gray-400"} />
                <span>{lineId}</span>
                {done ? (
                  <Check size={13} className="text-emerald-500 stroke-[3px]" />
                ) : (
                  <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                    {evaluated}/{total}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="flex-1 overflow-auto bg-gray-50 p-5">
        <div className="space-y-4">
          {/* Active line content */}
          {activeLineId && (
            <LineTab
              key={activeLineId}
              lineId={activeLineId}
              tasks={activeTasks}
              scheduleData={scheduleData}
              decisions={lineDecisions}
              onDecide={handleDecide}
              submitted={alreadySubmitted}
            />
          )}

          {/* Submit panel */}
          {!alreadySubmitted && lines.length > 0 && (
            <FinalSubmitPanel
              runId={runId}
              lines={lines}
              runTasks={runTasks}
              allDecisions={allDecisions}
              step={dispatchStep}
              user={user}
              onSubmitSuccess={() => setSubmitted(true)}
              queryClient={queryClient}
            />
          )}

          {alreadySubmitted && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 font-semibold">
              <CheckCircle2 size={16} className="text-emerald-500" />
              Bạn đã gửi xác nhận cho Main Planner. Kết quả đã được ghi nhận.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
