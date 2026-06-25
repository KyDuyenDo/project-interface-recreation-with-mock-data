import { Factory } from "lucide-react";

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

export default function FactoryHealth() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <Factory size={15} className="text-slate-400" />
        <span className="flex-1 text-sm font-bold text-slate-800">Tình trạng nhà máy</span>
        <span className="text-xs text-slate-400">
          {FACTORIES.length} nhà máy · {FACTORIES.reduce((a, f) => a + f.lines.length, 0)} chuyền
        </span>
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
  );
}
