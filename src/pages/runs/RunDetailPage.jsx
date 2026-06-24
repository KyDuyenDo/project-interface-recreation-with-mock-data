import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Download, Check, AlertTriangle, Loader2,
  CheckCircle, RefreshCw, X, Eye, Users, CheckCircle2, PanelRightOpen,
} from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  useRunDetail, useRunStatus, useRunWarnings, useRunOutputOrders,
  useVerifyRun, usePublishLogs, usePublishLogDetails, useActiveRun,
} from "../../hooks";
import { wizardStateApi } from "../../api";
import http from "../../api/http";
import { usePermissions } from "../../hooks/usePermissions";
import StatusBadge     from "./components/StatusBadge";
import AcceptRunDialog from "./components/AcceptRunDialog";
import Step6Edit       from "../ga-config/steps/Step6Edit";
import Step1Orders     from "../ga-config/steps/Step1Orders";
import Step2Capacity   from "../ga-config/steps/Step2Capacity";
import Step3MaterialETA from "../ga-config/steps/Step3MaterialETA";
import Step4GCDates    from "../ga-config/steps/Step4GCDates";
import RunHistoryDetailPage from "./RunHistoryDetailPage";
import SubPlannerDispatchPanel from "../../components/dispatch/SubPlannerDispatchPanel";
import SubStep2Panel from "../sub-planner/SubStep2Panel";
import { useAuthStore } from "../../store/authStore";

const BTN = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const PIPELINE_STEPS = [
  "ERP sync", "Năng lực chuyền", "TailFollowAllocator",
  "ILS Optimizer", "Phân bổ size", "Lưu kết quả",
];

const STEPS = [
  { key: "orders",   title: "Chọn đơn",   subtitle: "Nhập mã hoặc Excel" },
  { key: "capacity", title: "Ưu tiên",    subtitle: "Chuyền theo model" },
  { key: "mat",      title: "NVL về",     subtitle: "Ngày vật liệu" },
  { key: "gc_dates", title: "Ngày GC",    subtitle: "Thu gia công" },
  { key: "run",      title: "Chạy lịch",  subtitle: "TailFollow + ILS" },
  { key: "edit",     title: "Chỉnh sửa",  subtitle: "Review + tinh chỉnh" },
];

const WIZARD_TABS = [0, 1, 2, 3]; // step indices that use wizard state
const NOOP = () => {};

// wizard step index → dispatch step number (mirrors GAConfigPage)
const DISPATCH_STEPS = { 1: 2, 2: 3, 3: 4, 5: 6 };

// ── Sub-Planner badge (always visible) ────────────────────────────────────────
function SubPlannerTriggerBadge({ dispatchStep, runId, onClick }) {
  const { data: statusData } = useQuery({
    queryKey:        ["dispatch-status", runId, dispatchStep],
    queryFn:         () => http.get(`/runs/${runId}/dispatch-status`, { params: { step: dispatchStep } }).then(r => r.data),
    enabled:         !!runId,
    refetchInterval: 10000,
  });

  const dispatched     = statusData?.dispatched;
  const planners       = statusData?.planners || [];
  const confirmedCount = planners.filter(p => p.status === "confirmed").length;
  const rejectedCount  = planners.filter(p => p.status === "rejected").length;
  const total          = planners.length;
  const allConfirmed   = total > 0 && confirmedCount === total;

  const btnBase = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors";
  const btnStyle = allConfirmed
    ? `${btnBase} bg-green-50 border-green-200 text-green-700 hover:bg-green-100`
    : rejectedCount > 0
      ? `${btnBase} bg-red-50 border-red-200 text-red-700 hover:bg-red-100`
      : dispatched
        ? `${btnBase} bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100`
        : `${btnBase} bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100`;

  return (
    <button onClick={onClick} className={btnStyle}>
      <Users size={12} />
      Sub-Planner
      {dispatched ? (
        allConfirmed ? (
          <span className="flex items-center gap-0.5 bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
            <CheckCircle2 size={9} /> {total}/{total}
          </span>
        ) : rejectedCount > 0 ? (
          <span className="flex items-center gap-0.5 bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
            <AlertTriangle size={9} /> {rejectedCount}
          </span>
        ) : (
          <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
            {confirmedCount}/{total}
          </span>
        )
      ) : (
        <span className="bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full text-[10px]">Chưa gửi</span>
      )}
      <PanelRightOpen size={12} className="opacity-50" />
    </button>
  );
}

// ── Sub-Planner slide-in drawer ───────────────────────────────────────────────
function SubPlannerDrawer({ open, onClose, dispatchStep, runId }) {
  if (!dispatchStep) return null;
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px]" onClick={onClose} />
      )}
      <div className={`fixed top-0 right-0 h-full z-40 flex flex-col bg-white shadow-2xl border-l border-gray-200 transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ width: "min(1080px, calc(100vw - 196px))" }}>
        <div className="flex items-center gap-3 px-5 py-3.5 border-b bg-gray-50 shrink-0">
          <Users size={15} className="text-gray-500" />
          <span className="text-sm font-semibold text-gray-800 flex-1">Theo dõi Sub-Planner · Bước {dispatchStep}</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors text-gray-500">
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">
          <SubPlannerDispatchPanel runId={runId} dispatchStep={dispatchStep} readOnly={false} />
        </div>
      </div>
    </>
  );
}

// ── Completed WizardStepper ────────────────────────────────────────────────────
function CompletedStepper({ step, onGoStep, rightSlot }) {
  return (
    <div className="flex border-b border-gray-200 bg-white shrink-0 overflow-x-auto items-center">
      {STEPS.map((s, i) => {
        const isCurrent = i === step;

        return (
          <button
            key={s.key}
            onClick={() => onGoStep(i)}
            className={[
              "flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors min-w-0 whitespace-nowrap cursor-pointer",
              isCurrent
                ? "border-blue-600 text-blue-700 bg-blue-50/50"
                : i < 4
                  ? "border-amber-300 text-amber-700 hover:bg-amber-50"
                  : "border-green-400 text-green-700 hover:bg-gray-50",
            ].join(" ")}
          >
            <div className={[
              "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
              isCurrent
                ? "bg-blue-600 text-white"
                : i < 4
                  ? "bg-amber-100 text-amber-700"
                  : "bg-green-500 text-white",
            ].join(" ")}>
              {isCurrent
                ? i + 1
                : i < 4
                  ? <Eye size={10} />
                  : <Check size={12} />}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-medium leading-tight">{s.title}</div>
              <div className="text-[10px] leading-tight opacity-60">{s.subtitle}</div>
            </div>
          </button>
        );
      })}
      {rightSlot && (
        <div className="ml-auto px-3 shrink-0">{rightSlot}</div>
      )}
    </div>
  );
}

// ── Completed RunGA summary (step 5 view) ─────────────────────────────────────
function CompletedRunView({ run, warnings, publishLogs, onShowLogDetails, onRetryVerification, onShowCompare, onAccept, isMain }) {
  const liveStep   = run.step_progress ?? PIPELINE_STEPS.length;
  const progressPct = run.status === "done" ? 100 : 0;

  return (
    <div className="absolute inset-0 overflow-auto p-5 bg-gray-50">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        {[
          { label: "Đơn đã lập", value: run.scheduled_count ?? "—", delta: "Hoàn thành", up: true },
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
        </div>
        <div className="p-5">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>Lưu kết quả</span>
            <span>{PIPELINE_STEPS.length}/{PIPELINE_STEPS.length}</span>
          </div>
          <div className="bg-gray-100 rounded-full overflow-hidden h-2 mb-4">
            <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex flex-col gap-2">
            {PIPELINE_STEPS.map((label, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-blue-600 text-white">✓</div>
                <span className="text-gray-900">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Warnings inline */}
      {warnings.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 mb-4">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
            <div className="text-sm font-semibold text-gray-900">Cảnh báo &amp; ERP drift</div>
            <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{warnings.length} mục</span>
          </div>
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
        </div>
      )}

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
                        onClick={() => onShowLogDetails(log.id)}
                      >Xem lỗi</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Algorithm info */}
      <div className="bg-white rounded-xl border border-gray-200 mb-4">
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

      {/* Thông số */}
      <div className="bg-white rounded-xl border border-gray-200">
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
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function RunDetailPage() {
  const { runId: runIdParam } = useParams();
  const runId   = runIdParam ? parseInt(runIdParam, 10) : null;
  const navigate = useNavigate();

  // Wizard step: default to step 6 (index 5 = Chỉnh sửa)
  const [step, setStep] = useState(5);
  const [subDrawerOpen,      setSubDrawerOpen]       = useState(false);

  const [acceptTarget,       setAcceptTarget]       = useState(null);
  const [showCompare,        setShowCompare]         = useState(false);
  const [activeLogId,        setActiveLogId]         = useState(null);
  const [drawerOpen,         setDrawerOpen]          = useState(false);
  const [showSuccessOverlay, setShowSuccessOverlay]  = useState(false);

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

  // ── Wizard data (steps 1-4) ────────────────────────────────────────────────
  const wizardEnabled = WIZARD_TABS.includes(step) && !!runId;
  const { data: wOrders,   isLoading: wOrdersLoading }   = useQuery({ queryKey: ["wiz-orders",   runId], queryFn: () => wizardStateApi.getOrders(runId),          enabled: wizardEnabled, staleTime: 60_000 });
  const { data: wPrio,     isLoading: wPrioLoading }     = useQuery({ queryKey: ["wiz-prio",     runId], queryFn: () => wizardStateApi.getPriorities(runId),      enabled: wizardEnabled, staleTime: 60_000 });
  const { data: wCap,      isLoading: wCapLoading }      = useQuery({ queryKey: ["wiz-cap",      runId], queryFn: () => wizardStateApi.getCapacities(runId),      enabled: wizardEnabled, staleTime: 60_000 });
  const { data: wNewModel, isLoading: wNewModelLoading } = useQuery({ queryKey: ["wiz-newmodel", runId], queryFn: () => wizardStateApi.getNewModelTargets(runId), enabled: wizardEnabled, staleTime: 60_000 });
  const { data: wEta,      isLoading: wEtaLoading }      = useQuery({ queryKey: ["wiz-eta",      runId], queryFn: () => wizardStateApi.getMaterialEtas(runId),    enabled: wizardEnabled, staleTime: 60_000 });
  const { data: wGcDates,  isLoading: wGcLoading }       = useQuery({ queryKey: ["wiz-gc",       runId], queryFn: () => wizardStateApi.getGcDates(runId),         enabled: wizardEnabled, staleTime: 60_000 });
  const wizardLoading = wOrdersLoading || wPrioLoading || wCapLoading || wNewModelLoading || wEtaLoading || wGcLoading;

  // ── Derived wizard props ───────────────────────────────────────────────────
  const regularOrders     = useMemo(() => wOrders?.regular ?? [], [wOrders]);
  const gcOrders          = useMemo(() => wOrders?.gc      ?? [], [wOrders]);
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
      return () => { clearInterval(id); refetchPublishLogs(); };
    }
  }, [run?.lifecycle_status, runId, queryClient, refetchPublishLogs]);

  useEffect(() => {
    const latest = publishLogs?.[0];
    if (latest?.status === "success" && run?.lifecycle_status === "active") {
      setShowSuccessOverlay(true);
    }
  }, [publishLogs, run?.lifecycle_status]);

  const { isMain, isSub, myLines } = usePermissions();
  const { user } = useAuthStore();
  const isLocked = run?.lifecycle_status === "verifying";

  // Sub-planner: fetch tasks to know which orders are on their lines
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
  const myOrderIds = useMemo(() => new Set(myRunTasks.filter(t => t.order_id).map(t => t.order_id)), [myRunTasks]);

  const handleStartVerification = async () => {
    try {
      const log = await verifyRunMutation.mutateAsync(runId);
      setActiveLogId(log.id);
    } catch (err) {
      console.error("Verification failed:", err);
    }
  };

  if (!run) return (
    <div className="flex flex-col h-full items-center justify-center">
      <Loader2 size={28} className="animate-spin text-blue-500" />
    </div>
  );

  const isWizardStep = WIZARD_TABS.includes(step);

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

      {/* ── Completed wizard stepper (6 steps, no step 7) ──────────────────── */}
      <CompletedStepper
        step={step}
        onGoStep={setStep}
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

      {/* Sub-Planner slide-in drawer */}
      {!isSub && DISPATCH_STEPS[step] && (
        <SubPlannerDrawer
          open={subDrawerOpen}
          onClose={() => setSubDrawerOpen(false)}
          dispatchStep={DISPATCH_STEPS[step]}
          runId={runId}
        />
      )}

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative bg-gray-50">

        {/* Verifying overlay */}
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

        {/* ── Steps 1-4: read-only wizard content ────────────────────────── */}
        {isWizardStep && (
          <div className="absolute inset-0 p-5 overflow-hidden flex flex-col">
            {wizardLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 size={28} className="animate-spin text-blue-500" />
                <span className="ml-2 text-sm text-gray-500">Đang tải cấu hình…</span>
              </div>
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
                    materialEtaOverrides={materialEtaOvr}
                    setMaterialEtaOverrides={NOOP}
                    onPrev={() => setStep(1)}
                    onNext={() => setStep(3)}
                    readOnly
                  />
                )}
                {step === 3 && (
                  <Step4GCDates
                    gcOrders={isSub && myOrderIds.size > 0 ? gcOrders.filter(o => myOrderIds.has(o.order_id)) : gcOrders}
                    gcDateOverrides={gcDateOvr}
                    setGcDateOverrides={NOOP}
                    onPrev={() => setStep(2)}
                    onNext={() => setStep(4)}
                    readOnly
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* ── Step 5: completed RunGA summary ──────────────────────────────── */}
        {step === 4 && (
          <CompletedRunView
            run={run}
            warnings={warnings}
            publishLogs={publishLogs}
            onShowLogDetails={(id) => { setActiveLogId(id); setDrawerOpen(true); }}
            onRetryVerification={handleStartVerification}
            isMain={isMain}
          />
        )}

        {/* ── Step 6: editable Chỉnh sửa lịch ─────────────────────────────── */}
        {step === 5 && (
          <div className="absolute inset-0 p-5 overflow-hidden flex flex-col">
            <Step6Edit
              runId={runId}
              onPrev={() => setStep(4)}
              onNext={NOOP}
              dispatchBlocked={false}
              lineFilter={isSub && myLines.length > 0 ? myLines : null}
              viewOnly={isSub}
            />
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
