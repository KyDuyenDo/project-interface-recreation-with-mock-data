import { useNavigate } from "react-router-dom";
import { Plus, Trash2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { clsx } from "clsx";

// ─── Custom Hook ─────────────────────────────────────────────────────────────
import { useRunsPageData, PAGE_SIZE_TAB } from "./hooks/useRunsPageData";

// ─── Components ──────────────────────────────────────────────────────────────
import RunsHeroCards from "./components/RunsHeroCards";
import RunsTable from "./components/RunsTable";
import DeleteConfirmDialog from "./components/DeleteConfirmDialog";
import BulkDeleteDialog from "./components/BulkDeleteDialog";
import AcceptRunDialog from "./components/AcceptRunDialog";
import NewOrdersDialog from "./components/NewOrdersDialog";
import SubPlannerRunsPage from "./SubPlannerRunsPage";
import { usePermissions } from "../../hooks/usePermissions";

const BTN = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SM = "inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

function RunsPageMain() {
  const {
    navigate, perms,
    acceptTarget, setAcceptTarget,
    deleteTarget, setDeleteTarget,
    showNewOrders, setShowNewOrders,
    activeTab,
    selectedIds, setSelectedIds,
    currentPage, setCurrentPage, totalPages,
    bulkDeleteOpen, setBulkDeleteOpen,
    isBulkDeleting,
    deleteMutation,
    wizardPlan, runs, activeRun, activeRunId, newOrdersCount,
    TAB_BADGES, activeTabRuns, pagedRuns, allPageSelected,
    toggleSelectAll, toggleSelect, handleTabChange, handleStartFresh, handleBulkDelete,
  } = useRunsPageData();

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
      </header>

      <div className="flex-1 overflow-auto bg-gray-50 p-5">
        {/* Metric Cards Row */}
        <RunsHeroCards
          newOrdersCount={newOrdersCount}
          onShowNewOrders={() => setShowNewOrders(true)}
          wizardPlan={wizardPlan}
          onNavigateToWizard={(id) => navigate(id ? `/runs/new?resume=${id}` : "/runs/new")}
          onStartFresh={handleStartFresh}
          activeRun={activeRun}
          onNavigateToActiveRun={(id) => navigate(`/runs/${id}`)}
        />

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

        {/* Bulk Action Toolbar */}
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

        {/* Data Table */}
        <RunsTable
          runs={pagedRuns}
          activeTabRuns={activeTabRuns}
          activeTab={activeTab}
          activeRunId={activeRunId}
          selectedIds={selectedIds}
          allPageSelected={allPageSelected}
          toggleSelectAll={toggleSelectAll}
          toggleSelect={toggleSelect}
          onNavigateDetail={(id) => navigate(`/runs/${id}`)}
          onAcceptTarget={setAcceptTarget}
          onDeleteTarget={setDeleteTarget}
          isMain={perms.isMain}
        />

        {/* Pagination Controls */}
        {totalPages > 1 && (
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

      {/* Overlays / Modals */}
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
          selectedRuns={runs.filter(r => selectedIds.has(r.id))}
          isPending={isBulkDeleting}
          onClose={() => setBulkDeleteOpen(false)}
          onConfirm={handleBulkDelete}
        />
      )}
    </div>
  );
}

export default function RunsPage() {
  const { isSub } = usePermissions();
  if (isSub) return <SubPlannerRunsPage />;
  return <RunsPageMain />;
}
