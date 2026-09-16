# Interior Design Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for independent view families; preserve existing data operations and do not commit or push.

**Goal:** Apply the approved landing design to every existing app view on mobile and desktop.
**Architecture:** One scoped `.app-ui` experience, shared typography/material/control tokens and glass navigation; route-specific layouts retain existing forms, state and server actions. The landing remains independently styled. Wide operational layouts replace phone-width desktop containers.
**Tech Stack:** Next.js 15, React 19, local DM Sans, Motion, simple-liquid-glass 5.3.0.
**Spec:** User request and `docs/capsules-design-study.md`, refined below.

## Global constraints
- Upright DM Sans; headings 44–80px, body/control labels at least 18px; no numbered marketing sections or cursive.
- Cream/plum light surfaces, corresponding dark tokens, rounded 28–40px panels and capsule actions.
- Mobile liquid glass only on floating navigation. Desktop navigation retains refraction; content panels prioritize stable, readable surfaces.
- Functional forms, status, errors, loading, empty, selection and confirmation states must remain usable.
- Preserve auth, business logic, invite-only access and operator permissions. Never submit live business changes during visual QA.
- No new animation library; short microtransitions with reduced-motion support.

## Shared interface
`components/app/AppChrome.tsx` exports `AppHeader({ children?, backHref? })`, `AppNav({items, label?})`, and `AppPageHeading({eyebrow?, title, description?, children?})`.
Nav items: `{label: string, icon: string, href?: string, onClick?: () => void, active?: boolean}`; icons use the existing Material Symbols font. Header has separate logo and action glass pills. All routes are automatically wrapped by `AppExperience` except `/`.

## Tasks
- [x] Foundation and agenda (root): app/layout, app/interior.css, components/app/*, shared controls/Sheet, dashboard layout/navigation/loading, AgendaView, development visual harness. Reflow day/week/month controls and event text; keep drag, details, clients and notifications functional.
- [x] Settings: SettingsView and settings-scoped CSS. Restyle all panels and editors including services, team, availability, closures, notifications and appearance. Use AppHeader/AppNav and shared tokens.
- [x] Public and access flows: AuthLayout, login/signup, onboarding, both booking flows and privacy/configuration states. Give desktop a composed wide layout and mobile a readable single column; retain all existing steps.
- [x] Administration and reporting: master views, analytics/share, QRCard. Responsive dashboard hierarchy, large metrics, readable management sheets.
- [x] Verify: typecheck; route-by-route visual checks at 390px and 1280px, additional 320px/wide calendar checks; exercise non-mutating state transitions using existing mock harnesses. Review changes, build, restart local server. Coverage and limits recorded in `docs/interior-design.md`.

## Decisions
The user's “proceed” and approved landing standards authorize implementation; no additional design approval required. Work stays in the existing shared checkout so the running preview reflects the changes. No commits or deployments.
