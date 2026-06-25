import { useNavigate } from "react-router-dom";
import { ClipboardList, Layers, RefreshCw, Loader2, User } from "lucide-react";

// ─── Custom Hook ─────────────────────────────────────────────────────────────
import { useSubPlannerWorkspace } from "./hooks/useSubPlannerWorkspace";

// ─── Components ──────────────────────────────────────────────────────────────
import RunCard from "./components/RunCard";
import SummaryStats from "./components/SummaryStats";

export default function SubPlannerWorkspace() {
  const navigate = useNavigate();

  const {
    user,
    isSub,
    myLines,
    tasksByRun,
    runIds,
    isLoading,
    refetch,
  } = useSubPlannerWorkspace();

  if (!isSub) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-slate-50">
        <ClipboardList size={32} className="mx-auto mb-3 text-slate-200" />
        <div className="text-base font-semibold text-slate-500">Trang này chỉ dành cho Sub-Planner</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <header className="flex items-center h-16 px-6 border-b border-slate-200 bg-white shrink-0 gap-4 shadow-sm">
        <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow">
          <User size={16} className="text-white" />
        </div>
        <div>
          <div className="text-sm font-bold text-slate-900">Công việc của tôi</div>
          <div className="text-xs text-slate-400">
            {user?.full_name}
            {myLines.length > 0 && (
              <span className="ml-2">
                · Chuyền:&nbsp;
                {myLines.map(l => (
                  <span key={l} className="inline-flex items-center gap-0.5 mx-0.5 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                    <Layers size={8} /> {l}
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition shadow-sm"
        >
          <RefreshCw size={12} /> Làm mới
        </button>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        ) : runIds.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-20 text-center max-w-lg mx-auto mt-16">
            <ClipboardList size={36} className="mx-auto mb-3 text-slate-200" />
            <div className="text-base font-semibold text-slate-500 mb-1">Chưa có Run nào</div>
            <div className="text-sm text-slate-400">Main Planner chưa phân công Run nào cho bạn.</div>
          </div>
        ) : (
          <>
            <SummaryStats tasksByRun={tasksByRun} />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {runIds.map(runId => (
                <RunCard
                  key={runId}
                  runId={runId}
                  tasks={tasksByRun[runId]}
                  onClick={() => navigate(`/my-tasks/${runId}`)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
