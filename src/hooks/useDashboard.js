import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../api";

export const useDashboardSummary = () =>
  useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: dashboardApi.summary,
    staleTime: 60_000,
  });
