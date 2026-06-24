import { useAuthStore } from "../store/authStore";

export function usePermissions() {
  const { user } = useAuthStore();
  const role = user?.role || "sub_planner";
  const isMain = role === "main_planner" || role === "admin";
  const isSub = role === "sub_planner";
  const myLines = user?.assigned_lines || [];

  return {
    role,
    isMain,
    isSub,
    myLines,

    // Sidebar visibility
    canSeeOrders: isMain,
    canSeeKHX: isMain,
    canSeeLapLich: true,
    canSeeMyTasks: false, // integrated into Lập lịch for sub-planner
    canSeeLineAssignment: isMain,
    canSeeEvents: isMain,
    canSeeSubcontractor: true,
    canSeeMaterialETA: true,
    canSeeShoeTargets: isMain,
    canSeeNewModels: isMain,
    canSeeFactories: isMain,
    canSeeUsers: isMain,
    canSeeSettings: isMain,
    canSeeSync: isMain,

    // Wizard / steps
    canEditWizard: isMain,
    canDispatch: isMain,
    canRunGA: isMain,
    canConfirmFinal: isMain,

    // Runs page
    canCreateRun: isMain,
    canAcceptRun: isMain,
    canDeleteRun: isMain,
    canVerifyRun: isMain,

    // Run detail
    canExport: true,
    canEditSchedule: isMain,

    // Material ETA: sub sees only orders on their lines
    materialFilter: isSub ? myLines : null,
  };
}
