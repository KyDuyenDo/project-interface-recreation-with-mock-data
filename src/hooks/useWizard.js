import { useQuery } from "@tanstack/react-query";
import { wizardApi, factoriesApi } from "../api";

// ─── Model-line frequency stats for Step 2 priority matrix ───────────────────

export const useModelLineFrequency = (params) =>
  useQuery({
    queryKey: ["model-line-frequency", params],
    queryFn: () => wizardApi.modelLineFrequency(params),
    enabled: !!(params?.date_from && params?.date_to),
    staleTime: 10 * 60_000,
    placeholderData: (prev) => prev,  // keep old data visible while refetching
  });

// ─── Line throughput (capacity history per line) ─────────────────────────────

export const useLineThroughput = (params) =>
  useQuery({
    queryKey: ["line-throughput", params],
    queryFn: () => wizardApi.lineThroughput(params),
  });

export const useLineThroughputPicker = (params, enabled = true) =>
  useQuery({
    queryKey: ["line-throughput-picker", params],
    queryFn: () => wizardApi.lineThroughputPicker(params),
    enabled: enabled && !!(params?.months?.length),
    staleTime: 60_000,
  });

// ─── Throughput overrides ─────────────────────────────────────────────────────

export const useWizardThroughputOverrides = () =>
  useQuery({
    queryKey: ["throughput-overrides"],
    queryFn: wizardApi.throughputOverrides,
    staleTime: 60_000,
  });

// ─── Material ETAs for specific orders ───────────────────────────────────────

export const useWizardMaterialEtas = (orderIds) =>
  useQuery({
    queryKey: ["wizard-material-etas", orderIds],
    queryFn: () => wizardApi.materialEtas(orderIds),
    enabled: Array.isArray(orderIds) && orderIds.length > 0,
    staleTime: 30_000,
  });

// ─── Line capacity stats from ERP production report ──────────────────────────

export const useLineCapacityStats = (params) =>
  useQuery({
    queryKey: ["line-capacity-stats", params],
    queryFn: () => wizardApi.lineCapacityStats(params),
    enabled: !!(params?.date_from && params?.date_to),
    staleTime: 5 * 60_000,
  });

// ─── Line production for Step 2 right panel ──────────────────────────────────

export const useLineProduction = (params) =>
  useQuery({
    queryKey: ["line-production", params],
    queryFn: () => wizardApi.lineProduction(params),
    enabled: !!(params?.line_id && params?.date_from && params?.date_to),
    staleTime: 2 * 60_000,
  });

// ─── Line model affinity stats (for Tab 1 overview) ─────────────────────────

export const useLineModelStats = (params) =>
  useQuery({
    queryKey: ["line-model-stats", params],
    queryFn: () => wizardApi.lineModelStats(params),
    enabled: !!(params?.date_from && params?.date_to),
    staleTime: 5 * 60_000,
  });

// ─── EIP lines (from snapshot) ───────────────────────────────────────────────

export const useEIPLines = (params) =>
  useQuery({
    queryKey: ["eip-lines", params],
    queryFn: () => factoriesApi.lines(params),
    staleTime: 300_000,
  });

// ─── Full line pool: EIP + BDepartment dep_name ───────────────────────────────

export const useLinePool = () =>
  useQuery({
    queryKey: ["line-pool"],
    queryFn: () => wizardApi.linePool(),
    staleTime: 10 * 60_000,
  });

// ─── GC/CM subcontractor departments ─────────────────────────────────────────

export const useGcDepartments = () =>
  useQuery({
    queryKey: ["gc-departments"],
    queryFn: () => wizardApi.gcDepartments(),
    staleTime: 10 * 60_000,
  });

export const useFloors = () =>
  useQuery({
    queryKey: ["floors"],
    queryFn: factoriesApi.floors,
    staleTime: 300_000,
  });

