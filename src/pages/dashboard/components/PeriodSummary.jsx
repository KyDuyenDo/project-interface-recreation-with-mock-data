import { Calendar } from "lucide-react";

export default function PeriodSummary() {
  return (
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
  );
}
