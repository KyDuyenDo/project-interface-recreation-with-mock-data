import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

// ─── Custom Hooks ────────────────────────────────────────────────────────────
import {
  useRunDetailData,
  useRunDetailWizardData,
  useRunDetailSubPlanner,
  useSubPlannerEditing,
} from "./hooks/useRunDetailData";

// ─── Components ──────────────────────────────────────────────────────────────
import CompletedStepper from "./components/CompletedStepper";
import CompletedRunView from "./components/CompletedRunView";
import RunDetailHeader from "./components/RunDetailHeader";
import SuccessOverlay from "./components/SuccessOverlay";
import ErrorDrawer from "./components/ErrorDrawer";
import LockedStepView from "./components/LockedStepView";
import AcceptRunDialog from "./components/AcceptRunDialog";
import SubStep2Panel from "../sub-planner/SubStep2Panel";
import SubPlannerTriggerBadge from "../../components/dispatch/SubPlannerTriggerBadge";
import SubPlannerDrawer from "../../components/dispatch/SubPlannerDrawer";

// ─── Steps ───────────────────────────────────────────────────────────────────
import Step1Orders      from "../ga-config/steps/Step1Orders";
import Step2Capacity    from "../ga-config/steps/Step2Capacity";
import Step3MaterialETA from "../ga-config/steps/Step3MaterialETA";
import Step4GCDates     from "../ga-config/steps/Step4GCDates";
import Step6Edit        from "../ga-config/steps/Step6Edit";
import RunHistoryDetailPage from "./RunHistoryDetailPage";

import { usePublishLogDetails } from "../../hooks";

const NOOP = () => {};
const WIZARD_TABS = [0, 1, 2, 3];
const DISPATCH_STEPS = { 1: 2, 5: 6 };

export default function RunDetailPage() {
  const { runId: runIdStr } = useParams();
  const runId = runIdStr ? parseInt(runIdStr, 10) : null;
  const navigate = useNavigate();

  const [step, setStep] = useState(4); // Default to Step 5 (Results summary)
  const [showCompare, setShowCompare] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState(null);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [subDrawerOpen, setSubDrawerOpen] = useState(false);
  const [activeLogId, setActiveLogId] = useState(null);

  // ─── Data & State Hooks ────────────────────────────────────────────────────
  const {
    run, activeRun, isLive, warnings, orders,
    verifyRunMutation, publishLogs, refetchPublishLogs, isLocked,
    isMain, isSub, myLines, user, queryClient,
  } = useRunDetailData(runId);

  const {
    wizardLoading, wEta, wGcDates,
    regularOrders, gcOrders, selectedRegularIds, selectedGcIds, allSelectedIds,
    knownOrdersMap, priorityConfig, capChoices, workingHoursPerDay,
    importedTargetQty, materialEtaOvr, gcDateOvr,
  } = useRunDetailWizardData(runId, step);

  const {
    isStep6Dispatched, myOrderIds, isStepLocked,
  } = useRunDetailSubPlanner(runId, run, isSub, user);

  const {
    localEtaOverrides, localGcDateOverrides,
    handleSaveMaterialEtas, handleSaveGcDates,
  } = useSubPlannerEditing(runId, wEta, wGcDates);

  // Log details query
  const { data: logDetails, isLoading: isDetailsLoading } = usePublishLogDetails(activeLogId);

  // Auto-show success overlay when status changes to active
  useEffect(() => {
    const latest = publishLogs?.[0];
    if (latest?.status === "success" && run?.lifecycle_status === "active") {
      setShowSuccessOverlay(true);
    }
  }, [publishLogs, run?.lifecycle_status]);

  const handleStartVerification = async () => {
    try {
      const log = await verifyRunMutation.mutateAsync(runId);
      setActiveLogId(log.id);
    } catch (err) {
      console.error("Verification failed:", err);
    }
  };

  if (!run) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <Loader2 size={28} className="animate-spin text-blue-500" />
      </div>
    );
  }

  const isWizardStep = WIZARD_TABS.includes(step);

  return (
    <div className="flex flex-col h-full relative">
      <RunDetailHeader
        run={run}
        isLive={isLive}
        isMain={isMain}
        verifyRunMutation={verifyRunMutation}
        onNavigateBack={() => navigate("/runs")}
        onShowCompare={() => setShowCompare(true)}
        onAcceptRun={() => setAcceptTarget(run)}
        onStartVerification={handleStartVerification}
      />

      <CompletedStepper
        step={step}
        onGoStep={setStep}
        isStepLocked={isStepLocked}
        isSub={isSub}
        rightSlot={
          !isSub && DISPATCH_STEPS[step] ? (
            <SubPlannerTriggerBadge
              dispatchStep={DISPATCH_STEPS[step]}
              runId={runId}
              onClick={() => setSubDrawerOpen(true)}
            />
          ) : null
        }
      />

      {!isSub && DISPATCH_STEPS[step] && (
        <SubPlannerDrawer
          open={subDrawerOpen}
          onClose={() => setSubDrawerOpen(false)}
          dispatchStep={DISPATCH_STEPS[step]}
          runId={runId}
        />
      )}

      <div className="flex-1 min-h-0 relative bg-gray-50">
        {isLocked && (
          <div className="absolute inset-0 bg-white/75 backdrop-blur-[1px] z-40 flex flex-col items-center justify-center gap-4">
            <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 flex flex-col items-center text-center max-w-sm">
              <Loader2 size={40} className="animate-spin text-blue-600 mb-4" />
              <h3 className="font-bold text-gray-900 text-lg mb-1">Đang tiến hành đối soát</h3>
              <p className="text-gray-500 text-xs mb-4">
                Hệ thống đang tự động kiểm tra đối chiếu danh sách đơn hàng trong bản kế hoạch với dữ liệu thực tế trên ERP PDSCH...
              </p>
              <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full animate-pulse" style={{ width: "100%" }} />
              </div>
            </div>
          </div>
        )}

        {isWizardStep && (
          <div className="absolute inset-0 p-5 overflow-hidden flex flex-col">
            {wizardLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 size={28} className="animate-spin text-blue-500" />
                <span className="ml-2 text-sm text-gray-500">Đang tải cấu hình…</span>
              </div>
            ) : isStepLocked(step) ? (
              <LockedStepView stepIndex={step} />
            ) : (
              <>
                {step === 0 && (
                  <Step1Orders
                    regularOrders={regularOrders}
                    setRegularOrders={NOOP}
                    gcOrders={gcOrders}
                    setGcOrders={NOOP}
                    onPrev={NOOP}
                    onNext={() => setStep(1)}
                    readOnly
                  />
                )}
                {step === 1 && (
                  isSub ? (
                    <div className="flex-1 min-h-0 flex flex-col">
                      <SubStep2Panel
                        runId={runId}
                        myLines={myLines}
                        dispatchStep={2}
                      />
                    </div>
                  ) : (
                    <Step2Capacity
                      selectedRegularIds={selectedRegularIds}
                      selectedGcIds={selectedGcIds}
                      knownOrdersMap={knownOrdersMap}
                      priorityConfig={priorityConfig}
                      onPriorityConfigChange={NOOP}
                      workingHoursPerDay={workingHoursPerDay}
                      onWorkingHoursChange={NOOP}
                      capChoices={capChoices}
                      onCapChoicesChange={NOOP}
                      importedTargetQty={importedTargetQty}
                      onImportedTargetQtyChange={NOOP}
                      draftRunId={null}
                      onPrev={() => setStep(0)}
                      onNext={() => setStep(2)}
                      readOnly
                    />
                  )
                )}
                {step === 2 && (
                  <Step3MaterialETA
                    selectedIds={isSub && myOrderIds.size > 0 ? myOrderIds : allSelectedIds}
                    materialEtaOverrides={isSub ? localEtaOverrides : materialEtaOvr}
                    setMaterialEtaOverrides={isSub ? handleSaveMaterialEtas : NOOP}
                    onPrev={() => setStep(1)}
                    onNext={() => setStep(3)}
                    readOnly={isSub ? (run?.lifecycle_status === "active" || (run?.wizard_step ?? 0) < 2) : true}
                  />
                )}
                {step === 3 && (
                  <Step4GCDates
                    gcOrders={isSub && myOrderIds.size > 0 ? gcOrders.filter(o => myOrderIds.has(o.order_id)) : gcOrders}
                    gcDateOverrides={isSub ? localGcDateOverrides : gcDateOvr}
                    setGcDateOverrides={isSub ? handleSaveGcDates : NOOP}
                    onPrev={() => setStep(2)}
                    onNext={() => setStep(4)}
                    readOnly={isSub ? (run?.lifecycle_status === "active" || (run?.wizard_step ?? 0) < 3) : true}
                    isSub={isSub}
                  />
                )}
              </>
            )}
          </div>
        )}

        {step === 4 && (
          isStepLocked(4) ? (
            <LockedStepView stepIndex={4} />
          ) : (
            <CompletedRunView
              run={run}
              warnings={warnings}
              publishLogs={publishLogs}
              onShowLogDetails={(id) => { setActiveLogId(id); setDrawerOpen(true); }}
              onRetryVerification={handleStartVerification}
              isMain={isMain}
            />
          )
        )}

        {step === 5 && (
          isStepLocked(5) ? (
            <LockedStepView stepIndex={5} />
          ) : (
            <div className="absolute inset-0 p-5 overflow-hidden flex flex-col">
              <Step6Edit
                runId={runId}
                onPrev={() => setStep(4)}
                onNext={NOOP}
                dispatchBlocked={false}
                lineFilter={isSub && myLines.length > 0 ? myLines : null}
                viewOnly={isSub ? (run?.lifecycle_status === "active" || (run?.wizard_step ?? 0) < 5 || !isStep6Dispatched) : false}
              />
            </div>
          )
        )}
      </div>

      {showSuccessOverlay && (
        <SuccessOverlay onClose={() => setShowSuccessOverlay(false)} />
      )}

      {drawerOpen && (
        <ErrorDrawer
          activeLogId={activeLogId}
          logDetails={logDetails}
          isDetailsLoading={isDetailsLoading}
          onClose={() => setDrawerOpen(false)}
          onRetry={() => { setDrawerOpen(false); handleStartVerification(); }}
        />
      )}

      {acceptTarget && (
        <AcceptRunDialog
          run={acceptTarget}
          onClose={() => setAcceptTarget(null)}
          onAccept={() => setAcceptTarget(null)}
        />
      )}

      {showCompare && (
        <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col">
          <RunHistoryDetailPage
            runId={runId}
            compareRunId={activeRun?.id}
            onBack={() => setShowCompare(false)}
          />
        </div>
      )}
    </div>
  );
}
