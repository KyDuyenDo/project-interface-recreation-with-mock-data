import { Users, X } from "lucide-react";
import SubPlannerDispatchPanel from "./SubPlannerDispatchPanel";

/**
 * Slide-in drawer for monitoring Sub-Planner dispatch status.
 * Used in both GAConfigPage (wizard) and RunDetailPage (completed view).
 */
export default function SubPlannerDrawer({ open, onClose, dispatchStep, runId }) {
  if (!dispatchStep) return null;
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px] transition-opacity"
          onClick={onClose}
        />
      )}
      <div
        className={`fixed top-0 right-0 h-full z-40 flex flex-col bg-white shadow-2xl border-l border-gray-200 transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ width: "min(1080px, calc(100vw - 196px))" }}
      >
        <div className="flex items-center gap-3 px-5 py-3.5 border-b bg-gray-50 shrink-0">
          <Users size={15} className="text-gray-500" />
          <span className="text-sm font-semibold text-gray-800 flex-1">
            Theo dõi Sub-Planner · Bước {dispatchStep}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors text-gray-500"
          >
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">
          <SubPlannerDispatchPanel
            runId={runId}
            dispatchStep={dispatchStep}
            readOnly={false}
          />
        </div>
      </div>
    </>
  );
}
