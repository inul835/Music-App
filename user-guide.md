# Hum — User Guide (Google Drive edition)

*Your private music player, powered by Google Drive. No server code, no database, no credit card.*

**Version 2.0** · This edition replaces the earlier Cloudflare R2 version. The biggest change: **you no longer upload music through the website.** You drop files into a Google Drive folder using the Drive app you already have, and the website discovers everything automatically.

---

## 1. What changed from the R2 version

| | v1 (Cloudflare R2) | v2 (Google Drive) |
|---|---|---|
| Music upload | Through the website (drag & drop drawer) | Directly in the Google Drive app |
| Server code | Vercel Serverless Functions (`/api/*`) | **None** — the site is 100% static |
| Secrets | R2 access keys in Vercel env vars | **None** — only a public, restricted API key |
| Database / manifest | `metadata.json` in the bucket | **None** — names + embedded tags are read automatically |
| Album grouping | Manual `albumId` tags | Automatic: Drive **subfolders** or ID3 album tags |
| Cost | R2 storage + Class B ops | Free (15 GB Drive quota) |
| Credit card | Required by R2 | **Not required** |

Removed on purpose: the upload drawer, the auth-token API, and the metadata editor — Drive itself is now your upload and organization UI. Everything else (queue, shuffle, albums, search, lock-screen controls, background playback) is still here.

## 2. How it works (60-second version)

1. You keep a music folder on Google Drive, shared as **“Anyone with the link · Viewer.”**
2. The website (static files on Vercel) calls the official **Drive API v3** with an **API key** to list that folder and to stream files straight from Drive to your browser.
3. The app reads each file’s **embedded ID3/MP4/FLAC tags** (title, artist, album, cover art) and falls back to parsing the **file name** (`Artist - Title.mp3`). Nothing to fill in, ever.

```
Google Drive folder ──► Drive API v3 (list + stream) ──► Browser app (single HTML file)
        ▲                                                        │
        └── you add music with the Drive app          localStorage + IndexedDB caches
```

Your music never passes through Vercel. Vercel only serves the HTML file.

---

## 3. Step-by-step setup (≈10 minutes)

### Step 3.1 — Create the music folder in Drive

1. Open [drive.google.com](https://drive.google.com) (or the Drive mobile app).
2. Create a folder, e.g. **`HumMusic`**.
3. Open the folder in the **web** browser and look at the URL:

   ```
   https://drive.google.com/drive/folders/1A2b3C4d5E6f7G8h9IjKlMnOpQrStUvW
                                         └────────── this is the FOLDER ID ──────┘
   ```

4. Copy that long string — it is your **`DRIVE_FOLDER_ID`**.

### Step 3.2 — Upload your music

Upload files into that folder using the Drive app (mobile) or drag-and-drop (web). Two supported layouts:

| Layout | Result |
|---|---|
| `Song.mp3` files directly in the folder | Listed under **Songs**; grouped as “Singles” unless their embedded album tag says otherwise |
| Subfolders per album, e.g. `Neon Skyline/01 - The Modulars - Aurora Drive.mp3` | Each **subfolder = one album** (subfolder name wins over the ID3 album tag) |

**File-naming cheat sheet**

```
01 - The Modulars - Aurora Drive.mp3     → track 01 · artist "The Modulars" · title "Aurora Drive"
The Modulars - Aurora Drive.mp3          → artist + title
Aurora Drive.mp3                         → title only, artist "Unknown Artist"
```

**Tips for a beautiful library**

- Keep **embedded cover art** in your files (most downloaders/rippers include it). The app extracts and caches it automatically — that’s what fills the album grid.
- Supported formats: **MP3, M4A/AAC, FLAC, WAV, OGG/OPUS** (anything Drive lists as audio).
- Leading track numbers (`01 …`) give you correct album ordering.
- FLAC/OGG cover art: MP3/M4A/FLAC tags are read automatically; for exotic formats the app falls back to filename parsing and a generated gradient cover.

### Step 3.3 — Share the folder (⚠️ the step everyone forgets)

The Drive API key can only reach files that are **link-shared**:

1. Right-click the **`HumMusic`** folder → **Share** → **Share…**
2. Under *General access*, change **Restricted** → **Anyone with the link**.
3. Make sure the role is **Viewer**. Done.

> If you skip this, the app will show “Access denied (403)” — that message is intentional and tells you the folder isn’t link-shared yet.

### Step 3.4 — Create a Drive API key

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project (any name, e.g. `hum-music`).
2. **APIs & Services → Library** → search **“Google Drive API”** → **Enable**.
3. **APIs & Services → Credentials** → **+ Create credentials → API key**. Copy the key.
4. **Restrict it** (click the pencil icon on the key):
   - **API restrictions** → Restrict key → tick **Google Drive API**.
   - **Website restrictions** → add your site URLs, e.g. `https://your-app.vercel.app/*` (and `http://localhost:*/*` if you test locally).
5. No billing, no credit card — Drive API quota for personal use is generous and free.

> The key ends up in the browser, so treat it as **public by design**: it can only *list and read* files that are already public on the internet (your link-shared folder), and the restrictions above stop anyone else from using your quota or embedding the key elsewhere.

### Step 3.5 — Configure the app

Open **`config.js`** and paste your two values:

```js
window.HUM_CONFIG = {
  DRIVE_FOLDER_ID: '1A2b3C4d5E6f7G8h9IjKlMnOpQrStUvW',
  API_KEY: 'AIzaSy…your key…',
  ACCESS_PASSWORD: '',   // optional
  APP_NAME: 'Hum'
};
```

### Step 3.6 — Deploy to Vercel

**Option A — GitHub (recommended for updates):**

1. Create a GitHub repo and commit this project folder to it.
2. On [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
3. Framework preset: **Other**. Leave build settings empty. **Deploy.**
4. Open your `https://<project>.vercel.app` — your library should appear.

**Option B — CLI:** `npm i -g vercel && vercel --prod` inside the project folder.

**Option C — any static host** works too (GitHub Pages, Netlify, Cloudflare Pages): upload `index.html` + `config.js` and you’re done. There is no backend to configure.

> **Important:** after deploying, add your final Vercel URL to the API key’s *website restrictions* (Step 3.4) if you restricted the key.

---

## 4. Daily use — adding music later

1. Add files (or a new album subfolder) to the Drive folder from **any device, using the Drive app**.
2. Open Hum → tap the **refresh icon** (or just reload the page).
3. New songs appear; covers and durations are extracted in the background and cached on your device.

You never edit metadata on the website again. Want to fix a misspelled title? Rename the file in Drive (or fix its ID3 tag with any tag editor) and rescan.

---

## 5. Features tour

| Feature | Where | Notes |
|---|---|---|
| **Background playback** | automatic | A single persistent audio element + Media Session API. Lock screen / notification shows cover, title, and scrubber (Android Chrome, iOS Safari). |
| **Shuffle** | Home “Shuffle all”, album/artist pages, Now-Playing toggle | Fisher–Yates index mapping — the queue’s original order is never destroyed; toggling shuffle keeps the current song in front. |
| **Queue** | Now Playing → queue icon | Jump to any track, remove tracks, clear queue. Survives page reloads. |
| **Albums & artists** | Library tab / search | Albums come from subfolders or ID3 album tags; covers from embedded art with generated gradient fallbacks. |
| **Search** | Search tab | Instant filtering across songs, albums, artists — everything happens locally after the one-time folder listing. |
| **Resume** | automatic | Last queue, track and position are restored (paused) on next visit. |
| **Password gate** | optional | Set `ACCESS_PASSWORD` in `config.js` for a light lock screen (per browser session). |
| **Demo mode** | `?mock=1` | Open `https://your-site/?mock=1` to preview the full UI with a fake library — no Drive needed. |

---

## 6. Troubleshooting

| Symptom | Cause → fix |
|---|---|
| **“Setup needed”** on first open | `config.js` still has the placeholder values → paste real `DRIVE_FOLDER_ID` / `API_KEY`. |
| **“Access denied (403)”** | Folder not link-shared → redo Step 3.3. If the message mentions *referer*, add your site to the key’s website restrictions. |
| **“Drive API is not enabled”** | Enable the Google Drive API in Cloud Console (Step 3.4.2). |
| **“Folder not found” (404)** | Wrong `DRIVE_FOLDER_ID` (it must be the long ID from the folder URL, not the folder name), or the folder is still Restricted. |
| **“Drive quota reached”** | You hit the free daily quota (usually only from abuse/many users). Your key restrictions should prevent third-party use. |
| Library is empty but files are there | Files aren’t recognized as audio → keep normal extensions (`.mp3`, `.m4a`, …). Google Docs/Sheets/shortcuts are ignored on purpose. |
| Song plays but has wrong title/artist | The filename wins until tags arrive; rename the file or fix its ID3 tag in Drive, then rescan. |
| No cover art | The file has no embedded picture, or the format’s tags can’t be read in-browser → the app shows a generated gradient cover instead. |
| Album cover doesn’t match | Album covers use the **first track** that has art — embed the same picture in each track of the album. |
| Playback stops when screen locks | Normal on some iOS/Android battery savers → allow background activity for the browser; Hum requests audio focus via Media Session, which usually suffices. |
| Changes in Drive don’t appear | Tap refresh. The list is re-fetched every load; heavy caches (covers) update in the background. |

---

## 7. Security & privacy notes (honest version)

- **No secrets exist.** There are no private keys anywhere — the API key is public-by-design and restricted to the Drive API + your domains. Worst case exposure = someone streams your link-shared music.
- **Link-shared means link-accessible.** Anyone who obtains a file ID could fetch that file. This is the trade-off for credit-card-free, serverless streaming. If that ever bothers you, the R2 edition is the fully private alternative.
- **The password gate is a curtain, not a vault** — it hides the UI per session; the Drive folder permissions are the real boundary.
- **What’s cached on-device:** the file list, durations, and cover images (localStorage + IndexedDB). Clear them any time in **Settings → Cache**.

## 8. FAQ

**Does streaming count against my Drive storage?** Storage yes (files), bandwidth no — playback reads are free.

**Can I use several devices?** Yes — it’s just a website. Queue/position history is per device.

**Can friends use my URL?** Technically yes (the folder is link-shared). The API key’s referrer restriction keeps *other sites* from using your key, but anyone you give the link to can listen.

**Playlists?** Not yet — the queue + shuffle covers casual use. Albums are the organizational unit by design.

**Why no Google Apps Script?** It wasn’t needed: Drive API v3 + an API key does listing and range-based streaming directly from the browser, with none of Apps Script’s execution limits and URL-redirect fragility for large media files.

**Why no `metadata.json` anymore?** Embedded tags + filenames cover 99% of personal libraries, and having *zero* files to maintain was the whole point of the Drive edition.
