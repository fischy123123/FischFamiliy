# Weekend 1 — Click-by-Click Walkthrough

Goal for this session: **walk around a blockout of your actual lot on River
Ln, in Unreal, with game controls working.** No art yet — that's Weekend 2.
Budget 3–5 hours, most of it download/install time you can spend elsewhere.

Written for someone who has never opened Unreal. When anything doesn't match
what you see, screenshot it and bring it to Claude — versions shift menu
names occasionally.

---

## Part 0 — Ten-minute hardware check (do this first)

- **Windows PC**: a discrete GPU (NVIDIA GTX 1070 / RTX anything, or AMD
  equivalent), 16 GB+ RAM, 150 GB free on an SSD.
- **Mac**: Apple Silicon (M1 or later), 16 GB+ RAM, 150 GB free.
- If your machine is below this, stop — Unreal will technically open and
  practically be unusable. The browser game remains the game.

## Part 1 — Install (mostly waiting)

1. Go to **unrealengine.com** → Download → **Epic Games Launcher**. Install
   it, create/sign in to an Epic account.
2. In the launcher, left sidebar → **Unreal Engine** → **Library** tab →
   click **＋** next to "Engine Versions" → pick the newest **5.x** →
   Install. Accept the default components. *(~40–60 GB. Start it, walk away.)*
3. While that downloads, open **metahuman.unrealengine.com** in a browser,
   sign in with the same Epic account, and just poke around MetaHuman
   Creator — start sculpting an Eric. It autosaves to your account; the
   game will download him later. This is the fun part; do it while you wait.

## Part 2 — Create the project (10 min)

1. Launcher → Library → **Launch** the engine.
2. In the Project Browser: **Games** → **Third Person**.
3. Right side settings:
   - Blueprint (not C++)
   - Target Platform: **Mobile**
   - Quality Preset: **Scalable**
   - Starter Content: **ON**
   - Project name: `FischFamily`, pick a location on your SSD.
4. **Create.** First open takes several minutes ("Compiling Shaders…" in the
   corner is normal — it's thousands; let it finish once and it's cached).

## Part 3 — Learn to move (5 min)

You're looking at a small demo level with a mannequin.

- **Press Play** (toolbar ▶). WASD walks, space jumps, mouse looks. **Esc** stops.
- In the editor viewport (not playing): **hold right mouse button** to look,
  WASD to fly, scroll to change speed. That's 90% of editor navigation.

## Part 4 — Import the family's data (15 min)

1. Download the four CSVs from this repo folder (`unreal/DataTables/`) to
   your computer.
2. In Unreal's **Content Drawer** (Ctrl+Space), right-click → New Folder →
   `Data`.
3. Drag `Dialogue.csv` into it. In the import dialog choose **DataTable**,
   and for Row Type pick **None available? →** cancel; first make the struct:
   - Right-click in `Data` → Blueprints → **Structure**, name it `S_Dialogue`.
   - Open it; add variables matching the CSV columns: `Type` (String),
     `Speaker` (String), `ListenerFilter` (String), `Line` (String). Save.
   - Now drag the CSV in again → DataTable → Row Type `S_Dialogue`. Done —
     open it and you'll see every joke in the game.
4. Repeat for the other three (structs: `S_Character`, `S_Mission`,
   `S_WorldObject`, with variables named exactly like each CSV's columns —
   numbers as Float, everything else String).

*(This step is where beginners typo a column name and the import comes in
empty — if a table looks blank, that's what happened.)*

## Part 5 — Blockout your lot (the satisfying part, ~1–2 hrs)

**Coordinate rule:** browser `(x, z)` from `WorldLayout.csv` → Unreal
`X = x × 100`, `Y = z × 100`, ground is Z = 0. (Unreal units are cm.)

1. **File → New Level → Basic.** Save as `RiverLn`.
2. Select the Floor, set its scale to cover ~250 m (scale X=50, Y=50 works —
   the default floor is 5 m).
3. Place Actors panel (Window → Place Actors) → drag a **Cube** into the
   world for each object. Set its **Location** and **Scale** in the Details
   panel (cube is 1 m, so scale = size in meters). Worked examples:

   | Object | Location (X, Y, Z) | Scale (X, Y, Z) |
   |---|---|---|
   | House main wing | (−800, −2300, 275) | (12, 9, 5.5) |
   | Garage wing | (800, −2300, 250) | (12, 9, 5) |
   | Driveway (flat) | (800, −400, 5) | (15, 28, 0.1) |
   | River Ln road | (0, 1300, 5) | (140, 7, 0.1) |
   | RV #1 | (850, 2250, 105) | (5.2, 2.2, 2.1) |
   | Covered bridge deck | (2150, 3300, 10) | (3.2, 12.4, 0.2) |
   | Trampoline (cylinder) | (−2100, −200, 3) | (3.4, 3.4, 0.06) |

   Do the rest straight from `WorldLayout.csv`. Cylinders for redwood
   trunks (scale Z ≈ 15–25) sell it instantly — place the six "hero"
   redwoods at minimum.
4. Color-code if you like: drag materials from StarterContent onto cubes
   (wood on the house, dark grey on roads, blue plane at (0, 3300, −10)
   scaled (180, 10, 0.1) for the river).

## Part 6 — Play your street (5 min)

Drag a **Player Start** (Place Actors) onto the driveway, rotate the little
arrow toward the house. Press **Play**. You are now walking around 110 River
Ln. Jump on the trampoline cube. Walk the bridge. This moment is the whole
weekend's payoff — take a video for the family.

## Part 7 — Stretch goal: touch controls

Project Settings (Edit menu) → **Input** → check **Always Show Touch
Interface** and set Default Touch Interface to `LeftVirtualJoystickOnly`.
Then top menu **Platforms → (your phone type)** — actual device packaging
is Weekend 6; skip unless eager.

---

## End state checklist

- [ ] Engine installed, project opens
- [ ] Four Data Tables imported and showing rows
- [ ] Lot blocked out from WorldLayout.csv
- [ ] You walked from the porch, down the driveway, across River Ln,
      through the resort, and over the covered bridge
- [ ] (Bonus) an Eric MetaHuman drafted in the browser tool

**Weekend 2 preview:** Fab → add Quixel Megascans redwoods + forest floor,
enable the Water plugin for the San Lorenzo, replace the house cubes with
proper walls. Bring Claude your screenshots and we'll do it together.
