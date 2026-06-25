import { useState, useMemo } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useRuns, useActiveRun, useSchedulePeriods, useDeleteRun } from "../../../hooks";
import { useOrders } from "../../../hooks/useOrders";
import { wizardStateApi, runsApi } from "../../../api";
import { usePermissions } from "../../../hooks/usePermissions";

export const PAGE_SIZE_TAB = 20;

export function useRunsPageData() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const perms = usePermissions();

  const [acceptTarget, setAcceptTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showNewOrders, setShowNewOrders] = useState(false);
  const [activeTab, setActiveTab] = useState("draft");

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [tabPages, setTabPages] = useState({ draft: 1, accepted: 1, active: 1, running: 1 });
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const deleteMutation = useDeleteRun();

  // Queries
  const { data: wizardPlan } = useQuery({
    queryKey: ["wizard-in-progress"],
    queryFn:  () => wizardStateApi.getWizardInProgress(),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  const { data: runsData, isLoading } = useRuns({ page: 1, page_size: 100 });
  const { data: periodsData }         = useSchedulePeriods();
  const { data: activeRun }           = useActiveRun();
  const { data: newOrdersData }       = useOrders({ statuses: ["N"], page_size: 1, include_sizes: false });

  const runs           = Array.isArray(runsData) ? runsData : (runsData?.items || []);
  const periods        = periodsData?.items || periodsData || [];
  const activeRunId    = activeRun?.id;
  const newOrdersCount = newOrdersData?.total ?? null;

  // Filter lists & tabs
  const TAB_BADGES = useMemo(() => ({
    draft:    runs.filter(r => r.lifecycle_status === "draft" && r.status === "done").length,
    accepted: runs.filter(r => r.lifecycle_status === "accepted" || r.lifecycle_status === "verifying").length,
    active:   runs.filter(r => r.lifecycle_status === "active").length,
    running:  runs.filter(r => r.status === "running" || r.status === "pending" || r.status === "failed").length,
  }), [runs]);

  const activeTabRuns = useMemo(() => {
    if (activeTab === "draft")    return runs.filter(r => r.lifecycle_status === "draft" && r.status === "done");
    if (activeTab === "accepted") return runs.filter(r => r.lifecycle_status === "accepted" || r.lifecycle_status === "verifying");
    if (activeTab === "active")   return runs.filter(r => r.lifecycle_status === "active");
    if (activeTab === "running")  return runs.filter(r => r.status === "running" || r.status === "pending" || r.status === "failed");
    return [];
  }, [runs, activeTab]);

  const currentPage = tabPages[activeTab] || 1;
  const totalPages  = Math.max(1, Math.ceil(activeTabRuns.length / PAGE_SIZE_TAB));
  const pagedRuns   = useMemo(
    () => activeTabRuns.slice((currentPage - 1) * PAGE_SIZE_TAB, currentPage * PAGE_SIZE_TAB),
    [activeTabRuns, currentPage],
  );

  const setCurrentPage = (p) => setTabPages(prev => ({ ...prev, [activeTab]: p }));

  const allPageSelected = pagedRuns.length > 0 && pagedRuns.every(r => selectedIds.has(r.id));

  // Handlers
  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        pagedRuns.forEach(r => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        pagedRuns.forEach(r => next.add(r.id));
        return next;
      });
    }
  };

  const toggleSelect = (id) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSelectedIds(new Set());
  };

  const handleStartFresh = async (e) => {
    e.stopPropagation();
    await wizardStateApi.closeStaleWizardSessions().catch(() => {});
    if (wizardPlan && wizardPlan.status === "draft") {
      try { await runsApi.delete(wizardPlan.id); } catch (_) { /* non-fatal */ }
    }
    queryClient.setQueryData(["wizard-in-progress"], null);
    queryClient.invalidateQueries({ queryKey: ["wizard-in-progress"] });
    navigate("/runs/new");
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    const selectedRuns = runs.filter(r => selectedIds.has(r.id));
    const toDelete = selectedRuns.filter(r => r.lifecycle_status !== "active");
    for (const r of toDelete) {
      const force = r.status === "running" || r.status === "pending";
      try { await runsApi.delete(r.id, force); } catch { /* skip */ }
    }
    setIsBulkDeleting(false);
    setBulkDeleteOpen(false);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ["runs"] });
    queryClient.invalidateQueries({ queryKey: ["run-active"] });
  };

  return {
    navigate, queryClient, perms,
    acceptTarget, setAcceptTarget,
    deleteTarget, setDeleteTarget,
    showNewOrders, setShowNewOrders,
    activeTab, setActiveTab,
    selectedIds, setSelectedIds,
    currentPage, setCurrentPage, totalPages,
    bulkDeleteOpen, setBulkDeleteOpen,
    isBulkDeleting, setIsBulkDeleting,
    deleteMutation,
    wizardPlan, runs, activeRun, activeRunId, newOrdersCount,
    TAB_BADGES, activeTabRuns, pagedRuns, allPageSelected,
    toggleSelectAll, toggleSelect, handleTabChange, handleStartFresh, handleBulkDelete,
  };
}
