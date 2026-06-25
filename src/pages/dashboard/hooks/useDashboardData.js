import { useDashboardSummary, useRuns } from "../../../hooks";
import { useAuthStore } from "../../../store/authStore";

export function useDashboardData() {
  const { data: summary, isLoading, refetch: refetchSummary } = useDashboardSummary();
  const { data: runsData, refetch: refetchRuns } = useRuns({ limit: 8 });
  const { user } = useAuthStore();

  const runs = runsData?.items || runsData || [];
  const activeRun = runs.find(r => r.lifecycle_status === "active" || r.is_accepted) || runs[0];
  const recentRuns = runs.slice(0, 6);

  const todayStr = new Date().toLocaleDateString("vi-VN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });

  const handleSyncErp = () => {
    // Implement or trigger ERP synchronization
    console.log("Syncing with ERP...");
  };

  const refetchAll = () => {
    refetchSummary();
    refetchRuns();
  };

  return {
    summary,
    isLoading,
    runs,
    activeRun,
    recentRuns,
    user,
    todayStr,
    handleSyncErp,
    refetchAll,
  };
}
