import { Workbook } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";
import { Search, Download, X, SlidersHorizontal, RefreshCw } from "lucide-react";

// ─── Custom Hook ─────────────────────────────────────────────────────────────
import { useOrdersPageData, COLUMNS } from "./hooks/useOrdersPageData";

// ─── Components ──────────────────────────────────────────────────────────────
import { PageLayout, Topbar, FilterBar } from "../../components/layout";
import { Spinner } from "../../components/ui";
import DateRangeChip from "./components/DateRangeChip";
import PagStrip from "./components/PagStrip";
import PendingSaveBar from "./components/PendingSaveBar";

export default function OrdersPage() {
  const {
    filters,
    page,
    setPage,
    editQueue,
    setEditQueue,
    isSaving,
    setFilter,
    resetAll,
    isLoading,
    isFetching,
    total,
    gaPendingCt,
    active,
    sheets,
    handleCellUpdateBefore,
    handleSaveAll,
    pageSize,
  } = useOrdersPageData();

  return (
    <PageLayout>
      <Topbar title="BAO_CAO_SO_DUOI" subtitle="Tiến độ sản xuất · GA plan + PDSCH">
        <button
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          onClick={() => window.print()}
        >
          <Download size={14} /> Export
        </button>
      </Topbar>

      {/* Filter bar */}
      <FilterBar>
        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="rounded-full border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs placeholder:text-slate-400 focus:border-blue-400 focus:outline-none w-60"
            placeholder="Tìm mã đơn hàng, article…"
            value={filters.search}
            onChange={(e) => setFilter({ search: e.target.value })}
          />
        </div>

        <div className="h-5 w-px bg-slate-200" />

        <DateRangeChip
          label="LPD range"
          from={filters.lpd_from}
          to={filters.lpd_to}
          onFromChange={(v) => setFilter({ lpd_from: v })}
          onToChange={(v) => setFilter({ lpd_to: v })}
        />

        {active > 0 && (
          <>
            <div className="h-5 w-px bg-slate-200" />
            <div className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
              <SlidersHorizontal size={12} /> {active} filter{active > 1 ? "s" : ""}
            </div>
            <button
              onClick={resetAll}
              className="flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition"
            >
              <X size={11} /> Reset
            </button>
          </>
        )}

        <div className="flex-1" />

        {isFetching && !isLoading && (
          <span className="flex items-center gap-1 text-[11px] text-blue-500 animate-pulse">
            <RefreshCw size={11} className="animate-spin" /> Refreshing…
          </span>
        )}
        <span className="text-xs text-slate-400">
          {total.toLocaleString()} PDSCH · page {page}
        </span>
        {gaPendingCt > 0 && (
          <span className="rounded-full bg-yellow-50 border border-yellow-200 px-2.5 py-1 text-[10px] font-semibold text-yellow-700">
            {gaPendingCt} chờ ERP
          </span>
        )}
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-600">
          {COLUMNS.length} cols
        </span>
      </FilterBar>

      {/* Pending save bar */}
      <PendingSaveBar
        queue={editQueue}
        onSave={handleSaveAll}
        onDiscard={() => setEditQueue({})}
        isSaving={isSaving}
      />

      {/* Sheet area */}
      <div className="flex flex-col" style={{ height: "calc(100vh - 116px)" }}>
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner size={36} />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-hidden">
              <Workbook
                data={sheets}
                showToolbar={true}
                showFormulaBar={true}
                showSheetTabs={true}
                allowEdit={true}
                onCellUpdateBefore={handleCellUpdateBefore}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
            <PagStrip page={page} total={total} pageSize={pageSize} onChange={setPage} />
          </>
        )}
      </div>
    </PageLayout>
  );
}
