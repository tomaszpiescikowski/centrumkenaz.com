# Mobile Calendar & Bottom Navigation

## Scope
This change introduces a mobile-first calendar experience and a fixed bottom navigation bar.

## UI behavior
- Mobile navigation moved from the top bar to a fixed bottom bar.
- Bottom bar has at most 5 primary actions.
- Admin users get a central `+` action that links to `/admin/events/new`.
- Core mobile routes now use an app-like fixed viewport shell (`/`, `/calendar`, `/shop`, `/me`, `/pending-approval`).
- On those routes, page-level scrolling is disabled on mobile; scrolling is constrained to dedicated internal lists where needed.
- Mobile calendar uses a compact month grid.
- Each day shows up to 3 event markers.
- Tapping a day opens the day agenda list under the grid.
- Tapping an agenda item goes to event details/registration flow.

## Security guarantees
- No backend authorization rules were relaxed.
- Event registration and details still rely on backend guards (`401/403`) and existing account checks.
- Admin-only creation remains protected by server-side role checks in backend routes.
- Mobile admin `+` is a UI shortcut only; backend remains source of truth.

## Reliability notes
- Bottom nav is rendered only on mobile (`sm:hidden`) and avoids auth callback routes.
- Main layout reserves safe-area aware bottom space so content is not hidden behind fixed nav.
- Main layout uses `100svh` on mobile to reduce iOS viewport jump issues and accidental body scrolling.
- Calendar state is month-scoped with deterministic event grouping by local date keys.
- Data-heavy screens (shop list, account registrations, selected-day agenda) scroll inside stable containers rather than scrolling the whole page.

## Cleanup
- Removed old mobile weekly calendar mode from `Calendar.jsx` and replaced with unified compact-month implementation.
