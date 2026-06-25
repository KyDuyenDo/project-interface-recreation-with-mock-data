import { Zap, Clock, CheckCircle2, AlertTriangle, TrendingUp } from "lucide-react";

function runStatus(tasks) {
  if (tasks.every(t => t.status === "confirmed")) return "confirmed";
  if (tasks.some(t => t.status === "rejected")) return "rejected";
  return "pending";
}

export default function SummaryStats({ tasksByRun }) {
  const runs     = Object.values(tasksByRun);
  const total    = runs.length;
  const pending  = runs.filter(t => runStatus(t) === "pending").length;
  const done     = runs.filter(t => runStatus(t) === "confirmed").length;
  const rejected = runs.filter(t => runStatus(t) === "rejected").length;
  const totalTasks = runs.flat().length;
  const doneTasks  = runs.flat().filter(t => t.status !== "pending").length;
  const overallPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const stats = [
    { label: "Tổng Runs",    value: total,    Icon: Zap,         bg: "bg-slate-50",    border: "border-slate-200", text: "text-slate-700",    iconCls: "text-slate-400"   },
    { label: "Chờ xác nhận", value: pending,  Icon: Clock,       bg: "bg-amber-50",    border: "border-amber-200", text: "text-amber-700",    iconCls: "text-amber-500"   },
    { label: "Đã xác nhận",  value: done,     Icon: CheckCircle2,bg: "bg-emerald-50",  border: "border-emerald-200",text: "text-emerald-700",  iconCls: "text-emerald-500" },
    { label: "Có từ chối",   value: rejected, Icon: AlertTriangle,bg: "bg-red-50",     border: "border-red-200",  text: "text-red-600",      iconCls: "text-red-400"     },
  ];

  return (
    <div className="space-y-3 mb-6">
      <div className="grid grid-cols-4 gap-3">
        {stats.map(({ label, value, Icon, bg, border, text, iconCls }) => (
          <div key={label} className={`rounded-xl border px-4 py-4 flex items-center gap-3 ${bg} ${border}`}>
            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
              <Icon size={16} className={iconCls} />
            </div>
            <div>
              <div className={`text-2xl font-bold ${text}`}>{value}</div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <TrendingUp size={12} className="text-blue-500" /> Tiến độ tổng thể
            </span>
            <span className="text-xs font-bold text-slate-700">{doneTasks}/{totalTasks} nhiệm vụ · {overallPct}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-emerald-400 rounded-full transition-all"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
