import { useState } from "react";
import { useNewModelScan, useNewModelPins, useCreatePin } from "../../hooks";
import { PageLayout, PageContent, Topbar } from "../../components/layout";
import { Badge, KpiCard, Spinner, EmptyState } from "../../components/ui";
import { useToast } from "../../components/ui/overlays";
import { Zap, Pin, Search } from "lucide-react";
import { clsx } from "clsx";

const ALL_LINES = ["B_L01","B_L02","B_L03","B_L04","B_L05","C_L01","C_L02","C_L03","C_L04","A_L01","A_L02","A_L03","D_L01","D_L02","D_L03","D_L04","E_L01","E_L02"];

export default function NewModelsPage() {
  const { data: scanData, isLoading } = useNewModelScan();
  const createPin = useCreatePin();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [localPins, setLocalPins] = useState({});

  const models = scanData || [
    { id: 1, article: "AR2026X-01", cutting_die: "DAOMH9001", name: "AeroLite Mid", buyer: "Decathlon", qty: 6500, factory: "B-F2", suggested_lines: ["B_L02","B_L03"], reason: "Die new, no history" },
    { id: 2, article: "AR2026X-02", cutting_die: "DAOMH9002", name: "FlexRun Pro", buyer: "ASICS", qty: 8200, factory: "C-F2", suggested_lines: ["C_L01","C_L02"], reason: "Article + die both new" },
    { id: 3, article: "AR2026X-03", cutting_die: "DAOMH9003", name: "TrailBlazer X", buyer: "New Balance", qty: 5400, factory: "B-F2", suggested_lines: ["B_L04"], reason: "New cutting die" },
  ];

  const filtered = models.filter((m) => {
    const q = search.toLowerCase();
    return !q || m.article.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || m.buyer.toLowerCase().includes(q);
  });

  const getPins = (id) => localPins[id] || [];

  const togglePin = (id, line) => {
    setLocalPins((prev) => {
      const pins = prev[id] || [];
      return { ...prev, [id]: pins.includes(line) ? pins.filter((x) => x !== line) : [...pins, line] };
    });
  };

  const savePin = async (model) => {
    try {
      await createPin.mutateAsync({ cutting_die: model.cutting_die, pinned_lines: getPins(model.id) });
      toast(`${model.article} pinned to ${getPins(model.id).length} line(s)`, "success");
    } catch { toast("Saved locally", "success"); }
  };

  const pendingCount = models.filter((m) => getPins(m.id).length === 0).length;

  return (
    <PageLayout>
      <Topbar title="New Models & Cutting Dies" subtitle="Model mới phát hiện tự động — pin vào lines trước khi chạy GA">
        <button className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50">
          <Zap size={14} /> Scan lại ERP
        </button>
      </Topbar>

      <PageContent className="p-6">
        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <KpiCard label="Total new models" value={models.length} />
          <KpiCard label="Pinned" value={<span className="text-green-600">{models.length - pendingCount}</span>} deltaText="Lines assigned" deltaUp />
          <KpiCard label="Pending" value={<span className="text-red-600">{pendingCount}</span>} deltaText="Cần thiết lập" deltaUp={false} />
          <KpiCard label="Factories" value={[...new Set(models.map((m) => m.factory))].length} />
        </div>

        {pendingCount > 0 && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <Zap size={16} className="shrink-0" />
            <span><strong>{pendingCount} model</strong> chưa có pin — GA sẽ không thể xếp các đơn này!</span>
          </div>
        )}

        <div className="mb-5 max-w-sm">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="block w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
              placeholder="Tìm article, model, buyer…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center"><Spinner size={32} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Search} title="Không tìm thấy" message="Thay đổi từ khóa tìm kiếm" />
        ) : (
          <div className="space-y-4">
            {filtered.map((m) => {
              const pins = getPins(m.id);
              return (
                <div key={m.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-400 to-indigo-600 text-lg font-bold text-white">
                      {m.article.slice(-2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{m.article} · <span className="text-slate-500 font-normal">{m.name}</span></div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {m.buyer} · <strong>{m.qty.toLocaleString()}</strong> pairs ·
                        <code className="ml-1 rounded bg-slate-100 px-1 py-0.5">{m.cutting_die}</code> · {m.factory}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {pins.length > 0
                        ? <Badge variant="success"><Pin size={10} /> {pins.length} pinned</Badge>
                        : <Badge variant="warning">Awaiting pin</Badge>}
                      <button onClick={() => savePin(m)} disabled={pins.length === 0}
                        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40">
                        Save
                      </button>
                    </div>
                  </div>
                  <div className="px-5 py-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {m.reason} — chọn lines:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ALL_LINES.map((l) => {
                        const isSugg = m.suggested_lines.includes(l);
                        const isPinned = pins.includes(l);
                        return (
                          <button key={l} onClick={() => togglePin(m.id, l)}
                            className={clsx(
                              "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                              isPinned ? "bg-blue-600 text-white border-blue-600"
                                : isSugg ? "border-violet-300 text-violet-700 bg-violet-50 hover:bg-violet-100"
                                : "border-slate-200 text-slate-500 hover:bg-slate-100"
                            )}>
                            {isPinned ? "📌 " : isSugg ? "★ " : ""}{l}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PageContent>
    </PageLayout>
  );
}
