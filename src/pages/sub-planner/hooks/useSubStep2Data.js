import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../../store/authStore";
import { http } from "../../../api/http";

export function useSubStep2Data({ runId, myLines, dispatchStep = 2 }) {
  const { user } = useAuthStore();
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const [allDecisions, setAllDecisions] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ["my-tasks", user?.username],
    queryFn: () => http.get("/tasks/my", { params: { username: user?.username } }).then(r => r.data),
    enabled: !!user,
    refetchInterval: 30000,
  });

  const runTasks = useMemo(() => {
    const items = tasksData?.items || [];
    return items.filter(t => t.run_id === runId);
  }, [tasksData, runId]);

  const lines = useMemo(() => {
    const lids = [...new Set(runTasks.map(t => t.line_id).filter(Boolean))].sort();
    if (myLines && myLines.length > 0) return lids.filter(l => myLines.includes(l));
    return lids;
  }, [runTasks, myLines]);

  const activeLineId = lines[activeLineIdx] || null;
  const activeTasks = useMemo(() => runTasks.filter(t => t.line_id === activeLineId), [runTasks, activeLineId]);

  const { data: submitStatus } = useQuery({
    queryKey: ["step-submit-status", runId, dispatchStep, user?.username],
    queryFn: () => http.get(`/runs/${runId}/step-approvals`, { params: { step: dispatchStep, username: user?.username } }).then(r => r.data),
    enabled: !!runId && !!user,
    staleTime: 30_000,
  });

  const alreadySubmitted = submitStatus?.status === "confirmed" || submitted;

  const { data: scheduleData } = useQuery({
    queryKey: ["sub-schedule", runId, activeLineId],
    queryFn: () => http.get(`/runs/${runId}/sub-schedule/${activeLineId}`).then(r => r.data),
    enabled: !!runId && !!activeLineId,
    staleTime: 60_000,
  });

  const lineDecisions = allDecisions[activeLineId] || {};

  const handleDecide = (lineId, orderId, status, reason, note) => {
    setAllDecisions(prev => ({
      ...prev,
      [lineId]: {
        ...(prev[lineId] || {}),
        [orderId]: status === null ? { status: null } : { status, reason, note },
      },
    }));
  };

  const getLineStatus = (lineId) => {
    const lineTasks = runTasks.filter(t => t.line_id === lineId && t.order_id);
    const decs = allDecisions[lineId] || {};
    const evaluated = lineTasks.filter(t => decs[t.order_id]?.status).length;
    const total = lineTasks.length;
    return { evaluated, total, done: evaluated === total && total > 0 };
  };

  return {
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
  };
}
