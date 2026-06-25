import { useQuery } from "@tanstack/react-query";
import { Users, CheckCircle2, AlertTriangle, PanelRightOpen } from "lucide-react";
import http from "../../api/http";

/**
 * Badge button that shows the dispatch status for a given step.
 * Used in both GAConfigPage (wizard) and RunDetailPage (completed stepper).
 */
export default function SubPlannerTriggerBadge({ dispatchStep, runId, onClick }) {
  const { data: statusData } = useQuery({
    queryKey:        ["dispatch-status", runId, dispatchStep],
    queryFn:         () => http.get(`/runs/${runId}/dispatch-status`, { params: { step: dispatchStep } }).then(r => r.data),
    enabled:         !!runId,
    refetchInterval: 10000,
  });

  const dispatched     = statusData?.dispatched;
  const planners       = statusData?.planners || [];
  const confirmedCount = planners.filter(p => p.status === "confirmed").length;
  const rejectedCount  = planners.filter(p => p.status === "rejected").length;
  const total          = planners.length;
  const allConfirmed   = total > 0 && confirmedCount === total;

  const btnBase = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors";
  const btnStyle = allConfirmed
    ? `${btnBase} bg-green-50 border-green-200 text-green-700 hover:bg-green-100`
    : rejectedCount > 0
      ? `${btnBase} bg-red-50 border-red-200 text-red-700 hover:bg-red-100`
      : dispatched
        ? `${btnBase} bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100`
        : `${btnBase} bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100`;

  return (
    <button onClick={onClick} className={btnStyle}>
      <Users size={12} />
      Sub-Planner
      {dispatched ? (
        allConfirmed ? (
          <span className="flex items-center gap-0.5 bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
            <CheckCircle2 size={9} /> {total}/{total}
          </span>
        ) : rejectedCount > 0 ? (
          <span className="flex items-center gap-0.5 bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
            <AlertTriangle size={9} /> {rejectedCount}
          </span>
        ) : (
          <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
            {confirmedCount}/{total}
          </span>
        )
      ) : (
        <span className="bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full text-[10px]">Chưa gửi</span>
      )}
      <PanelRightOpen size={12} className="opacity-50" />
    </button>
  );
}
