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

Finish all four to complete a round — then it gets harder.

## Controls

| | Phone | Desktop |
|---|---|---|
| Move | left-side joystick | WASD / arrows |
| Run | push joystick to the edge | Shift |
| Jump | JUMP button | Space |
| Camera | drag right side | drag mouse |
| Switch character | tap portrait | 1–6 |
| Mute | 🔊 button | M |

## Tech

Plain [Three.js](https://threejs.org) (vendored in `lib/`, no build step, no
dependencies). All characters, the house, the redwoods, the Mini in the
driveway, and the suspiciously large banana slugs are procedurally built from
primitives in `game.js`.
