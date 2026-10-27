# HeartEcho Live

HeartEcho with three live rooms. Everyone who opens the same link shares one screen:

| Room | Page | What syncs |
|---|---|---|
| Letter Stamp Board | `module.html?m=stamps` | stamps (kept, max 300) and emotes (one-time events) |
| Postcard Corkboard | `module.html?m=notes` | postcards, each property is its own last-writer-wins register |
| Stationery Sketch | `module.html?m=sketch` | lines streamed every ~30 ms, the finished list is handed to newcomers |

Rooms: `&r=<name>` picks a room, and the default is `main`. "Read together" on any letter opens `m=stamps&r=<letter id>`.

## How it runs (free Cloudflare account)

- **Worker** (`src/worker.js`) serves `/public` as static assets and upgrades `/ws/<module>/<room>` to a WebSocket.
- **Durable Object `Room`**: one per module + room. It relays messages, assigns names and colors, and asks the longest-standing participant to hand each newcomer a snapshot. Nothing is written to storage.
- It uses the WebSocket Hibernation API, so idle rooms cost nothing. On the free plan, Durable Objects must be SQLite-backed (`new_sqlite_classes` in `wrangler.jsonc`).
- Free-plan budget: about 100,000 requests a day, and 20 incoming WebSocket messages count as 1 request. A class demo uses a small fraction of that.

## Run it locally

Requires Node.js 18+.

```bash
npm install
npm run dev          # http://localhost:8787
```

Open `http://localhost:8787/together.html`, enter a room, then choose **Room ▾ → One more in a new tab**.

Opening `index.html` straight from the folder still works for the letters. The rooms show "Local preview", because live sync needs the Worker.

## Deploy

```bash
npx wrangler login   # opens the browser once
npm run deploy       # → https://heartecho-live.<your-subdomain>.workers.dev
```

## Files

```
public/index.html, styles.css, script.js   original site + Together section, nav link, "Read together"
public/together.html                       room list
public/module.html                         room page: room bar, stage, sidebar (source case + sync rules)
public/together.js / together.css          shared realtime client, room bar, theme sync
public/modules/stamps.js | notes.js | sketch.js
src/worker.js                              Worker + Room Durable Object
wrangler.jsonc
```
