# Exporters — one brief, many forms

The brief JSON (`static/brief/data/YYYY-MM-DD.json`, shape in
`../schema/brief.schema.json`) is the **single canonical form**. Every export is
just a rendering of that document, so adding a format never means re-gathering
the news. Each exporter is toggled in `../config.json → delivery`.

## web — the live artifact ✅ built
`static/brief/` is a self-contained app that fetches the JSON and renders it.
Publishing = write `latest.json` + `YYYY-MM-DD.json`, update `index.json`, commit,
push. GitHub Pages redeploys and it's live at `https://anthonymichael.work/brief/`.
Deep-link a day with `?date=YYYY-MM-DD`. This is the reference renderer; keep it
in sync with the schema.

## pdf ⚙️ ready
Two paths:
1. **Manual (works today):** the web page carries a `@media print` stylesheet
   (light theme, section break-avoidance, chrome hidden). Open the brief →
   Print → Save as PDF.
2. **Automated:** Chromium is pre-installed in this environment
   (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). An exporter can drive it
   headless against the live (or a locally-served) URL:
   ```js
   // pdf.mjs — sketch
   import { chromium } from 'playwright';
   const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
   const p = await b.newPage();
   await p.goto(`https://anthonymichael.work/brief/?date=${DATE}`, { waitUntil: 'networkidle' });
   await p.pdf({ path: `brief-${DATE}.pdf`, printBackground: true, format: 'A4' });
   await b.close();
   ```
   Then attach the PDF to the email/Slack delivery, or upload to Drive via that
   connector.

## email 🔌 wire-up
Set `delivery.email.enabled: true`, authorize the Gmail connector. The routine
renders the FULL brief (including `private` sections) as inline HTML — reuse the
palette from `static/brief/css/brief.css` inlined — with a link to the live URL.
`mode: "draft"` creates a reviewable Gmail draft; `mode: "send"` sends it.

## slack 🔌 wire-up
Set `delivery.slack.enabled: true`, authorize the Slack connector. Post the
headline, one highlight per section, and the live link as a self-DM (or to a
chosen channel via `target`). Slack's mrkdwn, not HTML.

## screenshots 📐 planned
Per-section PNGs for easy sharing (a card at a time). Same headless-Chromium
setup as PDF, but screenshot each `.section` element:
```js
for (const el of await p.$$('.section')) await el.screenshot({ path: ... });
```
Useful for posting a single section to social or a group thread.

## thymer 📐 planned
[Thymer](https://thymer.com) has no first-party connector here yet. Two paths:
1. **Now — Markdown drop-in:** render the brief as Markdown (trivial from the
   JSON: heading per section, bullet per item with a link) and write it to a file
   / Drive folder Thymer imports from. A `toMarkdown(doc)` helper is the whole job.
2. **Later — API/MCP:** when a Thymer API token or MCP connector is available,
   add a `thymer` capability and create a note per brief. Keep the Markdown
   renderer as the fallback.

---

### Adding a new exporter
1. Add a key under `delivery` in `config.json` with `enabled` + its options.
2. Teach `GENERATE.md` step 5 to call it when enabled.
3. Because it consumes the canonical JSON, you never touch the scanners.
