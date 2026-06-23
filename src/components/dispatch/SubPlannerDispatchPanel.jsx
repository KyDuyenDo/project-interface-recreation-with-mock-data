/**
 * SubPlannerDispatchPanel
 * Shared component for Steps 2, 3, 4, 6 of the GA Config wizard.
 *
 * Shows:
 *  - Pre-dispatch: list of sub-planners + "Phân công" button
 *  - Post-dispatch: per-planner status table, progress bar, polling
 *  - Rejection handling: reject reason + "Phân công lại" button
 *
 * Props:
 *   runId        — draftRunId (steps 2-4) or runId (step 6)
 *   dispatchStep — wizard step number: 2, 3, 4, or 6
 *   readOnly     — if true, no dispatch button (sub-planner view)
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, CheckCircle2, Clock, AlertTriangle, RefreshCw,
  ChevronDown, ChevronUp, Loader2, Send, RotateCcw, Eye, Info,
} from "lucide-react";
import http from "../../api/http";

// ── Step metadata ──────────────────────────────────────────────────────────────
const STEP_META = {
  2: {
    label:       "Phân công xác nhận chuyền",
    description: "Phân công để Sub-Planner xác nhận kế hoạch ưu tiên chuyền & năng lực.",
    subTaskHint: "Sub-Planner xem kế hoạch → Chấp nhận hoặc Từ chối",
    color:       "blue",
  },
  3: {
    label:       "Phân công nhập NVL về",
    description: "Sub-Planner nhập ngày dự kiến NVL về cho các đơn hàng thuộc chuyền mình.",
    subTaskHint: "Sub-Planner nhập ngày NVL → Xác nhận hoàn tất",
    color:       "teal",
  },
  4: {
    label:       "Phân công nhập ngày GC",
    description: "Sub-Planner nhập ngày bắt đầu & kết thúc gia công cho đơn của chuyền mình.",
    subTaskHint: "Sub-Planner nhập ngày GC → Xác nhận hoàn tất",
    color:       "orange",
  },
  6: {
    label:       "Phân công review lịch",
    description: "Sub-Planner review lịch sản xuất GA sinh ra → Chấp nhận hoặc yêu cầu chỉnh sửa.",
    subTaskHint: "Sub-Planner review lịch chuyền → Chấp nhận hoặc Từ chối",
    color:       "purple",
  },
};

// Status chip
function StatusChip({ status }) {
  const cfg = {
    confirmed: { label: "Đã xác nhận", cls: "bg-green-100 text-green-700", icon: <CheckCircle2 size={11} /> },
    rejected:  { label: "Từ chối",     cls: "bg-red-100   text-red-700",   icon: <AlertTriangle size={11} /> },
    pending:   { label: "Chờ xác nhận",cls: "bg-amber-100 text-amber-700", icon: <Clock size={11} /> },
    submitted: { label: "Đã gửi",      cls: "bg-blue-100  text-blue-700",  icon: <Send size={11} /> },
  }[status] || { label: status, cls: "bg-gray-100 text-gray-500", icon: null };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.cls}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// Avatar initials
function Avatar({ name, color = "blue" }) {
  const initials = name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
  const colors = {
    blue: "bg-blue-100 text-blue-700", teal: "bg-teal-100 text-teal-700",
    orange: "bg-orange-100 text-orange-700", purple: "bg-purple-100 text-purple-700",
  };
  return (
    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${colors[color] || colors.blue}`}>
      {initials}
    </span>
  );
}

export default function SubPlannerDispatchPanel({ runId, dispatchStep, readOnly = false }) {
  const qc = useQueryClient();
  const meta = STEP_META[dispatchStep] || STEP_META[2];

  const [expanded, setExpanded] = useState(true);
  const [dispatched, setDispatched] = useState(false);

  // ── Fetch dispatch status ──────────────────────────────────────────────────
  const { data: statusData, isLoading: statusLoading, refetch } = useQuery({
    queryKey: ["dispatch-status", runId, dispatchStep],
    queryFn:  () =>
      http.get(`/runs/${runId}/dispatch-status`, { params: { step: dispatchStep } })
          .then(r => r.data),
    enabled:  !!runId && dispatched,
    refetchInterval: dispatched ? 8000 : false,
  });

  // If we load and status is already dispatched (resume scenario), mark as dispatched
  useEffect(() => {
    if (statusData?.dispatched) setDispatched(true);
  }, [statusData?.dispatched]);

  // ── Dispatch mutation ──────────────────────────────────────────────────────
  const dispatchMut = useMutation({
    mutationFn: () =>
      http.post(`/runs/${runId}/dispatch`, { step: dispatchStep }).then(r => r.data),
    onSuccess: () => {
      setDispatched(true);
      qc.invalidateQueries({ queryKey: ["dispatch-status", runId, dispatchStep] });
    },
  });

  if (!runId) return null;

  const planners = statusData?.planners || [];
  const confirmedCount = planners.filter(p => p.status === "confirmed").length;
  const rejectedCount  = planners.filter(p => p.status === "rejected").length;
  const total = planners.length;
  const allConfirmed = total > 0 && confirmedCount === total;

  // Border/accent colour by step
  const accent = {
    2: "border-blue-200   bg-blue-50",
    3: "border-teal-200   bg-teal-50",
    4: "border-orange-200 bg-orange-50",
    6: "border-purple-200 bg-purple-50",
  }[dispatchStep] || "border-blue-200 bg-blue-50";

  const headerBg = {
    2: "bg-blue-50   text-blue-800",
    3: "bg-teal-50   text-teal-800",
    4: "bg-orange-50 text-orange-800",
    6: "bg-purple-50 text-purple-800",
  }[dispatchStep] || "bg-blue-50 text-blue-800";

  const btnColor = {
    2: "bg-blue-600   hover:bg-blue-700   border-blue-600",
    3: "bg-teal-600   hover:bg-teal-700   border-teal-600",
    4: "bg-orange-500 hover:bg-orange-600 border-orange-500",
    6: "bg-purple-600 hover:bg-purple-700 border-purple-600",
  }[dispatchStep] || "bg-blue-600 hover:bg-blue-700 border-blue-600";

  return (
    <div className={`rounded-xl border shadow-sm overflow-hidden ${accent}`}>
      {/* ── Header ── */}
      <button
        className={`w-full flex items-center gap-2.5 px-4 py-3 text-left ${headerBg} transition-colors`}
        onClick={() => setExpanded(e => !e)}
      >
        <Users size={14} className="shrink-0" />
        <span className="text-sm font-bold flex-1">{meta.label}</span>

        {/* Summary badges */}
        {dispatched && (
          <span className="flex items-center gap-2">
            {allConfirmed ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                <CheckCircle2 size={11} /> Tất cả đã xác nhận
              </span>
            ) : (
              <>
                {confirmedCount > 0 && (
                  <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                    {confirmedCount}/{total} xác nhận
                  </span>
                )}
                {rejectedCount > 0 && (
                  <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                    {rejectedCount} từ chối
                  </span>
                )}
                {!dispatched || (!confirmedCount && !rejectedCount) ? null : null}
              </>
            )}
          </span>
        )}
        {!dispatched && !readOnly && (
          <span className="text-xs text-gray-500 font-medium">Chưa phân công</span>
        )}
        {readOnly && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Eye size={11} /> Xem
          </span>
        )}

        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* ── Body ── */}
      {expanded && (
        <div className="bg-white border-t border-gray-100">

          {/* Pre-dispatch state */}
          {!dispatched && (
            <div className="p-4 space-y-3">
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <Info size={14} className="shrink-0 mt-0.5 text-gray-400" />
                <span>{meta.description}</span>
              </div>

              {/* Sub-task hint */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600">
                <Send size={12} className="text-gray-400 shrink-0" />
                <span><strong>Việc Sub-Planner cần làm:</strong> {meta.subTaskHint}</span>
              </div>

              {/* List sub-planners from static data */}
              <PlannerPreviewList dispatchStep={dispatchStep} />

              {!readOnly && (
                <div className="flex justify-end pt-1">
                  <button
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold text-white transition-colors disabled:opacity-50 ${btnColor}`}
                    onClick={() => dispatchMut.mutate()}
                    disabled={dispatchMut.isPending}
                  >
                    {dispatchMut.isPending ? (
                      <><Loader2 size={14} className="animate-spin" /> Đang phân công…</>
                    ) : (
                      <><Send size={14} /> Phân công Sub-Planner</>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Post-dispatch state */}
          {dispatched && (
            <div className="p-4 space-y-3">
              {/* Sub-task hint */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600">
                <Send size={12} className="text-gray-400 shrink-0" />
                <span><strong>Sub-Planner đang thực hiện:</strong> {meta.subTaskHint}</span>
              </div>

              {/* Progress bar */}
              {total > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{confirmedCount}/{total} Sub-Planner đã xác nhận</span>
                    {allConfirmed && (
                      <span className="flex items-center gap-1 text-green-600 font-semibold">
                        <CheckCircle2 size={11} /> Sẵn sàng sang bước tiếp
                      </span>
                    )}
                    {rejectedCount > 0 && (
                      <span className="flex items-center gap-1 text-red-600 font-semibold">
                        <AlertTriangle size={11} /> Có {rejectedCount} từ chối — cần chỉnh sửa
                      </span>
                    )}
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${allConfirmed ? "bg-green-500" : rejectedCount > 0 ? "bg-amber-500" : "bg-blue-500"}`}
                      style={{ width: `${total ? (confirmedCount / total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Status table */}
              {statusLoading ? (
                <div className="flex items-center gap-2 py-4 justify-center text-sm text-gray-400">
                  <Loader2 size={16} className="animate-spin" /> Đang tải trạng thái…
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Sub-Planner</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Chuyền phụ trách</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Trạng thái</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Cập nhật</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {planners.map((p) => (
                        <tr key={p.username} className="hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <Avatar name={p.name} color={meta.color} />
                              <span className="font-medium text-gray-800 text-sm">{p.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {(p.lines || []).map(l => (
                                <span key={l} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                                  {l}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="space-y-1">
                              <StatusChip status={p.status} />
                              {p.status === "rejected" && p.reject_reason && (
                                <div className="flex items-start gap-1 text-[11px] text-red-600 bg-red-50 rounded px-2 py-1 max-w-xs">
                                  <AlertTriangle size={10} className="shrink-0 mt-0.5" />
                                  <span>{p.reject_reason}</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-400">
                            {p.updated_at ? new Date(p.updated_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                          </td>
                        </tr>
                      ))}
                      {planners.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-400">
                            Chưa có Sub-Planner được phân công
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Action row */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  onClick={() => refetch()}
                >
                  <RefreshCw size={13} /> Làm mới
                </button>
                {!readOnly && (
                  <button
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 text-sm text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                    onClick={() => dispatchMut.mutate()}
                    disabled={dispatchMut.isPending}
                  >
                    {dispatchMut.isPending
                      ? <><Loader2 size={13} className="animate-spin" /> Đang phân công lại…</>
                      : <><RotateCcw size={13} /> Phân công lại</>
                    }
                  </button>
                )}
                <div className="flex-1" />
                {allConfirmed && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
                    <CheckCircle2 size={13} /> Tất cả xác nhận — có thể sang bước tiếp
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Pre-dispatch: show which sub-planners will be assigned (from line assignments)
function PlannerPreviewList({ dispatchStep }) {
  const { data, isLoading } = useQuery({
    queryKey: ["line-assignments-preview"],
    queryFn:  () => http.get("/lines/assignments").then(r => r.data),
    staleTime: 60000,
  });

  if (isLoading) {
    return <div className="flex items-center gap-2 py-2 text-sm text-gray-400"><Loader2 size={13} className="animate-spin" /> Đang tải danh sách…</div>;
  }

  // /lines/assignments returns { items: [...] }
  const items = Array.isArray(data) ? data : (data?.items || []);

  // Group by planner
  const byPlanner = {};
  for (const a of items) {
    if (!a.planner_username) continue;
    if (!byPlanner[a.planner_username]) {
      byPlanner[a.planner_username] = { name: a.planner_name, lines: [] };
    }
    byPlanner[a.planner_username].lines.push(a.line_id);
  }

  const planners = Object.values(byPlanner);
  if (!planners.length) return null;

  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Sub-Planner sẽ nhận việc</div>
      <div className="grid gap-1.5">
        {planners.map(p => (
          <div key={p.name} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
            <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
            <span className="text-sm font-medium text-gray-700 flex-1">{p.name}</span>
            <div className="flex flex-wrap gap-1 justify-end">
              {p.lines.map(l => (
                <span key={l} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-white text-gray-600 border border-gray-200">
                  {l}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
