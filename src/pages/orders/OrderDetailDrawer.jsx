import { useState } from "react";
import { Drawer, DrawerSection, KVGrid, Tabs } from "../../components/ui/overlays";
import { Badge } from "../../components/ui";
import { statusVariant, fmtNum } from "../../utils";
import { ExternalLink, Package, Clock, AlertCircle } from "lucide-react";

const STATUS_LABEL = { P:"Planned", N:"New", C:"Confirmed", H:"Hold", R:"Released" };

export default function OrderDetailDrawer({ orderData, onClose }) {
  const [tab, setTab] = useState("info");

  // API returns { order: {...}, production_plan: [...], events: [...], sizes: [...], ... }
  const ord    = orderData?.order    || orderData || {};
  const pdsch  = orderData?.production_plan || [];
  const events = orderData?.events          || [];
  const sizes  = orderData?.sizes           || [];

  const orderId = ord.ORDERNO;

  return (
    <Drawer
      open={true}
      onClose={onClose}
      title={
        <span>
          Order{" "}
          <code className="rounded bg-slate-100 px-2 py-0.5 text-sm font-mono">{orderId}</code>
        </span>
      }
      subtitle={`${ord.ARTICLE || "—"} · ${fmtNum(ord.PAIRQTY)} pairs · ${ord.FTYNO || "—"}`}
      width={640}>

      {/* Status banner */}
      <div className={`flex items-center gap-2 px-6 py-2.5 text-xs font-semibold ${
        orderData?.is_late ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
      }`}>
        {orderData?.is_late ? "⚠️ Trễ hẹn" : "✅ Đúng tiến độ"}
        {orderData?.has_event && (
          <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-amber-700">Has events</span>
        )}
        {orderData?.has_subcontractor && (
          <span className="ml-1 rounded bg-violet-100 px-2 py-0.5 text-violet-700">Subcontractor</span>
        )}
        {orderData?.is_overridden && (
          <span className="ml-1 rounded bg-blue-100 px-2 py-0.5 text-blue-700">Overridden</span>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "info",   label: "Order info" },
          { value: "pdsch",  label: `PDSCH (${pdsch.length})` },
          { value: "events", label: `Events (${events.length})` },
          { value: "sizes",  label: `Sizes (${sizes.length})` },
        ]}
      />

      {/* ── Tab: Order info ── */}
      {tab === "info" && (
        <DrawerSection title="Thông tin đơn hàng">
          <KVGrid items={[
            ["Order No",      <strong className="font-mono text-xs">{ord.ORDERNO}</strong>],
            ["Article",       <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{ord.ARTICLE}</code>],
            ["Cutting die",   ord.CUTTING_DIE || ord.cutting_die || "—"],
            ["Customer",      ord.CUSTNAME || ord.CustName],
            ["Country",       ord.CNTRY || ord.COUNTRY],
            ["Factory",       ord.FTYNO && <Badge variant="neutral">{ord.FTYNO}</Badge>],
            ["Qty (pairs)",   <strong>{fmtNum(ord.PAIRQTY)}</strong>],
            ["Status",        ord.STATUS && (
              <Badge variant={statusVariant(ord.STATUS)}>
                {ord.STATUS} · {STATUS_LABEL[ord.STATUS] || ""}
              </Badge>
            )],
            ["CRD",           <strong className="font-mono text-xs">{ord.CRD}</strong>],
            ["LPD",           <span className="font-mono text-xs">{ord.LPD}</span>],
            ["PODD",          <span className="font-mono text-xs">{ord.PODD}</span>],
            ["Order date",    <span className="font-mono text-xs">{ord.ORDER_DT}</span>],
            ["Season",        ord.SEASON],
            ["Gender",        ord.GENDER],
            ["Size range",    ord.SIZE_RANGE],
            ["Brand",         ord.BRAND],
          ]} />
        </DrawerSection>
      )}

      {/* ── Tab: PDSCH ── */}
      {tab === "pdsch" && (
        <DrawerSection title="Tiến độ xưởng (PDSCH)">
          {pdsch.length === 0 ? (
            <p className="text-sm text-slate-400">Chưa có dữ liệu PDSCH cho đơn này.</p>
          ) : (
            <div className="space-y-2">
              {pdsch.map((s, i) => {
                const done = s.STATUS === "DONE" || s.COMPLETE_QTY >= s.PLAN_QTY;
                return (
                  <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm ${done ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {done ? "✓" : <Clock size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold">{s.STAGE || s.stage || `Stage ${i+1}`}</div>
                      <div className="text-xs text-slate-500">
                        {s.PLAN_START || s.planned_start} → {s.PLAN_END || s.planned_end}
                        {s.PLAN_QTY && <span className="ml-2">· {fmtNum(s.PLAN_QTY)} pcs planned</span>}
                        {s.COMPLETE_QTY != null && <span className="ml-1 text-green-600">· {fmtNum(s.COMPLETE_QTY)} done</span>}
                      </div>
                    </div>
                    <Badge variant={done ? "success" : "warning"}>{s.STATUS || (done ? "DONE" : "PENDING")}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </DrawerSection>
      )}

      {/* ── Tab: Events ── */}
      {tab === "events" && (
        <DrawerSection title="Announcement & Change events">
          {events.length === 0 ? (
            <p className="text-sm text-slate-400">Không có sự kiện nào cho đơn này.</p>
          ) : (
            <div className="space-y-3">
              {events.map((ev, i) => (
                <div key={i} className="flex gap-3 border-b border-slate-100 pb-3 last:border-0">
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs ${ev.TYPE === "CHANGE" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"}`}>
                    {ev.TYPE === "CHANGE" ? <AlertCircle size={14} /> : "📢"}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{ev.TYPE || "EVENT"}</span>
                      <Badge variant={ev.TYPE === "CHANGE" ? "warning" : "info"}>{ev.TYPE}</Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-700">{ev.NOTE || ev.REMARK || ev.note}</div>
                    <div className="mt-0.5 text-[10px] text-slate-400">
                      {ev.ACTOR || ev.actor || "system"} · {(ev.TS || ev.ts || "").slice(0, 16).replace("T", " ")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DrawerSection>
      )}

      {/* ── Tab: Sizes ── */}
      {tab === "sizes" && (
        <DrawerSection title="Size breakdown">
          {sizes.length === 0 ? (
            <p className="text-sm text-slate-400">Chưa có dữ liệu size cho đơn này.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {["Size", "Qty", "Unit"].map((h) => (
                      <th key={h} className="border-b border-slate-200 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sizes.map((s, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono font-semibold">{s.SIZE || s.size}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmtNum(s.QTY || s.qty)}</td>
                      <td className="px-3 py-2 text-slate-400">{s.UNIT || s.unit || "pairs"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DrawerSection>
      )}

      {/* Footer CTA */}
      <DrawerSection>
        <button
          onClick={() => window.open(`/api/v1/orders/${orderId}`, "_blank")}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition">
          <ExternalLink size={14} /> Xem raw API response
        </button>
      </DrawerSection>
    </Drawer>
  );
}
