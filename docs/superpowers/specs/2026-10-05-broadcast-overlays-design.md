# Broadcast overlays — Design

**Date:** 2026-10-05
**Status:** Design approved in conversation, after checking the approach against YoloLiv's YoloBox documentation. The timer in Program becomes a corner clock. This written spec is awaiting review.
**Branch:** `feat/broadcast-overlays`, from `staging`. The PR targets `staging`.
**Sub-project 7 of 7** from the UI/UX audit (`.impeccable-audit/AUDIT.md`, `producer-overlays/`). It is the last design sub-project; the venue display is the first feature after it.

## Context: where the overlays run

The production uses a **YoloLiv YoloBox** (Pro, Mini, Ultra). It adds a web page as a **Web URL overlay** on top of the video, and the operator can size and place each overlay on the canvas. The platforms YoloLiv lists as compatible (Singular.live, H2R Graphics, UNO, Flexyscore) share one model: a transparent output URL, driven live from a separate control panel. That is RepOne's model too: the Program overlay, driven by the producer's board through realtime.

YoloBox's own documentation adds three constraints:
1. **Viewport.** Some units render the page in a **1280×720** viewport and cut off content laid out for 1920. Newer firmware is "optimized for 1920×1080" and scales the overlay to fit.
2. **Web URL limit.** The Ultra shows **at most three** web URLs at once. One URL (Program) should therefore carry everything.
3. **Browser.** The built-in browser is an embedded WebView. Animations should stay on `transform` and `opacity`, with no blur or filters.

Transparency of the page background is implied by the compatible platforms but not documented. It has to be checked on the device, which is what §5 provides.

## Goal

An operator pastes **one URL** (Program) into YoloBox or OBS. At 720p, 1080p, 4K, or shrunk on the canvas, it shows every graphic whole, inside the broadcast safe area, over transparent video. Graphics enter and leave with motion instead of popping in, and the running clock sits in a corner over the action instead of blacking it out.

**Success means:**
- Every overlay renders on a fixed **1920×1080 stage** scaled to the viewport, at `min(vw/1920, vh/1080)`, centred. At 1280×720 nothing is cut off: every element's box stays inside the viewport.
- Every graphic sits inside the 5% action-safe area: 96px left/right and 54px top/bottom on the stage.
- **In Program, Timer is a corner clock.** The heat strip shows top-left and the clock top-right, over transparent video. Heat intro, Lanes, WOD, Results, Leaderboard and Sponsor stay full-frame cards. The lower third layers over whichever of those is showing.
- **Motion:**
  - the lower third slides in from the left and out the same way;
  - cards fade and rise in, then fade out;
  - the corner graphics fade.
  - Everything runs in about 300ms, using only `transform` and `opacity`.
  - Under `prefers-reduced-motion: reduce`, graphics appear and disappear without motion.
- **`/overlay/[floorId]`** is an operator page:
  - it says "YoloBox: add Program";
  - every source has a description, a **Copy URL** button and a **Preview** link;
  - it links to the calibration page.
- **`/overlay/[floorId]/test`** shows a calibration pattern: the stage outline, the safe-area frame, corner markers, the viewport size and scale, and a transparency check.
- Body and html stay transparent on every overlay route, which the existing overlay root layout already ensures.

## Non-goals

- The visual identity (black, white, RepOne red, Barlow display). It stays; the audit called it strong.
- What data each graphic shows, and the producer's controls. Those are sub-project 4.
- `TimerDisplay`'s use on the live page and the producer board.
- A YoloBox-specific iframe wrapper. The scaled stage makes it unnecessary.

## 1. The stage

`src/components/graphics/BroadcastStage.tsx` (client):

```tsx
<BroadcastStage>{children}</BroadcastStage>
```

- The outer wrapper is `fixed inset-0 overflow-hidden` and transparent.
- The inner stage is a `1920×1080` absolutely positioned box with `transform-origin: top left` and `transform: translate(offsetX, offsetY) scale(s)`:
  - `s = stageScale(innerWidth, innerHeight)`;
  - the offsets centre the scaled stage.
- It recomputes on `resize`.
- Before measuring, it renders at scale 1 with `visibility: hidden`, so a 720p viewport never shows one unscaled, cut-off frame.
- The scale comes from a pure function in `src/lib/broadcast/stage.ts`: `stageScale(width: number, height: number): number`, which returns `Math.min(width / 1920, height / 1080)`. The same file exports `STAGE = { width: 1920, height: 1080, safeX: 96, safeY: 54 }`.
- Children are laid out in stage pixels. `SafeArea` is a positioned box (`absolute` with `inset` at `safeY`/`safeX`) for anything that must stay title-safe.

## 2. Broadcast type scale

These are defined once in `globals.css`'s `@theme`, in stage pixels:

| Token | Size | Use |
|---|---|---|
| `--text-bc-hero` | 112px | full-frame card titles |
| `--text-bc-title` | 64px | card section titles, lower-third name |
| `--text-bc-body` | 40px | rows, names in cards |
| `--text-bc-label` | 26px | labels, divisions, affiliates |
| `--text-bc-clock` | 96px | the corner clock |

Graphics use `text-bc-*` classes instead of `text-xl`, `text-5xl` and the like. Spacing inside the stage uses stage pixels, so arbitrary values such as `px-[48px]` are fine there. The guard doesn't apply to `src/components/graphics`.

## 3. Graphics

Every graphic in `src/components/graphics/` keeps its props and changes only its layout:

- **Full-frame cards** (`HeatIdentification` full-screen, `LanesBoard` full-screen, `WodCard` full-screen, `HeatResults`, `Leaderboard` full-screen, `SponsorCard` full-screen):
  - fill the stage (`absolute inset-0`) with the card background;
  - lay out their content inside the safe area;
  - use the type scale;
  - replace `h-screen w-screen` with `absolute inset-0`.
- **Corner strip.** `HeatIdentification` (not full-screen) becomes the top-left heat strip, placed by its parent at the safe-area corner.
- **Corner clock.** `ClockBug` is new (`src/components/graphics/ClockBug.tsx`): the running time in `text-bc-clock` on the broadcast background. It turns the accent colour `atLimit`, exactly as `TimerDisplay` does.
- **Lower third.** `LowerThird` is placed by its parent at the safe area's bottom-left. It loses its own `absolute bottom-[8%] left-[4%]`.

Each `fullScreen` prop now means "fill the stage".

## 4. Motion

`src/components/graphics/Appear.tsx` (client):

```tsx
<Appear show={boolean} variant="slide-left" | "rise" | "fade">{children}</Appear>
```

- **Presence.** When `show` turns true, it mounts and plays the enter keyframes. When `show` turns false, it keeps the last children mounted, plays the exit keyframes, and unmounts after `EXIT_MS` (320).
- **Content changes while shown.** If the children change while `show` stays true (another athlete in the lower third), they swap in place with no exit.
- **Keyframes** live in `globals.css`: `bc-slide-in-left` and `bc-slide-out-left` (translateX -40px plus opacity), `bc-rise-in` and `bc-rise-out` (translateY 24px plus opacity), and `bc-fade-in` and `bc-fade-out`. All run 300ms on `cubic-bezier(.2,.8,.2,1)`.
- **Reduced motion.** An `@media (prefers-reduced-motion: reduce)` block sets `animation: none`, and `Appear` unmounts at once when the media query matches.

## 5. Routes

All of these render inside `BroadcastStage`:

- **`program`** (`ProgramOverlayClient`) has three layers:
  1. **Cards.** One `<Appear variant="rise">` per card graphic, shown when `active_graphic` is that card. Swapping cards fades one out while the next rises in.
  2. **Corner.** When `active_graphic === "timer"`, the heat strip shows top-left and the `ClockBug` top-right, inside the safe area, each in `<Appear variant="fade">`. No full-frame timer.
  3. **Lower third.** `<Appear variant="slide-left">` at the safe area's bottom-left, whenever `lower_third_athlete_id` is set. It sits over a card or over plain video.
- **Single routes** (`timer`, `heat`, `lanes`, `lower-third`, `leaderboard`, `wod`, `sponsor`). Each keeps today's content:
  - **Timer:** the `ClockBug` top-right.
  - **Heat:** the strip top-left.
  - **Lanes:** the compact board top-left, under the strip's slot.
  - **Leaderboard:** the compact board right.
  - **WOD:** the compact card left.
  - **Sponsor:** the compact card bottom-right.
  - **Lower third:** as in Program.

  Each sits in the safe area and uses `Appear` where it shows and hides on state.
- **`/overlay/[floorId]` (index)** is an operator reference page. It keeps the broadcast background and isn't a graphic.
  - A callout: **"YoloBox or a single browser source: add Program. It shows whatever Production puts on air."**
  - Program first, then the rest. Each row has the source's name, a one-line description, its full absolute URL, a **Copy URL** button (`navigator.clipboard.writeText`, button reads "Copied" for 2s) and a **Preview** link that opens in a new tab.
  - A link to the calibration page: "Check the picture on your device".
  - Targets are at least 44px.
- **`/overlay/[floorId]/test` (new).** Inside the stage:
  - a 2px outline of the full stage;
  - the safe-area frame, dashed, in the accent colour;
  - corner markers labelled TL, TR, BL and BR;
  - a centred panel showing the viewport size, the scale and "1920 × 1080 stage";
  - the line "If you can see your camera behind this text, the background is transparent."

  The page background stays transparent, so a white or black frame on the device means the device isn't honouring transparency.

## 6. Testing

- **Unit:** `stageScale` at 1920×1080 (1), 1280×720 (≈0.667), 3840×2160 (2), and a tall viewport, where the min rules.
- **Components (jsdom):**
  - `Appear`: mounts on show; stays mounted through the exit for `EXIT_MS` (fake timers) and then unmounts; swaps children in place while shown; unmounts at once when `matchMedia("(prefers-reduced-motion: reduce)")` matches.
  - `ProgramOverlayClient`, with the realtime hooks mocked:
    - `active_graphic: "timer"` renders the clock and the heat strip and no full-frame card;
    - `"lanes"` renders the lanes card;
    - a lower-third athlete renders `LowerThird` together with a card.
  - Index page: the Copy button writes the absolute Program URL, with the clipboard mocked.
- **Browser** (`.verify/overlays/`): set `broadcast_state` through SQL for each state.
  - Program at **1920×1080** and **1280×720**: timer and strip; lanes card plus lower third; leaderboard. At both sizes, every rendered graphic's `getBoundingClientRect` lies inside the viewport and inside the scaled safe area.
  - The computed background of `html` and `body` is transparent.
  - The calibration page at 1280×720.
  - The index page.
  - Motion: toggling the lower third through SQL shows it entering. A screenshot mid-animation is optional, but keep the class or attribute evidence.
  - Afterwards, reset `broadcast_state` and close the pages.

## 7. Docs

`DESIGN.md`'s "Broadcast graphics (overlays)" section is rewritten to cover:
- the 1920×1080 stage and `BroadcastStage`;
- the safe area;
- the `bc` type scale;
- `Appear` and its motion rules;
- "YoloBox: one Program URL; calibrate with `/test`".
