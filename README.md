# Sango Kingdom — 三國志III Web

A browser remake of Koei's *Romance of the Three Kingdoms III: Dragon of Destiny* (1992):
single-player vs AI, React + TypeScript, Firebase-backed cloud saves.
Based on the high-level design document in `docs/rotk3-web-design.md`.

## What's implemented (MVP — the "playable vertical slice")

This is the MVP tier from §11 of the design doc. The guiding cut: **everything needed to
experience the core ROTK3 loop** — officers as your action economy, monthly turns,
internal affairs feeding war, map conquest — with the tactical battle grid deferred.

| MVP item | Status |
|---|---|
| 46-city map with land/naval adjacency graph | ✅ SVG map, clickable cities |
| One scenario (190 AD — Coalition Against Dong Zhuo, 19 forces, 90 officers) | ✅ |
| One-command-per-officer-per-month action economy | ✅ |
| Internal affairs: Land, Cultivation, Flood Control, Economy, Tax Rate | ✅ |
| Military: Draft (10g+100f per 100), Train, Move, War | ✅ |
| Personnel (lite): Search/recruit free officers, Reward loyalty | ✅ |
| Auto-resolved battles (army power comparison, walls bonus, capture/flee/elimination) | ✅ |
| Monthly calendar: Jan gold tax + salaries, Jul harvest + cultivation reset | ✅ |
| Loyalty drift, defection, desertion, random events (flood/locusts/epidemic) | ✅ |
| Strategic-layer AI with personas (aggressive / builder / balanced) | ✅ |
| Save/load: browser storage always; Firebase (anon auth + Firestore) when configured | ✅ |
| Victory (all 46 cities) / defeat (lose last city) | ✅ |

**Deferred to V1** (per the design doc): tactical grid battles, duels, tactics,
diplomacy, plots, items, equipment/galleys, remaining five scenarios, full officer roster.

**Data fidelity note:** city list/adjacency, officer stats, and formulas are close
approximations of the original, pending the `[Verify]` research passes called out in the
design doc. They are isolated in `src/engine/data/` so verified tables can be dropped in
without touching game logic.

## Run it

```bash
npm install
npm run dev      # dev server
npm test         # engine unit tests
npm run build    # production bundle in dist/
```

## Firebase setup (optional — enables cloud saves)

Without configuration the game saves to browser `localStorage`. To enable Firebase:

1. In the [Firebase console](https://console.firebase.google.com), create a project,
   add a **Web app**, enable **Anonymous** sign-in (Authentication → Sign-in method),
   and create a **Firestore** database.
2. Copy `.env.example` to `.env.local` and fill in the values from your web app config.
3. Firestore security rules — each anonymous user may only touch their own saves:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
4. Restart `npm run dev`. The title screen will show "☁ Firebase cloud saves".

Saves are stored one document per slot at `users/{uid}/saves/{slot}` with the whole
game state as a JSON blob (single-document strategy per §7.3 of the design doc).

Deploy with `firebase deploy` after `npm run build` (Hosting root: `dist/`), or host the
`dist/` folder anywhere static.

## Architecture

```
src/
  engine/        pure TypeScript simulation — no DOM, no Firebase, unit-tested
    data/        cities (46 + adjacency), officers (90), scenario definitions
    newGame.ts   initial state from a scenario
    commands.ts  develop/draft/train/move/search/reward/war (+ auto-battle)
    turn.ts      monthly settlement: taxes, harvest, events, loyalty, calendar
    ai.ts        strategic-layer AI for rival warlords
  save/          SaveProvider interface; localStorage + Firebase implementations
  ui/            React components: SVG MapView, CityPanel command form
  App.tsx        title screen, top bar, log panel, save/load wiring
```

The authoritative simulation runs entirely client-side (§7.2): Firebase is a content
and save store, not a game server — which keeps cost near zero and leaves the door
open for Cloud Functions features (leaderboards, multiplayer) later.
