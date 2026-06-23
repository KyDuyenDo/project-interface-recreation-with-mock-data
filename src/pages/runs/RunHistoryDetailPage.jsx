import { useState } from "react";
import { ArrowLeft, Download, Check, CheckCircle, Loader2 } from "lucide-react";
import { useRunDetail, useRunDiff, useRunOutputOrders } from "../../hooks";
import StatusBadge from "./components/StatusBadge";

const BTN = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const TABS = [
  { value: "changes", label: "Thay đổi so với hiện hành" },
  { value: "summary", label: "Tổng quan" },
  { value: "orders",  label: "Đơn trong lịch" },
];

export default function RunHistoryDetailPage({ runId, compareRunId, onBack }) {
  const [tab, setTab] = useState("changes");

  const { data: run }                               = useRunDetail(runId);
  const { data: diff, isLoading: diffLoading }      = useRunDiff(runId, compareRunId);
  const { data: ordersData }                        = useRunOutputOrders(runId, null);
  const orders = ordersData?.orders || [];

  if (!run) return (
    <div className="flex flex-col h-full items-center justify-center">
      <Loader2 size={28} className="animate-spin text-blue-500" />
    </div>
  );

  const isActive = run.is_accepted;

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <header className="flex items-center h-14 px-5 border-b border-gray-200 bg-white shrink-0 gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <button
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-transparent text-xs text-gray-500 hover:bg-gray-100"
              onClick={onBack}>
              <ArrowLeft size={13} /> Lập lịch
            </button>
            Lịch sử · #{run.id} · {run.label}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {run.started_at?.slice(0, 16).replace("T", " ")} · {run.scheduled_count ?? "—"} đơn ·{" "}
            {isActive ? "Đây là lịch hiện hành" : "Đã bị thay thế"}
          </div>
        </div>
        <div className="flex-1" />
        <StatusBadge status={run.status} />
        {isActive && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle size={10} /> Hiện hành
          </span>
        )}
        <button className={`${BTN} bg-white text-gray-700 border-gray-200 hover:bg-gray-50`}>
          <Download size={14} /> Export
        </button>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-5">
        {TABS.map(t => (
          <button
            key={t.value}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
              ${tab === t.value ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            onClick={() => setTab(t.value)}>
            {t.label}
            {t.value === "changes" && diff?.n_changed != null && (
              <span className="ml-1.5 text-xs text-gray-400">({diff.n_changed})</span>
            )}
            {t.value === "orders" && orders.length > 0 && (
              <span className="ml-1.5 text-xs text-gray-400">({orders.length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-50 p-5">
        {tab === "changes" && (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
              <div className="text-sm font-semibold text-gray-900">Thay đổi so với lịch hiện hành</div>
              <div className="flex-1" />
              {diffLoading
                ? <Loader2 size={14} className="animate-spin text-gray-400" />
                : diff
                  ? <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${diff.n_changed > 0 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                      {diff.n_changed > 0 ? `${diff.n_changed} khác biệt` : "Giống hệt lịch hiện hành"}
                    </span>
                  : null}
            </div>
            {diffLoading ? (
              <div className="py-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-500" /></div>
            ) : !diff || diff.diffs?.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <Check size={28} className="mx-auto mb-2 text-green-500" />
                <div className="font-semibold text-gray-600">Không có khác biệt.</div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {["Đơn", "Trường", "Lịch này", "", "Lịch hiện hành"].map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {diff.diffs.map((d, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                      <td className="px-3 py-2 font-semibold text-sm">{d.order_id}</td>
                      <td className="px-3 py-2 text-xs">
                        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{d.field}</code>
                      </td>
                      <td className="px-3 py-2 text-xs text-red-600">{d.this_value ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-gray-400">→</td>
                      <td className="px-3 py-2 text-xs text-green-700 font-semibold">{d.compare_value ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === "summary" && (
          <div className="bg-white rounded-xl border border-gray-200 max-w-2xl">
            <div className="px-5 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Tổng quan lịch #{run.id}</div>
            <div className="p-5">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-gray-500">Label</dt>
                <dd className="text-gray-900 font-medium"><code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{run.label}</code></dd>
                <dt className="text-gray-500">Trạng thái</dt>
                <dd><StatusBadge status={run.status} /></dd>
                <dt className="text-gray-500">Thời điểm chạy</dt>
                <dd className="text-gray-900">{run.started_at?.slice(0, 16).replace("T", " ")}</dd>
                <dt className="text-gray-500">Thời gian</dt>
                <dd className="text-gray-900">{run.runtime_seconds != null ? `${run.runtime_seconds.toFixed(1)}s` : "—"}</dd>
                <dt className="text-gray-500">Đơn đã lập</dt>
                <dd className="text-gray-900 font-medium">{run.scheduled_count ?? "—"}</dd>
                <dt className="text-gray-500">On-time</dt>
                <dd className="text-gray-900 font-medium">{run.on_time_pct != null ? `${run.on_time_pct}%` : "—"}</dd>
                <dt className="text-gray-500">Fitness</dt>
                <dd className="text-gray-900 font-medium">{run.fitness?.toLocaleString() ?? "—"}</dd>
              </dl>
            </div>
          </div>
        )}

        {tab === "orders" && (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
              <div className="text-sm font-semibold text-gray-900">Đơn trong lịch (snapshot)</div>
              <div className="flex-1" />
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{orders.length} đơn</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {["Order", "Chuyền May", "Bắt đầu", "Kết thúc", "Qty"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.scbh} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-3 py-2 font-semibold text-sm">{o.scbh}</td>
                    <td className="px-3 py-2 text-xs">
                      <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{o.line_may}</code>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">{o.sew_start}</td>
                    <td className="px-3 py-2 text-xs text-gray-700">{o.go_end}</td>
                    <td className="px-3 py-2 text-xs text-right font-medium">{o.qty_total?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
