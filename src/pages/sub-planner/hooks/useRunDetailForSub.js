import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../../store/authStore";
import { usePermissions } from "../../../hooks/usePermissions";
import { http } from "../../../api/http";

export function useRunDetailForSub(runId) {
  const { user }  = useAuthStore();
  const { isSub } = usePermissions();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState(null);
  const [allDecisions, setAllDecisions] = useState({});
  const [submitted, setSubmitted] = useState(false);

  // Query tasks
  const { data, isLoading } = useQuery({
    queryKey: ["my-tasks", user?.username],
    queryFn: () => http.get("/tasks/my", { params: { username: user?.username } }).then(r => r.data),
    enabled: !!user,
  });

  const allTasks = data?.items || [];
  const runTasks = useMemo(() => allTasks.filter(t => String(t.run_id) === String(runId)), [allTasks, runId]);
  const meta     = runTasks[0];

  const lines = useMemo(() =>
    [...new Set(runTasks.map(t => t.line_id).filter(Boolean))].sort(),
    [runTasks]
  );

  // Default to first tab
  useEffect(() => {
    if (lines.length && !activeTab) setActiveTab(lines[0]);
  }, [lines, activeTab]);

  // Initialise decision map once tasks load
  useEffect(() => {
    if (!runTasks.length) return;
    setAllDecisions(prev => {
      const next = { ...prev };
      lines.forEach(lineId => {
        if (!next[lineId]) next[lineId] = {};
        runTasks.filter(t => t.line_id === lineId && t.order_id).forEach(t => {
          if (!(t.order_id in next[lineId])) {
            next[lineId][t.order_id] = t.status === "confirmed"
              ? { status: "accepted", reason: null, note: "" }
              : t.status === "rejected"
                ? { status: "rejected", reason: t.reject_reason || null, note: t.note || "" }
                : { status: null, reason: null, note: "" };
          }
        });
      });
      return next;
    });
  }, [runTasks, lines]);

  // Query schedule
  const { data: scheduleData } = useQuery({
    queryKey: ["line-schedule", lines.join(",")],
    queryFn: () => http.get("/lines/schedule", { params: { lines: lines.join(",") } }).then(r => r.data),
    enabled: lines.length > 0,
    staleTime: 60000,
  });

  const step = runTasks[0]?.step ?? 2;

  // Update a single order decision
  const handleDecide = (lineId, orderId, status, reason, note) => {
    setAllDecisions(prev => ({
      ...prev,
      [lineId]: {
        ...prev[lineId],
        [orderId]: { status, reason: reason || null, note: note || "" },
      },
    }));
  };

  // Tab completion indicator
  const lineCompletionMap = useMemo(() => {
    const map = {};
    lines.forEach(lineId => {
      const tasks = runTasks.filter(t => t.line_id === lineId && t.order_id);
      const decs  = allDecisions[lineId] || {};
      const total = tasks.length;
      const done  = tasks.filter(t => decs[t.order_id]?.status).length;
      map[lineId] = { total, done, complete: total > 0 && done === total };
    });
    return map;
  }, [lines, runTasks, allDecisions]);

  return {
    user, isSub,
    activeTab, setActiveTab,
    allDecisions, setAllDecisions,
    submitted, setSubmitted,
    runTasks, meta, lines,
    scheduleData, step,
    handleDecide, lineCompletionMap,
    isLoading, queryClient,
  };
}
