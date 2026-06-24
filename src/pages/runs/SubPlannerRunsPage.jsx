import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useRuns, useActiveRun } from "../../hooks";
import { usePermissions } from "../../hooks/usePermissions";
import { useAuthStore } from "../../store/authStore";
import { http } from "../../api/http";
import { wizardStateApi } from "../../api";
import StatusBadge from "./components/StatusBadge";
import {
  Eye, Layers, Package, Loader2, Shield, Play,
  CheckCircle2, Clock, AlertTriangle, Check,
} from "lucide-react";
import { clsx } from "clsx";


const BTN_SM = "inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const TAB_DEFS = [
  { key: "draft",    label: "Lịch nháp",                filter: r => r.lifecycle_status === "draft" && r.status === "done" },
  { key: "accepted", label: "Đã duyệt & Đối soát",      filter: r => r.lifecycle_status === "accepted" || r.lifecycle_status === "verifying" },
  { key: "active",   label: "Lịch chính thức (Active)", filter: r => r.lifecycle_status === "active" },
  { key: "running",  label: "Đang chạy & Lỗi",          filter: r => r.status === "running" || r.status === "pending" || r.status === "failed" },
];

export default function SubPlannerRunsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { myLines } = usePermissions();
  const [activeTab, setActiveTab] = useState("draft");

  const { data: runsData, isLoading } = useRuns({ page: 1, page_size: 100 });
  const { data: activeRun } = useActiveRun();
  const { data: wizardPlan } = useQuery({
    queryKey: ["wizard-in-progress"],
    queryFn:  () => wizardStateApi.getWizardInProgress(),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  const { data: tasksData } = useQuery({
    queryKey: ["my-tasks", user?.username],
    queryFn: () => http.get("/tasks/my", { params: { username: user?.username } }).then(r => r.data),
    enabled: !!user,
    refetchInterval: 30000,
  });

  const runs = Array.isArray(runsData) ? runsData : (runsData?.items || []);
  const tasks = tasksData?.items || [];

  const tasksByRun = useMemo(() => {
    const map = {};
    tasks.forEach(t => {
      if (!map[t.run_id]) map[t.run_id] = [];
      map[t.run_id].push(t);
    });
    return map;
  }, [tasks]);

  const myRunIds = useMemo(() => new Set(Object.keys(tasksByRun).map(Number)), [tasksByRun]);

  const tabCounts = useMemo(() => {
    const counts = {};
    TAB_DEFS.forEach(t => {
      if (t.key === "running") {
        counts[t.key] = runs.filter(t.filter).length;
      } else {
        counts[t.key] = runs.filter(r => t.filter(r) && myRunIds.has(r.id)).length;
      }
    });
    return counts;
  }, [runs, myRunIds]);

  const activeTabRuns = useMemo(() => {
    const def = TAB_DEFS.find(t => t.key === activeTab);
    if (!def) return [];
    const filtered = runs.filter(def.filter);
    if (activeTab === "running") return filtered;
    return filtered.filter(r => myRunIds.has(r.id));
  }, [runs, activeTab, myRunIds]);

  const pendingTaskCount = useMemo(() => tasks.filter(t => t.status === "pending").length, [tasks]);
  const inProgressRuns = runs.filter(r => r.status === "running" || r.status === "pending");

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <header className="flex items-center h-14 px-5 border-b border-gray-200 bg-white shrink-0 gap-3">
        <Play size={15} className="text-blue-500" />
        <div>
          <div className="text-sm font-bold text-gray-900">Lập lịch sản xuất</div>
          <div className="text-xs text-gray-400">TailFollow + ILS · lập lịch tự động theo đuôi chuyền</div>
        </div>
        <div className="flex-1" />
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
          <Shield size={12} className="text-emerald-500" /> Chế độ xem — Sub-Planner
        </span>
      </header>

      <div className="flex-1 overflow-auto p-5 space-y-5">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4">
          {/* Pending tasks */}
          <div
            className="bg-white rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 flex flex-col min-h-[160px] cursor-pointer hover:shadow-md transition-all"
            onClick={() => setActiveTab("draft")}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-blue-500 uppercase tracking-wide">Đơn cần xác nhận</div>
              <Package size={18} className="text-blue-400" />
            </div>
            <div className="flex items-end gap-1 my-2 flex-wrap">
              <span className="text-3xl font-bold text-gray-900">{pendingTaskCount}</span>
              <span className="text-lg text-gray-400 mb-0.5">đơn</span>
              <div className="ml-2 flex flex-wrap gap-1 mb-1">
                {myLines.map(l => (
                  <span key={l} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100/80 text-emerald-800 border border-emerald-200/50">
                    <Layers size={9} /> {l}
                  </span>
                ))}
              </div>
            </div>
            {pendingTaskCount > 0 ? (
              <div className="flex items-center justify-between text-xs text-gray-400 mt-auto pt-3 border-t border-blue-100">
                <span className="flex items-center gap-1 text-amber-600 font-medium">
                  <Clock size={12} className="text-amber-500 animate-pulse" /> Đang chờ phản hồi của bạn
                </span>
                <span className="text-blue-500 font-medium">Xem danh sách →</span>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-gray-400 mt-auto pt-3 border-t border-blue-100">
                <span className="flex items-center gap-1 text-green-600 font-medium">
                  <CheckCircle2 size={12} className="text-green-500" /> Đã hoàn tất mọi xác nhận
                </span>
                <span className="text-blue-500 font-medium">Xem danh sách →</span>
              </div>
            )}
          </div>

          {/* In-progress plan */}
          <div
            className={clsx(
              "bg-white rounded-xl border p-4 flex flex-col transition-all",
              wizardPlan ? "border-amber-200 bg-gradient-to-br from-amber-50/50 to-white cursor-pointer hover:shadow-md" : "border-gray-200"
            )}
            onClick={() => {
              if (wizardPlan) navigate(`/runs/${wizardPlan.id}`);
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">KẾ HOẠCH ĐANG THỰC HIỆN</div>
              {wizardPlan && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {wizardPlan.status === "running" ? "Đang chạy GA" : wizardPlan.status === "done" ? "Chờ xác nhận" : "Đang soạn"}
                </span>
              )}
            </div>
            {wizardPlan ? (
              <>
                <div className="text-sm font-bold text-gray-900 truncate mb-2">
                  {wizardPlan.label || `Nháp #${wizardPlan.id}`}
                </div>
                <div className="flex items-center gap-1 mb-2.5">
                  {["Đơn","Năng lực","NVL","GC","Chạy","Sửa","Xác nhận"].map((s, i) => {
                    const done = i < wizardPlan.wizard_step;
                    const cur  = i === wizardPlan.wizard_step;
                    const gaLocked = wizardPlan.status !== "draft" && i < 4;
                    return (
                      <div key={i} className="flex items-center gap-1">
                        <div title={s} className={clsx(
                          "w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold transition-colors",
                          cur  ? "bg-blue-600 text-white" :
                          done ? "bg-green-500 text-white" :
                          gaLocked ? "bg-gray-200 text-gray-400" :
                          "bg-gray-100 text-gray-400"
                        )}>
                          {done && !cur ? <Check size={8} /> : i + 1}
                        </div>
                        {i < 6 && <div className={clsx("w-2 h-0.5", i < wizardPlan.wizard_step ? "bg-green-400" : "bg-gray-200")} />}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between mt-auto pt-2 border-t border-amber-100/50 text-[10px] text-gray-400">
                  <span>Bước {wizardPlan.wizard_step + 1}/7 · {["Chọn đơn","Năng lực chuyền","NVL về","Ngày GC","Chạy lịch","Chỉnh sửa","Xác nhận"][wizardPlan.wizard_step] ?? ""}</span>
                  <span className="text-amber-600 font-semibold flex items-center gap-0.5">Chi tiết →</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center h-12 rounded-lg bg-gray-50 border border-dashed border-gray-200 mt-1">
                  <span className="text-xs text-gray-400">Không có kế hoạch đang chạy</span>
                </div>
                <div className="text-[10px] text-gray-400 mt-auto pt-2">Chọn đơn → năng lực → NVL → chạy → sửa → xác nhận · 7 bước</div>
              </>
            )}
          </div>


          {/* Active run */}
          {activeRun ? (
            <div
              className="bg-white rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-white p-5 flex flex-col min-h-[160px] cursor-pointer hover:shadow-md transition-all"
              onClick={() => navigate(`/runs/${activeRun.id}`)}>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs font-medium text-green-600 uppercase tracking-wide">Lịch hiện hành</div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />Active
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
                <span className="text-green-600 font-medium flex items-center gap-0.5">Chi tiết →</span>
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

        {/* Tabs + table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {TAB_DEFS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={clsx(
                  "flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                  activeTab === t.key
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-700",
                )}
              >
                {t.label}
                {tabCounts[t.key] > 0 && (
                  <span className={clsx(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold",
                    activeTab === t.key ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500",
                  )}>
                    {tabCounts[t.key]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-blue-500" />
            </div>
          ) : activeTabRuns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Package size={28} className="mb-2 text-gray-300" />
              <div className="font-semibold text-gray-500 text-sm">Không có lịch nào</div>
              <div className="text-xs mt-1">
                {activeTab === "draft"    ? "Chưa có lịch nháp nào liên quan đến bạn" :
                 activeTab === "accepted" ? "Chưa có lịch đang chờ duyệt" :
                 activeTab === "active"   ? "Chưa có lịch chính thức" :
                                           "Không có kế hoạch đang chạy"}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                <div className="text-sm font-semibold text-gray-900">
                  {activeTab === "draft"    ? "Lịch nháp — đang chờ duyệt" :
                   activeTab === "accepted" ? "Đã duyệt & Đối soát" :
                   activeTab === "active"   ? "Lịch chính thức (Active)" :
                                             "Đang chạy & Lỗi"}
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                  {activeTabRuns.length} lịch
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/70 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    <th className="px-3 py-3">#ID</th>
                    <th className="px-3 py-3">Nhãn lịch</th>
                    <th className="px-3 py-3">Trạng thái vòng đời</th>
                    <th className="px-3 py-3">Thời gian chạy</th>
                    <th className="px-3 py-3 text-right">Tổng đơn</th>
                    <th className="px-3 py-3">Tỷ lệ On-Time</th>
                    <th className="px-5 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTabRuns.map(r => {
                    const runTasks     = tasksByRun[r.id] || [];
                    const primaryCount = runTasks.filter(t => t.order_id && !t.is_support).length;
                    const supportCount = runTasks.filter(t => t.order_id && t.is_support).length;
                    const pendingCnt   = runTasks.filter(t => t.status === "pending").length;
                    const hasMyTasks   = runTasks.length > 0;

                    return (
                      <tr
                        key={r.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/runs/${r.id}`)}
                      >
                        <td className="px-3 py-3 font-bold text-gray-900 w-14">#{r.id}</td>
                        <td className="px-3 py-3 text-xs font-medium">
                          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{r.label}</code>
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge run={r} />
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-500">
                          {r.started_at?.slice(0, 16).replace("T", " ")}
                        </td>
                        <td className="px-3 py-3 text-xs text-right">
                          <div className="font-semibold text-gray-900">{r.scheduled_count ?? "—"}</div>
                          {hasMyTasks && (
                            <div className="text-[10px] text-gray-400 mt-0.5 flex items-center justify-end gap-1.5 flex-wrap">
                              {primaryCount > 0 && (
                                <span className="text-blue-600 font-semibold">{primaryCount} chính</span>
                              )}
                              {supportCount > 0 && (
                                <span className="text-violet-500 font-semibold">{supportCount} phụ</span>
                              )}
                              {pendingCnt > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-amber-600 font-semibold">
                                  <AlertTriangle size={8} /> {pendingCnt} chờ XN
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs font-bold">
                          {r.on_time_pct != null ? (
                            <span style={{ color: r.on_time_pct >= 80 ? "#047857" : "#b45309" }}>
                              {r.on_time_pct}%
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <button
                            className={`${BTN_SM} bg-white text-gray-700 border-gray-200 hover:bg-gray-50`}
                            onClick={() => navigate(`/runs/${r.id}`)}
                          >
                            <Eye size={12} /> Chi tiết
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
