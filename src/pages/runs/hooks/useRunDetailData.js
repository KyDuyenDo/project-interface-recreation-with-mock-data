import { useState, useEffect, useMemo } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import {
  useRunDetail, useRunStatus, useRunWarnings, useRunOutputOrders,
  useVerifyRun, usePublishLogs, usePublishLogDetails, useActiveRun,
} from "../../../hooks";
import { wizardStateApi } from "../../../api";
import http from "../../../api/http";
import { usePermissions } from "../../../hooks/usePermissions";
import { useAuthStore } from "../../../store/authStore";

const WIZARD_TABS = [0, 1, 2, 3]; // step indices that use wizard state

/**
 * All data fetching, queries, mutations, and derived state for RunDetailPage.
 */
export function useRunDetailData(runId) {
  const queryClient = useQueryClient();
  const { isMain, isSub, myLines } = usePermissions();
  const { user } = useAuthStore();

  // ── Core run data ───────────────────────────────────────────────────────
  const { data: activeRun } = useActiveRun();
  const { data: run }          = useRunDetail(runId);
  const isLive                 = run?.status === "running" || run?.status === "pending";
  const { data: statusData }   = useRunStatus(runId, isLive);
  const { data: warningsData } = useRunWarnings(runId);
  const { data: ordersData }   = useRunOutputOrders(runId, run?.status !== "failed" ? { page_size: 1000 } : null);

  const warnings  = warningsData?.warnings || [];
  const orders    = ordersData?.orders ?? ordersData?.items ?? [];
  const lateCount = useMemo(
    () => orders.filter(o => o.is_late || (o.crd && o.go_end > o.crd)).length,
    [orders],
  );

  // ── Verification ──────────────────────────────────────────────────────
  const verifyRunMutation = useVerifyRun();
  const { data: publishLogs, refetch: refetchPublishLogs } = usePublishLogs(runId);
  const isLocked = run?.lifecycle_status === "verifying";

  useEffect(() => {
    if (run?.lifecycle_status === "verifying") {
      const id = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["run", runId] });
        refetchPublishLogs();
      }, 4000);
      return () => { clearInterval(id); refetchPublishLogs(); };
    }
  }, [run?.lifecycle_status, runId, queryClient, refetchPublishLogs]);

  return {
    run, activeRun, isLive, statusData, warnings, orders, lateCount,
    verifyRunMutation, publishLogs, refetchPublishLogs, isLocked,
    isMain, isSub, myLines, user, queryClient,
  };
}

/**
 * Wizard-step data (steps 1-4) for viewing run config after completion.
 */
export function useRunDetailWizardData(runId, step) {
  const wizardEnabled = WIZARD_TABS.includes(step) && !!runId;

  const { data: wOrders,   isLoading: wOrdersLoading }   = useQuery({ queryKey: ["wiz-orders",   runId], queryFn: () => wizardStateApi.getOrders(runId),          enabled: wizardEnabled, staleTime: 60_000 });
  const { data: wPrio,     isLoading: wPrioLoading }     = useQuery({ queryKey: ["wiz-prio",     runId], queryFn: () => wizardStateApi.getPriorities(runId),      enabled: wizardEnabled, staleTime: 60_000 });
  const { data: wCap,      isLoading: wCapLoading }      = useQuery({ queryKey: ["wiz-cap",      runId], queryFn: () => wizardStateApi.getCapacities(runId),      enabled: wizardEnabled, staleTime: 60_000 });
  const { data: wNewModel, isLoading: wNewModelLoading } = useQuery({ queryKey: ["wiz-newmodel", runId], queryFn: () => wizardStateApi.getNewModelTargets(runId), enabled: wizardEnabled, staleTime: 60_000 });
  const { data: wEta,      isLoading: wEtaLoading }      = useQuery({ queryKey: ["wiz-eta",      runId], queryFn: () => wizardStateApi.getMaterialEtas(runId),    enabled: wizardEnabled, staleTime: 60_000 });
  const { data: wGcDates,  isLoading: wGcLoading }       = useQuery({ queryKey: ["wiz-gc",       runId], queryFn: () => wizardStateApi.getGcDates(runId),         enabled: wizardEnabled, staleTime: 60_000 });

  const wizardLoading = wOrdersLoading || wPrioLoading || wCapLoading || wNewModelLoading || wEtaLoading || wGcLoading;

  // ── Derived wizard props ──────────────────────────────────────────────
  const regularOrders      = useMemo(() => wOrders?.regular ?? [], [wOrders]);
  const gcOrders           = useMemo(() => wOrders?.gc      ?? [], [wOrders]);
  const selectedRegularIds = useMemo(() => new Set((wOrders?.regular ?? []).map(o => o.order_id)), [wOrders]);
  const selectedGcIds      = useMemo(() => new Set((wOrders?.gc ?? []).map(o => o.order_id)), [wOrders]);
  const allSelectedIds     = useMemo(() => new Set([...selectedRegularIds, ...selectedGcIds]), [selectedRegularIds, selectedGcIds]);
  const knownOrdersMap     = useMemo(() => {
    const m = {};
    for (const o of [...regularOrders, ...gcOrders]) {
      if (!o.order_id) continue;
      m[o.order_id] = {
        article:     (o.order?.ARTICLE   || o.order?.article   || "").trim(),
        cutting_die: (o.order?.DAOMH_    || o.order?.DAOMH     || o.order?.cutting_die || "").trim(),
        style:       (o.order?.XieMing_  || o.order?.style     || "").trim(),
        tool:        (o.order?.XTMH_     || o.order?.tool      || "").trim(),
        last_die:    (o.order?.DDMH_     || o.order?.last_die  || "").trim(),
      };
    }
    return m;
  }, [regularOrders, gcOrders]);
  const priorityConfig     = useMemo(() => wPrio?.priority_config ?? {}, [wPrio]);
  const capChoices         = useMemo(() => wCap?.cap_choices ?? {}, [wCap]);
  const workingHoursPerDay = wCap?.working_hours_per_day ?? 8;
  const importedTargetQty  = useMemo(() => wNewModel?.targets ?? {}, [wNewModel]);
  const materialEtaOvr     = useMemo(() => wEta?.overrides ?? {}, [wEta]);
  const gcDateOvr          = useMemo(() => wGcDates?.gc_dates ?? {}, [wGcDates]);

  return {
    wizardLoading, wEta, wGcDates,
    regularOrders, gcOrders, selectedRegularIds, selectedGcIds, allSelectedIds,
    knownOrdersMap, priorityConfig, capChoices, workingHoursPerDay,
    importedTargetQty, materialEtaOvr, gcDateOvr,
  };
}

/**
 * Sub-planner specific queries and step-lock logic.
 */
export function useRunDetailSubPlanner(runId, run, isSub, user) {
  const queryClient = useQueryClient();

  // Sub-planner: dispatch status for Step 2
  const { data: step2DispatchStatus } = useQuery({
    queryKey:  ["dispatch-status-step2", runId],
    queryFn:   () => http.get(`/runs/${runId}/dispatch-status`, { params: { step: 2 } }).then(r => r.data),
    enabled:   !!runId && isSub,
    staleTime: 30_000,
  });
  const isStep2Dispatched = !!step2DispatchStatus?.dispatched;

  // Sub-planner: dispatch status for Step 6
  const { data: step6DispatchStatus } = useQuery({
    queryKey:  ["dispatch-status-step6", runId],
    queryFn:   () => http.get(`/runs/${runId}/dispatch-status`, { params: { step: 6 } }).then(r => r.data),
    enabled:   !!runId && isSub,
    staleTime: 30_000,
  });
  const isStep6Dispatched = !!step6DispatchStatus?.dispatched;

  // Sub-planner: tasks for line filtering
  const { data: myTasksData } = useQuery({
    queryKey: ["my-tasks", user?.username],
    queryFn:  () => http.get("/tasks/my", { params: { username: user?.username } }).then(r => r.data),
    enabled:  !!user && isSub && !!runId,
    staleTime: 30_000,
  });
  const myRunTasks = useMemo(() => {
    if (!isSub || !myTasksData?.items) return [];
    return myTasksData.items.filter(t => t.run_id === runId);
  }, [isSub, myTasksData, runId]);
  const myOrderIds = useMemo(
    () => new Set(myRunTasks.filter(t => t.order_id).map(t => t.order_id)),
    [myRunTasks],
  );

  // ── Step lock logic ─────────────────────────────────────────────────
  const isStepLocked = (idx) => {
    if (!isSub) return false;
    if (run?.lifecycle_status === "active") return false;
    if (idx === 1) return !isStep2Dispatched;
    if (idx === 2) return (run?.wizard_step ?? 0) < 2;
    if (idx === 3) return (run?.wizard_step ?? 0) < 3;
    if (idx === 4) return (run?.wizard_step ?? 0) < 4 && run?.status !== "done" && run?.status !== "running";
    if (idx === 5) return (run?.wizard_step ?? 0) < 5 || !isStep6Dispatched;
    return false;
  };

  return {
    isStep2Dispatched, isStep6Dispatched,
    myOrderIds, isStepLocked, queryClient,
  };
}

/**
 * Sub-planner material ETA and GC date editing state + mutations.
 */
export function useSubPlannerEditing(runId, wEta, wGcDates) {
  const queryClient = useQueryClient();
  const [localEtaOverrides, setLocalEtaOverrides] = useState({});
  const [localGcDateOverrides, setLocalGcDateOverrides] = useState({});

  useEffect(() => {
    if (wEta?.overrides) setLocalEtaOverrides(wEta.overrides);
  }, [wEta]);

  useEffect(() => {
    if (wGcDates?.gc_dates) setLocalGcDateOverrides(wGcDates.gc_dates);
  }, [wGcDates]);

  const saveEtaMutation = useMutation({
    mutationFn: (overrides) => wizardStateApi.putMaterialEtas(runId, { overrides }).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wiz-eta", runId] }),
  });

  const saveGcMutation = useMutation({
    mutationFn: (gc_dates) => wizardStateApi.putGcDates(runId, { gc_dates }).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wiz-gc", runId] }),
  });

  const handleSaveMaterialEtas = (updater) => {
    setLocalEtaOverrides((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveEtaMutation.mutate(next);
      return next;
    });
  };

  const handleSaveGcDates = (updater) => {
    setLocalGcDateOverrides((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveGcMutation.mutate(next);
      return next;
    });
  };

  return {
    localEtaOverrides, localGcDateOverrides,
    handleSaveMaterialEtas, handleSaveGcDates,
  };
}
