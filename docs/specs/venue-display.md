Sí. Para el developer lo presentaría como una especificación funcional/arquitectónica, no todavía como instrucciones de programación. La idea es que entienda qué problema estamos resolviendo, cómo encaja dentro de RepOnePlatform y qué debe quedar preparado para crecer.

RepOnePlatform

Venue Display & Sponsor Delivery Architecture

Documento conceptual para desarrollo

1. Propósito

RepOnePlatform debe convertir las pantallas físicas instaladas en los venues en un canal dinámico de información deportiva y publicidad, administrado centralmente desde la plataforma.

La pantalla no debe funcionar como un simple slideshow de auspiciadores.

Debe combinar automáticamente:

Sponsors + competencia en curso + lineup + leaderboard + próximo heat + información del WOD + mensajes del evento

utilizando los mismos datos que RepOnePlatform maneja para scoring, producción y broadcast.

El objetivo es crear una pantalla que la audiencia quiera consultar repetidamente. Esa atención aumenta a su vez el valor de la publicidad presentada.

⸻

1. Principio arquitectónico

RepOnePlatform = Single Source of Truth

No queremos sistemas separados para:

- livestream
- venue display
- scoring
- leaderboard
- sponsors
- heat lineup

Todos deben consumir el mismo estado del evento.

Conceptualmente:

```
                     REPONE PLATFORM
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    COMPETITION         SPONSORS         EVENT STATE
       DATA                                  │
          │                                  │
  ┌───────┼────────┐                         │
  │       │        │                         │
```

   WODs     Heats   Results                      │
      │       │        │                         │
      │     Lanes   Scoring Engine               │
      │       │        │                         │
      │    Athletes    │                         │
      │                ▼                         │
      │           LEADERBOARD                    │
      │                │                         │
      └────────────────┼─────────────────────────┘
                       │
                 REAL-TIME STATE
                       │
         ┌─────────────┼──────────────┐
         │             │              │
         ▼             ▼              ▼
   LIVESTREAM      VENUE DISPLAY   PRODUCTION
    OVERLAYS                         DASHBOARD

The venue display is therefore another presentation layer of RepOnePlatform, not an independent application.

⸻

1. Physical architecture

Initial deployment:

RepOnePlatform
      │
      │ Internet / RepOne LAN
      ▼
Venue Display Web Application
      │
      ▼
Mini PC / Signage Player
      │
     HDMI
      │
      ▼
55" Vertical 4K Display
      │
      ▼
EVENT AUDIENCE

Preferred screen orientation:

9:16 vertical

Target resolutions:

1080 × 1920 minimum
2160 × 3840 preferred

The signage device should automatically launch the appropriate RepOnePlatform display URL in kiosk/full-screen mode.

Example conceptual route:

/display/venue/{eventId}/{displayId}

No operator should need to touch the TV during normal operation.

⸻

1. Display content engine

The display should NOT simply rotate images.

RepOnePlatform should maintain different Content Blocks.

CONTENT BLOCKS
SPONSOR_AD
CURRENT_HEAT
NEXT_HEAT
LEADERBOARD
WOD_INFO
EVENT_SCHEDULE
ATHLETE_SPOTLIGHT
EVENT_ANNOUNCEMENT
REPONE_CTA

Every block should have configurable properties such as:

Enabled
Duration
Priority
Weight/Frequency
Eligible Event State
Start Time
End Time
Sponsor Association (optional)

This creates a dynamic playlist rather than a static slideshow.

⸻

1. Example live rotation

During active competition:

┌─────────────────────────┐
│      SPONSOR AD         │
│       10 sec            │
└─────────────────────────┘
             ↓
┌─────────────────────────┐
│      CURRENT HEAT       │
│                         │
│ WOD 2 • HEAT 4          │
│ Lane 1 — Athlete A      │
│ Lane 2 — Athlete B      │
│ Lane 3 — Athlete C      │
│ Lane 4 — Athlete D      │
│                         │
│       15 sec            │
└─────────────────────────┘
             ↓
┌─────────────────────────┐
│      SPONSOR AD         │
│       10 sec            │
└─────────────────────────┘
             ↓
┌─────────────────────────┐
│     LEADERBOARD         │
│                         │
│ 1. Athlete A            │
│ 2. Athlete B            │
│ 3. Athlete C            │
│ 4. Athlete D            │
│ 5. Athlete E            │
│                         │
│       15 sec            │
└─────────────────────────┘
             ↓
┌─────────────────────────┐
│       NEXT HEAT         │
│       12 sec            │
└─────────────────────────┘
             ↓
          REPEAT

The sequence does not need to remain identical. The scheduler should determine what is appropriate based on configuration, sponsor obligations and event state.

⸻

1. Automatic event-state behavior

This is an important requirement.

The display should eventually understand the current state of the competition.

PRE-EVENT

Sponsors
Event Schedule
Today's WODs
Athlete Spotlights
RepOne CTA
Sponsors

ACTIVE HEAT

Sponsor
Current Heat
Sponsor
Leaderboard
Current Heat
Next Heat
Sponsor

BETWEEN HEATS

Next Heat
Sponsor
Leaderboard
WOD Information
Sponsor

BREAK

Advertising inventory can increase:

Sponsor
Sponsor
Leaderboard
Sponsor
Event Schedule
Sponsor
Athlete Spotlight

AWARDS / END OF EVENT

Final Leaderboard
Winners
Sponsors
Event Recap
RepOne CTA

The operator should have the ability to override the automatic state.

⸻

1. Real-time competition integration

The display must consume competition data rather than maintain its own copies.

For example:

PRODUCTION OPERATOR
Selects:
WOD 2
HEAT 5
START
        │
        ▼
REPONE EVENT STATE
        │
 ┌──────┼───────────────┐
 ▼      ▼               ▼
Venue   Broadcast    Commentator
Display Overlay       Dashboard

When Heat 5 becomes active, the Venue Display automatically knows:

- heat number
- division
- athletes
- lane assignments
- WOD
- next heat

No one should manually re-enter those athletes for the signage system.

⸻

1. Leaderboard integration

The same principle applies to scoring.

RESULT ENTERED
      │
      ▼
SCORING ENGINE
      │
      ▼
LEADERBOARD
      │
      ├──────── Broadcast
      │
      ├──────── RepOnePlatform
      │
      └──────── Venue Display

When a result changes the leaderboard, the Venue Display should receive the new information automatically.

No full-page refresh should normally be necessary.

⸻

1. Sponsor architecture

The sponsor itself should not own a permanent package.

The relationship should be:

SPONSOR
   │
   ▼
EVENT SPONSORSHIP
   │
   ▼
PACKAGE PURCHASED
   │
   ▼
ENTITLEMENTS
   │
   ├── Venue Display
   ├── Livestream
   ├── Commercial
   ├── Commentator Mention
   ├── Social Media
   └── Future Channels

This allows the same sponsor to purchase different levels at different events.

Example:

DECODATA
Sector CrossFit
→ Brand Mention Package
GBO Fitness
→ WOD Sponsor
FT Cross
→ Presenting Sponsor

There is still only one Decodata sponsor record.

⸻

1. Sponsor frequency engine

Each package can define default Venue Display entitlements.

Conceptually:

Package	Display	Duration	Weight
Standard	Yes	10 sec	1×
Plus	Yes	10 sec	2×
Premium	Yes	15 sec	3×
Presenting	Yes	15–20 sec	4×

These are examples, not fixed business rules.

Administrators must be able to modify packages.

An individual event sponsorship must also allow an override.

⸻

1. Weighted scheduler

The system should not simply say:

Show Sponsor A every 5 minutes.

Instead, create a weighted scheduling engine.

If:

Sponsor A = 1
Sponsor B = 1
Sponsor C = 2
Sponsor D = 4

Sponsor D should receive approximately four times the inventory of Sponsor A over an appropriate measurement window, while maintaining a natural viewing experience.

The scheduler should avoid:

- same advertiser twice consecutively;
- excessive repetition;
- long gaps for premium advertisers;
- sponsor conflicts where exclusivity exists.



⸻

1. Sponsored information blocks

This creates another monetization opportunity.

A sponsor doesn’t necessarily need an independent advertisement.

RepOnePlatform should eventually support:

CURRENT HEAT
Presented by DECODATA

or

LIVE LEADERBOARD
Presented by ELITE TECHNICAL AIR

or:

NEXT HEAT
Powered by [Sponsor]

This inventory may ultimately be more valuable because spectators have a reason to look at those screens.

Therefore the architecture should distinguish:

Sponsor Advertisement

from

Sponsored Content Block

⸻

1. Impression tracking

Every successfully displayed sponsor asset should generate a delivery record.

Conceptually:

Sponsor
Event
Package
Display
Creative
Timestamp
Duration
Completed
Playback Session
Content Type

Important:

Scheduled ≠ Delivered

RepOnePlatform should only count the exposure according to defined playback/completion rules.

This distinction will become important for sponsor reporting.

⸻

1. Sponsor Exposure Report

Long-term flow:

PURCHASED
     │
     ▼
ENTITLEMENTS
     │
     ▼
DELIVERY ENGINE
     │
     ▼
ACTUAL IMPRESSIONS
     │
     ▼
SPONSOR REPORT

Example:

DECODATA — EVENT REPORT

Venue Display
Purchased/Expected ........ 80
Delivered ................. 94
Standalone Ads ............ 52
Leaderboard Branding ...... 24
Heat Branding ............. 18
Livestream Mentions ....... 4/4
Commercials ............... 3/3

This becomes evidence of sponsor value rather than simply telling the advertiser that its logo appeared.

⸻

1. Multiple displays

Even if we begin with one entrance display, do not architect the system for only one screen.

Create the concept of:

DISPLAY DEVICE

Examples:

Entrance Display
Warm-Up Display
Athlete Area Display
Vendor Display
VIP Display

Each device could eventually have a different content mix.

For example:

Entrance: Sponsors + Schedule + Leaderboard

Athlete Area: Next Heat + Call to Floor + WOD + Leaderboard

Spectator Area: Current Heat + Leaderboard + Sponsors

⸻

1. Remote monitoring

From the RepOnePlatform dashboard, production should eventually see something similar to:

VENUE DISPLAYS
ENTRANCE DISPLAY
● ONLINE
Currently:
DECODATA
Next:
CURRENT HEAT
Resolution:
2160 × 3840
Last Heartbeat:
8 seconds ago
Today's Sponsor Impressions:
247

Controls:

PAUSE
RESUME
SKIP
FORCE SPONSOR
FORCE LEADERBOARD
EMERGENCY MESSAGE
RESTART PLAYLIST

⸻

1. Reliability requirement

The signage system cannot become useless because venue internet drops temporarily.

The player should cache enough information/assets to continue operating.

Conceptually:

```
             CLOUD
         RepOnePlatform
               │
               ▼
         LOCAL PLAYER
          CACHE/STATE
               │
               ▼
             TV
```

If connectivity disappears:

Sponsor assets continue rotating.

Competition information can display its last known state or be temporarily suppressed according to defined rules.

When connectivity returns:

Reconnect → synchronize → resume real-time operation.

⸻

1. Separation of responsibilities

This is important for development.

Competition Engine owns

Athletes
WODs
Heats
Lanes
Results
Leaderboard

Sponsor Module owns

Sponsors
Packages
Contracts/event sponsorships
Entitlements
Creative assets
Delivery requirements

Venue Display Engine owns

Playlist
Scheduling
Display modes
Device state
Playback
Impressions

Presentation Layer owns

Vertical layout
Animations
Typography
Sponsor creative rendering
Heat rendering
Leaderboard rendering

These should communicate, but they should not duplicate each other’s data.

⸻

1. MVP vs future development

I would explicitly tell the developer not to build everything at once.

MVP

For the first version:

One vertical display

Sponsor rotation

Current Heat

Next Heat

Leaderboard

Automatic real-time updates

Configurable sponsor frequency

Remote enable/disable

Basic impression tracking

Offline sponsor asset caching

That’s enough to prove the concept.

Phase 2

Add:

Sponsored Leaderboard
Sponsored Heat
Athlete Spotlight
WOD information
Schedules
Multiple displays
Advanced scheduling
Detailed exposure reports

Phase 3

Potentially:

Audience interaction
QR engagement
Sponsor analytics
Multiple venue zones
Remote fleet management
Automated sponsor fulfillment reporting

⸻

1. The business purpose

This is probably the most important thing for the developer to understand:

The Venue Display is not being developed primarily as a digital billboard.

Its purpose is to make RepOnePlatform the information layer of the physical sporting event.

The spectator looks at it because they want to know:

Who is competing?
Who’s next?
What’s the leaderboard?
What’s happening?

Once RepOne controls that attention, we can integrate sponsor exposure naturally into the experience.

That produces the cycle:

Useful information → repeated audience attention → sponsor exposure → measurable impressions → greater sponsor value → additional RepOne revenue.

And because all of it originates from RepOnePlatform, the same competition data can eventually power the venue screens, livestream graphics, commentator dashboard, website/app and post-event content without creating separate workflows.

I would give this architecture document to the contracted developer first, before giving Claude implementation instructions. Once the developer agrees with the architecture, the Claude prompt can be much more precise: we’ll have Claude audit the existing Sponsor module against this architecture and implement it in phases without disrupting what’s already working.