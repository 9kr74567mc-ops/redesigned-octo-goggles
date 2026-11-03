# Wendler Log — a 5/3/1 lift tracker for iPhone

An offline-first web app (PWA) for Jim Wendler's 5/3/1. Add it to your iPhone home screen and it runs full screen like a native app, with no App Store and no account. All data stays on the device.

## Features

- **5/3/1 programming**: training max (configurable % of 1RM), 5s / 3s / 5/3/1 weeks plus optional deload, 3/5/1 week order, classic PR (AMRAP) sets or 5's PRO, optional warm-ups, rounding to your smallest plate.
- **Supplemental templates**: FSL, SSL, BBB, BBS, or a custom % of TM, with sets/reps you can change.
- **Customizable exercises**: add, rename or delete main lifts and accessories; each main lift has its own TM and per-cycle increment.
- **Customizable sessions**: name, main lift, supplemental work, and an ordered accessory list per session. Any number of sessions per week.
- **Workout logging**: pre-filled weights, tap ✓ to log a set, editable weight/reps, add/remove sets and exercises, plate breakdown for every bar weight, rest timer with sound, workout notes.
- **Estimated 1RM**: Epley, Brzycki, or their average. PR sets show "N reps beats your e1RM PR" live, and you get a PR summary when you finish.
- **Automatic cycle tracking**: finishing every session advances the week; at cycle end it suggests new TMs (+increment, or −10% if a PR set missed its minimum reps) for you to review.
- **History and calendar**: month calendar with workout days (deload days in blue), a list view, editable past workouts, and logging workouts for any past date.
- **Progress**: e1RM chart with the training max overlaid, best/latest e1RM, rep records, and recent sessions.
- **Calculators**: plate loader and 1RM / percentage table.
- **Backups**: JSON export/import (uses the iOS share sheet) and a CSV export of every set.
- Light/dark mode, safe-area aware, works offline via a service worker.

## Install on iPhone

1. Deploy (below) or serve the folder over HTTPS.
2. Open the URL in **Safari** → **Share** → **Add to Home Screen**.

> Data is stored in the browser's local storage on that device. Export a backup from Settings now and then.

## Deploy (GitHub Pages)

`.github/workflows/pages.yml` runs the tests and publishes the site on every push to `main`.
One-time setup: repository **Settings → Pages → Source: GitHub Actions**.

## Develop

No build step and no dependencies.

```sh
npm test              # unit tests for the 5/3/1 logic (Node 20+)
python3 -m http.server 8080   # then open http://localhost:8080
```

| File | Purpose |
| --- | --- |
| `js/core.js` | Pure logic: weeks, percentages, supplemental, e1RM, PRs, plates, TM progression |
| `js/store.js` | Default data, persistence, schema normalization |
| `js/app.js` | UI: views, routing, events, rest timer |
| `css/app.css` | Styles (light/dark) |
| `sw.js` | Offline cache. Bump `VERSION` when shipping changes |
