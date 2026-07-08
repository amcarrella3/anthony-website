# The Daily Brief

A modular, multi-agent morning briefing. Every day, a scheduled routine sends a
small fleet of agents to scan the corners of the world you care about — faith,
the arts, civic life, technology, and one wide serendipitous thing — verifies
what they find, assembles it into one beautiful, honest brief, publishes it as a
**live web artifact** on your own site, and (optionally) drops it in your inbox
or Slack.

It is built so **you** can change what it watches, how it reads, and where it
goes — mostly by editing one JSON file, no code required.

```
brief/
  config.json          ← THE CONTROL PANEL. Edit this.
  GENERATE.md          ← the playbook the morning routine follows
  README.md            ← you are here
  schema/
    brief.schema.json  ← the shape of one day's brief (generator ↔ renderer contract)
    config.schema.json ← the shape of config.json
  exporters/
    README.md          ← web / email / slack / pdf / screenshots / thymer

static/brief/          ← the live web artifact (served at anthonymichael.work/brief/)
  index.html
  css/brief.css
  js/app.js            ← data-driven renderer; dispatches on each section's `kind`
  data/
    index.json         ← list of published briefs (newest first)
    latest.json        ← most recent brief
    YYYY-MM-DD.json     ← one file per day (the archive)
```

## The three knobs you'll actually turn

### 1. What it watches — `config.json → modules[]`
Each module is one domain the agents scan. To tune it, edit its:
- **`queries`** — the exact search strings the scanner runs. This is "the queries
  underpinning the search." Add, remove, rewrite freely.
- **`sources`** — where it looks: `web`, an `rss` feed list, or an `mcp`
  capability (`whitney`, `spotify`, `gmail`, `google_calendar`, `slack`).
- **`lenses`** — what you want *extracted* (e.g. "one idea to sit with").
- **`agentBrief`** — the standing instruction that shapes that scanner's taste.
- **`enabled`** — flip a module off without deleting it.

Add a whole new interest area by copying a module block and giving it a new `id`,
`label`, `glyph`, and `accent` (`ember`/`gold`/`verdigris`/`bronze`/`ichor`),
then add a `{ "kind": "module", "from": "<id>" }` line to `layout.sections`.

### 2. How it's shaped — `config.json → layout.sections[]`
The brief is assembled from this ordered list. Reorder it, drop a section, or add
one. Each entry's `kind` maps to a renderer in `static/brief/js/app.js`
(`masthead`, `headline`, `agenda`, `module`, `serendipity`, `radar`,
`on_this_day`, `epigram`). To invent a genuinely new *kind* of section, add a
renderer of the same name in `app.js` and a matching branch in the generator's
output — the schema's `kind` enum lists the current set.

### 3. Where it goes — `config.json → delivery`
- **`web`** (on): writes the JSON and pushes, so the brief goes live at
  `/brief/`. This is the always-on canonical output.
- **`email`** (off): a Gmail draft (or send) with the full brief + link.
- **`slack`** (off): a self-DM with highlights + link.
- **`pdf` / `screenshots` / `thymer`** (off): see `exporters/README.md`.

Turn any channel on by setting `enabled: true` (and authorizing the connector).

## Export targets — one brief, many forms

The brief JSON is the canonical form; every export is a *rendering* of it, so new
formats never require re-gathering:

| Target | Status | How |
| --- | --- | --- |
| **Live web artifact** | ✅ built | `static/brief/` reads the JSON; push → GitHub Pages |
| **PDF** | ⚙️ ready | the web page has a print stylesheet — "Save as PDF" works today; headless-Chromium automation documented in `exporters/` |
| **Email (HTML)** | 🔌 wire-up | Gmail connector + `delivery.email` |
| **Slack** | 🔌 wire-up | Slack connector + `delivery.slack` |
| **Screenshots** | 📐 planned | headless Chromium per-section capture — `exporters/` |
| **Thymer note** | 📐 planned | Markdown drop-in now; API when a Thymer connector exists — `exporters/` |

## Scheduling

The routine is a scheduled trigger (a "Routine") that wakes a session at
`schedule.cron` in your timezone and hands it `GENERATE.md`. To change the time,
edit `schedule` here **and** update the Routine (in the app's Routines/Automations
UI, or ask in a session: *"change my daily brief to 7am"*). To pause it, disable
the Routine or set `schedule.enabled: false`.

## Running it by hand
Open a session and say **"generate today's brief."** It follows the same
`GENERATE.md`. Good for testing a config change before the morning run.

## Privacy & trust
- Personal context (calendar, inbox) is marked `visibility: private` and is
  **stripped from the public web page** — it only rides along in email/Slack.
- Sources are held to the `guardrails` in config: reputable, nameable, linked;
  surprising claims cross-checked; uncertainty labeled, not laundered.
- The site is `noindex` and the brief page inherits that.
