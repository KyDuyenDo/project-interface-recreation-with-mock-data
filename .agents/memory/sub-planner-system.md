---
name: AutoPlanning Sub-Planner Permission System
description: Role-based access system with main_planner vs sub_planner roles, sub-planner workspace, line assignments, and notification bell.
---

## Architecture

All auth/permissions are pure client-side (no real backend). The mock intercept lives in `src/api/http.js`.

## Key decisions

- `MOCK_USERS` in `src/api/mockData.js` drives everything — 5 users (1 main, 4 sub). Login endpoint matches `body.username` against this map.
- `usePermissions` hook (`src/hooks/usePermissions.js`) is the single source of truth for all permission flags. Import from there, never compute inline.
- Sub-planner tasks come from `MOCK_TASK_ASSIGNMENTS` (Step 2 = line qty confirm, Step 6 = schedule review). These are in-memory only — mutations update them directly.
- `MOCK_LINE_ASSIGNMENTS` maps line_id → planner. Mutations to `/lines/assignments` update both this map and `MOCK_USERS[x].assigned_lines` in memory.
- `MOCK_NOTIFICATIONS` is in-memory, mutation POSTing to `/notifications/:id` marks a single read; POSTing to `/notifications` marks all read.

## Pages / components created

- `src/pages/sub-planner/SubPlannerWorkspace.jsx` — sub-planner task list (route `/my-tasks`)
- `src/pages/line-management/LineAssignmentPage.jsx` — main-planner line→sub assignment UI (route `/line-assignments`)
- `src/components/notifications/NotificationBell.jsx` — bell icon with unread badge + dropdown

## Permission-gated locations

- Sidebar (`src/components/layout/Sidebar.jsx`): nav items filtered by `usePermissions()`, sub-planner role banner with assigned lines shown
- RunsPage: "Lập lịch mới" and Accept/Delete buttons hidden for sub-planner
- RunDetailPage: Accept and Verify buttons hidden for sub-planner
- GAConfigPage: read-only amber banner shown for sub-planner

**Why:** All permission guards use `isMain`/`isSub` from `usePermissions()` — never use `user.role` strings directly in UI files.
