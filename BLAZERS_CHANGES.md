# SAG — full rewrite (Blazers brand + mission integration)

The Survivability Assessment Grid rebuilt on the Blazers brand system, with
mission wiring and data write-back. Core compute logic (Leaflet map, grid,
convex hull, Ramer–Douglas–Peucker simplification, table population) preserved.

## What SAG is / does
SAG is the SPATIAL HABITABILITY layer. IAS analyses individual rock images
(type, life-support %). SAG takes those samples and answers the geographic
question: across the surveyed area, which zones can support life, and where
should the rover explore next? It:
- reads the mission's samples + the shared rock-type dataset,
- plots each sample on a Leaflet map, colour-coded by habitability,
- draws a convex-hull polygon around the habitable (>=50%) samples,
- shows a per-sample habitability table.

## What changed
- **Full brand rewrite**: new Jinja template + 122-line from-scratch CSS on
  Blazers tokens (near-black, ember/gold, Aldrich/Teachers). Footer chevron
  band only (no vertical gutters — GCC-only). No horizontal scroll. Favicon added.
- **Mission wiring**: `/api/samples?missionId=...` reads mission-scoped samples;
  the banner shows the mission NAME (via new `/api/mission_name`); the coordinate
  form pre-fills with the mission centre.
- **Data write-back (NEW)**: SAG now sends a verdict back. `generate_grid`
  persists a habitability summary to `/missions/{id}/sag/summary`
  (total georeferenced samples, habitable count, avg life-support %, the
  habitable-region polygon) and logs an activity event — so the Command Center
  can surface the spatial result. On-page summary chips show the same.
- **Security**: removed the leaked email/password from the login modal.

## Data note (important)
Your current samples have `image`, `image_name`, `analyst_*` but NO
`latitude`/`longitude`/`type`. SAG's map + habitability need those. The summary
honestly reports "0 georeferenced" until samples carry coordinates + rock type
(added during IAS analysis). Wiring exists and works; it just needs geo-tagged
samples to light up the map.

## Run locally
    cd sag-v2
    pip install -r requirements.txt
    cp .env.example .env   # fill Firebase service-account values
    python api/index.py    # http://localhost:5000
Launch from the Command Center with ?missionId=...&lat=...&lng=...&radius=...

## Still to do (your side)
Rotate any leaked Firebase credentials; keep the service-account key in .env only.

## v2.1 — auth fix
- Fixed the 401 cascade: SAG now auto-authenticates on load (org-level gate),
  stores the token, and attaches it to every API request via bzFetch. No more
  manual login when launched from the Command Center; the login modal only
  appears if auto-auth fails. Mission-name lookup waits for the token (no
  transient 401). Requirements pinned (Flask 3.0.3 + Werkzeug 3.0.4).

## Update — single-page no-scroll layout + vertical gutters + georeferenced data
- **Single-page, no-scroll shell**: `#app` is now `height:100vh` flex column with
  `overflow:hidden`; header and footer are fixed-height rows and `#main` flexes to
  fill. The PAGE never scrolls — only the sample table and the map scroll inside
  their own panels. Verified headless at 1600×900, 1440×820 and 1366×720: page
  scroll = false at all sizes.
- **Wider left column**: `#main` grid is now `minmax(520px,42%) 1fr` so the six
  habitability columns fit without the earlier "PE / alyzed" truncation.
- **Table**: lives in `#table-panel`, fills the remaining left-column height, and
  scrolls both vertically and horizontally with a sticky (pinned) header.
- **Vertical chevron stripe gutters (SAG-approved)**: thin 26px stripes on both
  viewport edges using pattern-three.svg, `position:fixed` so they are paint-only
  and add zero document height — confirmed they do NOT break the no-scroll goal.
  Softly masked top/bottom so they read as edge accents. Auto-hidden < 900px.
- **Template**: left column wrapped in `#left-col`; panels carry `#coord-panel`,
  `#table-panel`, `#map-panel`; `#bz-gutter-right` (+ left) injected.
- **Data**: samples are now georeferenced. All 13 samples carry `type`,
  `latitude`, `longitude` (both under `/Samples` and
  `/missions/{id}/sag/summary`'s sibling `/sag/samples`). 8/13 are habitable
  (>=50%) and clustered within the 100 m mission radius, so the map lights up
  with markers, red/blue grids and a green convex hull once the JSON is imported.
