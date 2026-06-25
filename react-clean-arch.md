---
name: react-clean-arch
description: >
  Refactor React code to be clean, modular, and well-structured. Use this skill whenever the user wants to:
  clean up messy React code, split large components into smaller ones, extract business logic into custom hooks,
  separate concerns between UI and logic, organize a React codebase, reduce component complexity, or improve
  maintainability of React files. Trigger even when the user says things like "clean this up", "this component
  is too big", "tách component", "tách hook", "refactor React", or pastes a messy React file and asks for help.
  This skill covers both analysis (what to split) and execution (how to write the clean version).
---

# React Clean Architecture Skill

Refactor React code into clean, maintainable, well-separated modules. The output must be readable by any developer at a glance — no logic buried in JSX, no god components, no side effects scattered everywhere.

---

## Core Philosophy

> **UI renders. Hooks think. Utils compute.**

- **Components** → only JSX + minimal local display state (open/closed, hover, etc.)
- **Custom Hooks** → all data fetching, business logic, derived state, side effects
- **Utils / helpers** → pure functions, transformers, formatters — no React imports
- **Types** → co-located or in a shared `types/` folder

---

## Step 0 — Audit Before You Split

Read the entire file(s) first. Identify:

| What you see | What to do |
|---|---|
| Fetch/async logic inside component body | → Extract to custom hook |
| `useEffect` with business rules | → Extract to custom hook |
| Long JSX with obvious sub-sections | → Split into child components |
| Inline handlers with >3 lines | → Extract to hook or util |
| Repeated JSX patterns | → Make a reusable component |
| `useState` clusters that belong together | → Consolidate in one hook |
| Pure transformation/formatting | → Move to `utils/` |
| Prop drilling >2 levels | → Consider context or co-locate state |

Do **not** over-split. A component with 60 lines of simple JSX and one `useState` does not need to be split.

---

## Step 1 — Decide the File Structure

For a feature `FeatureName`, propose this layout:

```
features/FeatureName/
├── index.ts                  # barrel export
├── FeatureName.tsx           # root component (thin shell)
├── components/
│   ├── FeatureHeader.tsx
│   ├── FeatureList.tsx
│   └── FeatureItem.tsx
├── hooks/
│   ├── useFeatureData.ts     # data fetching + server state
│   └── useFeatureActions.ts  # mutations, event handlers
├── utils/
│   └── featureHelpers.ts     # pure functions
└── types.ts                  # shared TS interfaces
```

Adjust as needed — don't force structure that doesn't fit. For small refactors, splitting into `Component.tsx` + `useComponentLogic.ts` is enough.

---

## Step 2 — Extract Custom Hooks

### Rules for hooks

```ts
// ✅ Good hook: owns its own state, returns clean API
function useUserList(filters: Filters) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchUsers(filters)
      .then((data) => { if (!cancelled) setUsers(data); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters]);

  const removeUser = useCallback((id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }, []);

  return { users, loading, error, removeUser };
}
```

```ts
// ❌ Bad hook: just a wrapper, adds no value
function useTitle(title: string) {
  return <h1>{title}</h1>; // hooks never return JSX
}
```

### Hook naming conventions

| Purpose | Name pattern |
|---|---|
| Server data | `useXxxData`, `useXxxQuery` |
| User actions / mutations | `useXxxActions`, `useXxxMutations` |
| UI state only | `useXxxState`, `useXxxToggle` |
| Form handling | `useXxxForm` |
| Combined (small feature) | `useXxx` |

---

## Step 3 — Split Components

### Rules for components

```tsx
// ✅ Clean component: logic-free, readable in seconds
function UserCard({ user, onRemove }: UserCardProps) {
  return (
    <div className="card">
      <Avatar src={user.avatar} alt={user.name} />
      <div className="card-body">
        <h3>{user.name}</h3>
        <p>{user.email}</p>
      </div>
      <button onClick={() => onRemove(user.id)}>Remove</button>
    </div>
  );
}
```

```tsx
// ❌ Fat component: fetch + transform + render all mixed in
function UserCard({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);
  useEffect(() => {
    fetch(`/api/users/${userId}`).then(r => r.json()).then(setUser);
  }, [userId]);
  const fullName = `${user?.firstName} ${user?.lastName}`.trim();
  if (!user) return <Spinner />;
  return <div>{fullName}...</div>;
}
```

### When to split a component

Split when any of these are true:
- Component is >80–100 lines of JSX
- A section of JSX has its own heading/title concept (Header, Footer, Sidebar, Item, Card)
- Same JSX pattern appears >1 time
- A section would benefit from its own loading/error state
- You need to add a `key` prop → that's a list item, make it a component

Do **not** split just to hit a line count. Cohesion > brevity.

---

## Step 4 — Root Component Must Be a Thin Shell

The root component of a feature should only:
1. Call hooks to get data and handlers
2. Render child components, passing props down
3. Handle conditional rendering (loading, error, empty states)

```tsx
// ✅ Thin shell root component
export function UserListPage() {
  const { users, loading, error, removeUser } = useUserList();

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (users.length === 0) return <EmptyState />;

  return (
    <div className="user-list-page">
      <UserListHeader count={users.length} />
      <UserList users={users} onRemove={removeUser} />
    </div>
  );
}
```

---

## Step 5 — TypeScript Hygiene

- Define props interface directly above each component (co-located)
- Export shared types from `types.ts`, not from component files
- Avoid `any`. Use `unknown` + type guard if truly needed
- Use `React.FC` only if the team already uses it; otherwise plain function is fine

```ts
// Props co-located with component
interface UserCardProps {
  user: User;
  onRemove: (id: string) => void;
}

// Shared types in types.ts
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}
```

---

## Step 6 — Common Patterns to Apply

### Loading / Error / Empty pattern (always explicit)
```tsx
if (loading) return <LoadingSpinner />;
if (error) return <ErrorMessage message={error} />;
if (data.length === 0) return <EmptyState />;
return <MainContent data={data} />;
```

### Event handlers in hooks, not inline JSX
```tsx
// ✅
const { handleSubmit, handleDelete } = useFormActions();
<button onClick={handleSubmit}>Save</button>

// ❌
<button onClick={() => { validate(); save(); toast('ok'); }}>Save</button>
```

### Avoid deep prop drilling — co-locate state or use context
```tsx
// If prop is passed through 3+ components untouched → move state down or use context
```

### useCallback / useMemo — only when needed
- `useCallback`: handler passed as prop to a memoized child, or as dep of `useEffect`
- `useMemo`: expensive computation, or stable reference needed as dep
- Do NOT wrap everything by default — it adds complexity without benefit

---

## Step 7 — Output Format

When delivering refactored code:

1. **Show the new file structure** first (as a tree)
2. **Deliver each file separately** with a filename header
3. **Explain key decisions** briefly after each major file (1–3 bullet points max)
4. **Do not rewrite things that don't need changing** — call them out as "keep as-is"

Example output format:
```
## File structure
features/UserList/
├── index.ts
├── UserListPage.tsx
├── components/UserList.tsx, UserCard.tsx
├── hooks/useUserList.ts
└── types.ts

---

### hooks/useUserList.ts
[code]
> - Extracted fetch logic from UserListPage
> - Added cleanup flag to prevent state update after unmount

### UserListPage.tsx
[code]
> - Now a thin shell — only calls hook and renders children
```

---

## Checklist Before Handing Off

- [ ] No fetch/async logic inside component body
- [ ] No business logic in JSX (`{}` blocks have simple expressions only)
- [ ] Each component does one visual job
- [ ] Each hook owns one concern
- [ ] Loading, error, empty states are all handled explicitly
- [ ] No prop drilling past 2 levels
- [ ] TypeScript types defined — no implicit `any`
- [ ] File names match component/hook names exactly
- [ ] Barrel `index.ts` exports public API of the feature
