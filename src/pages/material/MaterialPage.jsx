import { PageLayout, PageContent, Topbar } from "../../components/layout";
import { useMaterialETA, useImportMaterialETA } from "../../hooks";
import { Spinner, Badge } from "../../components/ui";
import { useToast } from "../../components/ui/overlays";
import { Upload } from "lucide-react";
import { useRef } from "react";
import { fmtDate } from "../../utils";

export default function MaterialPage() {
  const { data, isLoading, refetch } = useMaterialETA({});
  const items = data?.items || data || [];
  const importMutation = useImportMaterialETA();
  const toast = useToast();
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await importMutation.mutateAsync(file);
      toast(`Imported ${res?.updated || 0} orders`, "success");
      refetch();
    } catch { toast("Import failed — check file format", "error"); }
  };

  return (
    <PageLayout>
      <Topbar title="Material ETA" subtitle="Ngày nguyên vật liệu về · match theo order_id">
        <input type="file" accept=".xlsx,.xls,.csv" ref={fileRef} className="hidden" onChange={handleFile} />
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">
          <Upload size={14} /> Import Excel
        </button>
      </Topbar>
      <PageContent className="p-6">
        {isLoading ? <div className="flex h-48 items-center justify-center"><Spinner size={32} /></div> : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {["Order ID","Article","Factory","Material ETA","Buffer (days)","Status"].map((h) =>
                    <th key={h} className="border-b border-slate-200 px-4 py-3 text-left font-semibold">{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">Import file Excel để xem ngày NVL</td></tr>
                ) : items.map((it) => (
                  <tr key={it.order_id} className="border-b border-slate-100 hover:bg-blue-50/30">
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold">{it.order_id}</td>
                    <td className="px-4 py-2.5"><code className="rounded bg-slate-100 px-1.5 text-xs">{it.article}</code></td>
                    <td className="px-4 py-2.5"><Badge variant="neutral">{it.factory_code}</Badge></td>
                    <td className="px-4 py-2.5 font-mono text-xs">{fmtDate(it.material_eta)}</td>
                    <td className="px-4 py-2.5 text-right">{it.buffer_days ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={it.status === "ok" ? "success" : "warning"}>{it.status || "pending"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageContent>
    </PageLayout>
  );
}
