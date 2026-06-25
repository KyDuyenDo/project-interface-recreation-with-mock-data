import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Send, AlertTriangle, Loader2, Layers } from "lucide-react";
import { clsx } from "clsx";
import { http } from "../../../api/http";

const BTN = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export default function FinalSubmitPanel({ runId, lines, runTasks, allDecisions, step, user, onSubmitSuccess, queryClient }) {
  const [submitting, setSubmitting] = useState(false);

  const submitMutation = useMutation({
    mutationFn: ({ lineDecisions }) =>
      http.post(`/runs/${runId}/step-approvals`, {
        step,
        planner_username: user?.username,
        final_submit: true,
        line_decisions: lineDecisions,
      }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      onSubmitSuccess();
    },
  });

  const lineStats = lines.map(lineId => {
    const tasks     = runTasks.filter(t => t.line_id === lineId && t.order_id);
    const decs      = allDecisions[lineId] || {};
    const total     = tasks.length;
    const accepted  = tasks.filter(t => decs[t.order_id]?.status === "accepted").length;
    const rejected  = tasks.filter(t => decs[t.order_id]?.status === "rejected").length;
    const evaluated = accepted + rejected;
    return { lineId, total, accepted, rejected, evaluated };
  });

  const grandTotal     = lineStats.reduce((s, l) => s + l.total, 0);
  const grandEvaluated = lineStats.reduce((s, l) => s + l.evaluated, 0);
  const grandAccepted  = lineStats.reduce((s, l) => s + l.accepted, 0);
  const grandRejected  = lineStats.reduce((s, l) => s + l.rejected, 0);
  const grandPending   = grandTotal - grandEvaluated;
  const canSubmit      = grandPending === 0 && grandTotal > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const lineDecisions = lines.map(lineId => {
        const tasks = runTasks.filter(t => t.line_id === lineId && t.order_id);
        const decs  = allDecisions[lineId] || {};
        return {
          line_id: lineId,
          orders: tasks.map(t => ({
            order_id:      t.order_id,
            status:        decs[t.order_id]?.status || "accepted",
            reject_reason: decs[t.order_id]?.reason || null,
            note:          decs[t.order_id]?.note   || null,
            is_support:    t.is_support || false,
          })),
        };
      });
      await submitMutation.mutateAsync({ lineDecisions });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
        <Send size={13} className="text-blue-500" />
        <span className="text-xs font-bold text-gray-700">Gửi kết quả cho Main Planner</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="space-y-1.5">
          {lineStats.map(l => (
            <div key={l.lineId} className="flex items-center gap-3">
              <span className="w-12 shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <Layers size={8} />{l.lineId}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className={clsx("h-full rounded-full transition-all",
                  l.evaluated === l.total && l.total > 0 ? "bg-emerald-400" : "bg-blue-400")}
                  style={{ width: l.total > 0 ? `${(l.evaluated / l.total) * 100}%` : "0%" }} />
              </div>
              <span className="text-[10px] text-gray-500 shrink-0 w-16 text-right">
                {l.evaluated === l.total && l.total > 0
                  ? <span className="text-emerald-600 font-semibold">✓ Hoàn tất</span>
                  : <>{l.evaluated}/{l.total} đơn</>
                }
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 py-2 px-3 rounded-lg bg-gray-50 border border-gray-100">
          <div className="text-xs text-gray-500">
            Tổng: <span className="font-bold text-gray-800">{grandTotal}</span> đơn
          </div>
          <div className="text-xs text-emerald-700">
            Chấp nhận: <span className="font-bold">{grandAccepted}</span>
          </div>
          <div className="text-xs text-red-600">
            Từ chối: <span className="font-bold">{grandRejected}</span>
          </div>
          {grandPending > 0 && (
            <div className="text-xs text-amber-600">
              Chưa đánh giá: <span className="font-bold">{grandPending}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!canSubmit && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle size={11} />
              Vui lòng đánh giá tất cả đơn hàng trước khi gửi kết quả.
            </p>
          )}
          <div className="flex-1" />
          <button
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
            className={clsx(BTN,
              canSubmit
                ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                : "bg-gray-100 text-gray-400 border-gray-200"
            )}>
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Gửi kết quả cho Main Planner
          </button>
        </div>
      </div>
    </div>
  );
}
