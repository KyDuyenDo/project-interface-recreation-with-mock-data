import { PageLayout, PageContent, Topbar } from "../../components/layout";
export default function SubcontractorPage() {
  return (
    <PageLayout>
      <Topbar title="Subcontractor tracking" subtitle="Theo dõi đơn gia công ngoài" />
      <PageContent className="p-6">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400">
          <div className="text-3xl mb-3">🏭</div>
          <h3 className="font-semibold text-slate-600">Subcontractor module</h3>
          <p className="text-sm mt-1">Tracking các đơn gia công bên ngoài theo SubcontractorOrder API.</p>
        </div>
      </PageContent>
    </PageLayout>
  );
}
