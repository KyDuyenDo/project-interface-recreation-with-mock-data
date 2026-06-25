import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../../store/authStore";
import { usePermissions } from "../../../hooks/usePermissions";
import { http } from "../../../api/http";

export function useSubPlannerWorkspace() {
  const { user } = useAuthStore();
  const { isSub, myLines } = usePermissions();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["my-tasks", user?.username],
    queryFn: () => http.get("/tasks/my", { params: { username: user?.username } }).then(r => r.data),
    enabled: !!user,
    refetchInterval: 30000,
  });

  const tasks = data?.items || [];

  const tasksByRun = useMemo(() => {
    const map = {};
    tasks.forEach(t => {
      if (!map[t.run_id]) map[t.run_id] = [];
      map[t.run_id].push(t);
    });
    return map;
  }, [tasks]);

  const runIds = useMemo(() => {
    return Object.keys(tasksByRun).map(Number).sort((a, b) => b - a);
  }, [tasksByRun]);

  return {
    user,
    isSub,
    myLines,
    tasks,
    tasksByRun,
    runIds,
    isLoading,
    refetch,
  };
}
