/* Wildhollow Vale Gazetteer — app logic
   ---------------------------------------------------------------
   Everything about *locations* (descriptions, daily rhythms, seasonal
   overlays, events, the calendar) comes verbatim from the project
   gazetteer (see app-data.js / GAZETTEER_DATA).

   Everything about the WEATHER ENGINE, EVENT DAY-RULE PARSING, MAP
   HOTSPOT PLACEMENT, and TRAVEL ADJACENCY is this app's own procedural
   layer, built to the spec in wildhollow_weather.md and
   scene_resolution_rules, but necessarily approximate. Each is
   labeled as such in the UI.
------------------------------------------------------------------ */

(function () {
  "use strict";

  const D = GAZETTEER_DATA;
  const REAL_MONTH_LENGTHS = [31,28,31,30,31,30,31,31,30,31,30,31];
  const REAL_MONTH_NAMES = ["January","February","March","April","May","June",
                             "July","August","September","October","November","December"];
  const HOUR_BANDS = ["deep_night","dawn","morning","midday","afternoon","sundown","evening","night"];
  const HOUR_BAND_LABELS = {
    deep_night: "Deep night", dawn: "Dawn", morning: "Morning", midday: "Midday",
    afternoon: "Afternoon", sundown: "Sundown", evening: "Evening", night: "Night"
  };
  // Rough real-clock ranges used only to pick a sensible DEFAULT band at page load.
  const HOUR_BAND_RANGES = [
    ["deep_night", 0, 4], ["dawn", 4, 6.5], ["morning", 6.5, 11], ["midday", 11, 13.5],
    ["afternoon", 13.5, 17], ["sundown", 17, 19], ["evening", 19, 22], ["night", 22, 24]
  ];

  // Anchor: gnome day-of-year 363 (mid-Longnight) = real ~Dec 21 (solstice).
  // Real day-of-year for Dec 21 in a non-leap year = 355.
  const GNOME_TO_REAL_OFFSET = 355 - 363; // -8, kept mod 365 below

  // ---------------------------------------------------------------
  // Lookups
  // ---------------------------------------------------------------
  const locationsById = {};
  D.locations.forEach(l => locationsById[l.id] = l);

  const clusterOfLocation = {};
  const clusterById = {};
  D.map.clusters.forEach(c => {
    clusterById[c.id] = c;
    c.locations.forEach(locId => clusterOfLocation[locId] = c.id);
  });

  const WEATHER_TABLE = {
    Hammerfrost: { high: 4, low: -1, wet: 0.40, snow: "likely", character: "grey, hard frost, freezing fog and rime; lake edges ice" },
    Thawmoon:    { high: 8, low: 0,  wet: 0.38, snow: "melting, occasional", character: "mud and thaw-fog; sleet; clearing spells lengthen" },
    Greenwake:   { high: 14, low: 4, wet: 0.35, snow: "rare, early only", character: "broken cloud and showers; morning fog; late frost risk early" },
    Suncrest:    { high: 19, low: 9, wet: 0.38, snow: "none", character: "fair with afternoon build-ups; the first thunderstorms; long light" },
    Greatsun:    { high: 24, low: 13, wet: 0.33, snow: "none", character: "sunny mornings, humid afternoons, convective storms" },
    Hartmoon:    { high: 23, low: 12, wet: 0.33, snow: "none", character: "warm and hazy; night mist begins; late-season storms" },
    Goldfall:    { high: 16, low: 6, wet: 0.40, snow: "first, late", character: "increasing cloud; heavy valley fog at dawn; first frosts late" },
    Frostmoon:   { high: 8, low: 2, wet: 0.45, snow: "first snows", character: "raw, damp, the wettest stretch; persistent fog; the Quieting" },
    Longnight:   { high: 4, low: -1, wet: 0.40, snow: "likely", character: "shortest light; freezing fog; the year's turn" }
  };
  const WARM_MONTHS = new Set(["Suncrest", "Greatsun", "Hartmoon"]);
  const COOL_FOG_MONTHS = new Set(["Goldfall", "Frostmoon", "Hammerfrost", "Longnight", "Thawmoon"]);

  // ---------------------------------------------------------------
  // Calendar math
  // ---------------------------------------------------------------
  function monthForGnomeDOY(doy) {
    for (const m of D.calendar.months) {
      if (doy >= m.doy_start && doy <= m.doy_end) return m;
    }
    if (doy >= D.calendar.intercalary.doy_start && doy <= D.calendar.intercalary.doy_end) {
      return { name: "Longnight", season: "longnight", ordinal: 9,
               doy_start: D.calendar.intercalary.doy_start, doy_end: D.calendar.intercalary.doy_end };
    }
    return D.calendar.months[0];
  }

  function gnomeDOYFromMonthDay(monthOrdinalOrLongnight, day) {
    if (monthOrdinalOrLongnight === "Longnight") {
      return D.calendar.intercalary.doy_start + (day - 1);
    }
    const m = D.calendar.months.find(mm => mm.ordinal === monthOrdinalOrLongnight);
    return m.doy_start + (day - 1);
  }

  function realDOYFromGnomeDOY(gdoy) {
    let r = ((gdoy - 1 + GNOME_TO_REAL_OFFSET) % 365 + 365) % 365;
    return r + 1;
  }
  function gnomeDOYFromRealDOY(rdoy) {
    let g = ((rdoy - 1 - GNOME_TO_REAL_OFFSET) % 365 + 365) % 365;
    return g + 1;
  }
  function realMonthDayFromDOY(doy) {
    let remaining = doy;
    for (let i = 0; i < 12; i++) {
      if (remaining <= REAL_MONTH_LENGTHS[i]) return { month: i, day: remaining };
      remaining -= REAL_MONTH_LENGTHS[i];
    }
    return { month: 11, day: 31 };
  }
  function realDOYFromMonthDay(month0, day) {
    let doy = day;
    for (let i = 0; i < month0; i++) doy += REAL_MONTH_LENGTHS[i];
    return doy;
  }

  // ---------------------------------------------------------------
  // Deterministic pseudo-random weather (per wildhollow_weather.md's
  // "by-hand fallback" method). Not a literal port of the full engine,
  // but same inputs/outputs/determinism.
  // ---------------------------------------------------------------
  function hashFloat(a, b) {
    const x = Math.sin(a * 12.9898 + b * 78.233 + 37.719) * 43758.5453;
    return x - Math.floor(x);
  }

  function describeWeather(year, gdoy, hourBand) {
    const month = monthForGnomeDOY(gdoy);
    const table = WEATHER_TABLE[month.name] || WEATHER_TABLE.Hammerfrost;
    const block = Math.floor((gdoy - 1) / 3);
    const regimeRoll = hashFloat(year, block * 7 + 1);
    const detailRoll = hashFloat(year, gdoy * 13 + 3);
    const disturbed = regimeRoll < table.wet;
    const warm = WARM_MONTHS.has(month.name);
    const coolFogEligible = COOL_FOG_MONTHS.has(month.name);

    let sky;
    if (disturbed) {
      if (warm) {
        sky = { deep_night: "warm and still, haze building", dawn: "close and humid already",
                 morning: "building cumulus", midday: "towering clouds stacking up the plateau",
                 afternoon: "the storm breaks — thunder and hard rain", sundown: "the storm clearing off east",
                 evening: "washed, cooler air", night: "clear and dripping" }[hourBand];
      } else {
        const frosty = table.low <= 0;
        sky = { deep_night: frosty ? "steady sleet ticking on the roofs" : "steady rain",
                 dawn: frosty ? "sleet turning to wet snow" : "grey and pouring",
                 morning: frosty ? "snow settling on the fields" : "frontal rain, no let-up",
                 midday: frosty ? "snow easing to flurries" : "rain, heavier in gusts",
                 afternoon: frosty ? "flurries, the road going white" : "rain continuing, the road greasy",
                 sundown: frosty ? "snow tapering off" : "rain slackening",
                 evening: frosty ? "clearing, bitter cold" : "drizzle, clouds breaking",
                 night: frosty ? "hard frost under clearing skies" : "the last of the rain moving off" }[hourBand];
      }
    } else {
      if (coolFogEligible && detailRoll < 0.5) {
        sky = { deep_night: "still air, fog gathering over the low ground",
                 dawn: "thick valley fog, the lake invisible",
                 morning: table.low <= 1 ? "the fog holding stubbornly" : "the fog burning off in patches",
                 midday: "clear overhead, haze lingering in the hollows",
                 afternoon: "clear and pale", sundown: "the light going early behind the rim",
                 evening: "fog re-forming over the water", night: "fog thick and cold" }[hourBand];
      } else {
        sky = { deep_night: "clear, the stars sharp", dawn: "clear, a hard early light delayed by the cliff",
                 morning: "fair", midday: "fair with a scatter of harmless cloud",
                 afternoon: "fair, the day's warmth at its peak", sundown: "clear, shadow climbing the eastern wall",
                 evening: "clear and cooling fast", night: "clear and cold" }[hourBand];
      }
    }
    return sky || "unremarkable";
  }

  // ---------------------------------------------------------------
  // Event day-rule parsing (best-effort; many canon rules are
  // deliberately non-fixed — moon phase, "weather permitting", the
  // insectarist's judgement, etc. Those resolve to "sometime this
  // month" rather than a specific day.)
  // ---------------------------------------------------------------
  function parseDayRule(rule) {
    let m = rule.match(/(\d+)(st|nd|rd|th)/);
    if (m) return { type: "exact", day: parseInt(m[1], 10) };
    m = rule.match(/week[s]?\s+(\d+)\s*[–-]\s*(\d+)/i);
    if (m) return { type: "range", start: (parseInt(m[1],10)-1)*7 + 1, end: parseInt(m[2],10)*7 };
    m = rule.match(/week\s+(\d+)/i);
    if (m) return { type: "range", start: (parseInt(m[1],10)-1)*7 + 1, end: parseInt(m[1],10)*7 };
    if (/mid-month/i.test(rule)) return { type: "range", start: 20, end: 26 };
    return { type: "unresolved" };
  }

  function activeEventsForDay(gdoy) {
    const month = monthForGnomeDOY(gdoy);
    const dayOfMonth = gdoy - month.doy_start + 1;
    const active = [];
    const uncertain = [];
    for (const e of D.events) {
      if (e.month !== month.name) continue;
      const parsed = parseDayRule(e.day_rule);
      if (parsed.type === "exact" && parsed.day === dayOfMonth) active.push(e);
      else if (parsed.type === "range" && dayOfMonth >= parsed.start && dayOfMonth <= parsed.end) active.push(e);
      else if (parsed.type === "unresolved") uncertain.push(e);
    }
    return { active, uncertain };
  }

  // ---------------------------------------------------------------
  // Scene composition
  // ---------------------------------------------------------------
  function composeScene(locationId, gdoy, hourBand, year) {
    const loc = locationsById[locationId];
    const month = monthForGnomeDOY(gdoy);
    const season = month.season;
    const clusterId = clusterOfLocation[locationId];

    const seasonalText = (D.seasonalOverlays[season] || {})[locationId];
    const rhythmText = (D.dailyRhythms[locationId] || {})[hourBand];
    const { active, uncertain } = activeEventsForDay(gdoy);
    const ownEvent = active.find(e => e.primary_location === locationId);
    const otherFestivals = active.filter(e => e.primary_location !== locationId && e.criticality === "festival_critical");
    const ownUncertain = uncertain.filter(e => e.primary_location === locationId);

    const weatherText = describeWeather(year, gdoy, hourBand);

    let html = "";
    html += `<p>${loc.description}</p>`;

    if (ownEvent) {
      html += `<p><span class="section-label">Today — ${ownEvent.name}</span>${ownEvent.description}</p>`;
    } else {
      if (seasonalText) html += `<p><span class="section-label">This season</span>${seasonalText}</p>`;
      if (rhythmText) html += `<p><span class="section-label">${HOUR_BAND_LABELS[hourBand]}</span>${rhythmText}</p>`;
      if (!seasonalText && !rhythmText) {
        html += `<p class="flag-note">No hour-by-hour or seasonal texture is recorded for this location in the gazetteer — only the base description above applies.</p>`;
      }
    }

    if (ownUncertain.length) {
      html += `<p class="flag-note">Also somewhere around now, on a day the source material leaves unfixed: ${ownUncertain.map(e => e.name.replace(/_/g," ")).join(", ")}.</p>`;
    }

    html += `<p><span class="section-label">Sky</span>The ${month.name} weather today is ${weatherText}.</p>`;

    if (otherFestivals.length) {
      html += `<p class="flag-note">Word around the farm: today is ${otherFestivals.map(e => e.name.replace(/_/g," ")).join(", ")}, centered elsewhere on the property.</p>`;
    }

    if (loc.sounds && loc.sounds.length) html += `<p><span class="section-label">Sounds</span>${loc.sounds.join("; ")}.</p>`;
    if (loc.smells && loc.smells.length) html += `<p><span class="section-label">Smells</span>${loc.smells.join("; ")}.</p>`;

    // Travel
    const cluster = clusterById[clusterId];
    const siblings = cluster.locations.filter(id => id !== locationId).map(id => locationsById[id].name);
    const neighborClusterIds = D.map.travelInferred[clusterId] || [];
    const neighborNames = neighborClusterIds.map(id => clusterById[id].name);

    html += `<p><span class="section-label">Easy to reach from here <span class="flag-note">(inferred, not canon)</span></span>`;
    const bits = [];
    if (siblings.length) bits.push(`elsewhere in ${cluster.name}: ${siblings.join(", ")}`);
    if (neighborNames.length) bits.push(`onward to ${neighborNames.join("; ")}`);
    html += bits.length ? bits.join(". ") + "." : "No inferred routes recorded for this area.";
    html += `</p>`;

    return html;
  }

  // ---------------------------------------------------------------
  // State
  // ---------------------------------------------------------------
  const state = {
    gdoy: 1,
    hourBand: "morning",
    currentClusterId: null, // null = overview
    selectedLocationId: null,
    year: new Date().getFullYear()
  };

  // ---------------------------------------------------------------
  // DOM refs
  // ---------------------------------------------------------------
  const el = {
    gnomeMonth: document.getElementById("gnome-month"),
    gnomeDay: document.getElementById("gnome-day"),
    realDate: document.getElementById("real-date"),
    timeOfDay: document.getElementById("time-of-day"),
    mapImage: document.getElementById("map-image"),
    zoomTarget: document.getElementById("zoom-target"),
    hotspotLayer: document.getElementById("hotspot-layer"),
    marker: document.getElementById("marker"),
    markerLabel: document.getElementById("marker-label"),
    clusterList: document.getElementById("cluster-list"),
    outputCard: document.getElementById("output-card"),
    crumbOverview: document.getElementById("crumb-overview"),
    crumbCurrent: document.getElementById("crumb-current"),
  };

  // ---------------------------------------------------------------
  // Init controls
  // ---------------------------------------------------------------
  function initMonthSelect() {
    D.calendar.months.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.ordinal;
      opt.textContent = m.name;
      el.gnomeMonth.appendChild(opt);
    });
    const opt = document.createElement("option");
    opt.value = "Longnight";
    opt.textContent = "Longnight (Festival Days)";
    el.gnomeMonth.appendChild(opt);
  }

  function setControlsFromGnomeDOY(gdoy, skipRealDate) {
    const month = monthForGnomeDOY(gdoy);
    el.gnomeMonth.value = month.name === "Longnight" ? "Longnight" : month.ordinal;
    el.gnomeDay.max = month.name === "Longnight" ? 5 : 45;
    el.gnomeDay.value = gdoy - month.doy_start + 1;
    if (!skipRealDate) {
      const rdoy = realDOYFromGnomeDOY(gdoy);
      const { month: rm, day: rd } = realMonthDayFromDOY(rdoy);
      const y = el.realDate.value ? parseInt(el.realDate.value.slice(0,4),10) : state.year;
      el.realDate.value = `${y}-${String(rm+1).padStart(2,"0")}-${String(rd).padStart(2,"0")}`;
    }
  }

  function setControlsFromRealDate(dateStr, skipGnome) {
    const [y, m, d] = dateStr.split("-").map(n => parseInt(n, 10));
    state.year = y;
    const rdoy = realDOYFromMonthDay(m - 1, d);
    const gdoy = gnomeDOYFromRealDOY(rdoy);
    state.gdoy = gdoy;
    if (!skipGnome) setControlsFromGnomeDOY(gdoy, true);
  }

  function initDefaults() {
    initMonthSelect();
    const now = new Date();
    state.year = now.getFullYear();
    const isoToday = now.toISOString().slice(0,10);
    el.realDate.value = isoToday;
    setControlsFromRealDate(isoToday, false);

    const hour = now.getHours() + now.getMinutes()/60;
    let band = "morning";
    for (const [name, start, end] of HOUR_BAND_RANGES) {
      if (hour >= start && hour < end) { band = name; break; }
    }
    state.hourBand = band;
    el.timeOfDay.value = band;
  }

  // ---------------------------------------------------------------
  // Event wiring: date/time controls
  // ---------------------------------------------------------------
  function onGnomeControlsChanged() {
    const monthVal = el.gnomeMonth.value;
    const maxDay = monthVal === "Longnight" ? 5 : 45;
    el.gnomeDay.max = maxDay;
    let day = parseInt(el.gnomeDay.value, 10) || 1;
    day = Math.min(Math.max(day, 1), maxDay);
    el.gnomeDay.value = day;
    const gdoy = gnomeDOYFromMonthDay(monthVal === "Longnight" ? "Longnight" : parseInt(monthVal,10), day);
    state.gdoy = gdoy;
    setControlsFromGnomeDOY(gdoy, false);
    renderOutput();
  }

  el.gnomeMonth.addEventListener("change", onGnomeControlsChanged);
  el.gnomeDay.addEventListener("input", onGnomeControlsChanged);
  el.realDate.addEventListener("input", () => {
    if (!el.realDate.value) return;
    setControlsFromRealDate(el.realDate.value, false);
    renderOutput();
  });
  el.timeOfDay.addEventListener("change", () => {
    state.hourBand = el.timeOfDay.value;
    renderOutput();
  });

  // ---------------------------------------------------------------
  // Map rendering
  // ---------------------------------------------------------------
  function clearHotspots() {
    el.hotspotLayer.innerHTML = "";
  }

  function makeHotspotEl(x, y, label, onClick, idForHighlight) {
    const btn = document.createElement("button");
    btn.className = "hotspot";
    btn.style.left = x + "%";
    btn.style.top = y + "%";
    btn.dataset.locId = idForHighlight || "";
    btn.innerHTML = `<span class="hotspot-tip">${label}</span>`;
    btn.addEventListener("click", onClick);
    el.hotspotLayer.appendChild(btn);
    return btn;
  }

  function showOverview() {
    state.currentClusterId = null;
    el.crumbOverview.classList.add("active");
    el.crumbCurrent.textContent = "";
    el.mapImage.src = D.map.overview.image;
    el.zoomTarget.style.transformOrigin = "50% 50%";
    el.zoomTarget.style.transform = "scale(1)";
    clearHotspots();
    D.map.overview.hotspots.forEach(h => {
      makeHotspotEl(h.x, h.y, h.label, () => enterCluster(h.id));
    });
    el.marker.hidden = true;
    renderBrowser();
  }

  function enterCluster(clusterId) {
    const cluster = clusterById[clusterId];
    state.currentClusterId = clusterId;
    el.crumbOverview.classList.remove("active");
    el.crumbCurrent.textContent = cluster.name;

    if (cluster.view) {
      const view = D.map.views[cluster.view];
      el.mapImage.src = view.image;
      el.zoomTarget.style.transformOrigin = "50% 50%";
      el.zoomTarget.style.transform = "scale(1)";
      clearHotspots();
      view.hotspots.forEach(h => {
        const loc = locationsById[h.id];
        makeHotspotEl(h.x, h.y, loc.name, () => selectLocation(h.id), h.id);
      });
    } else {
      // No dedicated render: stay on the overview image, zoom into the
      // cluster's approximate pin, and arrange its locations in a small
      // ring around that point (procedural placement, not surveyed).
      el.mapImage.src = D.map.overview.image;
      const pin = D.map.overview.hotspots.find(h => h.id === clusterId);
      el.zoomTarget.style.transformOrigin = `${pin.x}% ${pin.y}%`;
      el.zoomTarget.style.transform = "scale(2.3)";
      clearHotspots();
      const n = cluster.locations.length;
      const radius = 9;
      cluster.locations.forEach((locId, i) => {
        const angle = (i / n) * Math.PI * 2 - Math.PI/2;
        const x = pin.x + radius * Math.cos(angle);
        const y = pin.y + radius * Math.sin(angle) * 0.6;
        const loc = locationsById[locId];
        makeHotspotEl(x, y, loc.name, () => selectLocation(locId), locId);
      });
    }
    el.marker.hidden = true;
    renderBrowser();
  }

  function selectLocation(locId) {
    state.selectedLocationId = locId;
    const btn = el.hotspotLayer.querySelector(`[data-loc-id="${CSS.escape(locId)}"]`);
    if (btn) {
      el.marker.style.left = btn.style.left;
      el.marker.style.top = btn.style.top;
      el.marker.hidden = false;
      el.markerLabel.textContent = locationsById[locId].name;
    }
    document.querySelectorAll(".hotspot").forEach(h => h.classList.toggle("highlighted", h.dataset.locId === locId));
    renderOutput();
    renderBrowser();
  }

  el.crumbOverview.addEventListener("click", showOverview);

  // ---------------------------------------------------------------
  // Browser rendering
  // ---------------------------------------------------------------
  function renderBrowser() {
    el.clusterList.innerHTML = "";
    D.map.clusters.forEach(cluster => {
      const details = document.createElement("details");
      details.className = "cluster";
      details.open = state.currentClusterId === cluster.id;
      if (state.currentClusterId === cluster.id) details.classList.add("highlighted");

      const summary = document.createElement("summary");
      summary.innerHTML = `<span>${cluster.name}</span>`;
      if (cluster.locations.length > 1 || cluster.id !== state.currentClusterId) {
        const zoomBtn = document.createElement("button");
        zoomBtn.className = "zoom-link";
        zoomBtn.textContent = "zoom in";
        zoomBtn.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); enterCluster(cluster.id); });
        summary.appendChild(zoomBtn);
      }
      details.appendChild(summary);

      const ul = document.createElement("ul");
      ul.className = "cluster-locations";
      cluster.locations.forEach(locId => {
        const loc = locationsById[locId];
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.className = "loc-btn";
        if (locId === state.selectedLocationId) btn.classList.add("highlighted");
        btn.textContent = loc.name;
        btn.addEventListener("click", () => {
          if (state.currentClusterId !== cluster.id) enterCluster(cluster.id);
          selectLocation(locId);
        });
        li.appendChild(btn);
        ul.appendChild(li);
      });
      details.appendChild(ul);
      el.clusterList.appendChild(details);
    });
  }

  // ---------------------------------------------------------------
  // Output rendering
  // ---------------------------------------------------------------
  function renderOutput() {
    if (!state.selectedLocationId) return;
    const loc = locationsById[state.selectedLocationId];
    const month = monthForGnomeDOY(state.gdoy);
    const dayOfMonth = state.gdoy - month.doy_start + 1;
    const html = composeScene(state.selectedLocationId, state.gdoy, state.hourBand, state.year);
    el.outputCard.innerHTML = `
      <h3>You are here: ${loc.name}</h3>
      <p class="output-meta">${month.name} ${dayOfMonth} &middot; ${HOUR_BAND_LABELS[state.hourBand]}</p>
      ${html}
    `;
  }

  // ---------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------
  initDefaults();
  showOverview();

})();
