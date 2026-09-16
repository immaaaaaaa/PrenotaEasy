# Interior design

The interior uses the landing's upright DM Sans, cream/plum palette, oversized headings and rounded capsule controls. Operational views use solid content panels for readability; liquid glass is confined to floating navigation, including on mobile. Light mode is permanent, including when the device prefers dark mode. Previous theme preferences are cleared and appearance controls have been removed.

## Shared foundation

- `AppExperience` scopes interior typography and material tokens without changing the landing.
- `AppHeader` uses separate logo/action pills and compacts on scroll. `AppNav` provides a floating dock and returns to the top when changing local views.
- Body and control labels are at least 18px. Desktop headings scale up to 80px.
- Shared dialogs center on desktop and become bottom sheets on mobile. They have close buttons, Escape dismissal, focus containment/restoration, scroll locking and reduced-motion support.
- Calendar weeks/months scroll within their own region on narrow screens. The day view stays fluid. Short appointments keep one readable line and expose complete details on activation.

## View coverage

| Area | Views and states |
| --- | --- |
| Agenda | Owner/operator overview, day/week/month, clients, appointment details and editing, new appointments, client notes/history, notifications and QR |
| Studio | Business details, hours and breaks, service wizard, fixed slots and exceptions, add-ons, team, closures and sharing |
| Access | Login, invitation-only signup, onboarding, missing configuration |
| Customer | Service/add-on/operator/date/time selection, details, confirmation, appointment history, rescheduling and profile; both existing booking components |
| Management | Activity overview/cards, creation, operator access controls, reporting and sharing |
| Status | Loading, empty states, errors, missing pages, inactive operator premium access and privacy |

Existing authentication, permissions, database actions and availability logic remain in place. The public `/b/[slug]` route continues to use the richer booking component, as before.

## Visual verification

Checked in the in-app browser at 320px, 390px and 1280px using development fixtures. Coverage includes the agenda/calendar, a 15-minute event, operator navigation, customer detail dialogs, mobile service wizard, desktop fixed-slot editor, opening hours, login, onboarding, customer selection/calendar/profile/history, management cards with long names, creation dialog, populated/empty analytics and QR sharing.

DOM checks found no page-wide horizontal overflow or visible labels below 18px in the checked layouts. The 15-minute appointment's 20px text line fits within its 26px block. Dialog keyboard entry, Escape dismissal and focus return were checked. Destructive actions and errors use dedicated contrast tokens.

Fixtures at `/dev-access` and `/dev-management` block submissions and server-backed actions and return 404 in production. `/dev-calendar` and `/dev-settings` are pre-existing development harnesses; settings saves must not be used for visual QA. No real business records were changed during these checks. Booking availability is intentionally empty for fake fixture IDs, so real booking submissions, live authentication, physical-device performance and every possible data combination are outside this visual verification.

## Validation

- TypeScript check passed.
- `npm run build` passed, including Next.js type validation and route generation.
- Development server restarted on port 3000 with `.env.local`. Fresh login and landing loads succeeded; login button contrast was verified in the rendered DOM.
- Whitespace diff check passed. Independent reviews covered settings action preservation, agenda label sizing, and management calculations/fixture guards.

## Serverless runtime assets

The shared layout embeds DM Sans in the refractive backdrop using a filesystem read. The original WOFF2 must be included in each server function, as well as being served publicly. `outputFileTracingIncludes` explicitly includes that file.

`npm run build` also runs `check:runtime-assets`: five compiled route layouts are loaded from temporary directories containing only the public assets in their production file traces. This catches missing runtime files that a normal local build or `next start` can hide. Run `npm run check:runtime-assets` separately only after a production build.
