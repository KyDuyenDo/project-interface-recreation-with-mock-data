import { useDashboardSummary, useRuns } from "../../hooks";
import { PageLayout, PageContent, Topbar } from "../../components/layout";
import { Spinner, Badge } from "../../components/ui";
import { useNavigate } from "react-router-dom";
import {
  RefreshCw, ArrowRight, Plus, TrendingUp, TrendingDown,
  Package, Clock, CheckCircle2, AlertTriangle, Zap, BarChart3,
  Factory, ChevronRight, Activity, Calendar, Target, Layers,
} from "lucide-react";
import { fmtNum } from "../../utils";
import { useAuthStore } from "../../store/authStore";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Chào buổi sáng";
  if (h < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

const FACTORIES = [
  { id: "B-F2", lines: ["B_L01","B_L02","B_L03","B_L04","B_L05"], onTime: 97, load: 88 },
  { id: "C-F2", lines: ["C_L01","C_L02","C_L03","C_L04"],         onTime: 95, load: 92 },
  { id: "A-F1", lines: ["A_L01","A_L02","A_L03"],                 onTime: 98, load: 75 },
];

function StatusDot({ pct }) {
  if (pct >= 95) return <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />;
  if (pct >= 88) return <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />;
  return <span className="inline-block h-2 w-2 rounded-full bg-red-400" />;
}

function KpiBlock({ icon: Icon, label, value, sub, trend, up, accent }) {
  const colors = {
    blue:    { bg: "bg-blue-50",    icon: "text-blue-600",    ring: "ring-blue-100" },
    green:   { bg: "bg-emerald-50", icon: "text-emerald-600", ring: "ring-emerald-100" },
    red:     { bg: "bg-red-50",     icon: "text-red-500",     ring: "ring-red-100" },
    violet:  { bg: "bg-violet-50",  icon: "text-violet-600",  ring: "ring-violet-100" },
  };
  const c = colors[accent] || colors.blue;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ring-4 ${c.bg} ${c.ring}`}>
          <Icon size={18} className={c.icon} />
        </div>
        {trend && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${up ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
            {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {trend}
          </span>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold tracking-tight text-slate-900">{value}</div>
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mt-0.5">{label}</div>
      </div>
      {sub && <div className="text-xs text-slate-400 border-t border-slate-100 pt-2">{sub}</div>}
    </div>
  );
}

function RunStatusBadge({ status }) {
  const cfg = {
    accepted:  { label: "Accepted",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    active:    { label: "Active",    cls: "bg-blue-50 text-blue-700 border-blue-200" },
    running:   { label: "Running",   cls: "bg-amber-50 text-amber-700 border-amber-200" },
    done:      { label: "Done",      cls: "bg-slate-100 text-slate-600 border-slate-200" },
    failed:    { label: "Failed",    cls: "bg-red-50 text-red-600 border-red-200" },
    superseded:{ label: "Superseded",cls: "bg-slate-100 text-slate-400 border-slate-200" },
  };
  const c = cfg[status] || cfg.done;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${c.cls}`}>
      {c.label}
    </span>
  );
}

export default function DashboardPage() {
  const { data: summary, isLoading } = useDashboardSummary();
  const { data: runsData } = useRuns({ limit: 8 });
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const runs = runsData?.items || runsData || [];
  const activeRun = runs.find(r => r.lifecycle_status === "active" || r.is_accepted) || runs[0];
  const recentRuns = runs.slice(0, 6);

  const todayStr = new Date().toLocaleDateString("vi-VN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });

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
        <button className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition shadow-sm">
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

              {/* Left 2 cols: Active Run + Factory Health */}
              <div className="col-span-2 flex flex-col gap-5">

                {/* Active Run */}
                {activeRun ? (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                      <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow">
                        <Zap size={16} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-slate-900">Active GA Run</div>
                        <div className="text-xs text-slate-500 font-mono">{activeRun.label}</div>
                      </div>
                      <Badge variant="success">● Run #{activeRun.id}</Badge>
                      <button
                        onClick={() => navigate(`/runs/${activeRun.id}`)}
                        className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
                      >
                        Chi tiết <ArrowRight size={12} />
                      </button>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-5 divide-x divide-slate-100">
                      {[
                        { label: "Period", value: activeRun.period_label || "—" },
                        { label: "Thế hệ (gen)", value: activeRun.generation?.toLocaleString() || "—" },
                        { label: "Fitness score", value: activeRun.fitness?.toLocaleString() || "—" },
                        { label: "Đơn hàng", value: activeRun.n_orders || "—" },
                        { label: "On-time", value: activeRun.on_time_pct ? `${activeRun.on_time_pct}%` : "—" },
                      ].map(({ label, value }) => (
                        <div key={label} className="px-5 py-4">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
                          <div className="mt-1 text-sm font-bold text-slate-800">{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* On-time bar */}
                    <div className="px-5 pb-4">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                        <span>Tỷ lệ đúng hạn</span>
                        <span className="font-semibold text-emerald-600">{activeRun.on_time_pct || 96}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
                          style={{ width: `${activeRun.on_time_pct || 96}%` }}
                        />
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-t border-slate-100">
                      <span className="text-xs text-slate-400">
                        Accepted by <span className="font-semibold text-slate-600">{activeRun.accepted_by || "—"}</span>
                      </span>
                      <button
                        onClick={() => navigate("/khx")}
                        className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                      >
                        <Layers size={11} /> Mở KHX <ArrowRight size={11} />
                      </button>
                    </div>
                  </div>
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

                {/* Factory Health */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                    <Factory size={15} className="text-slate-400" />
                    <span className="flex-1 text-sm font-bold text-slate-800">Tình trạng nhà máy</span>
                    <span className="text-xs text-slate-400">{FACTORIES.length} nhà máy · {FACTORIES.reduce((a, f) => a + f.lines.length, 0)} chuyền</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {FACTORIES.map(f => (
                      <div key={f.id} className="flex items-center gap-4 px-5 py-3.5">
                        <div className="flex items-center gap-2 w-20 shrink-0">
                          <StatusDot pct={f.onTime} />
                          <span className="text-sm font-bold text-slate-700">{f.id}</span>
                        </div>
                        <div className="flex gap-1 flex-1 flex-wrap">
                          {f.lines.map(l => (
                            <span key={l} className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{l}</span>
                          ))}
                        </div>
                        <div className="flex items-center gap-4 shrink-0 text-right">
                          <div>
                            <div className="text-[10px] text-slate-400">On-time</div>
                            <div className={`text-sm font-bold ${f.onTime >= 95 ? "text-emerald-600" : f.onTime >= 88 ? "text-amber-600" : "text-red-500"}`}>
                              {f.onTime}%
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-400 text-right">Tải</div>
                            <div className="w-16 mt-1">
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${f.load > 90 ? "bg-amber-400" : "bg-blue-400"}`}
                                  style={{ width: `${f.load}%` }}
                                />
                              </div>
                              <div className="text-[10px] text-slate-400 text-right mt-0.5">{f.load}%</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right col: Recent Runs */}
              <div className="flex flex-col gap-5">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col">
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                    <Clock size={14} className="text-slate-400" />
                    <span className="flex-1 text-sm font-bold text-slate-800">Runs gần đây</span>
                    <button onClick={() => navigate("/runs")} className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-0.5">
                      Xem tất cả <ChevronRight size={12} />
                    </button>
                  </div>
                  <div className="flex-1 divide-y divide-slate-100">
                    {recentRuns.map(r => (
                      <button
                        key={r.id}
                        onClick={() => navigate(`/runs/${r.id}`)}
                        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition text-left group"
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${
                          r.lifecycle_status === "active" || r.is_accepted
                            ? "bg-blue-100 text-blue-700"
                            : r.status === "failed"
                            ? "bg-red-100 text-red-600"
                            : "bg-slate-100 text-slate-500"
                        }`}>
                          {r.id}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-xs font-semibold text-slate-700 font-mono">#{r.id} {r.label?.slice(0, 20)}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{r.period_label} · gen {r.generation}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <RunStatusBadge status={r.lifecycle_status || r.status} />
                          {r.on_time_pct && (
                            <span className="text-[10px] font-semibold text-emerald-600">{r.on_time_pct}%</span>
                          )}
                        </div>
                      </button>
                    ))}
                    {recentRuns.length === 0 && (
                      <div className="py-12 text-center text-sm text-slate-400">
                        <Activity size={24} className="mx-auto mb-2 text-slate-200" />
                        Chưa có run nào
                      </div>
                    )}
                  </div>
                  <div className="border-t border-slate-100 px-5 py-3 bg-slate-50 rounded-b-2xl">
                    <button
                      onClick={() => navigate("/runs/new")}
                      className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
                    >
                      <Plus size={12} /> Tạo GA Run mới
                    </button>
                  </div>
                </div>

                {/* Period summary card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                    <Calendar size={14} className="text-slate-400" />
                    <span className="text-sm font-bold text-slate-800">Kỳ kế hoạch</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {[
                      { label: "Tháng 7/2026", range: "01/07 – 31/07", status: "upcoming", runs: 0 },
                      { label: "Tháng 6/2026", range: "01/06 – 30/06", status: "active",   runs: 4 },
                      { label: "Tháng 5/2026", range: "01/05 – 31/05", status: "done",     runs: 2 },
                    ].map(p => (
                      <div key={p.label} className="flex items-center gap-3 px-5 py-3">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          p.status === "active" ? "bg-blue-500" :
                          p.status === "done" ? "bg-emerald-400" : "bg-slate-300"
                        }`} />
                        <div className="flex-1">
                          <div className="text-xs font-semibold text-slate-700">{p.label}</div>
                          <div className="text-[10px] text-slate-400">{p.range}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-slate-600">{p.runs} runs</div>
                          <div className={`text-[10px] font-medium ${
                            p.status === "active" ? "text-blue-600" :
                            p.status === "done" ? "text-emerald-600" : "text-slate-400"
                          }`}>
                            {p.status === "active" ? "Đang chạy" : p.status === "done" ? "Hoàn thành" : "Sắp tới"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </PageContent>
    </PageLayout>
  );
}
