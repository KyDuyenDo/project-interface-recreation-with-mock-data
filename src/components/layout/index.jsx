import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { clsx } from "clsx";

export function Topbar({ title, subtitle, children, backTo }) {
  const navigate = useNavigate();
  return (
    <header className="flex shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-6 py-3.5">
      {backTo && (
        <button
          onClick={() => navigate(backTo)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition">
          <ChevronLeft size={16} /> {typeof backTo === "string" ? "Back" : "Back"}
        </button>
      )}
      <div>
        <div className="text-lg font-semibold leading-tight">{title}</div>
        {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-2">{children}</div>
    </header>
  );
}

export function PageLayout({ children, className }) {
  return (
    <div className={clsx("flex flex-col", className)} style={{ height: "100%", overflow: "hidden" }}>
      {children}
    </div>
  );
}

export function PageContent({ children, className }) {
  return (
    <div className={clsx("flex-1 overflow-auto", className)}>
      {children}
    </div>
  );
}

export function FilterBar({ children }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
      {children}
    </div>
  );
}

export function Stepper({ steps, current, onJump, completed = [] }) {
  return (
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-6 py-3">
      {steps.map((s, i) => {
        const isActive = i === current;
        const isDone = completed.includes(i) || i < current;
        return (
          <div key={s.key} className="flex items-center">
            <button
              onClick={() => onJump?.(i)}
              className={clsx(
                "flex items-center gap-2 rounded-lg px-3 py-2 transition whitespace-nowrap",
                isActive ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50"
              )}>
              <span className={clsx(
                "grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                isActive ? "bg-primary-600 text-white"
                  : isDone ? "bg-green-500 text-white"
                  : "bg-slate-200 text-slate-500"
              )}>
                {isDone ? "✓" : i + 1}
              </span>
              <span className="flex flex-col items-start">
                <span className={clsx("text-xs font-semibold", isActive ? "text-primary-700" : "text-slate-700")}>
                  {s.title}
                </span>
                {s.subtitle && <span className="text-xs text-slate-400">{s.subtitle}</span>}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div className={clsx("mx-1 h-0.5 w-5 shrink-0", isDone ? "bg-green-400" : "bg-slate-200")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
