import { useNavigate } from "react-router-dom";
import {
  RefreshCw, Plus, Package, AlertTriangle, BarChart3, Target, Activity,
} from "lucide-react";

// ─── Custom Hook ─────────────────────────────────────────────────────────────
import { useDashboardData } from "./hooks/useDashboardData";

// ─── Components ──────────────────────────────────────────────────────────────
import { PageLayout, PageContent, Topbar } from "../../components/layout";
import { Spinner } from "../../components/ui";
import KpiBlock from "./components/KpiBlock";
import ActiveRunCard from "./components/ActiveRunCard";
import FactoryHealth from "./components/FactoryHealth";
import RecentRuns from "./components/RecentRuns";
import PeriodSummary from "./components/PeriodSummary";

// ─── Computation Utils ───────────────────────────────────────────────────────
import { fmtNum } from "../../utils";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Chào buổi sáng";
  if (h < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

export default function DashboardPage() {
  const navigate = useNavigate();

  const {
    summary,
    isLoading,
    activeRun,
    recentRuns,
    user,
    todayStr,
    handleSyncErp,
  } = useDashboardData();

  return (
    <PageLayout>
      <Topbar
        title="Dashboard"
        subtitle={`${greeting()}, ${user?.full_name?.split(" ").pop() || "Planner"} · ${todayStr}`}
      >
        <button
          onClick={() => navigate("/runs/new")}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 transition shadow-sm"
        >
          <Plus size={14} /> New GA Run
        </button>
        <button
          onClick={handleSyncErp}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition shadow-sm"
        >
          <RefreshCw size={13} /> Sync ERP
        </button>
      </Topbar>

      <PageContent className="p-6 bg-slate-50 min-h-0">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner size={32} />
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPI Row */}
            <div className="grid grid-cols-4 gap-4">
              <KpiBlock
                icon={Package}
                accent="blue"
                label="Tổng đơn hàng"
                value={fmtNum(summary?.total_orders || 480)}
                trend="+18 đơn"
                up
                sub="Kể từ lần đồng bộ cuối"
              />
              <KpiBlock
                icon={Target}
                accent="green"
                label="Tỷ lệ đúng hạn"
                value={`${(summary?.on_time_pct || 96.2).toFixed(1)}%`}
                trend="+1.2pp"
                up
                sub="So với tuần trước"
              />
              <KpiBlock
                icon={AlertTriangle}
                accent="red"
                label="Đơn trễ hạn"
                value={summary?.late_orders || 14}
                trend="−3 đơn"
                up
                sub="Cần lên lịch lại"
              />
              <KpiBlock
                icon={BarChart3}
                accent="violet"
                label="Tổng sản lượng"
                value={`${((summary?.total_qty || 4_820_000) / 1_000_000).toFixed(2)}M`}
                sub={`Trên ${summary?.factories_active?.length || 5} nhà máy`}
              />
            </div>

            {/* Main grid */}
            <div className="grid grid-cols-3 gap-5">
              {/* Left 2 cols: Active GA Run & Factory Health */}
              <div className="col-span-2 flex flex-col gap-5">
                {activeRun ? (
                  <ActiveRunCard
                    activeRun={activeRun}
                    onDetailClick={() => navigate(`/runs/${activeRun.id}`)}
                    onOpenKHXClick={() => navigate("/khx-plan")}
                  />
                ) : (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                    <Activity size={28} className="mx-auto mb-2 text-slate-300" />
                    <div className="text-sm font-semibold text-slate-400">Chưa có Run nào được chọn</div>
                    <button
                      onClick={() => navigate("/runs/new")}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
                    >
                      <Plus size={13} /> Tạo GA Run mới
                    </button>
                  </div>
                )}

                <FactoryHealth />
              </div>

              {/* Right col: Recent Runs & Period Summary */}
              <div className="flex flex-col gap-5">
                <RecentRuns
                  recentRuns={recentRuns}
                  onRunClick={(runId) => navigate(`/runs/${runId}`)}
                  onAllRunsClick={() => navigate("/runs")}
                  onCreateRunClick={() => navigate("/runs/new")}
                />

                <PeriodSummary />
              </div>
            </div>
          </div>
        )}
      </PageContent>
    </PageLayout>
  );
}
