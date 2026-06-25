import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { clsx } from "clsx";

export default function DateRangeChip({ label, from, to, onFromChange, onToChange }) {
  const [open, setOpen] = useState(false);
  const active = from || to;
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className={clsx(
          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition whitespace-nowrap",
          active
            ? "border-blue-400 bg-blue-50 text-blue-700"
            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
        )}>
        {label}
        {active && <span className="text-blue-500">●</span>}
        <ChevronDown size={12} className={clsx("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1.5 min-w-[260px] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">From</label>
                <input type="date" value={from} onChange={(e) => onFromChange(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">To</label>
                <input type="date" value={to} onChange={(e) => onToChange(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
              </div>
            </div>
            {active && (
              <button onClick={() => { onFromChange(""); onToChange(""); }}
                className="mt-2 w-full rounded-lg border border-slate-200 py-1 text-center text-[10px] text-slate-400 hover:bg-slate-50">
                Clear range
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
