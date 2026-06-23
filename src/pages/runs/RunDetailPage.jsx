import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Check, AlertTriangle, Loader2, CheckCircle, RefreshCw, X } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  useRunDetail,
  useRunStatus,
  useRunWarnings,
  useRunOutputOrders,
  useVerifyRun,
  usePublishLogs,
  usePublishLogDetails,
  useActiveRun,
} from "../../hooks";
import { wizardStateApi } from "../../api";
import { usePermissions } from "../../hooks/usePermissions";
import StatusBadge    from "./components/StatusBadge";
import AcceptRunDialog from "./components/AcceptRunDialog";
import Step6Edit      from "../ga-config/steps/Step6Edit";
import Step1Orders    from "../ga-config/steps/Step1Orders";
import Step2Capacity  from "../ga-config/steps/Step2Capacity";
import Step3MaterialETA from "../ga-config/steps/Step3MaterialETA";
import Step4GCDates   from "../ga-config/steps/Step4GCDates";
import RunHistoryDetailPage from "./RunHistoryDetailPage";

const BTN = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const PIPELINE_STEPS = [
  "ERP sync", "Năng lực chuyền", "TailFollowAllocator",
  "ILS Optimizer", "Phân bổ size", "Lưu kết quả",
];

const WIZARD_TABS = ["orders", "capacity", "eta", "gcdates"];

const NOOP = () => {};

export default function RunDetailPage() {
  const { runId: runIdParam, tab: tabParam } = useParams();
  const runId   = runIdParam ? parseInt(runIdParam, 10) : null;
  const navigate = useNavigate();

  const validTabs = ["overview", "warnings", "orders", "capacity", "eta", "gcdates", "step6", "params"];
  const [tab, setTabState] = useState(() => validTabs.includes(tabParam) ? tabParam : "overview");

  // Keep tab in sync when browser navigates (back/forward)
  useEffect(() => {
    if (tabParam && validTabs.includes(tabParam) && tabParam !== tab) {
      setTabState(tabParam);
    }
  }, [tabParam]);

  const setTab = (newTab) => {
    setTabState(newTab);
    navigate(`/runs/${runId}/${newTab}`, { replace: true });
  };

  const [acceptTarget,     setAcceptTarget]     = useState(null);
  const [showCompare,      setShowCompare]       = useState(false);
  const [activeLogId,      setActiveLogId]       = useState(null);
  const [drawerOpen,       setDrawerOpen]        = useState(false);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);

  const queryClient = useQueryClient();
  const { data: activeRun } = useActiveRun();
  const { data: run }          = useRunDetail(runId);
  const isLive                 = run?.status === "running" || run?.status === "pending";
  const { data: statusData }   = useRunStatus(runId, isLive);
  const { data: warningsData } = useRunWarnings(runId);
  const { data: ordersData }   = useRunOutputOrders(runId, run?.status !== "failed" ? { page_size: 1000 } : null);

  const warnings  = warningsData?.warnings || [];
  const orders    = ordersData?.orders ?? ordersData?.items ?? [];
  const lateCount = useMemo(() => orders.filter(o => o.is_late || (o.crd && o.go_end > o.crd)).length, [orders]);

  const availableTabs = useMemo(() => {
    const base = [
      { value: "overview",  label: "Tổng quan" },
      { value: "warnings",  label: "Cảnh báo" },
      { value: "orders",    label: "Đơn hàng" },
      { value: "capacity",  label: "Năng lực" },
      { value: "eta",       label: "NVL về" },
      { value: "gcdates",   label: "Ngày GC" },
    ];
    if (run?.status !== "failed") base.push({ value: "step6", label: "Chỉnh sửa lịch" });
    base.push({ value: "params", label: "Thông số" });
    return base;
  }, [run?.status]);

  // ── Wizard data ────────────────────────────────────────────────────────────
  const wizardEnabled = WIZARD_TABS.includes(tab) && !!runId;
  const { data: wOrders,   isLoading: wOrdersLoading }   = useQuery({ queryKey: ["wiz-orders",   runId], queryFn: () => wizardStateApi.getOrders(runId),          enabled: wizardEnabled, staleTime: 60_000 });
  const { data: wPrio,     isLoading: wPrioLoading }     = useQuery({ queryKey: ["wiz-prio",     runId], queryFn: () => wizardStateApi.getPriorities(runId),      enabled: wizardEnabled, staleTime: 60_000 });
  const { data: wCap,      isLoading: wCapLoading }      = useQuery({ queryKey: ["wiz-cap",      runId], queryFn: () => wizardStateApi.getCapacities(runId),      enabled: wizardEnabled, staleTime: 60_000 });
  const { data: wNewModel, isLoading: wNewModelLoading } = useQuery({ queryKey: ["wiz-newmodel", runId], queryFn: () => wizardStateApi.getNewModelTargets(runId), enabled: wizardEnabled, staleTime: 60_000 });
  const { data: wEta,      isLoading: wEtaLoading }      = useQuery({ queryKey: ["wiz-eta",      runId], queryFn: () => wizardStateApi.getMaterialEtas(runId),    enabled: wizardEnabled, staleTime: 60_000 });
  const { data: wGcDates,  isLoading: wGcLoading }       = useQuery({ queryKey: ["wiz-gc",       runId], queryFn: () => wizardStateApi.getGcDates(runId),         enabled: wizardEnabled, staleTime: 60_000 });
  const wizardLoading = wOrdersLoading || wPrioLoading || wCapLoading || wNewModelLoading || wEtaLoading || wGcLoading;

  // ── Derived step props ─────────────────────────────────────────────────────
  const regularOrders  = useMemo(() => wOrders?.regular ?? [], [wOrders]);
  const gcOrders       = useMemo(() => wOrders?.gc      ?? [], [wOrders]);

  const selectedRegularIds = useMemo(
    () => new Set((wOrders?.regular ?? []).map(o => o.order_id)),
    [wOrders],
  );
  const selectedGcIds = useMemo(
    () => new Set((wOrders?.gc ?? []).map(o => o.order_id)),
    [wOrders],
  );
  const allSelectedIds = useMemo(
    () => new Set([...selectedRegularIds, ...selectedGcIds]),
    [selectedRegularIds, selectedGcIds],
  );
  const knownOrdersMap = useMemo(() => {
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

  // ── Verification ──────────────────────────────────────────────────────────
  const verifyRunMutation = useVerifyRun();
  const { data: publishLogs, refetch: refetchPublishLogs } = usePublishLogs(runId);
  const { data: logDetails, isLoading: isDetailsLoading }  = usePublishLogDetails(activeLogId);

  useEffect(() => {
    if (run?.lifecycle_status === "verifying") {
      const id = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["run", runId] });
        refetchPublishLogs();
      }, 4000);
      return () => {
        clearInterval(id);
        // Fetch once more so logs are fresh after verifying ends
        refetchPublishLogs();
      };
    }
  }, [run?.lifecycle_status, runId, queryClient, refetchPublishLogs]);

  useEffect(() => {
    const latest = publishLogs?.[0];
    if (latest?.status === "success" && run?.lifecycle_status === "active") {
      setShowSuccessOverlay(true);
    }
  }, [publishLogs, run?.lifecycle_status]);

  if (!run) return (
    <div className="flex flex-col h-full items-center justify-center">
      <Loader2 size={28} className="animate-spin text-blue-500" />
    </div>
  );

  const handleStartVerification = async () => {
    try {
      const log = await verifyRunMutation.mutateAsync(runId);
      setActiveLogId(log.id);
    } catch (err) {
      console.error("Verification failed:", err);
    }
  };

  const { isMain } = usePermissions();
  const liveStep    = statusData?.current_step ?? run.step_progress ?? 0;
  const liveStepName = statusData?.step_name ?? run.step_name ?? "—";
  const progressPct  = statusData?.progress_pct ?? (run.status === "done" ? 100 : 0);
  const isLocked     = run.lifecycle_status === "verifying";

  const isWizardTab = WIZARD_TABS.includes(tab);

  return (
    <div className="flex flex-col h-full relative">

      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center h-14 px-5 border-b border-gray-200 bg-white shrink-0 gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <button
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-transparent text-xs text-gray-500 hover:bg-gray-100"
              onClick={() => navigate("/runs")}>
              <ArrowLeft size={13} /> Lập lịch
            </button>
            #{run.id} · {run.label}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            Tạo {run.started_at?.slice(0, 16).replace("T", " ")} · {run.scheduled_count ?? "—"} đơn
          </div>
        </div>
        <div className="flex-1" />
        <StatusBadge run={run} />
        {isLive && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />polling
          </span>
        )}

        {isMain && run.lifecycle_status === "draft" && run.status === "done" && (
          <>
            <button
              className={`${BTN} bg-white text-blue-600 border-blue-200 hover:bg-blue-50 shadow-sm`}
              onClick={() => setShowCompare(true)}
            >
              <RefreshCw size={14} /> Xem diff so với hiện hành
            </button>
            <button className={`${BTN} bg-blue-600 text-white border-blue-600 hover:bg-blue-700`} onClick={() => setAcceptTarget(run)}>
              <Check size={14} /> Accept lịch
            </button>
          </>
        )}

        {isMain && run.lifecycle_status === "accepted" && (
          <button
            className={`${BTN} bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-sm`}
            onClick={handleStartVerification}
            disabled={verifyRunMutation.isPending}
          >
            {verifyRunMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Verify ERP Sync (Đối soát)
          </button>
        )}

        {run.lifecycle_status === "verifying" && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-yellow-200 text-sm font-medium bg-yellow-50 text-yellow-800 animate-pulse">
            <Loader2 size={14} className="animate-spin" /> Đang đối soát ERP...
          </span>
        )}

        {run.lifecycle_status === "active" && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
            <CheckCircle size={12} className="mr-1" /> Active · Đã đồng bộ ERP
          </span>
        )}

        {run.lifecycle_status === "archived" && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
            Lưu trữ (Archived)
          </span>
        )}

        <button className={`${BTN} bg-white text-gray-700 border-gray-200 hover:bg-gray-50`}>
          <Download size={14} /> Export
        </button>
      </header>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-gray-200 bg-white px-5 shrink-0">
        {availableTabs.map(t => (
          <button
            key={t.value}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
              ${tab === t.value ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            onClick={() => setTab(t.value)}>
            {t.label}
            {t.value === "warnings" && warnings.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">{warnings.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative bg-gray-50">

        {/* Verifying overlay */}
        {isLocked && (
          <div className="absolute inset-0 bg-white/75 backdrop-blur-[1px] z-40 flex flex-col items-center justify-center gap-4">
            <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 flex flex-col items-center text-center max-w-sm">
              <Loader2 size={40} className="animate-spin text-blue-600 mb-4 animate-duration-1000" />
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

        {/* ── Wizard step tabs: use absolute inset layout matching GAConfigPage ── */}
        {isWizardTab && (
          <div className="absolute inset-0 p-5 overflow-hidden flex flex-col">
            {wizardLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 size={28} className="animate-spin text-blue-500" />
                <span className="ml-2 text-sm text-gray-500">Đang tải cấu hình…</span>
              </div>
            ) : (
              <>
                {tab === "orders" && (
                  <Step1Orders
                    regularOrders={regularOrders}
                    setRegularOrders={NOOP}
                    gcOrders={gcOrders}
                    setGcOrders={NOOP}
                    onPrev={NOOP}
                    onNext={() => setTab("capacity")}
                    readOnly
                  />
                )}
                {tab === "capacity" && (
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
                    onPrev={() => setTab("orders")}
                    onNext={() => setTab("eta")}
                    readOnly
                  />
                )}
                {tab === "eta" && (
                  <Step3MaterialETA
                    selectedIds={allSelectedIds}
                    materialEtaOverrides={materialEtaOvr}
                    setMaterialEtaOverrides={NOOP}
                    onPrev={() => setTab("capacity")}
                    onNext={() => setTab("gcdates")}
                    readOnly
                  />
                )}
                {tab === "gcdates" && (
                  <Step4GCDates
                    gcOrders={gcOrders}
                    gcDateOverrides={gcDateOvr}
                    setGcDateOverrides={NOOP}
                    onPrev={() => setTab("eta")}
                    onNext={NOOP}
                    readOnly
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* ── Non-wizard tabs: scrollable with padding ─────────────────────── */}
        {!isWizardTab && (
          <div className="absolute inset-0 overflow-auto p-5">

            {tab === "overview" && (
              <>
                {publishLogs?.[0] && publishLogs[0].status !== "verifying" && publishLogs[0].status !== "success" && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-3">
                    <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
                    <div className="flex-1">
                      <h4 className="font-bold text-red-900 text-sm">Đối soát đồng bộ ERP không khớp</h4>
                      <p className="text-xs text-red-700 mt-1">{publishLogs[0].verification_note}</p>
                      <div className="flex gap-2 mt-3">
                        <button
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors"
                          onClick={() => { setActiveLogId(publishLogs[0].id); setDrawerOpen(true); }}
                        >
                          Xem chi tiết đơn hàng thiếu
                        </button>
                        <button
                          className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                          onClick={handleStartVerification}
                        >
                          <RefreshCw size={11} /> Thử lại
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* KPI cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  {[
                    { label: "Đơn đã lập", value: run.scheduled_count ?? "—", delta: run.status === "done" ? "Hoàn thành" : "Đang chạy", up: true },
                    { label: "On-time",    value: run.on_time_pct != null ? `${run.on_time_pct}%` : "—", delta: run.on_time_count != null ? `${run.on_time_count} đơn` : "", up: true },
                    { label: "Cảnh báo",  value: warnings.length, delta: warnings.length ? "Cần xem lại" : "Không có vấn đề", up: !warnings.length, danger: warnings.length > 0 },
                    { label: "Thời gian", value: run.runtime_seconds != null ? `${run.runtime_seconds.toFixed(1)}s` : "—", delta: "TailFollow + ILS", up: true },
                  ].map(({ label, value, delta, up, danger }) => (
                    <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
                      <div className={`text-2xl font-bold mt-1 ${danger ? "text-red-600" : "text-gray-900"}`}>{value}</div>
                      {delta && (
                        <div className={`text-xs mt-1 flex items-center gap-1 ${up ? "text-green-600" : "text-red-500"}`}>
                          {up ? <Check size={11} /> : <AlertTriangle size={11} />} {delta}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Pipeline progress */}
                <div className="bg-white rounded-xl border border-gray-200 mb-4">
                  <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
                    <div className="text-sm font-semibold text-gray-900">Tiến trình pipeline</div>
                    {isLive && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 ml-auto">
                        <Loader2 size={10} className="animate-spin" /> Đang chạy
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex justify-between text-xs text-gray-500 mb-2">
                      <span>{liveStepName}</span>
                      <span>{liveStep}/{PIPELINE_STEPS.length}</span>
                    </div>
                    <div className="bg-gray-100 rounded-full overflow-hidden h-2 mb-4">
                      <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${Math.round(progressPct)}%` }} />
                    </div>
                    <div className="flex flex-col gap-2">
                      {PIPELINE_STEPS.map((label, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0
                            ${i < liveStep ? "bg-blue-600 text-white" : i === liveStep && isLive ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"}`}>
                            {i < liveStep ? "✓" : i + 1}
                          </div>
                          <span className={i < liveStep ? "text-gray-900" : "text-gray-400"}>{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Verification logs */}
                <div className="bg-white rounded-xl border border-gray-200 mb-4 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900 flex items-center justify-between">
                    <span>Lịch sử đối soát đồng bộ ERP</span>
                    <span className="text-xs text-gray-400 font-normal">Phiên gần nhất</span>
                  </div>
                  <div className="p-5">
                    {!publishLogs || publishLogs.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Chưa thực hiện phiên đối soát nào cho bản chạy này.</p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {publishLogs.map(log => (
                          <div key={log.id} className="flex items-center justify-between text-sm p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-gray-900 flex items-center gap-2">
                                Phiên #{log.id}
                                <span className="text-xs font-normal text-gray-500">({log.checked_at?.slice(0, 16).replace("T", " ")})</span>
                              </span>
                              <span className="text-xs text-gray-600 mt-1">Kết quả: {log.matched_count}/{log.total_records} đơn khớp</span>
                              <span className="text-[11px] text-gray-500 italic mt-0.5">{log.verification_note}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusBadge status={log.status} />
                              {(log.status === "partial" || log.status === "not_found") && (
                                <button
                                  className="px-2 py-1 text-xs bg-white hover:bg-gray-100 border border-gray-200 rounded text-gray-600"
                                  onClick={() => { setActiveLogId(log.id); setDrawerOpen(true); }}
                                >
                                  Xem lỗi
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Algorithm info */}
                <div className="bg-white rounded-xl border border-gray-200">
                  <div className="px-5 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Thuật toán</div>
                  <div className="p-5">
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                      <dt className="text-gray-500">Phase 1</dt><dd className="text-gray-900">TailFollowAllocator — gán chuyền theo đuôi + cân bằng tải</dd>
                      <dt className="text-gray-500">Phase 2</dt><dd className="text-gray-900">ILS (SWAP / RELOCATE / REORDER) — thoát local optima</dd>
                      <dt className="text-gray-500">Phase 3</dt><dd className="text-gray-900">SizeSequencer — phân bổ size theo ngày (K/Q từ DE_ORDERM)</dd>
                      <dt className="text-gray-500">Fitness</dt><dd className="font-medium text-gray-900">{run.fitness != null ? run.fitness.toLocaleString() : "—"}</dd>
                    </dl>
                  </div>
                </div>
              </>
            )}

            {tab === "warnings" && (
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
                  <div className="text-sm font-semibold text-gray-900">Cảnh báo &amp; ERP drift</div>
                  <div className="flex-1" />
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{warnings.length} mục</span>
                </div>
                {warnings.length === 0 ? (
                  <div className="py-12 text-center text-gray-400">
                    <Check size={28} className="mx-auto mb-2 text-green-500" />
                    <div className="font-semibold text-gray-600">Không có cảnh báo.</div>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {["Loại", "Mức độ", "Mô tả", "Đơn hàng"].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {warnings.map((w, i) => (
                        <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                          <td className="px-3 py-2 font-semibold text-sm">{w.kind}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                              ${w.severity === "high" ? "bg-red-100 text-red-700" : w.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />{w.severity}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">{w.message}</td>
                          <td className="px-3 py-2 text-xs font-mono text-gray-500">{w.order_id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === "step6" && (
              <div className="h-full min-h-0">
                <Step6Edit runId={runId} />
              </div>
            )}

            {tab === "params" && (
              <div className="bg-white rounded-xl border border-gray-200 max-w-2xl">
                <div className="px-5 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Thông số lập lịch</div>
                <div className="p-5">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                    <dt className="text-gray-500">Thuật toán</dt><dd className="text-gray-900">TailFollowAllocator + ILS</dd>
                    <dt className="text-gray-500">Horizon</dt><dd className="text-gray-900">{run.config_json?.horizon_days ?? 90} ngày</dd>
                    <dt className="text-gray-500">Cửa sổ năng lực</dt><dd className="text-gray-900">{run.config_json?.report_window_days ?? 90} ngày</dd>
                    <dt className="text-gray-500">Đơn đầu vào</dt><dd className="text-gray-900">{run.config_json?.order_ids ? `${run.config_json.order_ids.length} đơn (chọn thủ công)` : "Tất cả đơn NEW"}</dd>
                    <dt className="text-gray-500">Thời gian chạy</dt><dd className="text-gray-900">{run.runtime_seconds != null ? `${run.runtime_seconds.toFixed(1)}s` : "—"}</dd>
                    <dt className="text-gray-500">Tạo bởi</dt><dd className="text-gray-900">{run.triggered_by ?? "—"}</dd>
                  </dl>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* ── Success Overlay ─────────────────────────────────────────────────── */}
      {showSuccessOverlay && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-green-100 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4 animate-bounce">
              <CheckCircle size={36} />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Đồng bộ ERP Thành công!</h3>
            <p className="text-gray-500 text-sm mb-6">
              Bản kế hoạch sản xuất đã đối soát khớp 100% dữ liệu với ERP PDSCH và đã được chính thức kích hoạt làm <strong>Kế hoạch hiện hành (Active)</strong>.
            </p>
            <button
              className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-md transition-colors"
              onClick={() => setShowSuccessOverlay(false)}
            >
              Hoàn tất &amp; Tiếp tục
            </button>
          </div>
        </div>
      )}

      {/* ── Error Drawer ────────────────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
          <div className="flex-1" onClick={() => setDrawerOpen(false)} />
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Chi tiết đối soát phiên #{activeLogId}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Danh sách các đơn hàng chưa khớp đồng bộ với ERP PDSCH</p>
              </div>
              <button className="p-1 hover:bg-gray-200 rounded-full text-gray-500" onClick={() => setDrawerOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {isDetailsLoading ? (
                <div className="flex flex-col items-center justify-center h-full py-12">
                  <Loader2 size={24} className="animate-spin text-blue-600" />
                  <span className="text-xs text-gray-400 mt-2">Đang tải dữ liệu đơn hàng...</span>
                </div>
              ) : !logDetails || logDetails.length === 0 ? (
                <div className="text-center py-12 text-gray-400 italic">Không tìm thấy chi tiết đối soát.</div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
                    <strong>Lưu ý:</strong> Các đơn hàng đánh dấu <span className="font-bold">Thiếu ERP</span> cần được cập nhật lên ERP trước khi xác thực thành công.
                  </div>
                  <div className="divide-y divide-gray-100">
                    {logDetails.map(detail => (
                      <div key={detail.id} className="py-2.5 flex items-center justify-between text-sm">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-gray-800">{detail.order_id}</span>
                          <span className="text-[10px] text-gray-400">Kiểm tra lúc: {detail.last_checked_at?.slice(11, 19)}</span>
                        </div>
                        {detail.is_matched ? (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-semibold bg-green-50 text-green-700 border border-green-100">✓ Khớp</span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-700 border border-red-100">✗ Thiếu ERP</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3">
              <button
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5"
                onClick={() => { setDrawerOpen(false); handleStartVerification(); }}
              >
                <RefreshCw size={14} /> Thử lại đối soát
              </button>
              <button
                className="px-4 py-2 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium"
                onClick={() => setDrawerOpen(false)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {acceptTarget && (
        <AcceptRunDialog
          run={acceptTarget}
          onClose={() => setAcceptTarget(null)}
          onAccept={() => setAcceptTarget(null)}
        />
      )}

      {/* ── Inline compare view ─────────────────────────────────────────────── */}
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
