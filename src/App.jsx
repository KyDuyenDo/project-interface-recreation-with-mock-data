import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "./components/ui/overlays";
import { Sidebar } from "./components/layout/Sidebar";
import { useAuthStore } from "./store/authStore";
import { useEffect } from "react";

// Pages
import LoginPage from "./pages/auth/LoginPage";
import DashboardPage from "./pages/dashboard/DashboardPage";
import OrdersPage from "./pages/orders/OrdersPage";
import KHXPlanPage from "./pages/khx-plan/KHXPlanPage";
import RunsPage from "./pages/runs/RunsPage";
import RunDetailPage from "./pages/runs/RunDetailPage";
import GAConfigPage from "./pages/ga-config/GAConfigPage";
import SubcontractorPage from "./pages/subcontractor/SubcontractorPage";
import MaterialPage from "./pages/material/MaterialPage";
import ThroughputPage from "./pages/throughput/ThroughputPage";
import NewModelsPage from "./pages/new-models/NewModelsPage";
import SubPlannerWorkspace from "./pages/sub-planner/SubPlannerWorkspace";
import RunDetailForSub from "./pages/sub-planner/RunDetailForSub";
import LineAssignmentPage from "./pages/line-management/LineAssignmentPage";
import ScheduleAdjustPage from "./pages/schedule-adjust/ScheduleAdjustPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

function AppShell() {
  const { logout } = useAuthStore();

  useEffect(() => {
    const handler = () => logout();
    window.addEventListener("ap:auth-expired", handler);
    return () => window.removeEventListener("ap:auth-expired", handler);
  }, [logout]);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="flex flex-col overflow-hidden bg-slate-50">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/khx-plan" element={<KHXPlanPage />} />
          <Route path="/runs" element={<RunsPage />} />
          <Route path="/runs/new" element={<GAConfigPage />} />
          <Route path="/runs/:runId" element={<RunDetailPage />} />
          <Route path="/runs/:runId/:tab" element={<RunDetailPage />} />
          <Route path="/subcontractor" element={<SubcontractorPage />} />
          <Route path="/material" element={<MaterialPage />} />
          <Route path="/throughput" element={<ThroughputPage />} />
          <Route path="/new-models" element={<NewModelsPage />} />
          <Route path="/my-tasks" element={<SubPlannerWorkspace />} />
          <Route path="/my-tasks/:runId" element={<RunDetailForSub />} />
          <Route path="/line-assignments" element={<LineAssignmentPage />} />
          <Route path="/schedule-adjust" element={<ScheduleAdjustPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function RequireAuth({ children }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user } = useAuthStore();
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
            <Route path="/*" element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            } />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
