import { CheckCircle } from "lucide-react";

/**
 * Full-screen success overlay shown after ERP sync succeeds.
 */
export default function SuccessOverlay({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-green-100 flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4 animate-bounce">
          <CheckCircle size={36} />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Đồng bộ ERP Thành công!</h3>
        <p className="text-gray-500 text-sm mb-6">
          Bản kế hoạch sản xuất đã đối soát khớp 100% dữ liệu với ERP PDSCH và đã được chính thức kích hoạt làm <strong>Kế hoạch hiện hành (Active)</strong>.
        </p>
        <button
          className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-md transition-colors"
          onClick={onClose}
        >
          Hoàn tất &amp; Tiếp tục
        </button>
      </div>
    </div>
  );
}
