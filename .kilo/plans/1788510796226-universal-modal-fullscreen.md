# Plan: Universal Modal Fullscreen Toggle

## Objective
Add a universal fullscreen-toggle capability to every modal/dialog in both Next.js Odoo frontends (`cleon_document_management` and `cleon_company_documentary`), so modals that require scrolling can expand to fill the viewport.

## Current State Analysis

### `cleon_company_documentary/next-app/` — Centralized ModalShell pattern
- **Shared component:** `ModalShell.tsx` (32 lines) — used by `UploadModal`, `MediaEditModal`, `StorageSettingsModal`, `CreateFolderModal`, `BatchShareModal`
- **VideoModal** already has its own fullscreen implementation using browser Fullscreen API (lines 46, 190, 352-357 of VideoModal.tsx)
- **CSS:** `globals.css` has `.modal-backdrop`, `.modal-card`, `.modal-header`, `.modal-close` classes; also `.video-backdrop.is-fullscreen` pattern (lines 1359-1369)
- **No hooks directory** — hooks are inline or in parent components

### `cleon_document_management/next-app/` — Scattered inline modals
Many inline modal components with no shared shell:
1. **`CompliancePage.tsx`** — `Modal` function (line 1178) used by `CreatePolicyModal` (line 953) and `CreateExceptionModal` (line 1118)
2. **`FolderActions.tsx`** — inline edit modal (line 243) with portal dropdown
3. **`DocumentListPage.tsx`** — "Create folder" modal (line 512)
4. **`MyDocumentsPage.tsx`** — viewer modal with fullscreen already (line 644)
5. **`OrganizationFolderPage.tsx`** — viewer modal with fullscreen already (line 396)
6. **`EmployeeProfilePage.tsx`** — viewer modal with fullscreen already (line 457)
7. **`PolicyActions.tsx`** — policy modal with fullscreen already (line 187)
8. **`MoveDocumentsDialog.tsx`** — inline modal (line 50)
9. **`TypesConfigPanel.tsx`** — inline form modal (line 118)
10. **`ProfilesConfigPanel.tsx`** — inline form modal (line 160)
11. **`SettingsPage.tsx`** — `TypeModal` (line 1001)
12. **`AskScreen.tsx`** — inline modals (lines 617, 659)

### Existing Fullscreen Patterns
- **`cleon_company_documentary`**: Browser Fullscreen API (`document.fullscreenElement`, `requestFullscreen()`, `exitFullscreen()`) with CSS `.is-fullscreen` class
- **`cleon_document_management`**: CSS-based state toggle using `useState` with Tailwind classes (no browser API); pattern in `PolicyActions.tsx` lines 187-206

## Design Decision: CSS-Based Approach

Use the CSS-based approach (as in `cleon_document_management`'s `PolicyActions.tsx`) rather than browser Fullscreen API for both apps:
- No user permission prompts
- Consistent cross-browser behavior
- Simpler state management
- Works in iframes/embedded contexts

## Implementation Plan

### Phase 1: `cleon_company_documentary` — ModalShell Enhancement

**Task 1.1: Add CSS for fullscreen modal**
- File: `cleon_company_documentary/next-app/src/app/globals.css`
- Add `.modal-backdrop.is-fullscreen` and `.modal-card.is-fullscreen` CSS rules after the existing `.modal-card` block (around line 976)
- The fullscreen state removes max-width/max-height constraints, sets width/height to 100vw/100vh, removes border-radius and padding adjustments

**Task 1.2: Enhance `ModalShell` with fullscreen toggle**
- File: `cleon_company_documentary/next-app/src/app/components/modals/ModalShell.tsx`
- Add `useState` for `isFullscreen`
- Add `fullscreenable` optional prop (default `false` to avoid breaking existing uses)
- Add `Maximize2`/`Minimize2` toggle button in `modal-header`, between the title and close button
- Toggle `is-fullscreen` class on `.modal-backdrop` when active
- Exit fullscreen on Escape key and on `onClose`

**Task 1.3: Update ModalShell consumers to enable fullscreen**
- Files: `UploadModal.tsx`, `MediaModals.tsx` (MediaEditModal, StorageSettingsModal), `FolderModals.tsx` (CreateFolderModal, BatchShareModal)
- Add `fullscreenable` prop to all `ModalShell` usages

### Phase 2: `cleon_document_management` — Inline Modal Enhancement

**Task 2.1: Create a reusable `ModalDialog` wrapper component**
- File: `cleon_document_management/next-app/src/app/components/ModalDialog.tsx` (new file)
- Accept props: `title`, `eyebrow?`, `onClose`, `children`, `fullscreenable?`, `wide?`, `form?`
- Internally manage `isFullscreen` state
- Render the standard backdrop + card pattern with fullscreen toggle button in header
- Apply CSS-based fullscreen classes (matching `PolicyActions.tsx` pattern)
- Include Escape-to-exit-fullscreen and auto-exit on close

**Task 2.2: Refactor `CompliancePage.tsx` `Modal` to use `ModalDialog`**
- File: `cleon_document_management/next-app/src/app/components/CompliancePage.tsx`
- Replace inline `Modal` function with `ModalDialog` from `ModalDialog.tsx`
- Add `fullscreenable` to `CreatePolicyModal` and `CreateExceptionModal` usages
- Remove the local `Modal` function (line 1178-1201)

**Task 2.3: Refactor `FolderActions.tsx` edit modal**
- File: `cleon_document_management/next-app/src/app/components/FolderActions.tsx`
- Replace inline edit modal (lines 241-307) with `ModalDialog` component
- Add `fullscreenable` prop

**Task 2.4: Refactor `DocumentListPage.tsx` create folder modal**
- File: `cleon_document_management/next-app/src/app/components/DocumentListPage.tsx`
- Replace inline modal (lines 512-515) with `ModalDialog`
- Add `fullscreenable` prop

**Task 2.5: Refactor `MoveDocumentsDialog.tsx`**
- File: `cleon_document_management/next-app/src/app/components/MoveDocumentsDialog.tsx`
- Replace inline modal with `ModalDialog`
- Add `fullscreenable` prop

**Task 2.6: Refactor `TypesConfigPanel.tsx` modal**
- File: `cleon_document_management/next-app/src/app/components/intelligence/TypesConfigPanel.tsx`
- Replace inline modal (line 118) with `ModalDialog`
- Add `fullscreenable` prop

**Task 2.7: Refactor `ProfilesConfigPanel.tsx` modal**
- File: `cleon_document_management/next-app/src/app/components/intelligence/ProfilesConfigPanel.tsx`
- Replace inline modal (line 160) with `ModalDialog`
- Add `fullscreenable` prop

**Task 2.8: Refactor `SettingsPage.tsx` TypeModal**
- File: `cleon_document_management/next-app/src/app/components/SettingsPage.tsx`
- Replace inline `TypeModal` (line 1001) with `ModalDialog`
- Add `fullscreenable` prop

**Task 2.9: Refactor `AskScreen.tsx` inline modals**
- File: `cleon_document_management/next-app/src/app/components/intelligence/AskScreen.tsx`
- Replace URL paste modal (line 617) and document library modal (line 659) with `ModalDialog`
- Add `fullscreenable` prop

### Phase 3: Consistency — Update Document Viewers

**Task 3.1: Refactor existing fullscreen viewers to use `ModalDialog`** (optional, for consistency)
- Files: `OrganizationFolderPage.tsx`, `EmployeeProfilePage.tsx`, `MyDocumentsPage.tsx`, `PolicyActions.tsx`
- These already have fullscreen but use different state variable names (`viewerFullscreen`, `isFullscreen`) and slightly different CSS patterns
- Consider unifying into `ModalDialog` to reduce code duplication, but only if low-risk since they already work

### Phase 4: CSS — Ensure fullscreen styles are available in both apps

**Task 4.1: Add fullscreen CSS to `cleon_document_management`**
- File: `cleon_document_management/next-app/src/app/globals.css`
- Add `.modal-fullscreen-backdrop` and `.modal-fullscreen-card` utility classes that `ModalDialog` references
- Alternatively, rely on inline Tailwind classes as `PolicyActions.tsx` already does

## Key Patterns to Follow

### CSS-Based Fullscreen Toggle (from PolicyActions.tsx)
```tsx
const [isFullscreen, setIsFullscreen] = useState(false);
// Backdrop: ${isFullscreen ? "" : "p-4"}
// Card: ${isFullscreen ? "h-screen max-w-none rounded-none p-8" : "max-h-[92vh] max-w-5xl rounded-3xl p-6"}
// Toggle button: Maximize2 / Minimize2 from lucide-react
```

### Header Toggle Button Pattern
```tsx
<button
  onClick={() => setIsFullscreen(!isFullscreen)}
  aria-label={isFullscreen ? "Exit full screen" : "Maximize full screen"}
  className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:border-brand-pink hover:text-brand-pink"
>
  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
</button>
```

## Files to Modify

### cleon_company_documentary
1. `src/app/globals.css` — add fullscreen CSS for `.modal-backdrop.is-fullscreen`
2. `src/app/components/modals/ModalShell.tsx` — add fullscreen toggle + `fullscreenable` prop
3. `src/app/components/modals/UploadModal.tsx` — add `fullscreenable`
4. `src/app/components/modals/MediaModals.tsx` — add `fullscreenable` to both modals
5. `src/app/components/modals/FolderModals.tsx` — add `fullscreenable` to both modals

### cleon_document_management
1. `src/app/components/ModalDialog.tsx` — **new file**, shared modal with fullscreen
2. `src/app/components/CompliancePage.tsx` — replace inline `Modal`, add fullscreen to CreatePolicyModal & CreateExceptionModal
3. `src/app/components/FolderActions.tsx` — replace inline edit modal with `ModalDialog`
4. `src/app/components/DocumentListPage.tsx` — replace inline modal with `ModalDialog`
5. `src/app/components/MoveDocumentsDialog.tsx` — replace inline modal with `ModalDialog`
6. `src/app/components/intelligence/TypesConfigPanel.tsx` — replace inline modal with `ModalDialog`
7. `src/app/components/intelligence/ProfilesConfigPanel.tsx` — replace inline modal with `ModalDialog`
8. `src/app/components/SettingsPage.tsx` — replace `TypeModal` with `ModalDialog`
9. `src/app/components/intelligence/AskScreen.tsx` — replace inline modals with `ModalDialog`

## Risks & Mitigations

1. **CSS class conflicts in cleon_company_documentary** — The `ModalShell` uses CSS classes defined in `globals.css`. Adding `.is-fullscreen` modifier must not affect `.video-backdrop.is-fullscreen` used by `VideoModal`. **Mitigation:** Use distinct modifier class names or ensure VideoModal's `video-backdrop` class is separate from `modal-backdrop`.

2. **Behavior changes in cleon_document_management** — Refactoring inline modals could change layout/spacing. **Mitigation:** `ModalDialog` should match existing inline modal patterns exactly (same Tailwind classes for backdrop, card, header) to ensure visual parity.

3. **Portal vs inline rendering** — `FolderActions.tsx` edit modal is rendered inline (not portaled), while `ModalDialog` would be inline too (matching existing pattern). No portal change needed.

4. **Escape key handling** — Existing modals may already handle Escape. `ModalDialog` should not double-bind handlers. **Mitigation:** Only add Escape-to-exit-fullscreen within `ModalDialog`; let parent handle modal close.

5. **Backward compatibility** — Existing `ModalShell` consumers that don't pass `fullscreenable` should render identically. Default prop to `false`.

## Validation

1. **Visual regression** — All modals should look identical when not in fullscreen mode
2. **Fullscreen toggle** — Clicking the maximize icon expands the modal to fill the viewport; minimize icon returns to original size
3. **Content overflow** — Scrollbars should not appear in fullscreen mode (content fits viewport)
4. **Close behavior** — Closing modal in fullscreen mode should reset fullscreen state
5. **Escape key** — Pressing Escape while in fullscreen should exit fullscreen (not close modal)
6. **lucide-react availability** — Both apps already import `Maximize2`/`Minimize2` from `lucide-react`

## Out of Scope

- Migrating the browser Fullscreen API usage in `VideoModal.tsx` (it already works with native fullscreen)
- Creating a shared component library between the two apps (they have separate dependency trees)
- Modifying document viewer fullscreen implementations that already work (`OrganizationFolderPage`, `EmployeeProfilePage`, `MyDocumentsPage`) unless unifying them into `ModalDialog` proves low-risk
