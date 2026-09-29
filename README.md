# ◈ Project Crown

A playable, early-stage browser prototype for the Project Crown living-world city management sim. The interface is built in vanilla JavaScript and CSS; KaboomJS powers the procedural, pixelated atlas scene.

## Run locally

```bash
npm start
```

Open [http://localhost:5173](http://localhost:5173). No build step is required.

## Playable systems

- Seeded procedural worlds with 45–260 settlements, countries, climates, terrain, resources, companies, notable people, and rankings.
- Real-time calendar with pause and 0.5×–8× simulation speeds.
- Monthly city simulation for population, employment, happiness, crime, pollution, revenue, expenses, companies, research, news, and contracts.
- Mayor dashboard, tax controls, departmental funding, policies, infrastructure upgrades, housing and district values, transport, citizens, global commodity prices, company profiles, government bids, and research.
- KaboomJS pixel world atlas, HTML canvas trend chart, pixel logos, and synthesized retro sound effects.
- Guest saves in IndexedDB with a localStorage fallback, autosave, manual saves, and `.crown.json` import/export.

## Project layout

- `index.html` — entry point and screen shell.
- `css/style.css` — pixel-terminal visual design and responsive layouts.
- `js/app.js` — vanilla JS UI, user actions, and Kaboom atlas scene.
- `js/sim.js` — deterministic world generation and simulation rules.
- `js/data.js` — game content, assets, resources, policies, technologies, and companies.
- `js/prng.js` — seeded random generator and calendar / currency helpers.
- `js/storage.js` — local guest profiles and save files.
- `js/audio.js` — Web Audio interface sounds and ambient tones.
- `docs/GDD.md` — condensed Project Crown design document.

## Check JavaScript syntax

```bash
npm run check
```
