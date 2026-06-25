import { Loader2, Eye } from "lucide-react";

// ─── Custom Hook & Steps ─────────────────────────────────────────────────────
import { useWizardState } from "./hooks/useWizardState";

// ─── Components ──────────────────────────────────────────────────────────────
import WizardStepper from "./components/WizardStepper";
import GAConfigHeader from "./components/GAConfigHeader";
import SubPlannerTriggerBadge from "../../components/dispatch/SubPlannerTriggerBadge";
import SubPlannerDrawer from "../../components/dispatch/SubPlannerDrawer";

import Step1Orders      from "./steps/Step1Orders";
import Step2Capacity    from "./steps/Step2Capacity";
import Step3MaterialETA from "./steps/Step3MaterialETA";
import Step4GCDates     from "./steps/Step4GCDates";
import Step5RunGA       from "./steps/Step5RunGA";
import Step6Edit        from "./steps/Step6Edit";
import Step7Confirm     from "./steps/Step7Confirm";

const DISPATCH_STEPS = { 1: 2, 2: 3, 3: 4, 5: 6 };

export default function GAConfigPage() {
  const {
    navigate, isSub, resumeId,
    step, completedUpTo, label, setLabel,
    regularOrders, setRegularOrders, gcOrders, setGcOrders,
    excludeLines, materialEtaOverrides, setMaterialEtaOverrides,
    gcDateOverrides, setGcDateOverrides, runId, setRunId, draftRunId,
    priorityConfig, setPriorityConfig, workingHoursPerDay, setWorkingHoursPerDay,
    capChoices, setCapChoices, importedTargetQty, setImportedTargetQty,
    isLoadedFromServer, step2Loading, setStep2Loading,
    drawerOpen, setDrawerOpen,
    runStatus, gaHasRun, dispatchBlocked,
    selectedRegularIds, selectedGcIds, allSelectedIds, knownOrdersMap,
    canNavigateTo, canAdvanceFromCurrent,
    handleNext, handlePrev, goStep, discardDraft, saveStepState,
  } = useWizardState();

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
      {/* Topbar / Header */}
      <GAConfigHeader
        step={step}
        resumeId={resumeId}
        onBack={() => {
          saveStepState(step)
            .catch(err => console.error("Failed to save step state:", err))
            .finally(() => navigate("/runs"));
        }}
        onDiscard={discardDraft}
      />

      {/* Sub-planner read-only banner */}
      {isSub && (
        <div className="flex items-center gap-2 px-5 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-800 shrink-0">
          <Eye size={14} className="shrink-0" />
          <span><strong>Chế độ xem:</strong> Sub-Planner chỉ có thể xem cấu hình kế hoạch. Công việc cần xác nhận được phân công qua <a href="/my-tasks" className="underline font-semibold">Công việc của tôi</a>.</span>
        </div>
      )}

      {/* Step indicator + Sub-Planner trigger button */}
      <WizardStepper
        step={step}
        completedUpTo={completedUpTo}
        canNavigateTo={canNavigateTo}
        runStatus={runStatus}
        gaHasRun={gaHasRun}
        onGoStep={goStep}
        rightSlot={DISPATCH_STEPS[step] && !isSub ? (
          <SubPlannerTriggerBadge
            dispatchStep={DISPATCH_STEPS[step]}
            runId={step === 5 ? runId : draftRunId}
            onClick={() => setDrawerOpen(true)}
          />
        ) : null}
      />

      {/* Sub-Planner slide-in drawer */}
      {DISPATCH_STEPS[step] && !isSub && (
        <SubPlannerDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          dispatchStep={DISPATCH_STEPS[step]}
          runId={step === 5 ? runId : draftRunId}
        />
      )}

      {/* Step content */}
      <div className="flex-1 min-h-0 relative bg-gray-50">
        <div className="absolute inset-0 p-5 overflow-hidden flex flex-col">
          <>
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
                dispatchBlocked={dispatchBlocked}
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
              <Step6Edit runId={runId} draftRunId={draftRunId} dispatchBlocked={dispatchBlocked} {...stepProps} />
            )}
            {step === 6 && (
              <Step7Confirm runId={runId} draftRunId={draftRunId} label={label} onPrev={handlePrev} />
            )}
          </>
        </div>
      </div>
    </div>
  );
}
