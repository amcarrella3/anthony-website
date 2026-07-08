# GENERATE — the morning playbook

This is the script the daily routine runs. When the scheduled session wakes,
its whole job is to follow this file. It is written for an agent (you), not a
shell. Everything you need is in `brief/config.json`; this file tells you what
to *do* with it.

> One-line mission: **read the config, scan each enabled module with fresh eyes,
> assemble one honest, beautiful brief, publish it to the web, and deliver it.**

---

## 0. Load the control panel

1. Read `brief/config.json`. It is the single source of truth. Note:
   - `owner` (voice, timezone) — write in this voice.
   - `format` (caps, recency window, read-time target).
   - `modules[]` — each has `queries`, `sources`, `lenses`, `agentBrief`.
   - `personalContext` — calendar + inbox (private).
   - `layout.sections[]` — the exact order + kinds of the output.
   - `delivery` — which channels are on.
   - `guardrails` — non-negotiable.
2. Compute today's date in `owner.timezone` (format `YYYY-MM-DD`). Call it `DATE`.
3. Skip any module or section with `enabled: false`.

## 1. Scan — one agent per enabled module (fan out)

For each enabled module, spawn a scanner agent (use the `Agent` tool, or a
`Workflow` with one stage per module — see "Scaling" below). Give the scanner:

- The module's `agentBrief`, `queries`, `lenses`, and `sources`.
- The `guardrails` (sources policy, verification, tone).
- `format.maxItemsPerModule`, `format.recencyWindowHours`.

Each scanner must:

1. **Resolve its sources to real tools.** `kind: "web"` → `WebSearch` +
   `WebFetch`. `kind: "mcp"` with a `capability` → find the live MCP tool for
   that capability with `ToolSearch` (connector IDs change; match by capability,
   not by a hard-coded name). Capabilities used here: `whitney`, `spotify`,
   `gmail`, `google_calendar`, `slack`. `kind: "rss"` → `WebFetch` the feed URLs.
2. **Search broadly, then narrow.** Run the queries, open the promising results,
   read enough to summarize honestly. Prefer primary/reputable sources per the
   guardrails. Respect the recency window (older items only if evergreen).
3. **Verify** anything surprising or consequential against a second source.
   Mark confidence (`confirmed` / `reported` / `unconfirmed`).
4. **Return** up to `maxItemsPerModule` items as JSON matching the `items`
   shape in `brief/schema/brief.schema.json` — each with `lens`, `headline`,
   `body`, optional `why` (why it matters to Anthony), and a real `source`
   (name + url). Whitney items should carry the artwork `image` + `credit`.
5. Also return 0–2 **radar** candidates: things worth watching but not acting on
   today (feed the `radar` section).

Run scanners in parallel. If a scanner fails or a connector is offline, continue
without it and note the gap — never block the whole brief on one source.

## 2. Personal context (private)

If `personalContext.enabled`:
- **Calendar**: via the `google_calendar` MCP, list today's events (+ notable
  tomorrow). Summarize as a clean agenda (`agenda` section items: `lens` = time,
  `headline` = event).
- **Inbox**: via the `gmail` MCP, surface only threads that genuinely need
  attention today (unanswered asks, time-sensitive). Cap at `inbox.maxItems`.
- Mark the whole `agenda` section `visibility: "private"`. It will be included in
  email/Slack delivery but stripped from the public web artifact.

If a connector isn't authorized, skip that piece gracefully.

## 3. Assemble the brief

Build one JSON document conforming to `brief/schema/brief.schema.json`:

- Walk `layout.sections[]` in order. For each entry, produce the matching
  section object (`kind`, `title`, plus `id`/`accent` from the module for
  `module` sections; carry the module `glyph`/`accent`).
- **`headline`**: after scanning, write the single most important or most alive
  thing across everything today, in one or two sentences. This is the through-line.
- **`serendipity`**: the one wide, wonderful thing.
- **`radar`**: merge the scanners' radar candidates (dedupe).
- **`on_this_day`**: one well-sourced historical note for `DATE`.
- **`epigram`**: a short closing quote/line fitting the voice (attributed).
- If `format.dedupeAcrossModules`, drop duplicate stories across modules (keep
  the best-placed one).
- Set `title`, `subtitle` (from `format`, expand `{longdate}`), `date`,
  `generatedAt`, `readMinutes` (estimate), and `meta` (`generator`,
  `modulesRun`, `sourcesConsulted`).

Keep it tight: aim for `format.totalReadMinutesTarget`. Signal over volume.

## 4. Publish — the web artifact (always on)

Into `delivery.web.publishDir` (`static/brief/data/`):
1. Write `DATE.json` (the full document).
2. Overwrite `latest.json` with the same content.
3. Update `index.json`: prepend `{ "date": DATE, "label": <short headline> }` to
   `briefs` (newest first); don't duplicate an existing date.
4. If `delivery.web.commitAndPush`, commit these files to `main` with a message
   like `Daily Brief: DATE` and push. GitHub Pages redeploys →
   the brief goes live at `delivery.web.liveUrl`. (During development, publish to
   the working branch and open/refresh the PR instead of pushing to `main`.)

## 5. Deliver — the other channels (each if enabled)

- **email** (`delivery.email`): render the FULL brief (including private
  sections) as clean HTML with a link to the live URL. `mode: "draft"` → create
  a Gmail draft to `to`. `mode: "send"` → send it. Use the `gmail` MCP.
- **slack** (`delivery.slack`): post headline + one highlight per section + the
  live link as a self-DM via the `slack` MCP.
- **pdf / screenshots / thymer**: see `brief/exporters/README.md`. Off by default.

Deliver only what's enabled. Report a one-line summary of what was published and
sent (and anything skipped) at the end.

## 6. Guardrails (always)

- Sources must be reputable and nameable, with links. No sketchy aggregators, no
  engagement bait, no unverified rumor laundered into fact.
- Personal context never appears in the public web artifact.
- Tone: constructive, curious, humane. No doom-scroll. Leave him more oriented
  and a little more alive to the world.
- If you can't verify something, say so or leave it out.

---

## Scaling the scan (optional, for a richer brief)

The simple path is one `Agent` per module. For a deeper daily brief, drive it
with a `Workflow`: a `pipeline` where stage 1 is "scan module" and stage 2 is
"verify each item against a second source," so verification for one module runs
while another is still scanning. Use `parallel` only where you truly need all
results at once (e.g. cross-module dedupe before assembly). Keep the per-module
`agentBrief` as each scanner's system framing.

## Doing this by hand

You can run a brief any time without waiting for the schedule: open a session and
say *"generate today's brief"* (or run the routine's prompt). Same playbook.
