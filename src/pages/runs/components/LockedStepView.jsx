import { Lock } from "lucide-react";

const STEP_LOCK_MESSAGES = {
  1: { title: "Chưa mở cổng xác nhận năng lực", desc: "Main Planner chưa gửi yêu cầu phân công xác nhận năng lực chuyền cho bước này." },
  2: { title: "Đang chờ Main Planner", desc: "Bước này chưa được kích hoạt. Vui lòng chờ Main Planner chuyển sang Bước 3 (Vật liệu về)." },
  3: { title: "Đang chờ Main Planner", desc: "Bước này chưa được kích hoạt. Vui lòng chờ Main Planner chuyển sang Bước 4 (Ngày gia công)." },
  4: { title: "Đang chờ chạy GA", desc: "Bước này chưa được kích hoạt. Vui lòng chờ Main Planner chạy tối ưu GA lịch sản xuất." },
  5: { title: "Chưa mở cổng tinh chỉnh", desc: "Bước này chưa được kích hoạt. Vui lòng chờ Main Planner chạy tối ưu GA và mở cổng tinh chỉnh lịch." },
};

export default function LockedStepView({ stepIndex }) {
  const msg = STEP_LOCK_MESSAGES[stepIndex] || { title: "Chưa kích hoạt", desc: "Bước này hiện chưa khả dụng đối với Sub-Planner." };
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50/50">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200/80 flex flex-col items-center text-center max-w-sm">
        <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mb-4 border border-amber-100">
          <Lock size={20} />
        </div>
        <h3 className="font-bold text-gray-900 text-base mb-1.5">{msg.title}</h3>
        <p className="text-gray-500 text-xs leading-relaxed">{msg.desc}</p>
      </div>
    </div>
  );
}
