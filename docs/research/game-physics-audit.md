# NoLongerUbiquitous — inventory of physics-relevant depictions and mechanics

Audit of `src/index.html` (10,964 lines, HEAD 0194219; the source is unchanged since 55b2aa6) plus `docs/physics.md`, `docs/energy.md`, `docs/design-pillars.md`, `docs/audit-A.md` and `README.md`. **No files in the repo were modified.**
Line numbers are for `src/index.html` unless marked otherwise. Galaxy facts marked "probe" come from running the game headless (`tools/headless.js`, seed 1, real galaxy, both editions).

Each item gives: **what**, **where**, **editions** (G = game edition `index.html`, S = sim edition `simulation.html`) and **notes** (✔ = physically fine or defensible, ⚠ = questionable or simplified, ✘ = wrong, or contradicts the game's own physics).

---

## 0. How the editions differ

- `EDITIONS` / `ED` (548–556). The two published files differ only in this table (`tools/build.mjs` rewrites the line `const EDITION = 'game'`).
  - `game: { generation: 100, hazardBase: 0.6, delayExp: 0.33, regimeDelay: true, garrisonWar: true, growthCap: Infinity, declareDamp: true, physics: false }`
  - `sim:  { generation: 28,  hazardBase: 1.3, delayExp: -0.15, regimeDelay: false, garrisonWar: false, growthCap: 0.042, declareDamp: false, physics: true }`
- **`ED.physics` turns on only these things (sim only):**
  - Ship shielding against interstellar gas and cosmic rays, and its mass: `shieldOf` 1446.
  - Acceleration and deceleration time: `accelExtra` 1422 / `withAccel` 1430.
  - Flare protons on M dwarfs and planet surface dose: `radiationOf` 1405 / `flare` field at 1084. A grade-3 "earthlike" planet whose surface dose is above 20 mSv/yr is downgraded to grade 2 (889–894).
  - Proton damage to swarm solar cells, and selectable cell designs: `pvRemaining` 1398, `pvOf` 5242, `PV_DESIGNS` 1341, the swarm growth rate at 5233, and UI at 9063–9077 and 9642.
- **Present in BOTH editions:**
  - 0.95c / 0.9c ships.
  - Light-speed messages, plus a light-delayed view of the map, panels and events.
  - Energy bookkeeping for the Dyson swarm and propulsion (`propulsion` 1313, `bookShip` 5289).
  - Lanchester fleet battles, pirates, natives and alien nations.
  - Spectate mode.
  - Star catalog, habitable zones and planet models.
- The game edition has **no shielding, instantaneous 0→0.95c, no flares and no cell degradation**, yet it shows the same 0.95c numbers.

---

## 1. Ship speeds, travel times, relativity, simultaneity

### 1.1 Fixed cruise speeds 0.95c / 0.9c
- **Where:** `SHIP_SPEED = 0.95`, `OFFROUTE_SPEED = 0.9` (1266–1267). `shipYears = ly / β` (3763–3765). `fleetYears` (4117–4120). `voyage` (6177–6207).
- **Editions:** G and S.
- **What applies where:**
  - 0.95c on trade routes: cargo, construction material, migrants, troops on routes, fleets on a directly connected route leg.
  - 0.9c off-route: fleets, settlers' final leg, conquest reinforcements, and mid-flight redirects (4211).
- **Notes:**
  - ✔ Sub-light throughout; there is no FTL travel anywhere (see 3).
  - ⚠ Ships switch speed between 0.95c and 0.9c at waypoints with no energy booked: `voyage` scales the off-route legs (6199–6201).

### 1.2 Acceleration
- **Where:** `accelExtra` (1422–1429), `ACCEL = { crew: 1, cargo: 10 }` g (1421). Applied in `shipCargo` 4063, `fleetYears` 4119, `redirectFleet` 4211, `sendTroops` 4937 and `voyage` 6203.
- **Editions:**
  - G: `accelExtra` returns 0, so ships go **instantly 0 → 0.95c → 0** (infinite acceleration). No acceleration distance and no time.
  - S: constant proper acceleration. Coordinate time is `(c/a)γβ`, distance is `(c²/a)(γ−1)`, and short routes turn around at the midpoint: `t = 2(c/a)√((1+L/2c²/a)²−1)`. 1g = 0.969 ly/yr. ✔ The formulas are correct (hyperbolic motion).
- **Notes:**
  - ✘ G: instantaneous acceleration to 0.95c (with people aboard) is the classic complaint.
  - ⚠ S: positions are still interpolated **linearly** in time (`shipPosition` 6222–6227). The accelerated trip is drawn as uniform slower motion.
  - ⚠ S: deceleration in "free" mode (magsail + antimatter) is also modelled as a 1g symmetric burn. A magsail cannot give 1g, and its drag-limited braking from 0.9c would take decades (see 4.4).

### 1.3 Lorentz factor
- **Where:** γ appears only inside the formulas in `propulsion` (1314), `sailEff` (1310), `accelExtra` (1424) and `shieldOf` (1451).
- **Editions:** G and S.
- **Notes:** ✔ It is used correctly for kinetic energy, (γ−1)mc². γ is **never shown to the player**: no UI string mentions γ, "time dilation" or "ship time".

### 1.4 Proper time / time dilation for crews and colonists
- **Where:**
  - The only proper-time calculation is `tau` in `shieldOf` (1453–1455), used for the cosmic-ray dose: `2 T atanh β + (L−2x_a)/(γβ)`.
  - Design decision in `docs/energy.md` §1: "旅する側の時間の遅れは入れない" (traveller time dilation is not modelled). `docs/audit-A.md` lists this as a decided non-feature.
- **Editions:** `tau` exists in S only (G returns early).
- **Notes:**
  - ⚠ The colonists, migrants and troops being carried do **not age, grow or consume** during transit. Their numbers are frozen and appear on arrival (`launch` 3799–3815, `migrate` 4577–4612). Nothing therefore *contradicts* relativity, but nothing depicts it either.
  - ⚠ Settler supplies are sized in Earth-frame years: `supplyYears = 5 + 2·travelYears` (3777). They are for the colony after landing, not for the voyage, so this is consistent.
  - ⚠ S: in `shieldOf`, routes shorter than 2x_a (about 4.26 ly at 0.95c and 1g) fall back to the cruise formula `ly/(γβ c)` (1455). That **underestimates** proper time (the ship never reaches β) while still using the 0.95c dose tables. This is a minor internal inconsistency.
  - ⚠ Comment at 1453 says "加速と減速のあいだ (1g) は、船の時間が速く進む" ("during 1g acceleration and deceleration, ship time runs faster"). That is misleading wording: proper time runs *slower* than coordinate time in every phase. It is only "more" relative to the cruise-only formula.

### 1.5 Ambiguous "X 年" ("X years") strings
- **Where:** All are coordinate (galactic-rest-frame / Earth) years:
  - "到着まで X 年" ("X years to arrival") at 3814 (settlers), 4134 (fleets), 4219 (redirect), 4941 (troops) and 8379 (dispatch box).
  - Hover "通信 t 年・船 a〜b 年" ("comms t years, ship a–b years") at 7148–7160.
  - "あと X 年" ("X years left") in the ship lists at 8403, 8723 and 9010.
  - Fleet-move preview "到着まで" at 7104.
- **Editions:** G and S.
- **Notes:**
  - ⚠ The player is never told these are Earth-frame years. At 0.95c a 20 ly trip is 21.1 yr Earth time but 6.6 yr ship time; at 0.9c it is ×1/2.29. A physicist will ask "whose years?".
  - ⚠ S: the hover line (`shipYears`) and the troop message (4941, `route.years`) **omit** the acceleration time that the simulation actually applies. Other UI strings (`fleetYears`, `voyage`) include it.

### 1.6 Global "now" / simultaneity
- **Where:** One global clock `game.year`. The date is shown as "西暦 Y年 M月" (Gregorian year Y, month M) (10899). Events are stamped with that year ("X年に起きた", "happened in year X", at 8860).
- **Editions:** G and S.
- **Notes:**
  - ✔ This is defensible. All stars are nearly co-moving (v ≲ 100 km/s), so simultaneity offsets across 50 ly are ≲ vL/c² ≈ 0.02 yr.
  - ✔ Ships' own frames are never used for any "now".
  - ✔ Light delays are computed in this rest frame: the redirect intercept (4150) and the retarded positions in `apparent` (5890).
  - ⚠ Stars are static for the whole 500-year game. Proper motion is ignored; for example, Barnard's Star moves ≈0.24 ly in 500 yr. This is minor.

### 1.7 Travel inside a star system
- **Where:** Several paths treat movement inside one system as instantaneous and free:
  - `routeYears === 0` gives instant troop transfer (4931–4935).
  - `settlerFlight` returns null when `from === to` (3795).
  - Light delay is 0 within a system, even for very wide companions. For example, the α Cen system (`GJ 559`) contains Proxima (~0.2 ly from A/B), which is about 2 months of light time.
- **Editions:** G and S.
- **Notes:** ⚠ This is a minor simplification.

---

## 2. Light-speed communication, information flow, what the player sees

### 2.1 All orders and messages at exactly c
- **Where:**
  - `command` → `requests` with `arrive = year + lightDelay(target)` (6077–6083).
  - `lightDelay = sysDist(cap, sys)` (5661).
  - `travelYears` (3754). Its comment "光 (通信) が届くまでの年数" (years until light/communication arrives) is correct: 1 ly = 1 yr.
  - Tribute and grants are "光速の送金" (light-speed money transfers) (4427–4436).
  - Policy and fiscal changes take effect only where the news has arrived (2855, 2933–2965).
- **Editions:** G and S.
- **Notes:** ✔ This is the game's core and is done carefully.

### 2.2 The player's view is light-delayed relative to the capital
- **Where:**
  - Events and log: `seen = year + lightDelay` (5662–5683). `knownEvents` (5670) and `knownLog` (5685).
  - Per-system snapshots: `snapshot` 5715, `recordSnapshots`, `known` 5833.
  - "X 年前の情報" (information from X years ago) badge: `ageBadge` 7890–7895.
  - Map fades systems with old data (6951–6953).
  - Legend text (508): "地図は地球に届いている光で描く…" ("the map is drawn with the light that has reached Earth…").
- **Editions:** G and S.
- **Notes:**
  - ✔ Correct.
  - ⚠ The legend says "地球" (Earth), but the code uses the player's capital (`this.cap`). That is inconsistent for non-Earth nations.

### 2.3 Moving objects drawn at retarded (apparent) positions
- **Where:** `apparent` / `apparentPath` (5888–5925) solve `t + |x(t) − E| = now`. They are used for cargo, fleets, construction ships, troops, migrants and settlers (6756–6915). Ghosts of ships that have already arrived stay visible until the arrival light reaches the capital (`keepGhosts` 5032).
- **Editions:** G and S.
- **Notes:**
  - ✔ Physically correct. Approaching ships show the true relativistic "superluminal apparent motion" (up to 1/(1−β) = 20c). The comment at 10884 notes this explicitly.
  - ⚠ Aberration and Doppler are not depicted (see 6).

### 2.4 Signals drawn as "光の点" (dots of light)
- **Where:** 6852–6880 (the map's "通信" (comms) toggle, `SIGNAL_MODES` 10025). Signal positions also use the retarded-time solution.
- **Editions:** G and S.
- **Notes:**
  - ⚠ Correct kinematics for a hypothetical visible beam: outgoing beams appear to move at c/2 and incoming beams are never seen in transit. In reality a beam not aimed at the observer is invisible.
  - The legend makes this an explicit display choice, which is reasonable.

### 2.5 Fleet redirection catching up with a fleet in flight
- **Where:** `fleetIntercept` (4150–4158) uses bisection for when the light-speed order reaches the moving fleet. `sendRedirect` 4160 and `sendFleetClear` 4170.
- **Editions:** G and S.
- **Notes:**
  - ✔ The concept is right ("艦隊は光より遅いので必ず追いつく", "the fleet is slower than light, so the order always catches up").
  - ✘ **Bug:** `sendRedirect` calls `fleetIntercept(f)` with the default origin 0 (Sol) (4162). The request itself is stamped `from: this.cap`. For a human nation whose capital is not Sol (nation games or hotseat), the catch-up time is computed from the wrong star and can be shorter than light allows. `sendFleetClear` passes `origin` correctly.

### 2.6 AI nations use light-delayed intel
- **Where:**
  - `recordIntel` / `seenBy` / `seenShips` (5750–5797).
  - `aiKnowsWar` (5781).
  - `aiOrder` → orders delivered at light speed (5799).
  - Target selection in `realmsYearly` (3487–3530).
- **Editions:** G and S.
- **Notes:** ✔ Mostly correct. Exceptions are listed in 2.8.

### 2.7 Ends of wars propagate at c
- **Where:** `fightingAt` (2315–2322): the news goes from the treaty location to the attacker's capital and then on to the front. `tradeBlockedIn` (2300) and `warKnown` (2333).
- **Editions:** G and S.
- **Notes:**
  - ✔ Battles and sieges continue until the peace news arrives (3350, 3388).
  - ⚠ The *start* of a war is global and instantaneous: `beginWar` sets `realmWars` (2366). Only trade blocking waits for the news.

### 2.8 Information that arrives faster than light (leaks; design simplifications and bugs)

| # | Leak | Where | Ed. |
|---|---|---|---|
| a | **Spectate mode** ("観戦") shows the true simultaneous state everywhere. The Earth AI in that mode also uses true enemy fleet totals and battles (`earthWarYearly` 5934–5965: `realmShips`, `battleAt`, `garrison`). By design and labelled "光の遅れなしに実際の様子" ("the actual state without light delay"). | 477, 5926, 5834–5839, 9649 | G, S |
| b | **Ship and fleet lists use the true state.** They are filtered only on whether the *departure* has been seen, then show the true remaining time and progress bar. An entry **disappears at the true arrival**, years before the arrival light reaches the capital (the map still shows the ghost). Redirects (`f.to` and `f.arrive` change instantly) appear in the lists immediately. **Enemy fleets' destinations** are listed as soon as their departure is seen, which reveals intent rather than position. | `shipsHtml` 8400–8421; `militarySheet` "移動中の艦隊" (fleets in transit) 8723 and "向かっている" (heading here) 8693; settlers in the candidates sheet 9008–9010; the dashed ring in the system view 7578; `requestsTable` "発送済み" (shipped) 8482 | G, S |
| c | **Peace offers and peace conferences appear to the human instantly.** The rail item and `peaceOffers` / `conferences` are not gated by light delay. They show the global `warScore` and the loser's current treasury and systems (`treatyTerms` 2440). `acceptPeace` (2529) and `submitTreaty` (2464) act instantly, and the ceded systems change owner instantly. AI–AI peace is also negotiated instantly between capitals (`realmsYearly` 3524 `peaceChance` → `makePeace`). Only the *cease-fire news* is light-limited. | 7760–7766, 2417–2530, 3509–3526 | G, S |
| d | **Rally commands use the true locations of forces.** "全艦隊をここへ集結" (gather all fleets here) and "全歩兵をここへ" (all troops here) pick sources from the true `garrison` and `c.troops` everywhere. | `commandRaw` 6058–6069 | G, S |
| e | **Trade and procurement AI.** Buyers see sellers' *current* surplus (`spareOf` 3921, `avail` 4016). Procurement sees remote stocks and energy reserves (`procureFrom` 3637–3677). `routeRoom` / `routeMode` read the *receiver's* current energy, and the receiver is charged for deceleration **at departure**, years before the ship arrives (5308–5312, 3937, 3954). Migrants choose destinations by the true food saturation and free room of distant colonies (`migrate` 4594–4597). | as listed | G, S |
| f | **War score and exhaustion are realm-wide counters updated instantly** by losses anywhere. They drive taxes, loyalty and peace decisions in all systems at once. | `warLoss` 2386, `exhaust` 2382, `exhaustionYearly` 2404 | G, S |
| g | `incoming(id)` counts **all** fleets with `to === id`, including enemy ones and using true state, as reinforcements in the defence gap. | 4472–4474 | G, S |
| h | Refunds of cancelled requests are instant ("返金は光速で届くが、簡単のためすぐ返す", "refunds travel at light speed but are returned immediately for simplicity"). | 4049–4053 | G, S |
| i | **Story event "refugees"**: the accepted 50,000 refugees are added **instantly** to the emptiest colony anywhere in the realm, possibly tens of ly away (`addPeople` in `resolve`). This is matter transport faster than light. | 1910–1931 | G, S |
| j | **Physical teams delivered at exactly c.** "視察団を送る" (send an inspection team) and the plague option "医療団を送る…届いた時点で収まる" (send a medical team; the plague stops when they arrive) resolve when the *reply* arrives at light speed. People cannot travel at c; ships take ≥ ly/0.95. | 7713, 7869, 6125; 1959–1971 | G, S |
| k | **Natives are known before contact.** `isSurveyed() { return true; }` with the comment "先住民の有無・文明は天体観測で入植前から分かる" ("whether natives exist, and their civilization, is known from astronomical observation before settlement"). Species name, tech level and population are known from tens of ly, even for stone-age natives. | 3534–3536, 8312ff, 9001–9004 | G, S |
| l | The **system view** draws planets and companions at their *current* orbital phase (`game.year`), not the light-delayed phase, while the colony data shown is delayed. | 7477–7486 | G, S |
| m | The capital's laser accelerates fleets that start from uninhabited systems or mid-space redirects "instantly", although the beam would take years to arrive (see 4.6). | 5297–5306, 4213–4214 | G, S |

### 2.9 Detectability and fog of war
- **Where:** `HANDICAP.info` (1638–1645): `full` on easy and normal, `fuzzy` (rounded to 5) on hard, `hidden` on brutal. `shipsSeen` 8006.
- **Editions:** G and S.
- **Notes:**
  - ✔ The default "everything visible, only delayed" matches "there is no stealth in space". Hot shields, 34 kW/m² frontal heating and laser launches are bright.
  - ⚠ Waste-heat / infrared detectability of swarms is **not modelled** (`docs/audit-A.md` #10, decision P8/G5 still open). Fleet *counts* are visible, but no detection physics justifies it.

---

## 3. FTL, wormholes, warp, jump

- **Result:** None present in either edition. A grep for ワープ (warp), 超光速 (faster than light), ワームホール (wormhole), ハイパー (hyper), ジャンプ (jump), ブラックホール (black hole) and similar finds nothing.
- **Text claims:** "光速の壁の向こうへ広がる恒星間植民" ("interstellar colonization spreading beyond the light-speed barrier", tagline at 9631) and "情報も指令も光速でしか伝わらない" ("information and orders travel only at light speed", README).
- **Effective FTL despite this:** the leaks in 2.8 (b, c, d, e, f, i, m).

---

## 4. Propulsion and energy

### 4.1 Propulsion concept
- **What:** "Accelerate by laser sail, decelerate by magsail, finish with a little antimatter." Trade routes have lasers at both ends.
- **Where:** comments 1279–1281, `PROP` 1289–1296, `propulsion` 1313–1321, `docs/energy.md`.
- **Editions:** G and S.

### 4.2 Kinetic energy and sail efficiency (acceleration)
- **Where:**
  - Energy = (γ−1)mc² ÷ (η_L η_B η_S).
  - `sailEff = 2(γ−1)/(γβ+γ−1)`, which equals the integrated 2β/(1+β) for a perfect reflector. Required light = mc²(γβ+γ−1)/2 (1308–1310).
  - Efficiencies: laser 0.5, beam 0.8, PV 0.3.
- **Editions:** G and S.
- **Notes:** ✔ Correct relativistic formulas for a sail receding from its laser.

### 4.3 Deceleration by the destination's laser (route mode)
- **Where:** `propulsion` 'route' returns `dec = acc` (1316). `docs/energy.md` §2 says "着く側のレーザーで、加速と同じ式" ("by the arrival side's laser, same formula as acceleration"). The cost shown in the UI is E_UNIT "送る側の加速・受ける側の減速" ("sender's acceleration, receiver's deceleration") (9066).
- **Editions:** G and S.
- **Notes:**
  - ✘ **Physics error.** When the sail *approaches* the laser, the reflected light is blue-shifted and carries away the ship's kinetic energy. The laser energy needed is mc²(γβ−γ+1)/2, not mc²(γβ+γ−1)/2.
  - This **overcharges deceleration by ×6.2 at 0.95c (×4.4 at 0.9c).** Check: 0.84 vs 5.25 (in units of mc²/2) at 0.95c.
  - The R07 test (`tools/tests/energy.js`) only checks that the books match the formula, not the physics.

### 4.4 Magsail braking to 0.001c "with no energy"
- **Where:** `PROP.magsailTo` 1295 and the 'free' mode (1317–1320).
- **Editions:**
  - G: no braking time at all.
  - S: braking time modelled as a 1g mirror of acceleration.
- **Notes:**
  - ⚠ Energy-free is fine for drag braking.
  - ✘/⚠ The *time and distance* are ignored (G) or unrealistically short (S: 1g). Magsail drag in n ≈ 0.1 cm⁻³ gas gives far less than 1g, so braking from 0.9c takes decades and light-years. `docs/energy.md` cites Gros 2017 on heavy sails at high speed.
  - ⚠ Magsail deceleration from relativistic speed also means a strong ion/particle environment and heating, which is not mentioned.

### 4.5 Antimatter rocket
- **Where:** `R = exp(atanh β_f / v_e)` with v_e = 0.33c. Half the propellant is antimatter. Production efficiency 10⁻⁴ (1293–1294, 1317–1320).
- **Editions:** G and S.
- **Notes:**
  - ✔ Correct relativistic rocket equation, in rapidity form.
  - ⚠ 10⁻⁴ production efficiency is Forward's optimistic projection; today's value is ~10⁻⁹. This is documented.

### 4.6 Who pays and where the laser is
- **Where:** `pushFleet` 5297–5306: the payer is the departure system "自国でなければ国の首都" (or the nation's capital if the departure system is not its own). A fleet redirect is paid by the capital, "宇宙の途中なので" ("because it is in mid-space") (4213–4214).
- **Editions:** G and S.
- **Notes:**
  - ✘ This implies a laser at the capital accelerating a fleet that sits at an **uninhabited system** or in **mid-flight** tens of ly away, with no beam travel time and no diffraction. In practice this is energy delivered faster than light.

### 4.7 Mid-flight redirect
- **Where:** `redirectFleet` 4200–4222.
- **Editions:**
  - G: the fleet turns around instantly at 0.9c.
  - S: adds acceleration time for the new leg only, and **no time to shed the old velocity**.
- **Notes:** ✘ Reversing up to 2×0.9c of velocity instantly in mid-space. The energy is booked as one 'free' trip but the kinematics are ignored.

### 4.8 Multi-leg routes without stopping
- **Where:** Cargo, migrants and settlers follow the trade-route graph and change direction at relay stars without stopping. Energy is booked once at the origin and once at the destination ("途中の星系では止まらない", "it does not stop at intermediate systems", `docs/energy.md` §5; `shipCargo` 4055–4063; `voyage` 6177). The shielding path length uses the straight-line distance (5289, 3797).
- **Editions:** G and S.
- **Notes:** ✘ Turning a 0.95c sail ship by a large angle at a waypoint needs a Δv of order c and is not booked.

### 4.9 Laser diffraction ignored
- **Where:** `PROP.beam = 0.8` is fixed (1292). `docs/physics.md` §0 and P2.
- **Editions:** G and S.
- **Notes:** ⚠ At 1g the sail is pushed over ~2.1 ly. A 1 km sail needs a ~28,000 km transmitter aperture. The docs acknowledge this as a "setting choice".

### 4.10 Energy from the Dyson swarm
- **Where:**
  - `power = ΣL · L_sun · cover · 0.3 · rf · yr` (5270–5278).
  - `swarmCover` is logistic with a 5-year doubling time (5229–5235).
  - `SWARM` (1297–1302): 0.1 coverage at home in 2300 and a 10⁻⁶ seed for new colonies.
  - S: the growth rate scales with cell mass and damage (5233, 5242–5249).
- **Editions:** G and S. The cell-damage scaling is S only.
- **Notes:**
  - ✘ **Sol's swarm reaches ≈99% coverage by ~2350.** Planets are unaffected: Earth's farms, temperature and habitability never change (coverage is used only in `power`).
  - ✘ In S the cells are explicitly placed at √L AU, which is **1 AU for the Sun, on Earth's orbit** (1396–1397, `docs/physics.md` §7). A 99% swarm there would shade Earth.
  - ⚠ The swarm's mass (~3×10²³ kg ≈ Mercury at 1 kg/m²) is not drawn from any stock; this is documented.
  - ⚠ There is no waste heat or IR signature (audit-A #10).

### 4.11 Energy storage and debt
- **Where:**
  - Storage cap of 10 years of output (`SWARM.store`); the excess is "捨てた" (discarded) (5279–5286).
  - Fleets and troops may drive the reserve **negative** ("蓄えが負になってもよい", "the reserve may go negative", 5283, `docs/energy.md` §2).
- **Editions:** G and S.
- **Notes:**
  - ⚠ Storing up to ~3.6×10³⁴ J (10 years of a full solar swarm) has no stated medium. That is about 4×10¹⁷ kg of mass-energy.
  - ✘ Negative energy reserves (energy borrowed from the future) are unphysical bookkeeping.

### 4.12 Masses
- **Where:** 1 unit = 10⁹ kg. Fleet = 160 units = 1.6×10¹¹ kg (1304). Troop regiment = 5×10⁹ kg. Migrant = 250 t/person (1306). Settler ≈ 7×10¹⁰ kg (3794–3797).
- **Editions:** G and S.
- **Notes:** ✔ The energies quoted in `docs/energy.md` follow from these.

### 4.13 Units shown
- **Where:** `fmtJ` uses the ronna (RJ, 10²⁷) and quetta (QJ, 10³⁰) prefixes (7607ff).
- **Editions:** G and S.
- **Notes:** ✔ These are correct SI (2022) prefixes.

---

## 5. Combat

### 5.1 Fleet battles
- **Where:** Lanchester square law: each fleet destroys 0.6 enemy fleets per year (`BATTLE_RATE` 1713, `battlesStep` 3346–3383). Battles in uncolonized systems are resolved at once with √(a²−d²) (3283–3292).
- **Editions:** G and S.
- **Notes:**
  - ⚠ Battles last *years* at a star system. Ships have already braked to rest before fighting.
  - ⚠ There is no weapon physics and no description of weapons anywhere.
  - Audit-A #21 already notes "光速近くでの交戦の物理はない" ("there is no physics of combat near light speed").

### 5.2 Kinetic energy of relativistic ships never used as a weapon
- **Where:** Fleets always decelerate and then besiege (siege progress 0.12/yr, `siegesYearly` 3385–3428).
- **Editions:** G and S.
- **Notes:**
  - ✘ The classic complaint: **every ship is a planet-killer.**
  - One fleet at 0.9c has KE ≈ 1.9×10²⁸ J ≈ 4×10¹² Mt TNT. That is ≈5× the energy needed to boil Earth's oceans and ≈5×10⁴ Chicxulub impacts.
  - A single 10⁹ kg cargo unit at 0.95c carries ≈2×10²⁶ J (~500 Chicxulubs).
  - The game has no relativistic kill vehicles, no ramming and no defence against them. Sieges with ground troops are an Earth-historical abstraction.

### 5.3 Interception
- **Where:** Fleets only meet at star systems. They pass each other in flight without interaction, and there is no mid-space interception.
- **Editions:** G and S.
- **Notes:** ⚠ This is realistic in the sense that intercepting a relativistic object is nearly impossible, but it is never explained.

### 5.4 Warning time
- **Where:** No mechanic. Defenders react only through garrison levels; "surprise attack" (`奇襲攻撃`) is a diplomatic state, not a detection state (4137, 3318).
- **Editions:** G and S.
- **Notes:** ⚠ Physically, a 0.9c fleet is seen only ~0.11 yr per ly before arrival. The game neither exploits nor shows this. The map *does* show the departure light correctly.

### 5.5 Pirates
- **Where:** `pirates` / `pirateRaid` (4628–4660), `PIRATE_START = 2320`. Raids appear at a random colony with **no origin, no travel, no base and no energy cost**. Strength grows by +1/3 every 40 yr. The early "raid" story event is at 1976–1981.
- **Editions:** G and S.
- **Notes:** ✘ Interstellar raiders materialise from nowhere. This conflicts with the game's own light-speed and energy rules (audit-A #23: "根拠がない", "no basis").

### 5.6 Ground war against natives
- **Where:** Conquest progress (`wars`) and `nativeDefense` (3550).
- **Editions:** G and S.
- **Notes:** Not physics; listed for completeness.

### 5.7 Explosions and sounds
- **Where:** There are none. Battles are drawn as a pulsing dashed red ring, a bar of the force ratio and "艦隊戦 a対d" ("fleet battle a vs d") text (6992–7012). War is a ⚔ glyph.
- **Editions:** G and S.
- **Notes:** ✔ No sound in space; there is no audio at all (no `AudioContext` or `Audio` anywhere). The only haptic is `navigator.vibrate(15)` on a long press (6521), which is UI only.

---

## 6. Visual depictions

### 6.1 Galaxy map
- **Where:** `GalaxyView.draw` (6638–7180). The map is a 3D orthographic projection with yaw and pitch, distance rings of 4–64 ly, "drop lines" to the galactic plane when tilted (6672–6683), and 10-ly circles on the plane.
- **Editions:** G and S.
- **Notes:** ✔ Positions are true 3D positions from CNS5 (Golovin et al. 2023).

### 6.2 Star colours and sizes
- **Where:**
  - Colour: `tempToColor` (715–729) is a blackbody-to-RGB fit (Helland-type). For example, 3000 K → rgb(255,177,110).
  - Size: radius ∝ 1.5 + 1.1·log₁₀(1+20L) with a radial-gradient glow (6918–6940). A companion is drawn as a small offset dot.
- **Editions:** G and S.
- **Notes:**
  - ✔ The colours are reasonable blackbody approximations. M dwarfs are orange rather than "red", which is more accurate than most SF.
  - ⚠ The glow and log sizing are stylised; there is no apparent-magnitude logic.

### 6.3 Aberration, Doppler, relativistic beaming
- **Where:** Not shown anywhere. Nothing is ever rendered from a moving ship's viewpoint.
- **Editions:** G and S.
- **Notes:** ✔ This is consistent, since all views are rest-frame maps. "光行差" (aberration) appears only in the cosmic-ray shielding physics comments (1325) and in `docs/physics.md`.

### 6.4 Ship markers and trails
- **Where:**
  - Markers: cargo is a 3 px square, fleets are triangles, migrants dots, settlers orange dots with a dashed full-route line, construction ships diamonds, troops squares.
  - Lines: own fleets get a dashed arrow to the destination (6774–6815). Orders being sent get a dashed line with "指令 あと X 年" ("order, X years left") (6817–6838). Trade routes are green lines (6756–6764).
- **Editions:** G and S.
- **Notes:**
  - ✔ There are no exhaust trails or "engine glow" streaks.
  - ⚠ The dashed route lines of *other* nations' settler ships reveal their destination at departure (see 2.8b).

### 6.5 Borders and "territory"
- **Where:** `TERRITORY_LY = 5` (8496). This is a Stellaris-style coloured territory blur (6691–6754).
- **Editions:** G and S.
- **Notes:** ⚠ "Territory" is drawn as a filled region of space. It is purely political; there is no physical meaning.

### 6.6 Galaxy-view sky background (`#sky .sky-galaxy`)
- **Where:**
  - Image: `assets/space-galaxy.jpg`, the NASA SVS Deep Star Maps 2020 crop around the **Galactic Centre as seen from Earth**. Credits at 480 and README 457.
  - CSS: 380–386.
  - Behaviour: it is translated with slight parallax, rotated with the map's yaw and shifted with pitch (`updateSky` 10845–10861).
- **Editions:** G and S.
- **Notes:** ✘/⚠ An Earth-sky panorama (a view *within* the disc toward the bulge) is placed behind a top-down map of the local ±2 ly slab and rotated with it. That is geometrically meaningless and is decoration only.

### 6.7 System-view backgrounds
- **Where:** `systemBg` (10842–10844). Sol uses the **North America Nebula** (Spitzer IR + DSS composite). Every other star gets one of 17 NASA images (README 459–477), including:
  - Lagoon, Tarantula, **Andromeda**, **Pleiades (IR)**, **LMC** clusters, Soul Nebula, Dumbbell M27, Westerlund 2 and Dragonfish.
- **Editions:** G and S.
- **Notes:**
  - ✘ This is the classic "colourful nebula behind every star system" complaint.
  - From any star within 50 ly the sky looks almost identical to Earth's. These objects are faint or invisible to the eye, many of the images are false-colour IR, and the LMC, Tarantula and Andromeda are extragalactic.
  - Sol itself is shown "inside" a nebula it is not in.

### 6.8 System view (orbits)
- **Where:** `SystemView.draw` (7413–7510): log-scale radii (`A0 = 0.05` AU), a shaded HZ ring, a dashed "雪線" (snow/frost line), circular coplanar orbits at Kepler periods `√(a³/M)` (873), and companions orbiting at `√(sep³/(M1+M2))` (7480).
- **Editions:** G and S.
- **Notes:**
  - ✔ Kepler periods are correct.
  - ⚠ No eccentricities or inclinations.
  - ⚠ Phases are the true current phases, not light-delayed (2.8 l).

### 6.9 Planet appearance
- **Where:**
  - Map colours by surface class: `BODY_COLOR` / `TYPE_COLOR` (6238–6245).
  - Icons: rocky planets with craters, gas giants banded, ice giants **with rings**, mini-Neptunes with one band (`planetIcon` 6252–6265).
  - The system view draws 2 dark bands on giants.
- **Editions:** G and S.
- **Notes:** ⚠ The icons are stylised. Giving every ice giant a ring is iconography, not physics.

### 6.10 "画面の動き" (screen motion) FX
- **Where:** `fxbtn` (10044–10070). Random text "jitter" is a glitch aesthetic.
- **Editions:** G and S.
- **Notes:** Not physics.

### 6.11 Sound
- **Where:** None at all.
- **Editions:** G and S.
- **Notes:** ✔

---

## 7. Astrophysics

### 7.1 Real star catalogue
- **Where:**
  - Source: `REAL_STARS` (1050). It is built by `data/build/build_stars.py` from CNS5, with spectral types from SIMBAD or from Gaia colours via the Mamajek table, and exoplanets from the NASA Exoplanet Archive.
  - Slab: **±2 ly** from the galactic plane (`THIN_SLAB` 1071; the table itself holds ±17 ly, 600 systems), giving **73 systems** within ~53 ly.
- **Editions:** G and S.
- **Notes:**
  - ⚠ (probe) τ Ceti, ε Eridani, Wolf 359, Lalande 21185, UV Ceti, YZ Ceti, Luyten's Star, Altair and Vega are **excluded**. α Cen, Barnard's Star, Sirius, 61 Cyg and GJ 667 are included.
  - ⚠ The mean nearest-neighbour distance on the map is 6.3 ly, against 4.4 ly in the full 3D table. The real neighbourhood is flattened into a 4-ly-thick sheet (audit-A #27, user's decision).
  - The tooltip shows the true height above the plane (7693).

### 7.2 Legacy "flat" galaxy
- **Where:** `buildGalaxy` (1134–1149) and `scatter` (1005). It places 400 random 2D points scaled to a 4 ly mean spacing. It is used only for old saves.
- **Editions:** G and S.
- **Notes:** ⚠ 2D.

### 7.3 Procedural stars
- **Where:**
  - Class weights: `CLASSES` (695–705), with M 73% and WD 3.5%.
  - Mass–luminosity: L ∝ M^2.3/4/3.5 (711–713). Radius ∝ M^0.8/0.57.
  - Temperature from L and R. Subclass from mass.
  - White dwarfs: 0.4–1.1 M☉, radius ∝ M^-1/3, T 4,000–25,000 K (740–749).
  - Multiplicity: `MULTIPLICITY` (707), after Raghavan+2010.
- **Editions:** G and S.
- **Notes:** ✔ Reasonable textbook scalings.

### 7.4 Stellar ages, evolution, activity versus age
- **Where:** Not modelled. Stars are static for 500 yr. Flare rates are per star (TESS-measured, S only) rather than functions of age.
- **Editions:** G and S.
- **Notes:** ✔ Fine on a 500-yr timescale.

### 7.5 Habitable zone and frost line
- **Where:**
  - HZ: Kopparapu et al. 2014 conservative, with T clamped to 2600–7200 K (788–793).
  - Frost line: 2.7√L AU (3 AU for WDs) (785).
- **Editions:** G and S.
- **Notes:**
  - ✔
  - ⚠ The HZ for white dwarfs uses the clamped coefficients, but WD HZs are not drawn (7432).

### 7.6 Planet generation
- **Where:**
  - Counts: Poisson per class (780).
  - Types: by a/frost-line (795–802).
  - Mass–radius: `physical` (804–828).
  - η⊕ top-up: adds HZ rocky planets to FGK stars with probability 0.45 (1068–1122), to match Bryson+2021.
  - Orbit spacing: ×1.4–2.2. Stability cut at sep/3 for binaries (1033–1047, 1088).
- **Editions:** G and S.
- **Notes:** ✔ Broadly realistic statistics.

### 7.7 Known exoplanets
- **Where:** `knownPlanet` (1055–1065). The game uses the real a, mass and radius. **Atmospheric pressure and water are random.**
- **Editions:** G and S.
- **Notes:**
  - ⚠/✘ README says "観測値のまま置く" ("placed exactly as observed"), but only the orbit and mass are real.
  - (probe, seed 1) **Proxima Cen d** (0.26 M⊕, 0.029 AU) is given 3.3 atm, 334 K, an ocean and **natives**.
  - GJ 667 C f is given a temperate surface with natives. GJ 667 C e has 56 atm.
  - There is no XUV / stellar-wind atmospheric escape for close-in M-dwarf planets.

### 7.8 Atmosphere and temperature model
- **Where:**
  - `atmosphere` (830–833): pressure ∝ (mass/radius/(Teq/255))·random. This is an ad-hoc "escape index".
  - `greenhouse` (835): ad hoc.
  - `classifySurface` (837–844).
  - Sol's bodies use real values (Venus 92 atm and 737 K are overridden) (949–976).
- **Editions:** G and S.
- **Notes:** ⚠ Heuristic. Tidal locking does not affect climate (no day/night contrast).

### 7.9 Tidal locking
- **Where:** `tidalLock = a < 0.25·M^(1/3)` AU (872). It is display only: "(潮汐固定)" (tidally locked) at 8204.
- **Editions:** G and S.
- **Notes:** ⚠ A rough criterion with no consequences. Mercury (0.387 AU) is correctly shown as not locked.

### 7.10 Gravity
- **Where:** `gravity = M/R²` (877). For giants it is labelled "重力(1気圧面)" (gravity at the 1-atm level) (8205).
- **Editions:** G and S.
- **Notes:** ✔

### 7.11 M-dwarf flares
- **Where:** `FLARES` (1351) is per star and comes from TESS light curves → Cliver 2020 → Papaioannou 2023 → GOES association → Geant4 surface dose. Used by `annualDose` / `radiationOf` (1389–1418). The UI row "地表の被曝 … (フレア x%・宇宙線 y%)" ("surface dose … (flares x%, cosmic rays y%)") is at 8210.
- **Editions:** **S only.**
- **Notes:**
  - ✔ Carefully derived.
  - ⚠ It assumes solar-like proton escape from M dwarfs, an assumption the docs acknowledge.
  - ⚠ Flares affect only dose and solar cells, not atmospheric loss or habitability over time.

### 7.12 Natives and alien nations
- **Where:**
  - Natives on lush or arid planets: `makeNatives` / `makeMoreNatives` (1213–1241), with tech levels stone age to **information age**.
  - Alien homeworlds for nation games: `planNations` (2085–2130).
  - `SPECIES_TRAITS` (1594–1606): aquatic, cryophile and so on.
- **Editions:** G and S.
- **Notes:**
  - ✘ (probe, seed 1) 11 inhabited worlds among 73 real systems, including an **information-age civilisation at Barnard's Star (6 ly)** and another at 11.4 ly.
  - This conflicts with present-day SETI and radio non-detections at such ranges, and with the Fermi paradox. "Detectable by telescope before contact" (2.8 k) makes it worse.

---

## 8. Colonisation biology and physics

### 8.1 Settleability
- **Where:** `settleability` (846–868). The comment says "ドーム/地下都市前提" ("assumes domes / underground cities"). Gravity is ideal at 0.7–1.3 g and ruled out above 2.5 g; temperature is scored in the 150–400 K window; pressure is scored; grades are 0–3.
- **Editions:** G and S.
- **Notes:** ⚠ Low gravity down to 0.1 g is fully settleable, with no health effects of long-term low or high g. Space stations hold 2 M people with no mention of spin gravity.

### 8.2 Radiation on the surface
- **Where:** `radiationOf` (1405–1418). The limit is 20 mSv/yr (ICRP occupational). The UI shows the soil cover needed (`cover/200` m at 2 g/cm³, 8210).
- **Editions:** **S only.**
- **Notes:**
  - ✔ The physics is careful.
  - ⚠ Its only gameplay effect is downgrading "earthlike" (grade 3) planets.
  - ⚠ G has no radiation at all.

### 8.3 Crew radiation during the voyage
- **Where:** `SHIELD.crewSv = 0.6` Sv per trip, the NASA career limit (1362–1369).
- **Editions:** **S only.**
- **Notes:**
  - ✔ The shielding mass is computed so that the dose stays at the limit (see 9).
  - ✘ G: unshielded 0.95c ships would deliver ~1 Gy/s (audit-A §2), lethal in seconds, and the game shows no consequence.

### 8.4 Population growth
- **Where:**
  - Growth: max 4%/yr logistic (`POP_GROWTH` 1689, formula at 5411).
  - Caps (`capOf` 3556–3563): home 12,000 M; earthlike 4,000 M; grade 2 800 M; grade 1 80 M; stations 2 M.
  - S caps growth at 4.2%. G is uncapped, with traits up to ×1.3.
- **Editions:** G and S (different caps).
- **Notes:** ⚠ Not physics. Caps do not depend on area, gravity or energy.

### 8.5 Food and water
- **Where:** 1 t of food per person per year (`UNIT_KG`, 1286). Water is 0.1 unit per 10⁶ people per year (≈100 kg per person per year) only on non-temperate worlds (5401–5402). Food is grown only on temperate or ocean surfaces (`fertility` 3565).
- **Editions:** G and S.
- **Notes:** ⚠ 100 kg/yr of water is far below drinking needs (~1 t/yr). Near-total recycling is implied but never stated.

### 8.6 Generation length
- **Where:** `GENERATION_YEARS = ED.generation`: **100 yr in G** ("寿命が延びた設定", "a setting with extended lifespans") versus 28 yr in S (1786–1792, `docs/reality-check.md`).
- **Editions:** G ≠ S.
- **Notes:** ⚠ A biological claim in G, used only to scale the secession hazard.

### 8.7 Terraforming
- **Where:** Mentioned only in a comment ("テラフォーミング前の状態を評価する", "evaluates the state before terraforming", 845). There is no terraforming mechanic.
- **Editions:** —
- **Notes:** ✔ No claims are made.

### 8.8 Plague, accident and refugee events
- **Where:** `STORY` (1879–1982).
- **Editions:** G and S.
- **Notes:** See 2.8 i/j for the faster-than-light aspects. Otherwise not physics.

---

## 9. Interstellar medium, dust and shielding (sim edition)

### 9.1 ISM density
- **Where:** `ISM.nNuc = 0.1142` nucleons/cm³ (1329). It is built from Linsky+2019 H I columns plus LIC/Slavin & Frisch values plus dust (`docs/physics.md` §3).
- **Editions:** S (the constant also exists in G, which does not use it).
- **Notes:** ✔ Well sourced. There is no directional dependence, which the docs justify (only ln dependence).

### 9.2 Frontal shield against interstellar nucleons
- **Where:** `SHIELD_DOSE` comes from Geant4 FTFP_BERT depth–dose tables in water ice. Front thickness: about 14 m of water for cargo and about 28 m for crew. `shieldOf` 1446–1477, `shieldShape` 1437–1444.
- **Editions:** S.
- **Notes:**
  - ✔ The fluence is correctly treated as frame-invariant (n·L).
  - ✔ The 34.5 kW/m² frontal heating quoted in the comments is correct in the ship frame (γ·n·v·(γ−1)m_p c²).

### 9.3 Galactic cosmic rays on the side walls
- **Where:** `SHIELD_GCR` uses the Vos & Potgieter 2015 spectrum transformed to the ship frame with aberration, and scales with proper time `tau` (1325, 1358).
- **Editions:** S.
- **Notes:** ✔ Correct relativistic treatment (I/p² invariant). This is one of the few places that uses aberration.

### 9.4 Dust
- **Where:** Dust is folded into the nucleon count (0.3%) as "核子の集まりとして" ("as a collection of nucleons") (1323, `docs/physics.md` §0 and §3).
- **Editions:** S.
- **Notes:** ⚠ Fine for average dose. **Discrete grain impacts** (a 1 µg grain at 0.95c ≈ 2×10⁸ J ≈ 50 kg TNT, audit-A §2) and the resulting **erosion or ablation of the shield** are not modelled.

### 9.5 Frontal heat and gas drag
- **Where:** Explicitly excluded with numbers: heat needs ~0.3% radiator mass, and drag is 10⁻⁹ of momentum (1326, `docs/physics.md` §0).
- **Editions:** S.
- **Notes:** ✔ Documented order-of-magnitude dismissal.

### 9.6 Game edition has no shielding
- **Where:** `shieldOf` returns `kg: 0` when `!ED.physics` (1447).
- **Editions:** G.
- **Notes:** ✘ The same 0.95c ships are physically lethal and unprotected. The UI says nothing.

### 9.7 Solar-cell proton damage
- **Where:** `PV_DAMAGE`, `PV_DESIGNS` and `pvRemaining` (1334–1347, 1398–1404). Uses NRL displacement-damage dose, SR-NIEL and the Walters 2004 fit.
- **Editions:** S.
- **Notes:** ✔ Validated against GEO data (0.80%/yr versus 0.44–1.03%/yr measured).

---

## 10. Text and flavour making physical claims

- **"光速"** (light speed) appears in many UI strings. All describe light-speed messaging, and the messaging mechanics agree with them except where noted.
  - Locations: 476, 502, 1761 (`GOVERNOR_NOTE` "要求は光速で地球へ届き、返事も光速で戻る", "demands reach Earth at light speed and replies return at light speed"), 7886, 7915, 8105, 8489, 8906, 8945, 8962, 9631.
  - ⚠ The README line "講和の申し出は光速で届く" ("peace offers arrive at light speed") holds for the *human's* offer (`peace` command 5976). AI offers and conferences break it (2.8 c).
- **"0.95c / 0.9c"**: 7978, 8379, 4941 and README 57–59. ✔ These match the constants.
- **"見かけの位置"** (apparent position) in the legend at 508: ✔ correct (retarded positions).
- **"地球に届いている光で描く"** (drawn with light that has reached Earth): correct relative to the *capital*; "地球" (Earth) is wrong when the player's capital is elsewhere.
- **"ハビタブルゾーン"** (habitable zone), **"雪線"** (snow line), **"潮汐固定"** (tidally locked), **"表面重力 / 重力(1気圧面)"** (surface gravity / gravity at the 1-atm level), **"大気圧 / ほぼ真空 / 真空"** (pressure / near vacuum / vacuum), **"平衡温度"** (equilibrium temperature): in the body panel 8195–8211 and candidates sheet 9018–9027. ✔ Correct terms.
  - ⚠ The candidates header says "ハビタブルゾーン内の未入植の天体" ("unsettled bodies in the habitable zone"), and the filter is `inHZ`, which is OK. The distance column is labelled "最寄りの入植地から" ("from the nearest colony") but is computed from the **capital** (8991–8992, 9027). That is a text/mechanics mismatch.
- **"地表の被曝 … mSv/年 (フレア…・宇宙線…)"** ("surface dose … mSv/yr (flares…, cosmic rays…)") at 8210 and **"星間の気体と宇宙線の遮蔽 (10 光年・0.95c)"** ("shielding against interstellar gas and cosmic rays (10 ly, 0.95c)") at 9068: S only, ✔.
- **"視察団を送る…届くまで X 年 (光の遅れ)"** ("send an inspection team … arrives in X years (the light delay)") and **"医療団を送れば、届いた時点で収まる"** ("if you send a medical team, the plague stops when it arrives"): people arriving at exactly light speed (✘, 2.8 j).
- **"先住民の有無・文明は天体観測で入植前から分かる"** ("whether natives exist, and their civilization, is known from astronomical observation before settlement"), comment at 3534: ⚠ (2.8 k).
- **"艦隊戦は時間をかけて進み (ランチェスターの法則…)"** ("fleet battles proceed over time (Lanchester's law…)") at 8543: ⚠ a historical/operations model, not physics.
- **"宇宙海賊"** (space pirates) at 4644 and 4655: ✘ no physical origin (5.5).
- **"異星の難民船が太陽系に現れ"** ("an alien refugee ship appeared in the Solar System") at 1913: ⚠ the arrival is unannounced. A 0.9c ship would be seen ~0.1 yr per ly beforehand at most, so this is plausible. The *transfer* is instant (✘ 2.8 i).
- **"古い漂流船が見つかった"** ("an old derelict ship was found") at 1885: fine.
- **Tagline "光速の壁の向こうへ広がる恒星間植民"** ("interstellar colonization spreading beyond the light-speed barrier") at 9631: ✔ no FTL implied.
- **Grep results:** no hits for ワープ (warp), 超光速 (faster than light), ワームホール (wormhole), ブラックホール (black hole), 中性子星 (neutron star), 超新星 (supernova), 爆発 (explosion), 音 used for sound, 重力波 (gravitational waves), 人工重力 (artificial gravity), 冷凍睡眠/冬眠 (cryosleep/hibernation), or テラフォーミング (terraforming) as a mechanic.
- **"時間"** (time) appears only in the play-log UI (real-time minutes and hours, 9469).
- **"宇宙線"** (cosmic rays), **"放射線"** (radiation), **"被曝"** (dose) and **"光行差"** (aberration) appear only in S physics UI and comments.

---

## 11. Internal inconsistencies (consolidated)

1. **Deceleration energy:** destination-laser braking is charged the same as acceleration. It should be ~16% of it at 0.95c (23% at 0.9c), so it is overcharged ×6.2 / ×4.4. See `propulsion` 1316 and `docs/energy.md`; the UI repeats it at 9066. Both editions.
2. **Game-edition kinematics:** instant 0→0.95c and instant redirect reversal, while S models 1g acceleration. Both editions show the same "0.95c".
3. **S: magsail braking at 1g** contradicts magsail physics (4.4).
4. **S: arrival-time UI omits acceleration:** galaxy hover "船 a〜b 年" (ship a–b years, 7159) and the troop message (4941, `route.years`). Other displays include it.
5. **Redirect intercept computed from Sol, not the player's capital** (4162 versus `from: this.cap`).
6. **The map legend (508) says "地球に届いている光"** (light that has reached Earth), but the code measures delay from the player's capital (`this.cap`). Other notes use `ME.home` correctly, for example shipsHtml at 8420.
7. **Candidate sheet:** the "最寄りの入植地から" (from the nearest colony) header versus the capital-based distance (8991, 9027, 9031 note).
8. **Laser energy supplied by the capital to fleets far away or in mid-space**, with no beam delay (5297–5306, 4213).
9. **Multi-leg 0.95c paths turn at waypoints** with no Δv booked. The shielding length uses the straight line, not the path.
10. **Settlers:** the energy uses one speed (0.95c if the path has more than 2 nodes) and always 'free' mode, while the trip actually mixes 0.95c and 0.9c legs (3794–3797, 3790).
11. **Sol's Dyson swarm reaches ~99% coverage by ~2350** (and sits at 1 AU in S), but Earth's climate, farming and habitability are unaffected.
12. **Negative energy reserves are allowed** for fleets and troops.
13. **Faster-than-light information or matter** (2.8 b–m): ship/fleet lists, peace offers and conferences, rally, trade and procurement and migration AI, realm-wide war score, refugees teleported, inspection and medical teams at c, and natives known before contact.
14. **README "観測値のまま置く"** ("placed exactly as observed") versus random atmospheres and oceans on known exoplanets (Proxima d with 3.3 atm, ocean and natives).
15. **System view:** orbital phases are "now" while system data is light-delayed.
16. **S: proper time `tau` for short routes** falls back to the cruise formula, underestimating crew cosmic-ray dose. The comment at 1453 says ship time "runs faster" during acceleration (misleading).
17. **`incoming(id)` counts enemy fleets** heading to a system as friendly reinforcements (4472).
18. **War start is instantaneous and global** (`atWar`), while the war's end is light-limited (`fightingAt`). The asymmetry lets a fleet that was dispatched before the declaration could have reached it fight on arrival.

---

## Appendix: numbers used above

- **Lorentz factors:** γ(0.95) = 3.203 and γ(0.9) = 2.294. A 20 ly trip at 0.95c takes 21.05 yr in the Earth frame and 6.57 yr of proper time.
- **Kinetic energy of one fleet** (1.6×10¹¹ kg at 0.9c): (γ−1)mc² = 1.86×10²⁸ J ≈ 4.4×10¹² Mt TNT. For comparison:
  - Boiling Earth's oceans takes ≈3.6×10²⁷ J.
  - Chicxulub ≈ 4×10²³ J.
- **Kinetic energy of one cargo unit** (10⁹ kg at 0.95c): 1.98×10²⁶ J.
- **Laser light needed** (in units of mc²/2):
  - Acceleration: γβ+γ−1 = 5.245 at 0.95c and 3.359 at 0.9c.
  - Deceleration toward the laser: γβ−γ+1 = 0.840 at 0.95c and 0.770 at 0.9c.
- **Swarm coverage** (G): f(t) = 1/(1+9e^(−0.1386 t)) from 0.1 in 2300 gives 0.5 in 2316, 0.9 in 2332 and 0.99 in 2349.
- **Probe of the real galaxy** (seed 1, both editions identical except radiation):
  - 73 systems; primaries M 49, K 11, G 6, WD 5, A 1, F 1.
  - 28 known planets, 2 grade-3 worlds and 11 native civilisations, including tech 3 (information age) at Barnard's Star (6.0 ly) and at 11.4 ly.
- **Map flattening:** mean nearest-neighbour distance is 6.27 ly on the ±2 ly map versus 4.44 ly for the full ±17 ly table.
