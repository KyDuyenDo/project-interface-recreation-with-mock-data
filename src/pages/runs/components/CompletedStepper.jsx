import { Check, Eye, Lock } from "lucide-react";

const STEPS = [
  { key: "orders",   title: "Chọn đơn",   subtitle: "Nhập mã hoặc Excel" },
  { key: "capacity", title: "Năng lực chuyền", subtitle: "Xác nhận năng lực" },
  { key: "mat",      title: "NVL về",     subtitle: "Ngày vật liệu" },
  { key: "gc_dates", title: "Ngày GC",    subtitle: "Thu gia công" },
  { key: "run",      title: "Chạy lịch",  subtitle: "TailFollow + ILS" },
  { key: "edit",     title: "Chỉnh sửa",  subtitle: "Review + tinh chỉnh" },
];

export { STEPS };

/**
 * Horizontal tab-stepper for the 6-step completed run view.
 * Each step shows a badge (current / view-only / completed / locked).
 */
export default function CompletedStepper({ step, onGoStep, isStepLocked, isSub, rightSlot }) {
  return (
    <div className="flex border-b border-gray-200 bg-white shrink-0 overflow-x-auto items-center">
      {STEPS.map((s, i) => {
        const isCurrent = i === step;
        const locked    = isStepLocked ? isStepLocked(i) : false;
        const showAmber = isSub ? i === 0 : i < 4;

        return (
          <button
            key={s.key}
            disabled={locked}
            onClick={() => !locked && onGoStep(i)}
            className={[
              "flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors min-w-0 whitespace-nowrap",
              isCurrent
                ? "border-blue-600 text-blue-700 bg-blue-50/50 cursor-pointer"
                : locked
                  ? "border-transparent text-gray-300 cursor-not-allowed bg-gray-50/20"
                  : showAmber
                    ? "border-amber-300 text-amber-700 hover:bg-amber-50 cursor-pointer"
                    : "border-green-400 text-green-700 hover:bg-gray-50 cursor-pointer",
            ].join(" ")}
          >
            <div className={[
              "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
              isCurrent
                ? "bg-blue-600 text-white"
                : locked
                  ? "bg-gray-150 text-gray-300"
                  : showAmber
                    ? "bg-amber-100 text-amber-700"
                    : "bg-green-500 text-white",
            ].join(" ")}>
              {isCurrent
                ? i + 1
                : locked
                  ? <Lock size={9} className="text-gray-400" />
                  : showAmber
                    ? <Eye size={10} />
                    : <Check size={12} />}
            </div>
            <div className="text-left hidden sm:block">
              <div className={`text-xs font-semibold leading-tight ${locked ? 'text-gray-400' : ''}`}>{s.title}</div>
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
