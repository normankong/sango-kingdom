# 三國志III (ROTK3) Web Remake — High-Level Design Document

**Working title:** *Sangokushi III Web*
**Goal:** A faithful, single-player-vs-AI browser remake of Koei's *Romance of the Three Kingdoms III: Dragon of Destiny* (三國志III, 1992), using Firebase as the backend.
**Purpose of this doc:** A high-level design map to hand to Fable 5 for deeper research and detailed spec work. Sections marked **[Verify]** are places where Fable should confirm exact formulas, tables, and constants against the original game.

---

## 1. Design Pillars

1. **Faithful mechanics.** Match ROTK3's systems — 46 cities, six officer stats, monthly lunar-calendar turns, the command menus, and the tactical battle grid — as closely as practical. Not a modernization.
2. **Single-player vs AI.** One human ruler; all rival warlords are AI-controlled. No online multiplayer in scope (but the data model should not *prevent* it later).
3. **Browser-native.** Runs entirely in the web browser. No install.
4. **Firebase as backend.** Auth + cloud save + officer/scenario data. Because it's single-player, Firebase is primarily a save/load and content store, **not** an authoritative real-time game server (see §7).

---

## 2. Core Game Loop

```
Choose scenario & ruler
   ↓
[ Monthly turn ]
   Issue commands to your officers (each officer = 1 action/month)
   → Internal affairs, personnel, military, diplomacy, plots
   ↓
End turn → AI rulers take their turns
   ↓
Monthly report (harvests, taxes, loyalty shifts, random events, battles)
   ↓
Repeat until one ruler controls all 46 cities
```

**Victory condition:** Control all **46 cities** of China.
**Loss condition:** Lose your last city (option to go into exile as a free/wandering force before final defeat).

---

## 3. World Model

### 3.1 Map
- **46 cities/regions** connected by an adjacency graph (land borders + water routes). Movement, invasion, and diplomacy all operate on adjacency.
- Rendered as a stylized map of Han-era China; cities are nodes you select.
- **[Verify]** exact 46-city list, their names, and the adjacency edges (including which borders are river/naval crossings).

### 3.2 Per-city state
Each city tracks:

| Field | Range / cap | Notes |
|---|---|---|
| Population | up to 3,000,000 | grows with support & low tax |
| Gold | up to 50,000 | treasury |
| Food | up to 3,000,000 | feeds soldiers & officers |
| Soldiers | — | garrison, split among stationed officers |
| Economy (commerce) | 0–9,999 | drives January gold tax |
| Land Development | 0–100 | arable capacity |
| Cultivation | 0–100 | resets after July harvest |
| Flood Control | 0–100 | reduces flood disaster risk |
| Irrigation | 0–100 | boosts harvest yield |
| Tax Rate | 0–100 | collected in Jan (gold) & Jul (food) |
| Popular Support | 0–100 | low → revolts; high → growth |
| Equipment | up to 9,999 each | Crossbows, Strong Crossbows, Horses |
| Galleys | up to 100 each × 3 types | Armored / Heavy / Light |
| Stationed officers | list | each can hold soldiers/equipment |

**[Verify]** the exact growth/decay formulas per command and per season.

---

## 4. Officers (the heart of the game)

### 4.1 Stats (each 0–100)
- **War (武力)** — offensive strength in battle & duels
- **Intellect (知力)** — strategy tactics success (fire, confuse, etc.)
- **Political (政治)** — effectiveness of development commands
- **Charm (魅力)** — recruitment, popular support, diplomacy
- **Army Command (陸指)** — land-force command; gates advanced attacks
- **Navy Command (水指)** — naval-force command

### 4.2 Dynamic parameters
- **Loyalty (0–100)** — raised by rewards/salary/tenure; low loyalty → resignation or defection.
- **Morale (0–120)** — unit spirit in battle; raised by Rally.
- **Training (0–100)** — soldier combat effectiveness.
- **Stamina (0–100, battle only)** — drops when wounded.
- **Age / Years in service** — officers age yearly; illness and death occur. **[Verify]** mortality model.
- **Rank** — Ruler, Governor, Advisor, General, Military Officer, Civil Officer (gates which commands an officer may perform).
- **Compatibility (相性)** — hidden affinity value affecting recruitment success and loyalty drift; family ties in Historical Mode. **[Verify]** the 0–150 compatibility scale and how it's compared.

### 4.3 The action economy
**Each available officer performs one command per month.** The number and quality of your officers *is* your throughput — this is the central strategic tension. Officer status per turn: Available / Busy (multi-month task) / Done / Sick-Wounded.

**[Verify]** full historical officer roster with per-scenario stat blocks (this is a large data-entry task — a strong candidate for Fable research).

---

## 5. Command System (menus)

Grouped as in the original. Rank and officer stats gate availability.

**Military** — Move (relocate officers), Send (transfer goods), Rally (morale), War (attack adjacent city), Draft (cheap soldiers), Hire (skilled soldiers), Train, Assign (redistribute soldiers), Ship (build galleys).

**Personnel** — Search (find hidden officers), Recruit (free or enemy officers via gold/persuasion/visit/items), Reward (loyalty via gold/items/books), Give (food → popular support), Delegate (auto-govern a vassal city), Appoint (ranks), Fire, Seize (items).

**Development** *(Civil Officers)* — Land Development, Cultivation, Flood Control, Economy.

**Diplomacy** *(home city only)* — Ally, Joint Invasion (3-month coordinated attack), Truce, Exchange, Help, Threat, Revoke.

**Plot** — Hide Infiltrator (needs 100 loyalty), Bribe (turn enemy officer), Forged Letter (officer vs ruler discord), Rival (turn two enemies on each other), Rebel (make a governor defect).

**Market** — Sell/Buy Food, Buy Arms/Horses.

**Emergency** — Exile, Heal (Hua Tuo's book), Special Tax, Tax Rate.

**[Verify]** exact costs, success formulas, and stat thresholds for each command (e.g. Draft = 10 gold + 100 food per 100 soldiers; Simultaneous attack needs Command ≥ 70).

---

## 6. Battle System

Triggered by **War** (invade adjacent city) or defense. Turn-based on a **tactical grid**.

- **Land unit types:** Infantry, Cavalry (fast, can't scale walls), Crossbow (ranged, ~15 shots), Strong Crossbow (fire bolts, ~8 shots).
- **Naval unit types:** Armored / Heavy / Light Galley.
- **Terrain & mobility:** each tile costs mobility (max 10/turn); terrain modifies movement and combat; weather affects fire.
- **Attack commands:** Normal (also breaks gates), Simultaneous (Command ≥ 70), Surprise/Ambush, Bow, Firebolt, Charge, **Personal Combat** (officer duel; winner takes prisoner).
- **Tactics (intellect-based):** Fire, Ambush, Bribe, Incite, Confuse, Extinguish (naval).
- **Win (attacker):** occupy all castles / zero enemy food or morale / capture all officers / capture Commander-in-Chief.
- **Win (defender):** hold 10 days / same capture conditions.
- **Extended war:** battles over 10 days pause for monthly orders and resume next turn.

**[Verify]** damage formulas, morale/training multipliers, duel resolution, and capture/execution/recruit-prisoner flow.

---

## 7. Firebase / Technical Architecture

### 7.1 Recommended stack
- **Front end:** a single-page app. Suggest **TypeScript + React** for UI/menus and **HTML5 Canvas** (or PixiJS) for the map and the tactical battle grid. **[Decision for Fable/you]**: React+Canvas vs. a game engine like Phaser.
- **State:** the *authoritative game simulation runs client-side* (single-player, so no anti-cheat concern). Firebase stores the serialized game state as the save.
- **Firebase services:**
  - **Auth** — anonymous sign-in (upgradeable to Google) so saves follow the user across devices.
  - **Firestore** — save slots + static content (scenarios, officer master data, city definitions).
  - **Cloud Storage** *(optional)* — map art, sprites, audio.
  - **Cloud Functions** *(optional / later)* — only if you later want server-side validation, leaderboards, or online play. **Not required for MVP.**
  - **Hosting** — serve the SPA.

### 7.2 Why Firebase is "just" the DB here
Because rival warlords are AI and everything is single-player, the browser can run the whole turn/battle simulation and simply **write the resulting state to Firestore** after each turn (or on manual save). This keeps latency low and cost near-zero. Reserve Cloud Functions for features that genuinely need a trusted server.

### 7.3 Suggested Firestore data model
```
users/{uid}
  saves/{saveId}
    meta: { scenario, turnDate:{year,month}, playerRulerId, updatedAt }
    world:  { citiesById: {...}, diplomacy: {...}, rng seed }
    rulers/{rulerId}: { name, cities[], gold?, ai:bool, traits }
    officers/{officerId}: { stats, loyalty, cityId, rulerId, status, items[] }
    log/{turnId}: monthly reports & events

content/                          (read-only, shared by all players)
  scenarios/{scenarioId}: { startDate, description, initialRulers }
  officersMaster/{officerId}: { baseStats, portraitRef, historicalTies }
  cities/{cityId}: { name, adjacency[], terrain, coords }
```
**Design note:** keep large per-turn state in a single document or a compact sub-collection to minimize reads/writes (Firestore bills per document op). Consider storing the whole `world` blob as one document per save and only splitting officers out if it grows too large. **[Verify]** against Firestore's 1 MB/document limit for late-game states with many officers.

---

## 8. AI Design (rival warlords)

The AI must play *all* the same commands the human can. A practical layered approach:

1. **Strategic layer (per ruler, per month):** budget officers across goals — develop weak cities, defend borders, mass troops, recruit officers, pursue diplomacy/plots. Weight by personality traits (aggressive vs. builder).
2. **Tactical layer (battles):** grid AI for unit movement, target selection, and tactic use, scaled by Intellect/Command.
3. **Difficulty tiers:** tune aggressiveness, economic bonuses, and lookahead depth.

**[Verify / Research for Fable]:** how the original ROTK3 AI prioritized (many players have documented its behavior); decide how faithful vs. improved the AI should be.

---

## 9. Content & Data (biggest research load)

These are the large "fill-in-the-tables" tasks — ideal for Fable 5:
- **Officer master list** with per-scenario stat blocks, portraits, and historical family ties.
- **The 6 historical scenarios** (start dates and initial force layouts) — **[Verify]** exact scenario years and rosters.
- **46-city definitions** — names, coordinates, adjacency, terrain, and starting economy/population.
- **13 special items** (books/swords/horses + ruler-only Hua Tuo's book & Hereditary Seal) and their effects.
- **Random events** table (locust, flood, typhoon, epidemic, revolt, rebellion, good/poor harvest, Yellow Turban raids).
- **All command cost & success formulas.**

---

## 10. Turn / Calendar Rules

- **Monthly turns** on a lunar calendar; seasons = Spring (Jan–Mar), Summer (Apr–Jun), Fall (Jul–Sep), Winter (Oct–Dec).
- **January:** annual gold tax + officer gold salary.
- **July:** harvest food tax + officer food salary + Cultivation resets.
- **Every month:** loyalty drift, possible resignations, wounded recovery (up to 6 months), random events.

---

## 11. Scope Tiers (build order)

**MVP (playable vertical slice)**
- 46-city map + adjacency, one scenario, single human ruler + basic AI.
- Officer data & the action-per-officer turn loop.
- Internal affairs (Development + tax/harvest), Draft/Train, Move.
- Simplified auto-resolved battles (compare army power) instead of the full grid.
- Firestore save/load + anonymous auth.
- Victory check (control all 46).

**V1 (faithful core)**
- Full tactical grid battle with unit types, terrain, tactics, duels.
- Personnel, Recruit/Reward/Search, loyalty & defection.
- Diplomacy + Plots.
- Random events, items, multiple scenarios.
- Layered AI.

**V2 (polish / stretch)**
- All 6 scenarios + full officer roster, portraits, audio.
- Difficulty tuning, historical vs. what-if modes.
- (Optional) online multiplayer via Cloud Functions — the data model already anticipates it.

---

## 12. Open Questions for Fable 5 / You

1. **Front-end engine:** React+Canvas/Pixi vs. Phaser vs. plain Canvas?
2. **Art & IP:** original ROTK3 art/officers are Koei's IP — plan for original/placeholder art and generic officer data, or a purely personal/non-distributed build? **(Important legal note — decide before publishing.)**
3. **Faithful AI vs. improved AI?**
4. **How exact must formulas be** — reverse-engineered from the original, or "feels right" approximations?
5. **Save model:** single blob doc vs. split sub-collections (cost vs. document-size tradeoff).

---

*Prepared as a high-level design map. Sections marked **[Verify]** are the recommended starting points for Fable 5's deeper research. Mechanics sourced from the official ROTK3 "Dragon of Destiny" manual.*
