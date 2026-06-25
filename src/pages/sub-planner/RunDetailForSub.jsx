import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Layers, Calendar, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { clsx } from "clsx";

// ─── Custom Hook ─────────────────────────────────────────────────────────────
import { useRunDetailForSub } from "./hooks/useRunDetailForSub";

// ─── Components ──────────────────────────────────────────────────────────────
import LineTab from "./components/LineTab";
import FinalSubmitPanel from "./components/FinalSubmitPanel";

const BTN_SM = "inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export default function RunDetailForSub() {
  const { runId } = useParams();
  const navigate  = useNavigate();

  const {
    user, isSub,
    activeTab, setActiveTab,
    allDecisions,
    submitted, setSubmitted,
    runTasks, meta, lines,
    scheduleData, step,
    handleDecide, lineCompletionMap,
    isLoading, queryClient,
  } = useRunDetailForSub(runId);

  if (!isSub) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-gray-50">
        <span className="text-sm text-gray-400">Chỉ dành cho Sub-Planner</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center h-14 px-5 border-b border-gray-200 bg-white">
          <Loader2 size={18} className="animate-spin text-blue-500" />
        </div>
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <Loader2 size={24} className="animate-spin text-blue-400" />
        </div>
      </div>
    );
  }

  if (!runTasks.length) {
    return (
      <div className="flex flex-col h-full">
        <header className="flex items-center h-14 px-5 border-b border-gray-200 bg-white gap-3">
          <button onClick={() => navigate("/runs")} className={`${BTN_SM} bg-white border-gray-200 text-gray-600 hover:bg-gray-50`}>
            <ArrowLeft size={13} /> Quay lại
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <AlertTriangle size={32} className="mx-auto mb-3 text-amber-300" />
            <div className="text-sm font-semibold text-gray-500">Run #{runId} không tìm thấy</div>
          </div>
        </div>
      </div>
    );
  }

  const activeLineTasks = activeTab ? runTasks.filter(t => t.line_id === activeTab) : [];
  const activeDecisions = allDecisions[activeTab] || {};

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="shrink-0 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3 h-14 px-5">
          <button onClick={() => navigate("/runs")} className={`${BTN_SM} bg-white border-gray-200 text-gray-600 hover:bg-gray-50`}>
            <ArrowLeft size={13} /> Danh sách
          </button>
          <div className="h-4 w-px bg-gray-200" />
          <div>
            <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
              Run #{runId}
              <span className="text-xs font-mono font-normal text-gray-400">{meta?.run_label}</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
              <Calendar size={10} /> {meta?.period_label}
              <span className="text-gray-200">·</span>
              <Layers size={10} /> {lines.join(", ")}
            </div>
          </div>
        </div>

        {/* Line tabs */}
        <div className="flex items-center gap-0 px-5 overflow-x-auto border-t border-gray-100">
          {lines.map(lineId => {
            const isActive = activeTab === lineId;
            const comp     = lineCompletionMap[lineId] || {};
            return (
              <button key={lineId} onClick={() => setActiveTab(lineId)}
                className={clsx(
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap",
                  isActive
                    ? "border-blue-600 text-blue-700 bg-blue-50/50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                )}>
                <Layers size={12} />
                {lineId}
                {comp.complete ? (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 ml-0.5">
                    ✓
                  </span>
                ) : comp.done > 0 ? (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 ml-0.5">
                    {comp.done}/{comp.total}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 ml-0.5">
                    {comp.total}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Tab content */}
      <div className="flex-1 overflow-auto bg-gray-50 p-5">
        <div className="space-y-4">
          {activeTab && (
            <LineTab
              key={activeTab}
              lineId={activeTab}
              tasks={activeLineTasks}
              scheduleData={scheduleData?.by_line?.[activeTab]}
              decisions={activeDecisions}
              onDecide={handleDecide}
              submitted={submitted}
            />
          )}

          {/* Final submit panel */}
          {!submitted ? (
            <FinalSubmitPanel
              runId={runId}
              lines={lines}
              runTasks={runTasks}
              allDecisions={allDecisions}
              step={step}
              user={user}
              onSubmitSuccess={() => setSubmitted(true)}
              queryClient={queryClient}
            />
          ) : (
            <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-5 flex items-center gap-3">
              <CheckCircle2 size={22} className="text-emerald-500 shrink-0" />
              <div>
                <div className="text-sm font-bold text-emerald-800">Đã gửi kết quả thành công</div>
                <div className="text-xs text-emerald-600 mt-0.5">Main Planner đã được thông báo và sẽ xem xét kết quả đánh giá của bạn.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
