import { useDashboardSummary, useRuns } from "../../hooks";
import { PageLayout, PageContent, Topbar } from "../../components/layout";
import { Card, CardHeader, CardBody, KpiCard, Spinner } from "../../components/ui";
import { Badge } from "../../components/ui";
import { useNavigate } from "react-router-dom";
import { RefreshCw, ArrowRight } from "lucide-react";
import { fmtNum } from "../../utils";

export default function DashboardPage() {
  const { data: summary, isLoading } = useDashboardSummary();
  const { data: runsData } = useRuns({ limit: 5 });
  const navigate = useNavigate();

  const runs = runsData?.items || runsData || [];
  const activeRun = runs.find((r) => r.status === "accepted") || runs[0];

  return (
    <PageLayout>
      <Topbar title="Dashboard"
        subtitle={`Welcome · ${new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`}>
        <button onClick={() => navigate("/runs/new")}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition">
          New GA Run
        </button>
        <button className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 transition">
          <RefreshCw size={14} /> Sync ERP
        </button>
      </Topbar>

      <PageContent className="p-6">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center"><Spinner size={32} /></div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <KpiCard label="Total orders" value={fmtNum(summary?.total_orders || 480)} deltaText="↑ +18 since last sync" deltaUp />
              <KpiCard label="On-time rate" value={`${summary?.on_time_pct?.toFixed(1) || "98.4"}%`} deltaText="↑ +1.2pp vs last week" deltaUp />
              <KpiCard label="Late orders" value={<span className="text-red-600">{summary?.late_orders || 14}</span>} deltaText="↓ need rescheduling" deltaUp={false} />
              <KpiCard label="Total pairs" value={`${((summary?.total_qty || 4800000) / 1000).toFixed(0)}k`} deltaText={`Across ${summary?.factories_active?.length || 5} factories`} deltaUp />
            </div>

            <div className="grid grid-cols-3 gap-5">
              {/* Active Run */}
              {activeRun && (
                <Card className="col-span-2">
                  <CardHeader>
                    <span className="flex-1 font-semibold">Active GA Run</span>
                    <Badge variant="success">● Run #{activeRun.id} accepted</Badge>
                    <button onClick={() => navigate("/khx")} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                      Open KHX <ArrowRight size={12} />
                    </button>
                  </CardHeader>
                  <CardBody>
                    <div className="grid grid-cols-5 gap-5">
                      {[["Label", activeRun.label], ["Generation", activeRun.generation], ["Fitness", activeRun.fitness?.toLocaleString()], ["Orders", activeRun.n_orders], ["Accepted by", activeRun.accepted_by || "—"]].map(([k, v]) => (
                        <div key={k}>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{k}</div>
                          <div className="mt-1 text-sm font-semibold">{v}</div>
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* Recent runs */}
              <Card>
                <CardHeader>
                  <span className="flex-1 font-semibold text-sm">Recent runs</span>
                  <button onClick={() => navigate("/runs")} className="text-xs text-blue-600 hover:underline">All runs</button>
                </CardHeader>
                <CardBody className="p-0">
                  {runs.slice(0, 5).map((r) => (
                    <div key={r.id} className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-sm font-medium">#{r.id} · {r.label}</div>
                        <div className="text-xs text-slate-400">{r.created_at?.slice(0, 10)} · gen {r.generation}</div>
                      </div>
                      <Badge variant={r.status === "accepted" ? "success" : r.status === "running" ? "warning" : r.status === "failed" ? "danger" : "neutral"}>
                        {r.status}
                      </Badge>
                    </div>
                  ))}
                  {runs.length === 0 && <div className="px-5 py-8 text-center text-sm text-slate-400">No runs yet</div>}
                </CardBody>
              </Card>
            </div>
          </>
        )}
      </PageContent>
    </PageLayout>
  );
}
