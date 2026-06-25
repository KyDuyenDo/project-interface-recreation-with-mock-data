import { BarChart2, Package, Users, Check } from "lucide-react";
import LineInfoPanel from "./LineInfoPanel";
import CapacityChart from "./CapacityChart";
import OrdersTable from "./OrdersTable";

const BTN_XS = "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export default function LineTab({ lineId, tasks, scheduleData, decisions, onDecide, submitted }) {
  const primaryOrders = tasks.filter(t => !t.is_support && t.order_id);
  const supportOrders = tasks.filter(t =>  t.is_support && t.order_id);

  const handleAccept = (orderId) => onDecide(lineId, orderId, "accepted", null, "");
  const handleReject = (orderId, reason, note) => onDecide(lineId, orderId, "rejected", reason, note);
  const handleUndo   = (orderId) => onDecide(lineId, orderId, null, null, "");

  const handleAcceptAll = () => {
    [...primaryOrders, ...supportOrders].forEach(o => {
      if (!decisions[o.order_id]?.status) {
        onDecide(lineId, o.order_id, "accepted", null, "");
      }
    });
  };

  const allOrders  = [...primaryOrders, ...supportOrders];
  const evaluated  = allOrders.filter(o => decisions[o.order_id]?.status).length;
  const total      = allOrders.length;
  const pendingCount = total - evaluated;
  const allDone    = evaluated === total && total > 0;

  return (
    <div className="space-y-4">
      {/* Line info + progress */}
      <LineInfoPanel lineId={lineId} tasks={tasks} scheduleData={scheduleData} decisions={decisions} />

      {/* Capacity chart */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <BarChart2 size={13} className="text-blue-500" />
          <span className="text-xs font-bold text-gray-700">Biểu đồ công suất</span>
        </div>
        <CapacityChart lineId={lineId} scheduleData={scheduleData} />
      </div>

      {/* Primary orders */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Package size={13} className="text-blue-500" />
          <span className="text-xs font-bold text-gray-700">Đơn hàng chuyền chính</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">{primaryOrders.length}</span>
          {!submitted && !allDone && pendingCount > 0 && (
            <button onClick={handleAcceptAll}
              className={`${BTN_XS} ml-auto bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100`}>
              <Check size={9} /> Chấp nhận tất cả chưa đánh giá
            </button>
          )}
        </div>
        <OrdersTable
          orders={primaryOrders} isSupport={false}
          decisions={decisions}
          onAccept={handleAccept} onReject={handleReject} onUndo={handleUndo}
          submitted={submitted}
        />
      </div>

      {/* Support orders */}
      {supportOrders.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users size={13} className="text-violet-500" />
            <span className="text-xs font-bold text-gray-700">Đơn hàng chuyền phụ</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700">{supportOrders.length}</span>
            <span className="text-[10px] text-gray-400">(chuyền này hỗ trợ chuyền khác)</span>
          </div>
          <OrdersTable
            orders={supportOrders} isSupport={true}
            decisions={decisions}
            onAccept={handleAccept} onReject={handleReject} onUndo={handleUndo}
            submitted={submitted}
          />
        </div>
      )}
    </div>
  );
}
