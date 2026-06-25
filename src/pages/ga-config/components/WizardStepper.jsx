import { Eye, Check } from "lucide-react";
import { STEPS } from "../hooks/useWizardState";

export default function WizardStepper({ step, completedUpTo, canNavigateTo, runStatus, gaHasRun, onGoStep, rightSlot }) {
  const isReadOnly = (i) => gaHasRun && i < 4;
  const isLocked = (i) => {
    if (runStatus === "running" && i < 4) return true;
    return !canNavigateTo(i);
  };

  return (
    <div className="flex border-b border-gray-200 bg-white shrink-0 overflow-x-auto items-center">
      {STEPS.map((s, i) => {
        const isCompleted = i <= completedUpTo;
        const isCurrent   = i === step;
        const locked      = isLocked(i);
        const readOnly    = isReadOnly(i);

        return (
          <button
            key={s.key}
            disabled={locked}
            onClick={() => !locked && onGoStep(i)}
            className={[
              "flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors min-w-0 whitespace-nowrap",
              isCurrent
                ? "border-blue-600 text-blue-700 bg-blue-50/50"
                : readOnly
                  ? "border-amber-300 text-amber-700 hover:bg-amber-50 cursor-pointer"
                  : isCompleted && !locked
                    ? "border-green-400 text-green-700 hover:bg-gray-50 cursor-pointer"
                    : locked
                      ? "border-transparent text-gray-300 cursor-not-allowed"
                      : "border-transparent text-gray-400 cursor-not-allowed",
            ].join(" ")}
          >
            <div className={[
              "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
              isCurrent
                ? "bg-blue-600 text-white"
                : readOnly
                  ? "bg-amber-100 text-amber-700"
                  : isCompleted
                    ? "bg-green-500 text-white"
                    : "bg-gray-100 text-gray-400",
            ].join(" ")}>
              {readOnly && !isCurrent ? <Eye size={10} /> : isCompleted && !isCurrent ? <Check size={12} /> : i + 1}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-medium leading-tight">{s.title}</div>
              <div className="text-[10px] leading-tight opacity-60">{s.subtitle}</div>
            </div>
          </button>
        );
      })}
      {rightSlot && (
        <div className="ml-auto px-3 shrink-0">{rightSlot}</div>
      )}
    </div>
  );
}
