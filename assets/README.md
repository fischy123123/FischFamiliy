# 📸 Drop files here → the game turns photo-real

The game checks this folder every time it loads. Each file it finds
replaces a procedural part of the world with the real thing. Missing
files are skipped — you can add them one at a time, in any order, and
nothing can break.

## How to add a file (from any browser, even your phone)

1. Go to **github.com/fischy123123/FischFamiliy** → open the `assets` folder
2. **Add file → Upload files** → drag the file in → **Commit changes**
   (commit directly to `main`)
3. Wait ~1 minute for the site to redeploy, then reload
   **fischy123123.github.io/FischFamiliy** — you'll see a
   "📸 Photo upgrade loaded" message in-game for each file it found.

⚠️ Filenames must match **exactly** (lowercase). Rename after downloading.

## The shopping list (all free, no accounts needed)

### 1. `env.hdr` — real forest sky lighting *(biggest single upgrade)*
- Go to **polyhaven.com/hdris** → category *Nature/Forest* — good picks:
  search **"forest slope"**, **"lakeside"**, or **"meadow"**
- On the asset page: resolution **1K**, format **HDR** → Download
- Rename to `env.hdr` (≈ 2 MB)

### 2. `ground_diff.jpg` + `ground_nor.jpg` — real forest floor
- **polyhaven.com/textures** → search **"forest floor"** (e.g. *forest_floor*,
  *forest_leaves*, *brown_mud_leaves*)
- On the asset page click the download arrow's dropdown: choose **2K → JPG**,
  then under the file list download just:
  - **Diffuse** → rename `ground_diff.jpg`
  - **Normal (GL)** → rename `ground_nor.jpg`

### 3. `bark_diff.jpg` + `bark_nor.jpg` — real redwood bark
- Same site, search **"pine bark"** or **"bark brown"**
- 2K JPG → Diffuse → `bark_diff.jpg`, Normal (GL) → `bark_nor.jpg`

### 4. `tree.glb` — a real scanned/modeled redwood *(optional, dramatic)*
- **sketchfab.com** → search **"redwood tree"** or **"pine tree
  low poly realistic"** → filters: **Downloadable** ✓, License **CC0**
  (or CC-BY — then add the artist's name to the credits list below)
- Download format **glTF (.glb)** — pick one under ~15 MB, a single tree
- Rename to `tree.glb`. The game auto-sizes it and plants all 68 redwoods
  with it (one draw call — phones are fine).

### 5. `rock.glb` — a real scanned boulder *(optional)*
- Poly Haven models (**polyhaven.com/models**, search "rock") or Sketchfab
  as above → GLB under ~5 MB → rename `rock.glb`
- Replaces every yard rock and river boulder.

## Credits

CC0 assets need no credit. If you use any CC-BY asset, list it here:

- *(artist — asset name — source URL)*
