import { Calendar, Table2, ListOrdered, CalendarDays, History, ArrowLeft, Undo2, Save, CheckCircle2, Snowflake, Bell, X } from "lucide-react";
import { clsx } from "clsx";

// ─── Custom Hook ─────────────────────────────────────────────────────────────
import { useScheduleAdjust } from "./hooks/useScheduleAdjust";

// ─── Sub-Components ──────────────────────────────────────────────────────────
import KpiPill from "./components/KpiPill";
import LateOrderCard from "./components/LateOrderCard";
import EditHistorySection from "./components/EditHistorySection";

// ─── Shared GA Config Components ─────────────────────────────────────────────
import ScheduleCalendar from "../ga-config/components/ScheduleCalendar";
import LineSequenceTab from "../ga-config/components/LineSequenceTab";
import DailyReport from "../ga-config/components/DailyReport";
import ScheduleTable from "../ga-config/components/ScheduleTable";

// ─── UI / Utilities ──────────────────────────────────────────────────────────
import { Spinner } from "../../components/ui";
import { fmtDate } from "../../utils";

const FROZEN_UNTIL = "2026-06-25";

const MAIN_TABS = [
  { key: "lich", label: "Lịch sắp xếp", Icon: Calendar },
  { key: "bang", label: "Bảng chi tiết", Icon: Table2 },
  { key: "lineup", label: "Nối đuôi", Icon: ListOrdered },
  { key: "daily", label: "Báo cáo ngày", Icon: CalendarDays },
  { key: "history", label: "Lịch sử", Icon: History },
];

export default function ScheduleAdjustPage() {
  const {
    runId,
    navigate,
    lineFilter,
    orders,
    chunks,
    apiChunks,
    chunkEdits,
    setLocalChunks,
    edits,
    setEdits,
    undoStack,
    saveStatus,
    mainTab,
    setMainTab,
    plannerNotes,
    setPlannerNotes,
    lateAlertOpen,
    setLateAlertOpen,
    hasChanges,
    kpis,
    lateOrders,
    handleChunkChanged,
    handleUndo,
    dataLoading,
    runLabel,
    toast,
    dailyRows,
  } = useScheduleAdjust();

  return (
    <div className="relative flex flex-col h-full overflow-hidden bg-white">
      {/* ── TOPBAR ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 h-12 flex items-center gap-3 border-b border-slate-200 bg-white px-4">
        {/* Back button */}
        <button
          onClick={() => navigate("/schedule-adjust")}
          className="shrink-0 flex items-center gap-1 rounded-lg px-2 py-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          title="Về danh sách lịch"
        >
          <ArrowLeft size={14} />
        </button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <span
            className="text-xs text-slate-400 hover:text-blue-600 cursor-pointer transition-colors"
            onClick={() => navigate("/schedule-adjust")}
          >
            Điều chỉnh lịch
          </span>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-bold text-slate-800 truncate max-w-[160px]">{runLabel}</span>
          {hasChanges && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold px-2 py-0.5 border border-amber-200 shrink-0">
              Chưa lưu
            </span>
          )}
        </div>

        {/* Line badges */}
        {lineFilter?.length > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            {lineFilter.map(l => (
              <span
                key={l}
                className={clsx(
                  "rounded px-1.5 py-0.5 text-[10px] font-bold",
                  l.startsWith("A")
                    ? "bg-violet-100 text-violet-700"
                    : l.startsWith("B")
                    ? "bg-blue-100 text-blue-700"
                    : "bg-teal-100 text-teal-700"
                )}
              >
                {l}
              </span>
            ))}
          </div>
        )}

        {/* KPI pills */}
        <div className="flex items-center gap-1.5 mx-auto">
          <KpiPill label="đơn" value={kpis.total} color="slate" />
          <KpiPill
            label="đúng hạn"
            value={`${kpis.onTimePct}%`}
            color={kpis.onTimePct >= 80 ? "green" : kpis.onTimePct >= 60 ? "amber" : "red"}
          />
          <KpiPill label="trễ" value={kpis.late} color={kpis.late > 0 ? "red" : "slate"} />
          <KpiPill label="chưa sắp" value={kpis.unscheduled} color={kpis.unscheduled > 0 ? "amber" : "slate"} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {saveStatus === "saving" && <span className="text-xs text-slate-400 mr-1">Đang lưu...</span>}
          {saveStatus === "saved" && (
            <span className="text-xs text-green-600 flex items-center gap-1 mr-1">
              <CheckCircle2 size={12} /> Đã lưu
            </span>
          )}

          <button
            onClick={handleUndo}
            disabled={!undoStack.length}
            title="Hoàn tác"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
          >
            <Undo2 size={13} />
            Hoàn tác
            {undoStack.length > 0 && <span className="rounded-full bg-slate-100 text-[10px] px-1.5">{undoStack.length}</span>}
          </button>

          <button
            onClick={() => toast("Đã lưu nháp lịch điều chỉnh", "success")}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            <Save size={13} />
            Lưu nháp
          </button>

          <button
            onClick={() => {
              setLocalChunks(null);
              toast("Lịch đã được xác nhận và áp dụng", "success");
            }}
            disabled={!hasChanges}
            className="flex items-center gap-1.5 rounded-lg border border-blue-600 bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition"
          >
            <CheckCircle2 size={13} />
            Xác nhận lịch
          </button>
        </div>
      </div>

      {/* ── TAB BAR ────────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex items-center">
          {MAIN_TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setMainTab(key)}
              className={clsx(
                "flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap",
                mainTab === key
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              )}
            >
              <Icon size={13} />
              {label}
              {key === "history" && chunkEdits.length > 0 && (
                <span className="rounded-full bg-blue-100 text-blue-700 text-[10px] px-1.5 font-bold">
                  {chunkEdits.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {lateOrders.length > 0 && (
            <button
              onClick={() => setLateAlertOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
            >
              <Bell size={12} className="shrink-0" />
              <span>{lateOrders.length} đơn trễ</span>
            </button>
          )}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Snowflake size={11} className="text-blue-400 shrink-0" />
            <span>
              Đóng băng đến <strong className="text-slate-600">{fmtDate(FROZEN_UNTIL)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* ── BODY ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden bg-white">
        <div className="flex-1 min-h-0 flex flex-col min-w-0">
          {dataLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Spinner size={32} />
            </div>
          ) : (
            <>
              {/* Calendar tab */}
              {mainTab === "lich" && (
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-3">
                  <ScheduleCalendar
                    runId={runId}
                    orders={orders}
                    chunks={chunks}
                    initialChunks={apiChunks}
                    setChunks={setLocalChunks}
                    edits={edits}
                    setEdits={setEdits}
                    onChunkChanged={handleChunkChanged}
                    usingFallback={dailyRows.length === 0}
                    hasDailyData={dailyRows.length > 0}
                    viewOnly={false}
                  />
                </div>
              )}

              {/* Bảng chi tiết tab */}
              {mainTab === "bang" && (
                <div className="flex-1 min-h-0 overflow-auto">
                  <div className="p-5">
                    <ScheduleTable chunks={chunks} edits={edits} />
                  </div>
                </div>
              )}

              {/* Nối đuôi tab */}
              {mainTab === "lineup" && (
                <div className="flex-1 min-h-0 overflow-auto">
                  <div className="p-5">
                    <LineSequenceTab runId={runId} orders={orders} />
                  </div>
                </div>
              )}

              {/* Báo cáo ngày tab */}
              {mainTab === "daily" && (
                <div className="flex-1 min-h-0 overflow-hidden p-4">
                  <DailyReport runId={runId} capacityOverrides={{}} />
                </div>
              )}

              {/* Lịch sử tab */}
              {mainTab === "history" && (
                <div className="flex-1 min-h-0 overflow-auto bg-slate-50">
                  <div className="p-5 max-w-5xl">
                    <EditHistorySection edits={chunkEdits} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Late-orders slide-in drawer ── */}
      {/* Backdrop */}
      <div
        onClick={() => setLateAlertOpen(false)}
        className={clsx(
          "absolute inset-0 z-40 bg-black/20 transition-opacity duration-300",
          lateAlertOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      />
      {/* Panel */}
      <div
        className={clsx(
          "absolute inset-y-0 right-0 z-50 flex w-[400px] max-w-full flex-col bg-white shadow-2xl border-l border-slate-200",
          "transition-transform duration-300 ease-in-out",
          lateAlertOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 shrink-0 bg-white">
          <Bell size={14} className="text-red-500 shrink-0" />
          <span className="flex-1 text-sm font-bold text-slate-800">Đơn trễ hạn — cần xử lý</span>
          <span className="rounded-full bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5">
            {lateOrders.length} đơn
          </span>
          <button
            onClick={() => setLateAlertOpen(false)}
            className="ml-1 rounded-md p-1 hover:bg-slate-100 text-slate-400 transition"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
          {lateOrders.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 mt-2">
              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
              <p className="text-xs font-semibold text-emerald-700">Không có đơn trễ hạn trong lịch này.</p>
            </div>
          ) : (
            lateOrders.map(o => (
              <LateOrderCard
                key={o.order_id}
                order={o}
                note={plannerNotes[o.order_id] ?? ""}
                onNoteChange={(id, v) => setPlannerNotes(n => ({ ...n, [id]: v }))}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
