# 🌲 Fisch Family: Forest Chaos 🌲

A 3D browser game starring the Fisch family at their house in the redwoods of
Felton, California. One house in the forest. Six Fisches. Zero chance of peace
and quiet.

## ✨ Act I — Felton After Dark

- **Living day/night cycle** — the sun arcs and sets behind the ridge; real
  night brings a starry sky and Milky Way, glowing windows, a warm porch light,
  twinkling RV-resort string lights, a flashlight in the dark, and fireflies
  drifting over the yard. Tap **🌗** (or press **T**) to cycle the time of day.
- **Drive the Mini** — walk up to the car, tap **🚗 Drive**, and cruise River
  Ln with working headlights at night. Tap **🚪** to hop out.
- **Cross into Henry Cowell** — over the covered bridge and the train crossing
  lies the hollow **Fremont Tree** you can step inside, and the **Garden of
  Eden swimming hole** with a **jump rock** to cannonball off.
- **Ride the Roaring Camp train** — flag it at the platform, climb aboard, and
  pull the whistle as it loops the forest.
- **Real-calendar magic** — the game knows today's date. Birthdays decorate the
  yard with balloons, a banner and a cake; December lights the eaves; late
  October brings jack-o'-lanterns; every other day counts down to the next
  Fisch birthday.
- **Photo Mode** — tap **📷** (or **P**), frame the shot, and **📸 Capture**
  saves a PNG to your device.

## Play it

Open `index.html` in any modern browser — **works great on phones** (touch
joystick + jump button) and desktops (WASD + mouse).

The easiest way to host it: enable **GitHub Pages** for this repo
(Settings → Pages → deploy from branch), then open the page URL on your phone.

Or run it locally:

```bash
npx serve .        # then open the printed URL
```

## The cast

| Character | Role |
|---|---|
| **Eric** | Dad. Powered by coffee & dad jokes. Broadcasts them on a timer. |
| **Jessy** | Mom. Can hear a snack wrapper from 3 rooms away. |
| **Liam** (14) | Hoodie, headphones, master of "five more minutes." Fastest Fisch. |
| **Maddie** (11) | CEO of Sass. Secretly in charge. |
| **Rowan** (4) | ZOOMIES incarnate. Randomly sprints for no reason. |
| **Faylen** (2) | Tiny tornado. Waddles. Follows the nearest parent. |

Tap a portrait (or press 1–6) to switch characters any time. Everyone you're
not controlling wanders around living their best chaotic life.

## Missions

1. **🐌 Slug Patrol** — banana slugs are invading the yard (this is Felton,
   after all). Scoop 'em up.
2. **🧸 Toy Tornado** — pick up the toys before someone steps on The LEGO.
   Someone will step on The LEGO.
3. **🍝 Dinner Time!** — play as a parent and catch all four fleeing kids.
4. **☕ Coffee Emergency** — play as a kid and deliver coffee to the
   under-caffeinated parents.

5. **⚽ Forest Cup** — score goals on the white goal at the forest edge.

Finish all five to complete a round — then it gets harder.

## 🏠 Act III — Come On In

Walk up to the front door and **🚪 Go inside** — the whole interior is
built from the real photos: the entry and dining room under the antler
chandelier, the white galley kitchen with the skylight and breakfast
nook, the double-height great room with the river-rock fireplace and
window wall, Liam's room, and a real staircase up to the loft — game
room (break at the pool table, crash the drums, play the piano), the
blue primary suite (nap to skip time) and its stone bathroom with the
barn door. Fire up the espresso machine, raid the fridge, watch TV,
then slip out the patio doors to the backyard and **soak in the hot
tub**. Four new achievements live indoors.

## 🗺️ Act II — Greater Felton

- **Downtown Felton** along Hwy 9: a little main street (Felton Coffee, Felton Market, the Trading Post) with a boardwalk and street lamps that glow at night.
- **Fishing** — a dock on the San Lorenzo; cast, wait for the bite, reel in trout, bass, the odd boot, or a bragging-rights steelhead.
- **Canopy zipline** — climb a redwood platform and fly across the yard.
- **Weather** — tap 🌦️ to roll in the marine-layer fog or bring rain over the redwoods.
- **Family time-trials** — run the glowing-ring course; each Fisch keeps their own best time on a shared leaderboard (saved on your device).

## Hang out

Walk up to any family member for context actions: **Talk** (everyone has
opinions, some of them about you), **High five**, and a special per person —
dad jokes on demand (Eric), snack speed-boost (Jessy), race to the mailbox
(Liam), mandatory dance party (Maddie), tag (Rowan), piggyback rides (Faylen).

The world is full of stuff too: bounce on the in-ground trampoline, kick the
soccer ball, skip stones on the San Lorenzo, make s'mores at the campfire,
honk the Mini, check the mail, knock on the front door, chase the squirrel,
spot the deer, and find **Greg the Golden Slug** hiding deep in the forest.
There are 27 achievements to unlock.

## Controls

| | Phone | Desktop |
|---|---|---|
| Move | left-side joystick | WASD / arrows |
| Run | push joystick to the edge | Shift |
| Jump | JUMP button | Space |
| Camera | drag right side | drag mouse |
| Switch character | tap portrait | 1–6 |
| Mute | 🔊 button | M |

## The world

A compressed but geographically faithful Felton, laid out from the real
street view and aerial: **Hwy 9** runs east–west with occasional passing
cars, and **River Ln** — a cracked, sun-bleached dead-end lane — runs
north from the junction past the house (110, west side; the neighbor's
cabin at 111 across the lane) and ends at the **San Lorenzo River**. The
Santa Cruz Redwoods RV Resort sits east of the lane by the water, a
walkable covered bridge crosses to the **Henry Cowell** trailhead on the
far bank, the Roaring Camp steam train passes through the redwoods
beyond, downtown Felton is up Hwy 9, and the Santa Cruz Mountains sit
hazy on every horizon. Power lines sag along the lane, sword ferns crowd
the forest floor, and sun shafts slant through the canopy.

## Make it photo-real (no coding needed)

The game auto-upgrades itself with any real photo-scanned assets it finds
in the [`assets/`](assets/README.md) folder — real forest-floor and bark
textures, a real captured sky for lighting, scanned tree and rock models.
See **assets/README.md** for the 20-minute shopping list of free files and
exactly where to drop them.

## Tech

Plain [Three.js](https://threejs.org) (vendored in `lib/`, no build step, no
dependencies). All characters, the house, the redwoods, the Mini in the
driveway, and the suspiciously large banana slugs are procedurally built from
primitives in `game.js`.
