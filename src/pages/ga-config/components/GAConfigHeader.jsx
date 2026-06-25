import { ArrowLeft, X } from "lucide-react";
import { STEPS } from "../hooks/useWizardState";

export default function GAConfigHeader({
  step, resumeId, onBack, onDiscard,
}) {
  return (
    <header className="flex items-center h-14 px-5 border-b border-gray-200 bg-white shrink-0 gap-3">
      <div>
        <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-transparent text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
            onClick={onBack}
          >
            <ArrowLeft size={13} /> Lập lịch
          </button>
          {resumeId ? "Tiếp tục kế hoạch" : "Kế hoạch GA mới"}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          Bước {step + 1}/{STEPS.length} · {STEPS[step].title} · TailFollow + ILS
        </div>
      </div>
      <div className="flex-1" />
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />Nháp
      </span>
      <button
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-transparent text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        onClick={onDiscard}
      >
        <X size={13} /> Hủy nháp
      </button>
    </header>
  );
}
