import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, X, Check, Lock, Eye, Loader2 } from "lucide-react";
import { useRunStatus, useRunDetail } from "../../hooks/useRuns";
import { wizardStateApi, runsApi } from "../../api";
import { usePermissions } from "../../hooks/usePermissions";


import Step1Orders      from "./steps/Step1Orders";
import Step2Capacity    from "./steps/Step2Capacity";
import Step3MaterialETA from "./steps/Step3MaterialETA";
import Step4GCDates     from "./steps/Step4GCDates";
import Step5RunGA       from "./steps/Step5RunGA";
import Step6Edit        from "./steps/Step6Edit";
import Step7Confirm     from "./steps/Step7Confirm";

// ─── Wizard metadata ──────────────────────────────────────────────────────────

const STEPS = [
  { key: "orders",   title: "Chọn đơn",   subtitle: "Nhập mã hoặc Excel" },
  { key: "capacity", title: "Ưu tiên",    subtitle: "Chuyền theo model" },
  { key: "mat",      title: "NVL về",     subtitle: "Ngày vật liệu" },
  { key: "gc_dates", title: "Ngày GC",    subtitle: "Thu gia công" },
  { key: "run",      title: "Chạy lịch",  subtitle: "TailFollow + ILS" },
  { key: "edit",     title: "Chỉnh sửa",  subtitle: "Review + tinh chỉnh" },
  { key: "confirm",  title: "Xác nhận",   subtitle: "Đẩy vào kế hoạch" },
];

// ─── Step indicator ───────────────────────────────────────────────────────────

function WizardStepper({ step, completedUpTo, canNavigateTo, runStatus, gaHasRun, onGoStep }) {
  // "locked" = truly inaccessible (GA running, or prerequisite not met)
  // "readOnly" = accessible but content is view-only (GA completed, steps 0-3)
  const isReadOnly = (i) => gaHasRun && i < 4;
  const isLocked = (i) => {
    if (runStatus === "running" && i < 4) return true;
    return !canNavigateTo(i);
  };

  return (
    <div className="flex border-b border-gray-200 bg-white shrink-0 overflow-x-auto">
      {STEPS.map((s, i) => {
        const isCompleted = i <= completedUpTo;
        const isCurrent   = i === step;
        const locked      = isLocked(i);
        const readOnly    = isReadOnly(i);

        return (
          <button
            key={s.key}
            disabled={locked}
            onClick={() => !locked && onGoStep(i)}
            className={[
              "flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors min-w-0 whitespace-nowrap",
              isCurrent
                ? "border-blue-600 text-blue-700 bg-blue-50/50"
                : readOnly
                  ? "border-amber-300 text-amber-700 hover:bg-amber-50 cursor-pointer"
                  : isCompleted && !locked
                    ? "border-green-400 text-green-700 hover:bg-gray-50 cursor-pointer"
                    : locked
                      ? "border-transparent text-gray-300 cursor-not-allowed"
                      : "border-transparent text-gray-400 cursor-not-allowed",
            ].join(" ")}>
            <div className={[
              "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
              isCurrent
                ? "bg-blue-600 text-white"
                : readOnly
                  ? "bg-amber-100 text-amber-700"
                  : isCompleted
                    ? "bg-green-500 text-white"
                    : "bg-gray-100 text-gray-400",
            ].join(" ")}>
              {readOnly && !isCurrent ? <Eye size={10} /> : isCompleted && !isCurrent ? <Check size={12} /> : i + 1}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-medium leading-tight">{s.title}</div>
              <div className="text-[10px] leading-tight opacity-60">{s.subtitle}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export default function GAConfigPage() {
  const navigate      = useNavigate();
  const queryClient   = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isSub } = usePermissions();
  const resumeId = searchParams.get("resume") ? parseInt(searchParams.get("resume"), 10) : null;

  // Wizard state
  const [step,                setStep]                = useState(() => {
    const s = parseInt(searchParams.get("step"), 10);
    return isNaN(s) ? 0 : Math.min(Math.max(s, 0), 6);
  });
  const [completedUpTo,       setCompletedUpTo]       = useState(-1);
  const [label,               setLabel]               = useState("");

  // Orders: two separate panels
  const [regularOrders, setRegularOrders] = useState([]); // [{order_id, order:{...}}]
  const [gcOrders,      setGcOrders]      = useState([]); // [{order_id, order:{...}}]

  const [excludeLines] = useState(new Set());
  const [materialEtaOverrides, setMaterialEtaOverrides] = useState({});
  const [gcDateOverrides,      setGcDateOverrides]      = useState({});
  const [runId,               setRunId]               = useState(null);
  const [draftRunId,          setDraftRunId]          = useState(null);
  const [priorityConfig,      setPriorityConfig]      = useState({});
  const [workingHoursPerDay,  setWorkingHoursPerDay]  = useState(8);
  const [capChoices,          setCapChoices]          = useState({ regular: {}, gc: {}, noHistRegular: {}, noHistGc: {} });
  const [importedTargetQty,   setImportedTargetQty]   = useState({});

  const [isLoadedFromServer, setIsLoadedFromServer] = useState(false);
  const [step2Loading,       setStep2Loading]       = useState(false);

  // Sync step → URL so each step has its own URL (browser history, refresh-safe)
  useEffect(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set("step", step);
      return next;
    }, { replace: true });
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resume: load run info when ?resume=id is present
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
      // If URL has a valid step >= jumpTo, honour it (e.g. user bookmarked step 6)
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
  }, [resumeId, resumeRunData?.id]);

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
      // Also load default priorities so Step 2 has pre-populated assignments
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
      // Non-fatal: wizard works without persistence if draft creation fails
    });
  }, [resumeId]);

  // ── Debounced auto-save effects ──────────────────────────────────────────
  // Step 2 (capacity/priority/new-model-targets) is handled by Step2Capacity's
  // own 400ms auto-save. Only auto-save the steps that have no child component save.

  // Save Step 1 Orders
  useEffect(() => {
    if (!isLoadedFromServer || !draftRunId) return;
    const timer = setTimeout(() => {
      wizardStateApi.putOrders(draftRunId, { regular: regularOrders, gc: gcOrders })
        .catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [draftRunId, regularOrders, gcOrders, isLoadedFromServer]);

  // Save Step 3 Material ETA Overrides
  useEffect(() => {
    if (!isLoadedFromServer || !draftRunId) return;
    const timer = setTimeout(() => {
      wizardStateApi.putMaterialEtas(draftRunId, { overrides: materialEtaOverrides })
        .catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [draftRunId, materialEtaOverrides, isLoadedFromServer]);

  // Save Step 4 GC Date Overrides
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

  // Derived sets for downstream steps
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

  // Derived knownOrdersMap (article/die/style/tool per order_id)
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
  const gaHasRun  = runId != null; // GA was triggered (may still be running)

  // Persist wizard step when it changes
  useEffect(() => {
    if (!draftRunId) return;
    wizardStateApi.saveWizardStep(draftRunId, step).catch(() => {});
  }, [draftRunId, step]);

  // ── Step navigation constraints ────────────────────────────────────────────
  function canNavigateTo(target) {
    if (step === 1 && step2Loading && target > 1) return false;
    const maxReachable = completedUpTo + 1;
    // While GA is actively running, block navigation to steps 0-3
    if (runStatus === "running" && target < 4) return false;
    // After GA completes, steps 0-3 are viewable (read-only) — allow navigation
    if (gaHasRun && target < 4) return true;
    if (target <= step) return true;
    if (target > maxReachable) return false;
    if (target >= 5 && !runDone) return false;  // edit+confirm require run done
    return true;
  }

  // Step 4 = RunGA — must wait for run to finish before advancing to edit/confirm
  const canAdvanceFromCurrent = (step !== 4 || runDone) && !(step === 1 && step2Loading);

  function handleNext() {
    if (!canAdvanceFromCurrent) return;
    saveStepState(step).catch(err => console.error("Failed to save step state:", err));
    setCompletedUpTo(prev => Math.max(prev, step));
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  }

  function handlePrev() {
    if (step > 0) {
      saveStepState(step).catch(err => console.error("Failed to save step state:", err));
      setStep(s => s - 1);
    }
  }

  function goStep(target) {
    if (canNavigateTo(target)) {
      saveStepState(step).catch(err => console.error("Failed to save step state:", err));
      setStep(target);
    }
  }

  async function discardDraft() {
    if (!window.confirm("Hủy bỏ kế hoạch nháp này? Mọi thao tác đã thực hiện sẽ bị mất.")) return;
    // Delete both the wizard draft run and the GA run (if different).
    // Cascade on FK deletes all related wizard data automatically.
    const toDelete = [...new Set([draftRunId, runId].filter(Boolean))];
    await Promise.allSettled(toDelete.map(id => runsApi.delete(id)));
    // Also close any other stale wizard sessions and clear the card cache.
    await wizardStateApi.closeStaleWizardSessions().catch(() => {});
    queryClient.setQueryData(["wizard-in-progress"], null);
    queryClient.invalidateQueries({ queryKey: ["wizard-in-progress"] });
    navigate("/runs");
  }

  // ── Step component map ─────────────────────────────────────────────────────
  const stepProps = {
    onPrev: handlePrev,
    onNext: handleNext,
  };

  if (resumeId && !isLoadedFromServer) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50">
        <Loader2 size={36} className="animate-spin text-blue-500 mb-3" />
        <div className="text-sm font-semibold text-gray-700">Đang tải cấu hình kế hoạch...</div>
        <div className="text-xs text-gray-400 mt-1">Vui lòng chờ trong giây lát</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <header className="flex items-center h-14 px-5 border-b border-gray-200 bg-white shrink-0 gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <button
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-transparent text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
              onClick={() => {
                saveStepState(step)
                  .catch(err => console.error("Failed to save step state:", err))
                  .finally(() => navigate("/runs"));
              }}>
              <ArrowLeft size={13} /> Lập lịch
            </button>

            {resumeId ? "Tiếp tục kế hoạch" : "Kế hoạch GA mới"}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            Bước {step + 1}/{STEPS.length} · {STEPS[step].title} · TailFollow + ILS
          </div>
        </div>
        <div className="flex-1" />
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />Nháp
        </span>
        <button
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-transparent text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          onClick={discardDraft}>
          <X size={13} /> Hủy nháp
        </button>
      </header>

      {/* Sub-planner read-only banner */}
      {isSub && (
        <div className="flex items-center gap-2 px-5 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-800 shrink-0">
          <Eye size={14} className="shrink-0" />
          <span><strong>Chế độ xem:</strong> Sub-Planner chỉ có thể xem cấu hình kế hoạch. Công việc cần xác nhận được phân công qua <a href="/my-tasks" className="underline font-semibold">Công việc của tôi</a>.</span>
        </div>
      )}

      {/* Step indicator */}
      <WizardStepper
        step={step}
        completedUpTo={completedUpTo}
        canNavigateTo={canNavigateTo}
        runStatus={runStatus}
        gaHasRun={gaHasRun}
        onGoStep={goStep}
      />

      {/* Step content */}
      <div className="flex-1 min-h-0 relative bg-gray-50">
        <div className="absolute inset-0 p-5 overflow-hidden flex flex-col">
        {step === 0 && (
          <Step1Orders
            regularOrders={regularOrders}
            setRegularOrders={setRegularOrders}
            gcOrders={gcOrders}
            setGcOrders={setGcOrders}
            draftRunId={draftRunId}
            readOnly={gaHasRun}
            {...stepProps}
          />
        )}
        {step === 1 && (
          <Step2Capacity
            selectedRegularIds={selectedRegularIds}
            selectedGcIds={selectedGcIds}
            knownOrdersMap={knownOrdersMap}
            priorityConfig={priorityConfig}
            onPriorityConfigChange={setPriorityConfig}
            workingHoursPerDay={workingHoursPerDay}
            onWorkingHoursChange={setWorkingHoursPerDay}
            capChoices={capChoices}
            onCapChoicesChange={setCapChoices}
            importedTargetQty={importedTargetQty}
            onImportedTargetQtyChange={setImportedTargetQty}
            draftRunId={draftRunId}
            onLoadingChange={setStep2Loading}
            readOnly={gaHasRun}
            {...stepProps}
          />
        )}
        {step === 2 && (
          <Step3MaterialETA
            selectedIds={allSelectedIds}
            materialEtaOverrides={materialEtaOverrides}
            setMaterialEtaOverrides={setMaterialEtaOverrides}
            draftRunId={draftRunId}
            readOnly={gaHasRun}
            {...stepProps}
          />
        )}
        {step === 3 && (
          <Step4GCDates
            gcOrders={gcOrders}
            gcDateOverrides={gcDateOverrides}
            setGcDateOverrides={setGcDateOverrides}
            draftRunId={draftRunId}
            readOnly={gaHasRun}
            {...stepProps}
          />
        )}
        {step === 4 && (
          <Step5RunGA
            selectedIds={allSelectedIds}
            excludeLines={excludeLines}
            materialEtaOverrides={materialEtaOverrides}
            gcDateOverrides={gcDateOverrides}
            priorityConfig={priorityConfig}
            workingHoursPerDay={workingHoursPerDay}
            label={label}
            setLabel={setLabel}
            runId={runId}
            setRunId={setRunId}
            draftRunId={draftRunId}
            canAdvance={canAdvanceFromCurrent}
            {...stepProps}
          />
        )}
        {step === 5 && (
          <Step6Edit runId={runId} draftRunId={draftRunId} {...stepProps} />
        )}
        {step === 6 && (
          <Step7Confirm runId={runId} draftRunId={draftRunId} label={label} onPrev={handlePrev} />
        )}
        </div>
      </div>
    </div>
  );
}
