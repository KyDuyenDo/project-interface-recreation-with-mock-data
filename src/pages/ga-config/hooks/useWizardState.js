import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useRunStatus, useRunDetail } from "../../../hooks/useRuns";
import { wizardStateApi, runsApi } from "../../../api";
import { usePermissions } from "../../../hooks/usePermissions";
import http from "../../../api/http";

export const STEPS = [
  { key: "orders",   title: "Chọn đơn",   subtitle: "Nhập mã hoặc Excel" },
  { key: "capacity", title: "Ưu tiên",    subtitle: "Chuyền theo model" },
  { key: "mat",      title: "NVL về",     subtitle: "Ngày vật liệu" },
  { key: "gc_dates", title: "Ngày GC",    subtitle: "Thu gia công" },
  { key: "run",      title: "Chạy lịch",  subtitle: "TailFollow + ILS" },
  { key: "edit",     title: "Chỉnh sửa",  subtitle: "Review + tinh chỉnh" },
  { key: "confirm",  title: "Xác nhận",   subtitle: "Đẩy vào kế hoạch" },
];

const DISPATCH_STEPS = { 1: 2, 2: 3, 3: 4, 5: 6 };

export function useWizardState() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isSub } = usePermissions();
  const resumeId = searchParams.get("resume") ? parseInt(searchParams.get("resume"), 10) : null;

  // Wizard state
  const [step, setStep] = useState(() => {
    const s = parseInt(searchParams.get("step"), 10);
    return isNaN(s) ? 0 : Math.min(Math.max(s, 0), 6);
  });
  const [completedUpTo, setCompletedUpTo] = useState(-1);
  const [label, setLabel] = useState("");

  // Orders: two separate panels
  const [regularOrders, setRegularOrders] = useState([]);
  const [gcOrders, setGcOrders] = useState([]);

  const [excludeLines] = useState(new Set());
  const [materialEtaOverrides, setMaterialEtaOverrides] = useState({});
  const [gcDateOverrides, setGcDateOverrides] = useState({});
  const [runId, setRunId] = useState(null);
  const [draftRunId, setDraftRunId] = useState(null);
  const [priorityConfig, setPriorityConfig] = useState({});
  const [workingHoursPerDay, setWorkingHoursPerDay] = useState(8);
  const [capChoices, setCapChoices] = useState({ regular: {}, gc: {}, noHistRegular: {}, noHistGc: {} });
  const [importedTargetQty, setImportedTargetQty] = useState({});

  const [isLoadedFromServer, setIsLoadedFromServer] = useState(false);
  const [step2Loading, setStep2Loading] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer when wizard step changes
  useEffect(() => { setDrawerOpen(false); }, [step]);

  // Sync step → URL
  useEffect(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set("step", step);
      return next;
    }, { replace: true });
  }, [step, setSearchParams]);

  // Resume: load run info when ?resume=id is present
  // NOTE: searchParams is intentionally excluded from deps to avoid a
  // circular loop (step→URL sync triggers this effect which overrides step).
  const { data: resumeRunData } = useRunDetail(resumeId);
  useEffect(() => {
    if (!resumeId || !resumeRunData) return;
    setDraftRunId(resumeId);
    setLabel(resumeRunData.label || "");
    const savedStep = resumeRunData.wizard_step ?? 0;
    const urlStep   = parseInt(searchParams.get("step"), 10);
    // If GA already ran, jump to step 5 (edit); otherwise restore saved/URL step
    if (resumeRunData.status === "done" || resumeRunData.status === "running" || resumeRunData.status === "pending") {
      const jumpTo = resumeRunData.status === "done" ? 5 : 4;
      const effectiveStep = (!isNaN(urlStep) && urlStep >= jumpTo && urlStep <= 6) ? urlStep : jumpTo;
      setStep(effectiveStep);
      setCompletedUpTo(Math.max(jumpTo, savedStep));
      setRunId(resumeId);
    } else {
      const effectiveStep = (!isNaN(urlStep) && urlStep >= 0 && urlStep <= savedStep) ? urlStep : savedStep;
      setStep(effectiveStep);
      setCompletedUpTo(savedStep);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId, resumeRunData]);

  // Fetch all states from backend if resuming
  useEffect(() => {
    if (!resumeId || !draftRunId) return;
    Promise.all([
      wizardStateApi.getOrders(draftRunId),
      wizardStateApi.getPriorities(draftRunId),
      wizardStateApi.getCapacities(draftRunId),
      wizardStateApi.getNewModelTargets(draftRunId),
      wizardStateApi.getMaterialEtas(draftRunId),
      wizardStateApi.getGcDates(draftRunId),
    ])
      .then(([orders, priorities, capacities, newModelTargets, materialEtas, gcDates]) => {
        if (orders) {
          setRegularOrders(orders.regular || []);
          setGcOrders(orders.gc || []);
        }
        if (priorities) {
          setPriorityConfig(priorities.priority_config || {});
        }
        if (capacities) {
          setWorkingHoursPerDay(capacities.working_hours_per_day || 8);
          setCapChoices(capacities.cap_choices || { regular: {}, gc: {}, noHistRegular: {}, noHistGc: {} });
        }
        if (newModelTargets) {
          setImportedTargetQty(newModelTargets.targets || {});
        }
        if (materialEtas) {
          setMaterialEtaOverrides(materialEtas.overrides || {});
        }
        if (gcDates) {
          setGcDateOverrides(gcDates.gc_dates || {});
        }
        setIsLoadedFromServer(true);
      })
      .catch((err) => {
        console.error("Error loading wizard state:", err);
        setIsLoadedFromServer(true);
      });
  }, [resumeId, draftRunId]);

  // Create a draft run on first mount (skip if resuming)
  const draftCreated = useRef(false);
  useEffect(() => {
    if (resumeId) return; // resuming — skip creating new draft
    if (draftCreated.current) return;
    draftCreated.current = true;
    wizardStateApi.createDraft("").then((res) => {
      setDraftRunId(res.id);
      // Load default priorities
      wizardStateApi.getPriorities(res.id).then((p) => {
        if (p?.priority_config && Object.keys(p.priority_config).length > 0) {
          setPriorityConfig(p.priority_config);
        }
      }).catch(() => {});
      // Pre-populate Step 3 Material ETAs
      wizardStateApi.getMaterialEtas(res.id).then((m) => {
        if (m?.overrides && Object.keys(m.overrides).length > 0) {
          setMaterialEtaOverrides(m.overrides);
        }
      }).catch(() => {});
      // Pre-populate Step 4 GC dates
      wizardStateApi.getGcDates(res.id).then((g) => {
        if (g?.gc_dates && Object.keys(g.gc_dates).length > 0) {
          setGcDateOverrides(g.gc_dates);
        }
      }).catch(() => {});
      setIsLoadedFromServer(true);
    }).catch(() => {
      // Non-fatal
    });
  }, [resumeId]);

  // Debounced auto-save effects
  useEffect(() => {
    if (!isLoadedFromServer || !draftRunId) return;
    const timer = setTimeout(() => {
      wizardStateApi.putOrders(draftRunId, { regular: regularOrders, gc: gcOrders })
        .catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [draftRunId, regularOrders, gcOrders, isLoadedFromServer]);

  useEffect(() => {
    if (!isLoadedFromServer || !draftRunId) return;
    const timer = setTimeout(() => {
      wizardStateApi.putMaterialEtas(draftRunId, { overrides: materialEtaOverrides })
        .catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [draftRunId, materialEtaOverrides, isLoadedFromServer]);

  useEffect(() => {
    if (!isLoadedFromServer || !draftRunId) return;
    const timer = setTimeout(() => {
      wizardStateApi.putGcDates(draftRunId, { gc_dates: gcDateOverrides })
        .catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [draftRunId, gcDateOverrides, isLoadedFromServer]);

  // Helper to save step state on transition / exit
  const saveStepState = useCallback((stepToSave) => {
    if (!draftRunId) return Promise.resolve();
    if (stepToSave === 0) {
      return wizardStateApi.putOrders(draftRunId, { regular: regularOrders, gc: gcOrders });
    }
    if (stepToSave === 1) {
      return Promise.all([
        wizardStateApi.putPriorities(draftRunId, { priority_config: priorityConfig }),
        wizardStateApi.putCapacities(draftRunId, { working_hours_per_day: workingHoursPerDay, cap_choices: capChoices }),
        wizardStateApi.putNewModelTargets(draftRunId, { targets: importedTargetQty }),
      ]);
    }
    if (stepToSave === 2) {
      return wizardStateApi.putMaterialEtas(draftRunId, { overrides: materialEtaOverrides });
    }
    if (stepToSave === 3) {
      return wizardStateApi.putGcDates(draftRunId, { gc_dates: gcDateOverrides });
    }
    return Promise.resolve();
  }, [draftRunId, regularOrders, gcOrders, priorityConfig, workingHoursPerDay, capChoices, importedTargetQty, materialEtaOverrides, gcDateOverrides]);

  // Derived properties
  const selectedRegularIds = useMemo(
    () => new Set(regularOrders.map(o => o.order_id)),
    [regularOrders],
  );
  const selectedGcIds = useMemo(
    () => new Set(gcOrders.map(o => o.order_id)),
    [gcOrders],
  );
  const allSelectedIds = useMemo(
    () => new Set([...selectedRegularIds, ...selectedGcIds]),
    [selectedRegularIds, selectedGcIds],
  );

  const knownOrdersMap = useMemo(() => {
    const map = {};
    for (const o of [...regularOrders, ...gcOrders]) {
      if (!o.order_id) continue;
      map[o.order_id] = {
        article:     (o.order?.ARTICLE   || "").trim(),
        cutting_die: (o.order?.DAOMH_    || "").trim(),
        style:       (o.order?.XieMing_  || "").trim(),
        tool:        (o.order?.XTMH_     || "").trim(),
        last_die:    (o.order?.DDMH_     || "").trim(),
        color_no:    (o.order?.COLNO     || "").trim(),
        qty:         parseInt(o.order?.PAIRQTY || 0, 10),
        crd:         o.order?.DUEDT || null,
      };
    }
    return map;
  }, [regularOrders, gcOrders]);

  // Run status polling
  const { data: statusData } = useRunStatus(runId, !!runId);
  const runStatus = statusData?.status ?? null;
  const runDone   = runStatus === "done";
  const gaHasRun  = runId != null;

  // Persist wizard step
  useEffect(() => {
    if (!draftRunId) return;
    wizardStateApi.saveWizardStep(draftRunId, step).catch(() => {});
  }, [draftRunId, step]);

  // Dispatch gate
  const isDispatchGatedStep = step === 1 || step === 5;
  const dispatchGateRunId   = step === 5 ? runId : draftRunId;
  const dispatchGateStepNum = DISPATCH_STEPS[step];

  const { data: dispatchGateStatus } = useQuery({
    queryKey:        ["dispatch-status", dispatchGateRunId, dispatchGateStepNum],
    queryFn:         () => http.get(`/runs/${dispatchGateRunId}/dispatch-status`, { params: { step: dispatchGateStepNum } }).then(r => r.data),
    enabled:         isDispatchGatedStep && !!dispatchGateRunId && !isSub,
    refetchInterval: 5000,
  });

  const dispatchBlocked = isDispatchGatedStep && !isSub && (() => {
    if (!dispatchGateStatus?.dispatched) return false;
    const planners       = dispatchGateStatus.planners || [];
    const confirmedCount = planners.filter(p => p.status === "confirmed").length;
    return confirmedCount < planners.length;
  })();

  const canNavigateTo = useCallback((target) => {
    if (step === 1 && step2Loading && target > 1) return false;
    if (dispatchBlocked && target > step) return false;
    const maxReachable = completedUpTo + 1;
    if (runStatus === "running" && target < 4) return false;
    if (gaHasRun && target < 4) return true;
    if (target <= step) return true;
    if (target > maxReachable) return false;
    if (target >= 5 && !runDone) return false;
    return true;
  }, [step, step2Loading, dispatchBlocked, completedUpTo, runStatus, gaHasRun, runDone]);

  const canAdvanceFromCurrent = (step !== 4 || runDone) && !(step === 1 && step2Loading) && !dispatchBlocked;

  const handleNext = () => {
    if (!canAdvanceFromCurrent) return;
    saveStepState(step).catch(err => console.error("Failed to save step state:", err));
    setCompletedUpTo(prev => Math.max(prev, step));
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  };

  const handlePrev = () => {
    if (step > 0) {
      saveStepState(step).catch(err => console.error("Failed to save step state:", err));
      setStep(s => s - 1);
    }
  };

  const goStep = (target) => {
    if (canNavigateTo(target)) {
      saveStepState(step).catch(err => console.error("Failed to save step state:", err));
      setStep(target);
    }
  };

  const discardDraft = async () => {
    if (!window.confirm("Hủy bỏ kế hoạch nháp này? Mọi thao tác đã thực hiện sẽ bị mất.")) return;
    const toDelete = [...new Set([draftRunId, runId].filter(Boolean))];
    await Promise.allSettled(toDelete.map(id => runsApi.delete(id)));
    await wizardStateApi.closeStaleWizardSessions().catch(() => {});
    queryClient.setQueryData(["wizard-in-progress"], null);
    queryClient.invalidateQueries({ queryKey: ["wizard-in-progress"] });
    navigate("/runs");
  };

  return {
    navigate, queryClient, isSub, resumeId,
    step, setStep, completedUpTo, setCompletedUpTo, label, setLabel,
    regularOrders, setRegularOrders, gcOrders, setGcOrders,
    excludeLines, materialEtaOverrides, setMaterialEtaOverrides,
    gcDateOverrides, setGcDateOverrides, runId, setRunId, draftRunId,
    priorityConfig, setPriorityConfig, workingHoursPerDay, setWorkingHoursPerDay,
    capChoices, setCapChoices, importedTargetQty, setImportedTargetQty,
    isLoadedFromServer, step2Loading, setStep2Loading,
    drawerOpen, setDrawerOpen,
    runStatus, runDone, gaHasRun, dispatchBlocked,
    selectedRegularIds, selectedGcIds, allSelectedIds, knownOrdersMap,
    canNavigateTo, canAdvanceFromCurrent,
    handleNext, handlePrev, goStep, discardDraft, saveStepState,
  };
}
