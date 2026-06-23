import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { runsApi, periodsApi } from "../api";

// ─── List / detail ───────────────────────────────────────────────────────────

export const useRuns = (params) =>
  useQuery({
    queryKey: ["runs", params],
    queryFn: () => runsApi.list(params),
  });

export const useRunDetail = (id) =>
  useQuery({
    queryKey: ["run", id],
    queryFn: () => runsApi.detail(id),
    enabled: !!id,
  });

export const useActiveRun = () =>
  useQuery({
    queryKey: ["run-active"],
    queryFn: () => runsApi.active(),
    staleTime: 60_000,
  });

// ─── Live status (step-based progress, polled while pending/running) ─────────

export const useRunStatus = (id, enabled = true) =>
  useQuery({
    queryKey: ["run-status", id],
    queryFn: () => runsApi.status(id),
    enabled: !!id && enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "running" || status === "pending") return 2000;
      return false;
    },
  });

// ─── Warnings ────────────────────────────────────────────────────────────────

export const useRunWarnings = (id) =>
  useQuery({
    queryKey: ["run-warnings", id],
    queryFn: () => runsApi.warnings(id),
    enabled: !!id,
  });

// ─── Gene read/edit (KHX page) ───────────────────────────────────────────────

export const useRunGenes = (id, params) =>
  useQuery({
    queryKey: ["run-genes", id, params],
    queryFn: () => runsApi.genes.list(id, params),
    enabled: !!id,
  });

// ─── KHX sheets ──────────────────────────────────────────────────────────────

export const useKHXSheets = (runId) =>
  useQuery({
    queryKey: ["khx-sheets", runId],
    queryFn: () => runsApi.khxSheets(runId),
    enabled: !!runId,
  });

export const useKHXSheet = (runId, factory, year, month) =>
  useQuery({
    queryKey: ["khx", runId, factory, year, month],
    queryFn: () => runsApi.khx(runId, factory, year, month),
    enabled: !!(runId && factory && year && month),
  });

// ─── Full schedule + output views ────────────────────────────────────────────

export const useRunSchedule = (id, params) =>
  useQuery({
    queryKey: ["run-schedule", id, params],
    queryFn: () => runsApi.schedule(id, params),
    enabled: !!id,
    staleTime: 120_000,
  });

export const useRunOutputOrders = (id, params) =>
  useQuery({
    queryKey: ["run-output-orders", id, params],
    queryFn: () => runsApi.outputOrders(id, params),
    enabled: !!id,
    staleTime: 120_000,
  });

export const useRunOutputLineload = (id, params) =>
  useQuery({
    queryKey: ["run-output-lineload", id, params],
    queryFn: () => runsApi.outputLineload(id, params),
    enabled: !!id,
    staleTime: 120_000,
  });

export const useRunOutputDaily = (id, params) =>
  useQuery({
    queryKey: ["run-output-daily", id, params],
    queryFn: () => runsApi.outputDaily(id, params),
    enabled: !!id,
    staleTime: 120_000,
    retry: (failCount, error) => error?.response?.status !== 404 && failCount < 2,
  });

export const useRunScheduleDay = (id, targetDate) =>
  useQuery({
    queryKey: ["run-schedule-day", id, targetDate],
    queryFn: () => runsApi.scheduleDay(id, targetDate),
    enabled: !!(id && targetDate),
    staleTime: 120_000,
  });

// ─── Line view: running + scheduled ─────────────────────────────────────────

export const useLineWithRunning = (runId, line, scDate) =>
  useQuery({
    queryKey: ["line-with-running", runId, line, scDate],
    queryFn: () => runsApi.lineWithRunning(runId, line, scDate),
    enabled: !!(runId && line),
    staleTime: 60_000,
  });

export const useRunPdschRunning = (runId, params) =>
  useQuery({
    queryKey: ["run-pdsch-running", runId, params],
    queryFn: () => runsApi.pdschRunning(runId, params),
    enabled: !!runId,
    staleTime: 120_000,
  });

// ─── Run diff ────────────────────────────────────────────────────────────────

export const useRunDiff = (runId, compareRunId) =>
  useQuery({
    queryKey: ["run-diff", runId, compareRunId],
    queryFn: () => runsApi.diff(runId, compareRunId),
    enabled: !!(runId && compareRunId),
    staleTime: 300_000,
  });

// ─── Mutations ───────────────────────────────────────────────────────────────

export const useCreateRun = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: runsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["runs"] });
      qc.invalidateQueries({ queryKey: ["run-active"] });
    },
  });
};

export const useAcceptRun = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note, period_id }) => runsApi.accept(id, { note, period_id }),
    onSuccess: () => {
      qc.setQueryData(["wizard-in-progress"], null);
      qc.invalidateQueries({ queryKey: ["runs"] });
      qc.invalidateQueries({ queryKey: ["run-active"] });
      qc.invalidateQueries({ queryKey: ["schedule-periods"] });
      qc.invalidateQueries({ queryKey: ["wizard-in-progress"] });
    },
  });
};

export const useDeleteRun = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg) => {
      const id    = typeof arg === "object" ? arg.id    : arg;
      const force = typeof arg === "object" ? (arg.force ?? false) : false;
      return runsApi.delete(id, force);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["runs"] });
      qc.invalidateQueries({ queryKey: ["run-active"] });
    },
  });
};

// ─── Schedule Periods ────────────────────────────────────────────────────────

export const useSchedulePeriods = (params) =>
  useQuery({
    queryKey: ["schedule-periods", params],
    queryFn: () => periodsApi.list(params),
    staleTime: 60_000,
  });

export const useCreatePeriod = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: periodsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule-periods"] }),
  });
};

export const useEditGene = (runId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, body }) => runsApi.genes.edit(runId, orderId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["khx"] });
      qc.invalidateQueries({ queryKey: ["run-genes"] });
    },
  });
};

export const useImpactAnalysis = (runId) =>
  useMutation({
    mutationFn: (body) => runsApi.impact(runId, body),
  });

export const useVerifyRun = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => runsApi.verify(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["run", id] });
      qc.invalidateQueries({ queryKey: ["runs"] });
      qc.invalidateQueries({ queryKey: ["run-active"] });
      qc.invalidateQueries({ queryKey: ["publish-logs", id] });
    },
  });
};

export const usePublishLogs = (runId) =>
  useQuery({
    queryKey: ["publish-logs", runId],
    queryFn: () => runsApi.publishLogs(runId),
    enabled: !!runId,
  });

export const usePublishLogDetails = (logId) =>
  useQuery({
    queryKey: ["publish-log-details", logId],
    queryFn: () => runsApi.publishLogDetails(logId),
    enabled: !!logId,
  });
