import { Package, Loader2, Check, PlayCircle, Plus } from "lucide-react";

export default function RunsHeroCards({
  newOrdersCount, onShowNewOrders,
  wizardPlan, onNavigateToWizard, onStartFresh,
  activeRun, onNavigateToActiveRun,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">

      {/* Card 1 — Đơn hàng mới */}
      <div
        className="bg-white rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 flex flex-col min-h-[160px] cursor-pointer hover:shadow-md transition-all"
        onClick={onShowNewOrders}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-medium text-blue-500 uppercase tracking-wide">Đơn hàng mới</div>
          <Package size={18} className="text-blue-400" />
        </div>
        <div className="flex items-end gap-1 my-2">
          {newOrdersCount != null
            ? <span className="text-3xl font-bold text-gray-900">{newOrdersCount.toLocaleString()}</span>
            : <Loader2 size={28} className="animate-spin text-gray-300 mt-3" />}
          <span className="text-lg text-gray-400 mb-0.5">đơn</span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-400 mt-auto pt-3 border-t border-blue-100">
          <span>Chưa có LPD · Chưa vào lịch</span>
          <span className="text-blue-500">Xem danh sách →</span>
        </div>
      </div>

      {/* Card 2 — Kế hoạch đang thực hiện / Bắt đầu kế hoạch mới */}
      {wizardPlan ? (
        <div
          className="bg-white rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 flex flex-col min-h-[160px] cursor-pointer hover:shadow-md transition-all"
          onClick={() => onNavigateToWizard(wizardPlan.id)}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-amber-600 uppercase tracking-wide">Kế hoạch đang thực hiện</div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              {wizardPlan.status === "running" ? "Đang chạy GA" : wizardPlan.status === "done" ? "Chờ xác nhận" : "Đang soạn"}
            </span>
          </div>
          <div className="text-sm font-semibold text-gray-900 mb-2 truncate">
            {wizardPlan.label || `Nháp #${wizardPlan.id}`}
          </div>
          <div className="flex items-center gap-1 mb-3">
            {["Đơn","Ưu tiên","NVL","GC","Chạy","Sửa","Xác nhận"].map((s, i) => {
              const done = i < wizardPlan.wizard_step;
              const cur  = i === wizardPlan.wizard_step;
              const gaLocked = wizardPlan.status !== "draft" && i < 4;
              return (
                <div key={i} className="flex items-center gap-1">
                  <div title={s} className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors ${
                    cur  ? "bg-blue-600 text-white" :
                    done ? "bg-green-500 text-white" :
                    gaLocked ? "bg-gray-200 text-gray-400" :
                    "bg-gray-100 text-gray-400"
                  }`}>
                    {done && !cur ? <Check size={9} /> : i + 1}
                  </div>
                  {i < 6 && <div className={`w-3 h-0.5 ${i < wizardPlan.wizard_step ? "bg-green-400" : "bg-gray-200"}`} />}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-auto pt-3 border-t border-amber-100">
            <span>Bước {wizardPlan.wizard_step + 1}/7 · {["Chọn đơn","Ưu tiên","NVL về","Ngày GC","Chạy lịch","Chỉnh sửa","Xác nhận"][wizardPlan.wizard_step] ?? ""}</span>
            <div className="flex items-center gap-2">
              {wizardPlan.status !== "running" && (
                <button
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors px-1"
                  onClick={onStartFresh}
                  title="Hủy và bắt đầu kế hoạch mới"
                >
                  Bắt đầu lại
                </button>
              )}
              <span className="text-amber-600 font-medium flex items-center gap-1"><PlayCircle size={11} /> Tiếp tục →</span>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="bg-white rounded-xl border border-dashed border-gray-300 hover:border-blue-300 p-5 flex flex-col min-h-[160px] cursor-pointer hover:shadow-md transition-all"
          onClick={() => onNavigateToWizard(null)}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Kế hoạch đang thực hiện</div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-400 py-2">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <Plus size={22} className="text-gray-400" />
            </div>
            <div className="font-semibold text-sm text-gray-600">Bắt đầu kế hoạch mới</div>
            <div className="text-xs text-gray-400 text-center">Chọn đơn → năng lực → NVL → chạy → sửa → xác nhận · 7 bước</div>
          </div>
        </div>
      )}

      {/* Card 3 — Lịch hiện hành */}
      {activeRun ? (
        <div
          className="bg-white rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-white p-5 flex flex-col min-h-[160px] cursor-pointer hover:shadow-md transition-all"
          onClick={() => onNavigateToActiveRun(activeRun.id)}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-medium text-green-600 uppercase tracking-wide">Lịch hiện hành</div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
              <span className="w-1.5 h-1.5 rounded-full bg-current" />Active
            </span>
          </div>
          {activeRun.period_label && (
            <div className="text-xs text-green-600 font-medium mb-1">{activeRun.period_label}</div>
          )}
          <div className="text-base font-semibold text-gray-900 mb-3 truncate">{activeRun.label}</div>
          <div className="flex gap-4 mb-3">
            {[
              { val: activeRun.scheduled_count ?? "—", lab: "đơn" },
              { val: activeRun.on_time_pct != null ? `${activeRun.on_time_pct}%` : "—", lab: "on-time" },
              { val: activeRun.fitness?.toLocaleString() ?? "—", lab: "fitness" },
            ].map(({ val, lab }) => (
              <div key={lab}>
                <div className="text-xl font-bold text-gray-900">{val}</div>
                <div className="text-xs text-gray-400">{lab}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-auto pt-3 border-t border-green-100">
            <span>Accepted {activeRun.accepted_at?.slice(0, 10)} · {activeRun.accepted_by ?? "—"}</span>
            <span className="text-green-600">Chi tiết →</span>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col min-h-[160px]">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Lịch hiện hành</div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-400">
            <div className="font-semibold text-sm text-gray-500">Chưa có lịch active</div>
            <div className="text-xs text-gray-400">Accept một lần chạy để kích hoạt</div>
          </div>
        </div>
      )}
    </div>
  );
}
