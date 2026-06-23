import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, Package, Eye, Loader2, Check, Calendar,
  AlertTriangle, Trash2, PlayCircle, CheckSquare, Square,
  ChevronLeft, ChevronRight, X,
} from "lucide-react";
import { clsx } from "clsx";
import { useRuns, useActiveRun, useSchedulePeriods, useDeleteRun } from "../../hooks";
import { useQuery } from "@tanstack/react-query";
import { wizardStateApi, runsApi } from "../../api";
import { useOrders } from "../../hooks/useOrders";

import { usePermissions } from "../../hooks/usePermissions";
import StatusBadge from "./components/StatusBadge";
import AcceptRunDialog  from "./components/AcceptRunDialog";
import NewOrdersDialog  from "./components/NewOrdersDialog";

const BTN    = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SM = "inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const PAGE_SIZE_TAB = 20;

// ── PeriodRunRow ──────────────────────────────────────────────────────────────
function PeriodRunRow({ run: r, isActive, onDetail, onHistory }) {
  return (
    <tr
      className={clsx(
        "border-b border-gray-50 last:border-0 cursor-pointer",
        isActive
          ? "bg-green-50/60 hover:bg-green-50"
          : "opacity-60 hover:opacity-100 hover:bg-gray-50",
      )}
      onClick={onHistory}>
      <td className="px-3 py-2.5 font-bold text-gray-900 w-14">#{r.id}</td>
      <td className="px-3 py-2.5 text-xs">
        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{r.label}</code>
      </td>
      <td className="px-3 py-2.5 w-32">
        <StatusBadge run={r} />
      </td>
      <td className="px-3 py-2.5 text-xs text-gray-500">
        {r.is_accepted && r.accepted_at
          ? `Accepted ${r.accepted_at.slice(0, 10)}${r.accepted_by ? ` · ${r.accepted_by}` : ""}`
          : r.started_at?.slice(0, 16).replace("T", " ")}
        {r.superseded_at && (
          <span className="ml-1 text-gray-400">
            → thay thế {r.superseded_at.slice(0, 10)}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs text-right font-medium text-gray-900">
        {r.scheduled_count ?? "—"}
      </td>
      <td className="px-3 py-2.5 text-xs font-semibold">
        {r.on_time_pct != null
          ? <span style={{ color: r.on_time_pct >= 80 ? "#047857" : "#b45309" }}>{r.on_time_pct}%</span>
          : "—"}
      </td>
      <td className="px-3 py-2.5 text-xs text-gray-400">
        {r.superseded_by && <span>→ #{r.superseded_by}</span>}
      </td>
      <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
        <button
          className={`${BTN_SM} bg-white text-gray-700 border-gray-200 hover:bg-gray-50`}
          onClick={onDetail}>
          <Eye size={12} /> Chi tiết
        </button>
      </td>
    </tr>
  );
}

// ── DeleteConfirmDialog (single) ──────────────────────────────────────────────
function DeleteConfirmDialog({ run, isPending, onClose, onConfirm }) {
  const isAccepted = run.lifecycle_status === "accepted" || run.lifecycle_status === "verifying";
  const isRunning  = run.status === "running" || run.status === "pending";
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <Trash2 size={16} className="text-red-500 shrink-0" />
          <div className="text-sm font-semibold text-gray-900">
            Xóa lịch <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">#{run.id}</code>
          </div>
        </div>
        <div className="px-5 py-4 space-y-3">
          {isRunning && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              Lịch này <strong>đang chạy</strong>. Xóa bắt buộc sẽ dừng tiến trình và xóa vĩnh viễn.
            </div>
          )}
          {isAccepted && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm bg-amber-50 text-amber-800 border border-amber-100">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              Lịch này đang ở trạng thái <strong>đã duyệt</strong>. Hệ thống sẽ loại bỏ trước khi xóa.
            </div>
          )}
          <p className="text-sm text-gray-600">
            Xóa <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{run.label}</code>?{" "}
            Thao tác <strong>không thể hoàn tác</strong>.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button
            className={`${BTN} bg-white text-gray-700 border-gray-200 hover:bg-gray-50`}
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            className={`${BTN} bg-red-600 text-white border-red-600 hover:bg-red-700`}
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            {isRunning ? "Xóa bắt buộc" : isAccepted ? "Loại bỏ & Xóa" : "Xóa lịch"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── BulkDeleteDialog ──────────────────────────────────────────────────────────
function BulkDeleteDialog({ selectedRuns, isPending, onClose, onConfirm }) {
  const activeCount   = selectedRuns.filter(r => r.lifecycle_status === "active").length;
  const runningCount  = selectedRuns.filter(r => r.status === "running" || r.status === "pending").length;
  const deletable     = selectedRuns.filter(r => r.lifecycle_status !== "active");
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <Trash2 size={16} className="text-red-500 shrink-0" />
          <div className="text-sm font-semibold text-gray-900">
            Xóa {deletable.length} lịch
          </div>
        </div>
        <div className="px-5 py-4 space-y-3">
          {activeCount > 0 && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm bg-orange-50 text-orange-800 border border-orange-200">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>
                <strong>{activeCount} lịch đang Active</strong> sẽ bị bỏ qua — không thể xóa lịch chính thức.
              </span>
            </div>
          )}
          {runningCount > 0 && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>
                <strong>{runningCount} lịch đang chạy</strong> sẽ bị xóa bắt buộc — tiến trình GA sẽ dừng.
              </span>
            </div>
          )}
          <p className="text-sm text-gray-600">
            Xóa <strong>{deletable.length} lịch</strong>? Thao tác <strong>không thể hoàn tác</strong>.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button className={`${BTN} bg-white text-gray-700 border-gray-200 hover:bg-gray-50`} onClick={onClose}>
            Hủy
          </button>
          <button
            className={`${BTN} bg-red-600 text-white border-red-600 hover:bg-red-700`}
            disabled={isPending || deletable.length === 0}
            onClick={onConfirm}
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Xóa {deletable.length} lịch
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RunsPage() {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  const [acceptTarget,    setAcceptTarget]     = useState(null);
  const [deleteTarget,    setDeleteTarget]     = useState(null);
  const [showNewOrders,   setShowNewOrders]    = useState(false);
  const [expandedPeriods, setExpandedPeriods]  = useState({});
  const [activeTab,       setActiveTab]        = useState("draft");

  const [selectedIds,   setSelectedIds]   = useState(new Set());
  const [tabPages,      setTabPages]      = useState({ draft: 1, accepted: 1, active: 1, running: 1 });
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const perms = usePermissions();
  const deleteMutation = useDeleteRun();

  const { data: wizardPlan } = useQuery({
    queryKey: ["wizard-in-progress"],
    queryFn:  () => wizardStateApi.getWizardInProgress(),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  const handleStartFresh = async (e) => {
    e.stopPropagation();
    // Close ALL stale wizard sessions so the card fully disappears before navigating.
    // createDraft will also do this, but doing it here gives instant feedback.
    await wizardStateApi.closeStaleWizardSessions().catch(() => {});
    if (wizardPlan && wizardPlan.status === "draft") {
      try { await runsApi.delete(wizardPlan.id); } catch (_) { /* non-fatal */ }
    }
    queryClient.setQueryData(["wizard-in-progress"], null);
    queryClient.invalidateQueries({ queryKey: ["wizard-in-progress"] });
    navigate("/runs/new");
  };

  const { data: runsData, isLoading } = useRuns({ page: 1, page_size: 100 });
  const { data: periodsData }         = useSchedulePeriods();
  const { data: activeRun }           = useActiveRun();
  const { data: newOrdersData }       = useOrders({ statuses: ["N"], page_size: 1, include_sizes: false });

  const runs           = Array.isArray(runsData) ? runsData : (runsData?.items || []);
  const periods        = periodsData?.items || periodsData || [];
  const activeRunId    = activeRun?.id;
  const newOrdersCount = newOrdersData?.total ?? null;

  const periodMap = useMemo(() => {
    const map = {};
    periods.forEach(p => { map[p.id] = { ...p, runs: [] }; });
    runs.forEach(r => {
      if (r.period_id && map[r.period_id]) map[r.period_id].runs.push(r);
    });
    return map;
  }, [runs, periods]);

  const sortedPeriods = useMemo(() =>
    periods.slice().sort((a, b) =>
      new Date(b.period_start || 0) - new Date(a.period_start || 0),
    ), [periods]);

  const draftRuns = useMemo(() =>
    runs.filter(r => r.status === "done" && !r.is_accepted), [runs]);

  const legacyRuns = useMemo(() =>
    runs.filter(r =>
      !(r.status === "done" && !r.is_accepted) &&
      (!r.period_id || !periodMap[r.period_id]),
    ), [runs, periodMap]);

  // ── Per-tab filtering ──────────────────────────────────────────────────────
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

  // ── Selection helpers ──────────────────────────────────────────────────────
  const allPageSelected = pagedRuns.length > 0 && pagedRuns.every(r => selectedIds.has(r.id));
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

  const togglePeriod = (id) =>
    setExpandedPeriods(prev => ({ ...prev, [id]: !prev[id] }));

  // ── Bulk delete ────────────────────────────────────────────────────────────
  const selectedRuns = runs.filter(r => selectedIds.has(r.id));
  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
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

  // ── Table renderer ─────────────────────────────────────────────────────────
  const renderTable = (runsToShow, title, emptyMessage) => {
    if (isLoading) {
      return (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
          <Loader2 size={28} className="animate-spin mx-auto text-blue-500" />
        </div>
      );
    }
    if (activeTabRuns.length === 0) {
      return (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 shadow-sm">
          <Package size={28} className="mx-auto mb-2 text-gray-300" />
          <div className="font-semibold text-gray-600">{emptyMessage}</div>
        </div>
      );
    }
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <div className="text-sm font-semibold text-gray-900">{title}</div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {activeTabRuns.length} lịch
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/70 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 w-8">
                <button onClick={toggleSelectAll} className="text-gray-400 hover:text-blue-600 transition-colors">
                  {allPageSelected
                    ? <CheckSquare size={14} className="text-blue-500" />
                    : <Square size={14} />}
                </button>
              </th>
              <th className="px-3 py-3">#ID</th>
              <th className="px-3 py-3">Nhãn lịch</th>
              {activeTab !== "draft" && activeTab !== "running" && (
                <th className="px-3 py-3">Giai đoạn</th>
              )}
              <th className="px-3 py-3">Trạng thái vòng đời</th>
              {activeTab === "running" && (
                <th className="px-3 py-3">Chi tiết lỗi / Tiến độ</th>
              )}
              <th className="px-3 py-3">Thời gian chạy</th>
              <th className="px-3 py-3 text-right">Tổng đơn</th>
              <th className="px-3 py-3">Tỷ lệ On-Time</th>
              <th className="px-5 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {runsToShow.map(r => (
              <tr
                key={r.id}
                className={clsx(
                  "border-b border-gray-100 last:border-0 hover:bg-gray-50/50 cursor-pointer transition-colors",
                  r.id === activeRunId && "bg-green-50/40 hover:bg-green-50/60",
                  selectedIds.has(r.id) && "bg-blue-50/50",
                )}
                onClick={() => navigate(`/runs/${r.id}`)}
              >
                {/* Checkbox */}
                <td className="px-4 py-3 w-8" onClick={e => { e.stopPropagation(); toggleSelect(r.id); }}>
                  {selectedIds.has(r.id)
                    ? <CheckSquare size={14} className="text-blue-500" />
                    : <Square size={14} className="text-gray-300 hover:text-gray-500" />}
                </td>
                <td className="px-3 py-3 font-bold text-gray-900 w-14">#{r.id}</td>
                <td className="px-3 py-3 text-xs font-medium">
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{r.label}</code>
                </td>
                {activeTab !== "draft" && activeTab !== "running" && (
                  <td className="px-3 py-3">
                    {r.period_label ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold text-xs border border-indigo-100 shadow-sm w-fit">
                        <Calendar size={12} className="text-indigo-500 shrink-0" />
                        {r.period_label}
                      </span>
                    ) : (
                      <span className="text-gray-400 font-medium italic">—</span>
                    )}
                  </td>
                )}
                <td className="px-3 py-3">
                  <StatusBadge run={r} />
                </td>
                {activeTab === "running" && (
                  <td className="px-3 py-3 text-xs max-w-[280px]">
                    {r.status === "failed" ? (
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 border border-red-200 shadow-sm w-fit">
                          <AlertTriangle size={11} className="text-red-600 shrink-0" />
                          Lập lịch lỗi
                        </span>
                        {r.error_message ? (
                          <span className="text-xs text-red-600 font-medium line-clamp-2" title={r.error_message}>
                            {r.error_message}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Không có chi tiết lỗi</span>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200 w-fit">
                          {r.status === "running" ? "Đang giải..." : "Đang chờ..."}
                        </span>
                        {r.step_name && (
                          <span className="text-xs text-blue-600 font-medium">
                            Bước: {r.step_name} ({r.step_progress}%)
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                )}
                <td className="px-3 py-3 text-xs text-gray-500">
                  {r.started_at?.slice(0, 16).replace("T", " ")}
                </td>
                <td className="px-3 py-3 text-xs text-right font-semibold text-gray-900">
                  {r.scheduled_count ?? "—"}
                </td>
                <td className="px-3 py-3 text-xs font-bold">
                  {r.on_time_pct != null ? (
                    <span style={{ color: r.on_time_pct >= 80 ? "#047857" : "#b45309" }}>{r.on_time_pct}%</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      className={`${BTN_SM} bg-white text-gray-700 border-gray-200 hover:bg-gray-50`}
                      onClick={() => navigate(`/runs/${r.id}`)}
                    >
                      <Eye size={12} /> Chi tiết
                    </button>
                    {perms.isMain && r.status === "done" && r.lifecycle_status === "draft" && (
                      <button
                        className={`${BTN_SM} bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-sm`}
                        onClick={() => setAcceptTarget(r)}
                      >
                        <Check size={12} /> Chấp nhận
                      </button>
                    )}
                    {perms.isMain && r.lifecycle_status !== "active" && (
                      <button
                        className={clsx(
                          BTN_SM,
                          r.status === "running" || r.status === "pending"
                            ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                            : "bg-white text-red-600 border-red-200 hover:bg-red-50",
                        )}
                        onClick={() => setDeleteTarget(r)}
                        title={r.status === "running" || r.status === "pending" ? "Xóa bắt buộc" : "Xóa lịch"}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };


  // ── Tab content helpers ────────────────────────────────────────────────────
  const TAB_META = {
    draft:    { title: "Lịch nháp — đang chờ duyệt",           empty: "Không có lịch nháp nào đang chờ duyệt." },
    accepted: { title: "Lịch đã duyệt & Đang đối soát",        empty: "Không có lịch nào ở trạng thái đã duyệt." },
    active:   { title: "Lịch chính thức (Active)",             empty: "Chưa có lịch chính thức nào hoạt động." },
    running:  { title: "Lịch đang chạy & Gặp lỗi",            empty: "Không có lịch nào đang chạy hoặc bị lỗi." },
  };

  // ── Main ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <header className="flex items-center h-14 px-5 border-b border-gray-200 bg-white shrink-0 gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">Lập lịch sản xuất</div>
          <div className="text-xs text-gray-400 mt-0.5">TailFollow + ILS · lập lịch tự động theo đuôi chuyền</div>
        </div>
        <div className="flex-1" />
        {perms.isMain && (
          <button
            className={`${BTN} bg-blue-600 text-white border-blue-600 hover:bg-blue-700`}
            onClick={() => navigate("/runs/new")}>
            <Plus size={14} /> Lập lịch mới
          </button>
        )}
        {perms.isSub && (
          <span className="text-xs px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 font-medium">
            Chế độ xem — Sub-Planner
          </span>
        )}
      </header>

      <div className="flex-1 overflow-auto bg-gray-50 p-5">

        {/* Hero cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">

          {/* Card 1 — Đơn hàng mới */}
          <div
            className="bg-white rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 flex flex-col min-h-[160px] cursor-pointer hover:shadow-md transition-all"
            onClick={() => setShowNewOrders(true)}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-blue-500 uppercase tracking-wide">Đơn hàng mới</div>
              <Package size={18} className="text-blue-400" />
            </div>
            <div className="flex items-end gap-1 my-2">
              {newOrdersCount != null
                ? <span className="text-3xl font-bold text-gray-900">{newOrdersCount.toLocaleString()}</span>
                : <Loader2 size={28} className="animate-spin text-gray-300 mt-3" />}
              <span className="text-lg text-gray-400 mb-0.5">đơn</span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400 mt-auto pt-3 border-t border-blue-100">
              <span>Chưa có LPD · Chưa vào lịch</span>
              <span className="text-blue-500">Xem danh sách →</span>
            </div>
          </div>

          {/* Card 2 — Kế hoạch đang thực hiện / Bắt đầu kế hoạch mới */}
          {wizardPlan ? (
            <div
              className="bg-white rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 flex flex-col min-h-[160px] cursor-pointer hover:shadow-md transition-all"
              onClick={() => navigate(`/runs/new?resume=${wizardPlan.id}`)}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium text-amber-600 uppercase tracking-wide">Kế hoạch đang thực hiện</div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  {wizardPlan.status === "running" ? "Đang chạy GA" : wizardPlan.status === "done" ? "Chờ xác nhận" : "Đang soạn"}
                </span>
              </div>
              <div className="text-sm font-semibold text-gray-900 mb-2 truncate">
                {wizardPlan.label || `Nháp #${wizardPlan.id}`}
              </div>
              <div className="flex items-center gap-1 mb-3">
                {["Đơn","Ưu tiên","NVL","GC","Chạy","Sửa","Xác nhận"].map((s, i) => {
                  const done = i < wizardPlan.wizard_step;
                  const cur  = i === wizardPlan.wizard_step;
                  const gaLocked = wizardPlan.status !== "draft" && i < 4;
                  return (
                    <div key={i} className="flex items-center gap-1">
                      <div title={s} className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors ${
                        cur  ? "bg-blue-600 text-white" :
                        done ? "bg-green-500 text-white" :
                        gaLocked ? "bg-gray-200 text-gray-400" :
                        "bg-gray-100 text-gray-400"
                      }`}>
                        {done && !cur ? <Check size={9} /> : i + 1}
                      </div>
                      {i < 6 && <div className={`w-3 h-0.5 ${i < wizardPlan.wizard_step ? "bg-green-400" : "bg-gray-200"}`} />}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400 mt-auto pt-3 border-t border-amber-100">
                <span>Bước {wizardPlan.wizard_step + 1}/7 · {["Chọn đơn","Ưu tiên","NVL về","Ngày GC","Chạy lịch","Chỉnh sửa","Xác nhận"][wizardPlan.wizard_step] ?? ""}</span>
                <div className="flex items-center gap-2">
                  {wizardPlan.status !== "running" && (
                    <button
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors px-1"
                      onClick={handleStartFresh}
                      title="Hủy và bắt đầu kế hoạch mới"
                    >
                      Bắt đầu lại
                    </button>
                  )}
                  <span className="text-amber-600 font-medium flex items-center gap-1"><PlayCircle size={11} /> Tiếp tục →</span>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="bg-white rounded-xl border border-dashed border-gray-300 hover:border-blue-300 p-5 flex flex-col min-h-[160px] cursor-pointer hover:shadow-md transition-all"
              onClick={() => navigate("/runs/new")}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Kế hoạch đang thực hiện</div>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-400 py-2">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <Plus size={22} className="text-gray-400" />
                </div>
                <div className="font-semibold text-sm text-gray-600">Bắt đầu kế hoạch mới</div>
                <div className="text-xs text-gray-400 text-center">Chọn đơn → năng lực → NVL → chạy → sửa → xác nhận · 7 bước</div>
              </div>
            </div>
          )}

          {/* Card 3 — Lịch hiện hành */}
          {activeRun ? (
            <div
              className="bg-white rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-white p-5 flex flex-col min-h-[160px] cursor-pointer hover:shadow-md transition-all"
              onClick={() => navigate(`/runs/${activeRun.id}`)}>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs font-medium text-green-600 uppercase tracking-wide">Lịch hiện hành</div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />Active
                </span>
              </div>
              {activeRun.period_label && (
                <div className="text-xs text-green-600 font-medium mb-1">{activeRun.period_label}</div>
              )}
              <div className="text-base font-semibold text-gray-900 mb-3 truncate">{activeRun.label}</div>
              <div className="flex gap-4 mb-3">
                {[
                  { val: activeRun.scheduled_count ?? "—", lab: "đơn" },
                  { val: activeRun.on_time_pct != null ? `${activeRun.on_time_pct}%` : "—", lab: "on-time" },
                  { val: activeRun.fitness?.toLocaleString() ?? "—", lab: "fitness" },
                ].map(({ val, lab }) => (
                  <div key={lab}>
                    <div className="text-xl font-bold text-gray-900">{val}</div>
                    <div className="text-xs text-gray-400">{lab}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400 mt-auto pt-3 border-t border-green-100">
                <span>Accepted {activeRun.accepted_at?.slice(0, 10)} · {activeRun.accepted_by ?? "—"}</span>
                <span className="text-green-600">Chi tiết →</span>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col min-h-[160px]">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Lịch hiện hành</div>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-400">
                <div className="font-semibold text-sm text-gray-500">Chưa có lịch active</div>
                <div className="text-xs text-gray-400">Accept một lần chạy để kích hoạt</div>
              </div>
            </div>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 mb-4 bg-white p-2 rounded-xl shadow-sm border border-gray-100">
          {[
            { id: "draft",    label: "Lịch nháp",                badgeColor: "bg-amber-100 text-amber-800" },
            { id: "accepted", label: "Đã duyệt & Đối soát",      badgeColor: "bg-indigo-100 text-indigo-800" },
            { id: "active",   label: "Lịch chính thức (Active)", badgeColor: "bg-green-100 text-green-800" },
            { id: "running",  label: "Đang chạy & Lỗi",          badgeColor: "bg-red-100 text-red-800" },
          ].map(t => {
            const isActive = activeTab === t.id;
            const badge    = TAB_BADGES[t.id];
            return (
              <button
                key={t.id}
                onClick={() => handleTabChange(t.id)}
                className={clsx(
                  "px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-1.5",
                  isActive
                    ? "bg-blue-50 text-blue-600 border border-blue-100 shadow-sm"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50 border border-transparent"
                )}
              >
                {t.label}
                {badge > 0 && (
                  <span className={clsx("px-2 py-0.5 rounded-full text-xs font-bold shrink-0", t.badgeColor)}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bulk action toolbar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 mb-3 bg-blue-50 rounded-xl border border-blue-100">
            <span className="text-sm text-blue-700 font-medium">{selectedIds.size} lịch đã chọn</span>
            <button
              className={`${BTN_SM} bg-red-600 text-white border-red-600 hover:bg-red-700`}
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 size={12} /> Xóa {selectedIds.size} lịch
            </button>
            <button
              className={`${BTN_SM} bg-white text-gray-600 border-gray-200 hover:bg-gray-50`}
              onClick={() => setSelectedIds(new Set())}
            >
              <X size={12} /> Bỏ chọn
            </button>
          </div>
        )}

        {/* Tab content */}
        {(() => {
          const meta = TAB_META[activeTab];
          return renderTable(pagedRuns, meta.title, meta.empty);
        })()}

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between mt-3 px-1">
            <span className="text-xs text-gray-500">
              {activeTabRuns.length} lịch · trang {currentPage}/{totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="px-2 py-1 rounded border border-gray-200 text-xs text-gray-600 disabled:opacity-40 hover:bg-gray-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={12} />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const pg = totalPages <= 7
                  ? i + 1
                  : Math.max(1, Math.min(totalPages - 6, currentPage - 3)) + i;
                return (
                  <button
                    key={pg}
                    onClick={() => setCurrentPage(pg)}
                    className={clsx(
                      "px-2.5 py-1 rounded border text-xs transition-colors",
                      pg === currentPage
                        ? "bg-blue-500 text-white border-blue-500"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50",
                    )}
                  >
                    {pg}
                  </button>
                );
              })}
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="px-2 py-1 rounded border border-gray-200 text-xs text-gray-600 disabled:opacity-40 hover:bg-gray-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {showNewOrders && (
        <NewOrdersDialog
          onClose={() => setShowNewOrders(false)}
          onStartPlan={() => { setShowNewOrders(false); navigate("/runs/new"); }}
        />
      )}
      {acceptTarget && (
        <AcceptRunDialog
          run={acceptTarget}
          onClose={() => setAcceptTarget(null)}
          onAccept={() => setAcceptTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmDialog
          run={deleteTarget}
          isPending={deleteMutation.isPending}
          onClose={() => { deleteMutation.reset(); setDeleteTarget(null); }}
          onConfirm={() => {
            const force = deleteTarget.status === "running" || deleteTarget.status === "pending";
            deleteMutation.mutate({ id: deleteTarget.id, force }, {
              onSuccess: () => setDeleteTarget(null),
            });
          }}
        />
      )}
      {bulkDeleteOpen && (
        <BulkDeleteDialog
          selectedRuns={selectedRuns}
          isPending={isBulkDeleting}
          onClose={() => setBulkDeleteOpen(false)}
          onConfirm={handleBulkDelete}
        />
      )}
    </div>
  );
}
