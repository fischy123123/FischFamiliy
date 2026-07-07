# 🌲 Fisch Family: Forest Chaos 🌲

A 3D browser game starring the Fisch family at their house in the redwoods of
Felton, California. One house in the forest. Six Fisches. Zero chance of peace
and quiet.

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

## Hang out

Walk up to any family member for context actions: **Talk** (everyone has
opinions, some of them about you), **High five**, and a special per person —
dad jokes on demand (Eric), snack speed-boost (Jessy), race to the mailbox
(Liam), mandatory dance party (Maddie), tag (Rowan), piggyback rides (Faylen).

The world is full of stuff too: bounce on the in-ground trampoline, kick the
soccer ball, skip stones on the San Lorenzo, make s'mores at the campfire,
honk the Mini, check the mail, knock on the front door, chase the squirrel,
spot the deer, and find **Greg the Golden Slug** hiding deep in the forest.
There are 10 achievements to unlock.

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

A compressed but geographically faithful Felton: your house on River Ln,
the Santa Cruz Redwoods RV Resort across the lane, the San Lorenzo River
behind it with a walkable Felton Covered Bridge (est. 1892), a Henry
Cowell trailhead on the far bank, the Roaring Camp steam train passing
through the redwoods beyond, and the Santa Cruz Mountains hazy on every
horizon.

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
