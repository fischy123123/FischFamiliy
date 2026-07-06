# Fisch Family: Forest Chaos — Unreal Engine 5 Migration Guide

Everything designed and tuned in the browser version — the family, the world
layout of 110 River Ln, the missions, the dialogue, the activities — carries
over. This folder is the handoff package: this guide plus four CSV data
tables that import directly into Unreal as Data Tables.

## 0. The honest platform reality

| | Browser version (this repo) | Unreal version |
|---|---|---|
| Where it runs | Any phone/computer, via a link | Installed app on iPhone/Android (+ Mac/PC) |
| Visual ceiling | Stylized-realistic (where we are now) | True photoreal: Nanite, Lumen GI, MetaHumans |
| How family gets it | Tap the GitHub Pages link | TestFlight invite (iOS) or APK file (Android) |
| What you need | Nothing — it's done | A Mac or gaming PC, ~150 GB free disk, UE 5.4+ (free) |
| iOS distribution | n/a | Apple Developer account ($99/yr) + a Mac to build |
| Android distribution | n/a | Just build the APK and install it — no account needed |

**Recommendation:** start with the Android APK target (zero gatekeeping,
build → AirDrop/Drive → install) even if the family is mostly iPhone;
test on one Android device, then do the Apple dance once it's fun.

## 1. Install checklist

1. [Epic Games Launcher](https://www.unrealengine.com/download) → install **UE 5.4+** (free).
2. In the launcher, sign into **Fab** (Epic's asset marketplace — Quixel
   Megascans are free with a UE license).
3. [MetaHuman Creator](https://metahuman.unrealengine.com) — free,
   browser-based, this is how the family becomes photoreal (Section 3).
4. New project: **Games → Third Person → Blueprint**, target platform
   *Mobile*, quality *Scalable* (you can push quality up later — starting
   mobile-scalable avoids painful downgrades).

## 2. The world — build from `DataTables/WorldLayout.csv`

The whole neighborhood is exported as coordinates. Scale: **1 browser unit
= 1 meter = 100 Unreal units**; browser `(x, z)` → Unreal `(X = x·100,
Y = z·100)`, ground at Z=0.

Build order that works:
1. **Landscape**: flat 250m circle is fine (matches the game). Paint with
   Megascans *forest floor / redwood needle* layers per the browser's
   duff-vs-grass zones.
2. **Blockout** every rectangle in WorldLayout.csv with BSP/simple meshes
   first. Play it. It will already feel like the neighborhood.
3. Replace blockouts with assets (Section 4).

Key zones (full list in the CSV): house at (0, −23), driveway (8, −4),
River Ln road along y = 13, RV resort strip (17, 22), San Lorenzo River
band y = 28→38, covered bridge at x = 21.5 crossing it, railway at
y = 41.8, trampoline (−21, −2), campfire (−24, −16), soccer goal (−24, −6).

## 3. The family — MetaHumans

This is the single biggest upgrade Unreal buys you. In MetaHuman Creator,
build each person against the reference photos (the same ones used for the
stylized versions), then use **Mesh to MetaHuman** if you want to fit from
photos more directly. Heights/speeds/personality are in
`DataTables/Characters.csv`.

- **Eric** — short dark hair, trimmed beard, brown eyes; leather jacket
  (Fab has biker/casual outfit packs)
- **Jessy** — long brown hair with side-swept bangs, green eyes, winged
  eyeliner, gold nose stud, orange top
- **Liam (14)** — long curly light-brown hair, glasses, teen mustache fuzz,
  light-blue hoodie + headphones prop around neck
- **Maddie (11)** — side-parted wavy bob, brown eyes, neon-green tee
  (MetaHuman teen presets, scale ~1.50 m)
- **Rowan (4)** — MetaHuman doesn't do age 4 well; use a Fab stylized-child
  base or scale a teen preset to 1.05 m; navy sideways ball cap with red
  circle patch is his signature
- **Faylen (2)** — same approach at 0.78 m; messy top bun, mint sundress

Kids caveat: photoreal *small children* are the weakest spot of every
pipeline including MetaHuman. Expect Rowan/Faylen to land "very good"
rather than photograph-perfect.

## 4. Asset shopping list (all free on Fab/Quixel)

- **Redwood forest**: search Fab for *"redwood"* / *"sequoia"*; Megascans
  conifer + forest-floor packs; MAW/Project Nature pine packs work well as
  understory. Nanite ON for desktop, OFF for the mobile build.
- **House**: no asset will match your house. Two options: (a) blockout +
  Megascans wood/board-and-batten materials — 90% of the look for 5% of
  the work (recommended), or (b) model it in Blender from the photos.
- **San Lorenzo River**: built-in **Water plugin** (river spline).
- **Covered bridge**: Fab has several covered/wooden bridges; re-plank
  with Megascans wood.
- **RVs, Mini Cooper, old pickup**: Fab vehicle packs (search "camper",
  "RV", "pickup truck rusty").
- **Steam train**: Fab "steam locomotive" — put it on a spline mover with
  the whistle timing from the browser version (crossing every 24–45 s).
- **Deer, squirrel, butterflies, birds**: Fab animal packs ("STF Animals",
  "Animal Variety Pack").
- **Banana slugs**: nobody sells banana slugs. Model a capsule + antennae
  in UE modeling mode, bright yellow — 15 minutes, and honestly the
  comically-large slugs are canon now.

## 5. Systems — direct mapping from the browser code

| Browser system (game.js) | Unreal equivalent |
|---|---|
| Character switching (1–6 / portraits) | `Possess` different Character pawns; portrait UMG bar |
| Family wander AI, Rowan zoomies, Faylen-follows-parent | Behavior Trees + NavMesh; zoomies = speed multiplier task |
| Missions (5, in `Missions.csv`) | Quest Blueprint component reading the Data Table |
| Talk / High-five / Specials | Sphere overlap → UMG action bar; lines from `Dialogue.csv` Data Table |
| Speech bubbles | Widget Components above heads |
| Trampoline / soccer / stone skipping | Launch Character volume; physics ball + goal overlap; projectile with bounce-on-water |
| Kick physics, tag, races | Already specced — copy constants from Characters.csv/Missions.csv |
| Touch joystick + buttons | Enhanced Input **Touch Interface** (built-in virtual joystick) |
| Wind/birds/train audio | MetaSounds; ambient wind + bird one-shots |
| Dad jokes on a timer | Timer → pick random row from Dialogue.csv `dadjoke` rows |

## 6. Mobile build targets

- **Android**: enable Android SDK via Turnkey (Project Settings →
  Platforms → Android), package *ASTC*, install the APK directly on
  phones. Start here.
- **iOS**: requires a Mac + Apple Developer account; distribute via
  TestFlight to the family (up to 100 internal testers, no App Store
  review needed for internal builds).
- Mobile settings that matter: Mobile HDR **on** (needed for nice
  lighting), Lumen **off** on mobile (use baked lighting there; Lumen on
  desktop), forest density scaled by device profile.

## 7. Milestones (realistic hobbyist pacing)

1. **Weekend 1** — project setup, landscape, blockout from WorldLayout.csv, third-person touch controls. *Playable walk around the lot.*
2. **Weekend 2** — Megascans forest + house materials + river. *Looks like Felton.*
3. **Weekend 3–4** — MetaHumans imported, possession switching, name plates.
4. **Weekend 5** — missions + interactions off the Data Tables, speech widgets.
5. **Weekend 6** — activities (trampoline, soccer, stones, train), audio, Android build for the family.

## 8. Files in this folder

- `DataTables/Characters.csv` — the six Fisches: stats, looks, personalities
- `DataTables/Dialogue.csv` — every greeting, reply, quip, special, and dad joke
- `DataTables/Missions.csv` — all five missions with counts, rules, and completion text
- `DataTables/WorldLayout.csv` — every object in the neighborhood with coordinates

Import each in UE: right-click in Content Browser → Miscellaneous →
Data Table → pick/create the matching row struct → reimport from CSV.
