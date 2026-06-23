---
name: GA Wizard Dispatch Tracking
description: How the sub-planner dispatch/tracking sub-step is wired into the GA Config wizard.
---

## Pattern
Each of Steps 2, 3, 4, 6 now contains a `SubPlannerDispatchPanel` rendered just above their footer nav.

## Component
`src/components/dispatch/SubPlannerDispatchPanel.jsx`
- Props: `runId` (draftRunId for steps 2-4, runId for step 6), `dispatchStep` (2|3|4|6), `readOnly`
- Pre-dispatch: shows planner list preview + "Phân công Sub-Planner" button
- Post-dispatch: polls `/runs/:id/dispatch-status?step=N` every 8s, shows per-planner status table
- "Phân công lại" button recalls and re-dispatches

## Mock API (http.js)
- `POST /runs/:id/dispatch` — creates DISPATCH_STATE entry, notifies sub-planners
- `GET /runs/:id/dispatch-status?step=N` — returns per-planner status, merges with MOCK_TASK_ASSIGNMENTS

**Why:** DISPATCH_STATE is in-memory (not in mockData.js) so it resets on each session — this is intentional for demo purposes.

## Step props
- Step2Capacity: already had `draftRunId` prop
- Step3MaterialETA: `draftRunId` added to function signature (was passed but ignored before)
- Step4GCDates: `draftRunId` added to function signature (same reason)
- Step6Edit: already had `runId` prop

## Bugs fixed alongside this feature
- `RunDetailPage.jsx`: `usePermissions()` was called after an early `return`, violating Rules of Hooks — moved before the early return.
- `PriorityMatrixTab.jsx (ProductionPanel)`: `prodData ?? []` failed when prodData was `{items:[]}` — changed to `Array.isArray(prodData) ? prodData : (prodData?.items ?? [])`.
- `SubPlannerDispatchPanel (PlannerPreviewList)`: `/lines/assignments` returns `{items:[]}` not raw array — fixed with `data?.items || []`.
