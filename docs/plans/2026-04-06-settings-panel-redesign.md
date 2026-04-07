# Settings Panel Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the LingoFlow settings screen into a clearer, higher-signal control center without changing the underlying settings data model.

**Architecture:** Keep the current React settings state and storage flow intact, but refactor the settings UI into stronger information hierarchy: overview header, richer tab navigation, section-level descriptions, denser provider management, and more legible shortcut editing. Preserve the existing dark shell while introducing a flatter teal-accent visual system and better keyboard/accessibility semantics.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library

---

### Task 1: Lock down desired behavior with failing settings tests

**Files:**
- Modify: `frontend/src/tests/features/SettingsPanel.test.tsx`
- Test: `frontend/src/tests/features/SettingsPanel.test.tsx`

**Step 1: Write the failing test**

Add tests that assert the redesigned screen exposes:
- a summary/header area for the active tab,
- visible section descriptions for general/service settings,
- provider status chips and grouped counts,
- shortcut cards that expose both current binding and helper text.

**Step 2: Run test to verify it fails**

Run: `npm --prefix frontend run test -- src/tests/features/SettingsPanel.test.tsx`
Expected: FAIL because the new summary/header and richer content are not rendered yet.

**Step 3: Write minimal implementation**

Update settings components so the tested summary/header and richer section content exist with stable accessible text.

**Step 4: Run test to verify it passes**

Run: `npm --prefix frontend run test -- src/tests/features/SettingsPanel.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/tests/features/SettingsPanel.test.tsx frontend/src/features/settings
git commit -m "test: cover redesigned settings panel structure"
```

### Task 2: Refactor settings panel composition around overview + richer tabs

**Files:**
- Modify: `frontend/src/features/settings/SettingsPanel.tsx`
- Modify: `frontend/src/features/settings/settingsTabs.ts`
- Modify: `frontend/src/features/settings/settingsPanelSections.tsx`
- Test: `frontend/src/tests/features/SettingsPanel.test.tsx`

**Step 1: Write the failing test**

Add or refine tests for:
- active tab metadata rendering,
- tab count/status text,
- section descriptions staying aligned with the selected tab,
- keyboard navigation continuing to work.

**Step 2: Run test to verify it fails**

Run: `npm --prefix frontend run test -- src/tests/features/SettingsPanel.test.tsx`
Expected: FAIL because tab metadata and content hierarchy do not exist yet.

**Step 3: Write minimal implementation**

Refactor tab metadata into reusable objects, add top-level settings hero/overview, and change `renderTabContent` helpers to return richer sections with titles, descriptions, and denser layout blocks.

**Step 4: Run test to verify it passes**

Run: `npm --prefix frontend run test -- src/tests/features/SettingsPanel.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/features/settings/SettingsPanel.tsx frontend/src/features/settings/settingsTabs.ts frontend/src/features/settings/settingsPanelSections.tsx frontend/src/tests/features/SettingsPanel.test.tsx
git commit -m "feat: redesign settings panel information hierarchy"
```

### Task 3: Rebuild provider management as a real configuration studio

**Files:**
- Modify: `frontend/src/features/settings/ProviderPanel.tsx`
- Modify: `frontend/src/tests/features/ProviderPanel.test.tsx`
- Modify: `frontend/src/tests/features/SettingsPanel.test.tsx`

**Step 1: Write the failing test**

Add tests that assert:
- provider groups show enabled counts,
- each provider row shows category and enabled state clearly,
- the editor panel shows configuration guidance and links,
- enabling a provider from the row/editor still emits the expected patch.

**Step 2: Run test to verify it fails**

Run: `npm --prefix frontend run test -- src/tests/features/ProviderPanel.test.tsx src/tests/features/SettingsPanel.test.tsx`
Expected: FAIL because the richer provider studio UI is not present yet.

**Step 3: Write minimal implementation**

Restructure provider sections into a denser split view with summary metrics, active-state emphasis, cleaner field grouping, and accessible labels without changing provider configuration behavior.

**Step 4: Run test to verify it passes**

Run: `npm --prefix frontend run test -- src/tests/features/ProviderPanel.test.tsx src/tests/features/SettingsPanel.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/features/settings/ProviderPanel.tsx frontend/src/tests/features/ProviderPanel.test.tsx frontend/src/tests/features/SettingsPanel.test.tsx
git commit -m "feat: redesign provider configuration studio"
```

### Task 4: Restyle shortcut management and global settings surfaces

**Files:**
- Modify: `frontend/src/features/settings/ShortcutPanel.tsx`
- Modify: `frontend/src/styles/settings-panel.css`
- Test: `frontend/src/tests/features/SettingsPanel.test.tsx`

**Step 1: Write the failing test**

Add or refine tests that assert:
- shortcut cards expose helper text,
- recording state remains visible and accessible,
- action labels and current bindings remain discoverable.

**Step 2: Run test to verify it fails**

Run: `npm --prefix frontend run test -- src/tests/features/SettingsPanel.test.tsx`
Expected: FAIL because the updated shortcut layout and helper text are not fully rendered yet.

**Step 3: Write minimal implementation**

Adjust shortcut markup and rewrite `settings-panel.css` to deliver the new layout, visual tokens, focus states, responsive behavior, and reduced-motion-safe transitions.

**Step 4: Run test to verify it passes**

Run: `npm --prefix frontend run test -- src/tests/features/SettingsPanel.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/features/settings/ShortcutPanel.tsx frontend/src/styles/settings-panel.css frontend/src/tests/features/SettingsPanel.test.tsx
git commit -m "feat: restyle shortcut and settings surfaces"
```

### Task 5: Verify the redesign across checks

**Files:**
- Modify: `frontend/src/features/settings/SettingsPanel.tsx`
- Modify: `frontend/src/features/settings/settingsPanelSections.tsx`
- Modify: `frontend/src/features/settings/ProviderPanel.tsx`
- Modify: `frontend/src/features/settings/ShortcutPanel.tsx`
- Modify: `frontend/src/styles/settings-panel.css`
- Modify: `frontend/src/tests/features/SettingsPanel.test.tsx`
- Modify: `frontend/src/tests/features/ProviderPanel.test.tsx`

**Step 1: Run focused test suite**

Run: `npm --prefix frontend run test -- src/tests/features/SettingsPanel.test.tsx src/tests/features/ProviderPanel.test.tsx`
Expected: PASS

**Step 2: Run static verification**

Run: `npm --prefix frontend run typecheck`
Expected: PASS

**Step 3: Run formatting/lint check if needed**

Run: `npm --prefix frontend run lint`
Expected: PASS

**Step 4: Manual visual verification**

Run: `npm --prefix frontend run dev`
Expected: Settings screen renders with no horizontal scroll, strong hierarchy, and stable keyboard focus states.

**Step 5: Commit**

```bash
git add frontend/src/features/settings frontend/src/styles/settings-panel.css frontend/src/tests/features
git commit -m "feat: deliver redesigned settings control center"
```
