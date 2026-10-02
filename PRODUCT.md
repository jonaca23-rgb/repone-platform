# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

RepOne Platform is RepOneLive's in-house tool for running its own CrossFit-style competitions. It serves one organization. Each role uses it in a different situation:

- **Organizers (admin, event director).** At a laptop before and during an event. They set up events, divisions, WODs, heats and lanes, register and check in athletes, track fees, payments and expenses, manage sponsors, and invite staff.
- **Scorekeepers.** On the competition floor, usually on a phone or tablet, under time pressure. They enter each lane's result for the heat, then finish the heat.
- **Producers.** Run the live broadcast from a tablet or laptop. They set the heat on air, run the timer, and trigger graphics, lower thirds and sponsors.
- **Commentators.** At a laptop at the desk. They read lanes, athletes, WODs and standings at a glance while talking.
- **Athletes.** Mostly on a phone. They sign up, create their profile, show a QR at check-in, track lifts and benchmarks, and message other athletes and staff.
- **Spectators (public).** On phones, at the venue or remotely. They follow the live leaderboard. On video they see the broadcast overlays.

## Product Purpose

The platform runs a competition end to end from one source of truth. Scoring, the leaderboard, the broadcast graphics, the commentator screens, the public live view and, next, the venue display and sponsor delivery all read the same event state.

Success means two things. An event runs without re-entering data across systems. On event day the screens are fast, glanceable and hard to get wrong.

## Positioning

The scoring engine, the production controls and the broadcast overlays are one system. A result entered on the floor reaches the leaderboard, the commentators and the on-air graphics in real time, with no operator copying data between tools.

## Operating Context

- **Event day is the critical scene.** It is loud and bright, with people standing and in a hurry. Phones and tablets are common on the floor and at the production desk, and venue connectivity can be weak.
- **Overlays are OBS/vMix/YoloBox browser sources.** They render at 1920×1080 over video, so they must be transparent and readable at broadcast distance.
- **Staff often compete too.** One account can hold several roles, for example an athlete who also scorekeeps. After sign-in, a start page shows every module the person can open.
- **Access:** staff join by email invitation. Public sign-up is for athletes.

## Capabilities and Constraints

- **Stack:** Next.js (App Router) with Tailwind 4, Supabase (Postgres with RLS, Realtime) and BetterAuth. It is deployed on Vercel. Roles and permissions use BetterAuth's organization plugin.
- **Single organization** today.
- **UI language:** English. The client and its users are in Puerto Rico.
- **Theme decision (2026-10-02):** the whole app uses one dark theme. The admin area moves from light to dark.
- **Component library decision (2026-10-02):** the app adopts shadcn/ui. Overlays stay plain React and Tailwind with broadcast-specific tokens, because they must not carry focus rings, portals or extra client JS.
- **Planned:** a venue display and sponsor delivery system (`docs/specs/venue-display.md`).

## Brand Commitments

- **The RepOne and RepOneLive logos** in `public/` are kept.
- **RepOne red (#e0122f)** is part of the identity.
- **The look is a sports-network broadcast package:** black, red and white with condensed display type, used for the overlays and carried into the app.

## Evidence on Hand

- **Seed data:** one organization (RepOneLive), one event, one floor, six athletes and dev accounts per role.
- **UI/UX audit, 2026-10-02:** `.impeccable-audit/AUDIT.md`, local and not in git.
- **No real testimonials, customers or metrics exist.** Do not invent them.

## Product Principles

1. **Event day first.** A screen used live (scoring, production, commentary) must be glanceable, forgiving and fast, even on a phone or tablet.
2. **One source of truth.** Never make someone re-enter what the system already knows. What's shown as live must actually be live.
3. **Hard to get wrong.** Destructive and on-air actions are explicit, confirmable and visibly reflected.
4. **Everyone sees what they can do.** Navigation follows each person's permissions. The admin sees everything.
5. **Broadcast-grade identity.** The RepOne look holds from the overlays to the operator screens.

## Accessibility & Inclusion

The target is WCAG 2.1 AA. Contrast is the known gap: red text and dimmed greys on dark backgrounds fail AA. On phone screens used on the floor, touch targets must be at least 44px and inputs at least 16px, so iOS doesn't zoom in.
