# Wildhollow Vale — Interactive Gazetteer

Open `index.html` directly in a browser. No server, no build step, no external
libraries — plain HTML/CSS/JS. Everything needed to run is in this folder,
**including the `images/` subfolder — it must stay alongside `index.html`.**

`editor.html` is a companion tool: click any map image to place or correct
location pins, then export the coordinates as JSON.

## Canon sweep (this update)

The live `wildhollow_vale.json` had drifted from several canon-update docs
(Westwork, Scholars, Naiads, Provisioning/Cheese) that were written but never
merged back into the project file. This pass folds in what's geographically
real:

- **The Underspire** added as a full location (Goldenhead clan-seat, the
  dam's east arm) — assembled from `wildhollow_underspire.md` since no
  `vale.json` entry exists despite one being described as added.
- **The Cheese Caves** added (Pernel Ashcombe, Old Eddric, Bracken; west
  bluff, near the dairy).
- **Parthemion's statue** and **the Vacationer hammocks** added to
  `mage_huts` — both real canon I'd previously flagged as rendering errors.
  That was wrong; corrected here. Six huts is also canon-correct, not the
  discrepancy I originally claimed.
- **The Ice House** added — thin canon, one line only ("the icehouse crew's
  frost-clock"), flagged as such.
- **Five saferooms** added as minor satellite pins (bat-caves base, cropland,
  orchard, pasture, Spider Wood's top gate) — not new clusters, just new pins
  within existing ones.
- **The Old Farmstead** added — a real, abandoned point of interest near the
  dam, distinct from the Westwork (staffed, active). Its exact position is
  still an estimate from an annotated screenshot, not an editor export —
  flagged in the data as `estimated: true`.
- **The "Northrill Village" was removed.** It was my own misreading of a
  rendered view — there's no settlement there, just farm sheds, an overnight
  cottage or two, and an old tree on the bank. Replaced with
  `northrill_farmland`, scoped to match.
- **`spider_wood`'s compass direction was wrong** ("northwest corner") and
  has been corrected, both here and at the canon source, to match its real
  position: a cliff to the southeast, by the Guano Caves.
- **Aldermere (the lake) moved** from the Farmed Valley Floor cluster to the
  Curlspire Dam & Westwork cluster, matching its real, editor-placed
  coordinates rather than my earlier guess.

## Map coordinates: real vs. placeholder

The **minimap** (`overhead_map.jpg`) carries real, editor-placed coordinates
for both cluster-level pins and individual-location pins — see
`map.minimap.clusterPins` / `map.minimap.locationPins` in `data.json`.

Most of the **dedicated views** now carry real coordinates too, computed with
`bpy_extras.object_utils.world_to_camera_view()` against each view's actual
Blender camera and cross-checked against the editor-placed minimap numbers
(the one clean 1:1 comparison — `gatehouse` vs. `north_gate` — landed within
~2 percentage points on both axes). Only two placeholders remain, both
because no corresponding object exists in the scene to project:
`underspire_dam_city` (no dedicated marker for the Underspire itself yet)
and `westrun` in the Guano Caves view (the junction it would project from
sits just outside that camera's frame). Both are marked
`placeholder: true` in `data.json` and render with the dashed red outline.

## What's canon vs. what this app invented

**Straight from the gazetteer, unaltered:** all location descriptions,
daily rhythms, seasonal overlays, the calendar, and the 24 dated events.

**Built for this app, not canon — each labeled in the UI:**
- **The weather engine** — a deterministic implementation of
  `wildhollow_weather.md`'s "by-hand fallback" method, since no reference
  engine exists to port. Presented as its own paragraph, not integrated into
  each location's weather-conditional behavior line by line.
- **Event day-rule parsing** — exact rules ("the 15th") are enforced;
  deliberately unfixed ones (moon phase, "weather permitting") surface as a
  soft "sometime around now" note.
- **Travel adjacency** ("easy to reach from here") — inferred from the
  three-bank layout and river geography, not canonical distances. Entries
  are clickable.
- **The duck pond** — named in canon (tied to `the_clearspan`'s description)
  but without its own location record; included in the North Gate cluster,
  flagged as derived.

## Known rough edges
- Leap years are ignored throughout, matching the source calendar's own
  stated approach.
- `saferoom_cropland`'s coordinate (20.9%, 10.8%) sits suspiciously close to
  where the Duck Pond was marked on the annotated reference image — flagged
  for the person maintaining this data to confirm or correct.
- The `whole_valley` oblique overview candidate from earlier in this
  project's history was never wired in as a replacement for
  `north_across_valley.jpg` — that thread is effectively superseded by the
  minimap/editor workflow instead.
