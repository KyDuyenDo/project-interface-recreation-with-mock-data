---
name: Sub-planner Lập lịch specialization
description: How the Lập lịch (runs) page and RunDetailPage are specialized for sub-planners
---

## Key decisions

**RunsPage pattern**: `RunsPage` is a thin router — calls `usePermissions()` only, then renders `SubPlannerRunsPage` (isSub) or `RunsPageMain` (main planner). This avoids React hooks rule violation from an early return mid-hook-chain.

**Why:** The original RunsPage had many hooks after the early return, which would violate hooks rules. Solution: move all main-planner hooks into `RunsPageMain`, keep the exported `RunsPage` as a thin 3-line router.

**Sub-planner views in RunDetailPage:**
- Step 1 (wizard index 1 = Năng lực): isSub → `SubStep2Panel` (fetches /tasks/my filtered to runId, shows line tabs + CapacityChart + OrdersTable with accept/reject)
- Step 2 (index 2 = NVL): filter `selectedIds` to `myOrderIds` (derived from tasks/my data for this run)
- Step 3 (index 3 = GC dates): filter `gcOrders` to those in `myOrderIds`
- Step 5 (index 5 = Chỉnh sửa lịch): pass `lineFilter={myLines}` and `viewOnly={true}` to Step6Edit

**Step6Edit lineFilter:** New props `lineFilter` (string[]) and `viewOnly` (bool). When lineFilter is active, `chunks` and `orders` are filtered to those lines. Toggle button "Chuyền của tôi / Xem tất cả chuyền" in sub-tabs area. viewOnly hides Bước tiếp button and shows amber "Chỉ xem" badge. Uses `allOrders`/`allChunks` internals and derives filtered `orders`/`chunks` — reset effect keyed on `allOrders` not filtered orders.

**SubStep2Panel** (src/pages/sub-planner/SubStep2Panel.jsx): Self-contained panel with CapacityChart, LineInfoPanel, OrdersTable, RejectDialog, LineContent, FinalSubmitPanel. Fetches tasks/my and sub-schedule/:lineId. Tracks local decisions state and posts to /runs/:id/step-approvals when all evaluated.

**canSeeMyTasks: false** in usePermissions — "Công việc của tôi" removed from sidebar, integrated into Lập lịch.

**How to apply:** When adding new sub-planner wizard step views, follow the same pattern: derive filtered data from myOrderIds/myLines, pass to existing step components as props, or create a SubStepXPanel.
