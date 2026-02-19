# Frontend Structure Guide For LLMs

This file is the canonical map for working in `src/`.
If you edit frontend code, read this file first.

## Goals
- Keep code discoverable by domain and responsibility.
- Avoid duplicating UI logic/styles already extracted to shared layers.
- Preserve import and folder consistency when adding/moving files.

## High-Level Layout

```text
src/
  App.jsx
  main.jsx
  api/
  components/
    calendar/
    common/
    controls/
    forms/
    layout/
    navigation/
    ui/
  constants/
  context/
  hooks/
  languages/
  pages/
    account/
    admin/
    auth/
    public/
  styles/
    base.css
    design-tokens.css
    index.css
    ui.css
    modules/
      components/
      pages/
  utils/
```

## Folder Responsibilities

### `components/`
- `layout/`: app frame/shell wrappers.
- `navigation/`: top/bottom nav and footer.
- `forms/`: reusable form widgets and auth form buttons.
- `controls/`: selectors/toggles used in nav/forms.
- `common/`: reusable feature-agnostic visual building blocks.
- `calendar/`: calendar feature component(s).
- `ui/`: low-level shared UI primitives (cards, tables, auth gate, sort utils).

### `pages/`
- `public/`: pages available without auth.
- `auth/`: login/callback auth flows.
- `account/`: authenticated user flows.
- `admin/`: admin-only flows.

### `styles/`
- `index.css`: single global stylesheet entrypoint imported from `main.jsx`.
- `base.css`: global baseline/layout/motion primitives.
- `ui.css`: shared Tailwind component classes (`@layer components`).
- `design-tokens.css`: CSS token variables.
- `modules/components|pages`: all CSS Modules.

### `api/`, `context/`, `hooks/`, `utils/`, `constants/`
- `api/`: HTTP boundary and payload normalization.
- `context/`: app-wide state providers.
- `hooks/`: reusable behavior hooks.
- `utils/`: pure utility functions.
- `constants/`: immutable frontend constants.

## Import Rules

1. Keep imports domain-accurate.
- Example: do not import `components/common/EventIcon.jsx` as if it were in root `components/`.

2. Use existing shared primitives first.
- Cards: `components/ui/ViewCard.jsx`
- Auth/login-required blocks: `components/ui/AuthGateCard.jsx`
- Sortable tables: `components/ui/SortableDataTable.jsx`

3. Use shared style classes before adding long inline class chains.
- Shared classes are in `styles/ui.css` (`ui-input`, `ui-table-*`, `ui-tag-*`, etc.).

4. Keep CSS Modules in `styles/modules/*`.
- New component module: `src/styles/modules/components/<Name>.module.css`
- New page module: `src/styles/modules/pages/<Name>.module.css`

5. Keep one global stylesheet entry.
- Only `src/main.jsx` imports global stylesheet (`src/styles/index.css`).

## When Adding New Code

1. New page:
- Place in one of `pages/public|auth|account|admin`.
- Update routes in `App.jsx`.

2. New reusable component:
- Place in appropriate `components/*` domain folder.
- If highly generic, place in `components/ui/`.

3. New styles:
- Prefer shared class extension in `styles/ui.css`.
- Use CSS Module only for component/page-specific styling.

4. New strings:
- Add i18n keys in language JSON files; do not hardcode UI text.

## Anti-Patterns To Avoid
- Reintroducing root-level `src/index.css`.
- Creating duplicate auth gate markup instead of `AuthGateCard`.
- Creating duplicate card/table/sort patterns instead of shared `ui` components.
- Scattering `.module.css` files back near JSX files.
- Moving files without updating all imports and route imports.

## PR/Change Checklist (Frontend)
- Imports resolve after moves.
- Routes in `App.jsx` are correct.
- Shared UI abstractions reused where applicable.
- No dead/duplicated code introduced.
- `npm run build` passes.
