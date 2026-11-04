# Steam store page draft (English)

Written 2026-11-04 (round SO4, B-077) from `store/page-ja.md` after checking it against the current game (main `075f1c8`; the check is in section 8 of the Japanese page). Terms follow the glossary (`docs/glossary/terms.json`) and the in-game English table (`src/outward/lang-en.js`). **This is Claude's draft. A professional proofreader reviews it before the page goes public** (QD-73 = a; what to hand over is in section 6).

Rule (same as the Japanese page): write from the design pillars (`docs/design-pillars.md`), and **do not describe anything that is not in the current game edition**.

---

## 1. Name

**NoLongerUbiquitous**

(Subtitle: "Interstellar colonization beyond the light-speed barrier" — the same line as the home screen in English.)

## 2. Short description (top of the store page; Steam allows a few hundred characters)

> Orders and news travel no faster than light. As Earth Government, colonize 142 real nearby star systems and choose how your dependencies are governed, where trade routes run, and when to make war or peace — from reports that arrive decades late. Secession risk is calibrated on 131 historical dependencies.

(about 300 characters)

## 3. About this game

### Govern beyond the light delay — with institutions, not orders

The year is 2300. Self-replicating industry and Dyson swarms have made humanity's economy explode. Ships fly at 90% of the speed of light. Space is still too big. A directive sent to a colony 20 light-years away arrives 20 years later, and news of what happened there takes another 20 years to reach Earth.

You are Earth Government. Instead of moving every system by hand, you decide how much to delegate to distant governments, and you design the institutions and the flows of energy and matter.

### Governance that arrives late

- Give each colony a form of rule taken from historical dependencies: tributary states, protectorates, princely states, dominions, mandates, chartered company territories, puppet states, satellite states, personal unions, Han domains of Tokugawa Japan, medieval vassals and more — 19 types, plus direct-rule colonies (including forced labor under the encomienda).
- Every type splits sovereignty into 8 bundles (diplomacy, military, taxation & tribute, law & courts, appointment of rulers, trade, religion & culture, succession), and tracks who holds each one on two layers: the treaty on paper and the de facto balance of power. When loyalty falls, the local elite resists and reality drifts away from the treaty. You can renegotiate the bundles one at a time.
- Tighten your grip and resistance grows; loosen it and they drift away. Secession risk and the share of independence movements that turn into wars come from a survival analysis of 131 historical dependencies and from colonial independence data (ICOW). Each type has a "sources" panel with period terms, cases, primary sources and the scholarly debate.
- Inside each system live groups that differ by class, ethnicity and values; each form of rule gives them different access to power.
- Directives cost political capital, more for distant systems. Before sending one, you can check how many years it will take to arrive and what to expect when it does. Leave a policy with your governors, and they will decide on the spot instead of asking Earth.

### Other nations think inside the same light delay

- Start as one of 4 to 8 nations, each with its own species and traits. The AI runs the others, and AI nations, too, decide only from the records that have reached their capitals.
- Non-aggression pacts, defensive alliances and trade pacts take effect where and when the reply arrives at light speed. AI nations decide war, peace and pacts from the balance of threat (balancing or bandwagoning), the favors and grudges they remember, their leaders' careers, and the council and factions at home — and they show you the reasons.
- Before declaring war, a nation may show its fleet and demand systems or funds. Give in, or refuse and fight.

### An economy of light and matter

- See 142 real nearby stars (from the CNS5 catalogue, out to about 54 light-years from the Sun, at their true positions) on a 3D star map you can rotate and tilt. Planets that have been observed keep their observed values. You can also play in a generated galaxy.
- Trade routes are lanes with a laser launch station and a deceleration facility at each end. Cargo goes where price and interest over the years in transit say it should.
- Energy is booked like money, and matter and energy are conserved (nothing appears from nowhere or vanishes). Crewed ships carry shielding against interstellar gas and cosmic rays, and acceleration and deceleration take years.
- Population ages year by year, and as incomes rise people move from farming to industry and from industry to services. Researchers raise the level of technology, but ideas get harder to find.
- Set tax rates, consumption tax, tariffs, interest rates, budgets and government bonds with sliders whose ranges come from values real countries have used. There is a central bank, too.

### History you can explain

- Independence, wars and peace come with a breakdown of their causes. Read why it happened, then try different institutions next game.
- Wars run on war exhaustion and war score, and end in a peace conference where you choose terms. Fleet battles are resolved ship by ship, with a report of the odds and the losses. Systems can build space fortresses. A fleet near the speed of light can become a strike that cannot be stopped.
- Both the start and the end of a war spread only at the speed of light. Even after peace is signed, distant fleets keep fighting until the news reaches them. At the end of each 100-year era, a review lays the history Earth saw next to the history that really happened.

### How it plays

- Choose a match of 100, 300 or 500 years (2300–2800). An era objective appears every 100 years. Speeds run from one month to 64 years per second, and "until next news" skips quiet stretches.
- Start with challenges (60 Systems, No Independence, Unification, Expedition) and one of 4 difficulty levels if you like.
- Play alone, take turns on one device (hot seat), or play an online match (devices connect directly, with no server).
- Available in Japanese and English.

## 4. Feature list (short; next to images and in event posts)

- Orders and news at light speed. Govern from reports that arrive decades late
- 19 historical types of dependency, plus colonies. Bundles of sovereignty, on paper and de facto
- Secession risk from data on 131 dependencies
- A 3D map of 142 real nearby stars
- AI nations that think inside the same light delay: pacts, alliances, coercion, and their reasons
- An economy that conserves energy and matter. Trade driven by price and interest. Research and structural change
- Independence, wars and peace with explained causes. A review at the end of each era
- Hot seat and online matches

## 5. Notes for the proofreader (QD-73 = a)

- Keep the glossary terms (`docs/glossary/terms.json`, `en` column) unless the proofreader proposes a better one for the whole game; if a term changes, it changes in the glossary and in `src/outward/lang-en.js` together (the glossary check `node docs/glossary/check.mjs` keeps them aligned).
- Terms the store text uses that the glossary does not yet have: coercion (`威圧`), space fortress (`宇宙要塞`), light-speed strike (`光速の一撃`), review (`答え合わせ`), central bank (`中央銀行`). The in-game English uses "coercion" and "Light-speed strike" already.
- Sensitive history: the regime types include Manchukuo and the Wang Jingwei regime (puppet states), Tibet and Outer Mongolia, Eastern European satellite states and Korea; the store text does not name them, but the in-game "sources" panels do (Japanese page, section 6).
- Content survey answers (slavery and forced labor in text, AI-generated text, image credits) are in the Japanese page, section 6; they apply to the English page as well.

## 6. What to hand to the proofreader

| What | Where |
|---|---|
| This page (store text) | `store/page-en.md` |
| The game's English table (about 2,700 keys; Japanese key → English) | `src/outward/lang-en.js` |
| The glossary (319 terms with `ja`, `en`, notes) | `docs/glossary/terms.json` (how to read it: `docs/glossary/README.md`) |
| How translation works in the game (what keys look like, `{0}` placeholders, HTML tags) | `docs/i18n.md` |
| A playable build in English | `index.html?lang=en` (game) and `demo.html?lang=en` (demo, the first era only) on the published page |
