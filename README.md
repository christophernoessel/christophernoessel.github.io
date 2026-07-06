# Wildhollow Vale — Interactive Gazetteer

Open `index.html` directly in a browser. No server, no build step, no external
libraries — plain HTML/CSS/JS, per the brief. Everything needed to run is in
this folder, **including the `images/` subfolder — it must stay alongside
`index.html`, not be flattened out of it.**

## What's canon vs. what this app invented

**Straight from the gazetteer (`wildhollow_vale.json`), unaltered:**
- All 31 location descriptions, staff, components, sounds, and smells.
- The daily rhythms (8 hour-bands) and seasonal overlays, where the source
  defines them for a given location.
- The calendar (eight 45-day months + 5 Longnight days) and the 24 dated events.
- The gnome-calendar ↔ real-world-date correspondence: the source anchors
  mid-Longnight to the winter solstice (~Dec 21); this app's date math is a
  direct implementation of that, not a new assumption.

**Built for this app, not canon — each labeled in the UI:**
- **The weather engine.** `wildhollow_weather.md` specifies a deterministic
  algorithm (seeded regime blocks, per-day detail rolls, box-valley
  modifiers) but no reference implementation. This app's `describeWeather()`
  follows the doc's simpler "by-hand fallback" method with its own seeded
  hash — deterministic (same date always gives the same sky) but not a port
  of a canonical engine, because none exists to port. It's presented as its
  own paragraph rather than rewriting each location's weather-conditional
  behavior line by line (e.g., the wash-house's dry-outside-or-not choice) —
  that finer integration isn't implemented.
- **Event day-rule parsing.** Many events have exact or near-exact rules
  ("the 15th," "week 2") and those are parsed and enforced. Several are
  deliberately unfixed in canon (moon phase, "weather permitting," "set by
  the insectarist's judgement") — those surface as a soft "sometime around
  now" note rather than a fabricated exact day.
- **Map hotspot placement.** Coordinates are eyeballed against the seven
  rendered views, not surveyed. Locations with no dedicated rendered view
  (the Compound's interior buildings, the farmed acreage, Yrel's Grove) are
  arranged in a small procedural ring around that area's approximate spot on
  the overview map — a placeholder arrangement, not a real layout.
- **Travel adjacency** ("easy to reach from here"). Inferred from the
  three-bank layout described in `wildhollow_compound_layout.md` and the
  road/river geography in the gazetteer. Flavor-level proximity, not
  canonical distances or transit times. Entries are clickable — they jump
  the map/browser to that location or cluster, same as a hotspot would.
- **The Northrill village.** The `east_following_northrill` rendered view
  shows a settlement that has no corresponding entry in the gazetteer's
  location list. It's included as a flavor-only stop (`downriver_village`)
  with a note that it isn't a real gazetteer record.
- **The duck pond.** Named in canon (`the_clearspan`'s description mentions
  "the reed (duck) pond" as something its purifying field protects) but
  without a standalone location record of its own. Included in the North
  Gate & Threshold cluster, sourced from that line and flagged as derived
  rather than a first-class entry.
- **Yrel's Grove** has no rendered view yet (the first render was rejected)
  — it's still browsable and clickable on the overview map, just without a
  close-up image.
- **The orientation minimap** (bottom-right corner, expandable) uses a
  separate top-down render (`overhead_map.jpg`) — a different camera and a
  different art style from the seven oblique atlas-plate views. Its nine
  cluster markers were eyeballed independently against this image, not
  copied from the main overview's coordinates, since the two images don't
  share a coordinate space. Each marker's placement confidence is recorded
  in `data.json` (`map.minimap.hotspots[].confidence`) — four are a
  confident match to a visible feature (the gate-side crossroads, the
  walled compound fields, the Scholars' Ring — its path is visibly the same
  shape as the dedicated render — and the dam/lake); the rest are
  best-guess placements with no confirming feature, flagged `low`.
  The "current view" indicator on the minimap is honest about what it can
  and can't show: for the three areas with no dedicated render (the
  Compound, the Farmed Valley Floor, Yrel's Grove), it draws a real
  proportional crop box, since that view genuinely is a zoomed crop of one
  image. For the six areas with their own rendered view, it draws a pulsing
  locator dot instead of a box, because that view is a different
  photograph — there's no real frustum to project, and a box there would
  imply a precision that doesn't exist.

## Known rough edges
- The **scholar-huts render** added an unrequested statue and shows six
  cottages rather than the roughly eight positions in the original blockout.
  Doesn't affect function, just flagging it as a rendering discrepancy.
- Village building counts in the rendered views don't try to match the
  original Blender blockouts 1:1 — they're illustrated at a denser, more
  "real village" level of detail. Only named-location hotspots are pinned,
  not individual buildings.
- Leap years are ignored throughout, matching the source calendar's own
  stated approach (drift is negligible).
- The interactive overview map is still `north_across_valley.jpg`. A second
  overview candidate (`whole_valley`, an oblique render from a new Blender
  camera) was under discussion as a possible replacement, but that thread
  is still open pending confirmation of which village cluster is which in
  that image — it hasn't been wired in, so don't be surprised it's not here.
