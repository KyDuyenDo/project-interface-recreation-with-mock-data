import { useQuery } from "@tanstack/react-query";
import { runsApi } from "../api";

export const useKHXPlanSheets = (runId) =>
  useQuery({
    queryKey: ["khx-plan-sheets", runId],
    queryFn: () => runsApi.khxPlanSheets(runId),
    enabled: !!runId,
  });

export const useKHXPlanSheet = (runId, zone, year, month) =>
  useQuery({
    queryKey: ["khx-plan", runId, zone, year, month],
    queryFn: () => runsApi.khxPlan(runId, zone, year, month),
    enabled: !!(runId && zone && year && month),
  });
