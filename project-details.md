# Hum · Project Details — Google Drive edition (v2.0)

*Architecture blueprint and engineering decision log. Companion to `user-guide.md`.*

---

## 1. Product summary

Hum is a private, personal music platform that turns a **link-shared Google Drive folder** into a polished streaming library. It is a **single static HTML file** (`index.html`) plus a user-editable config — there is **no server, no database, no upload pipeline, and no secret credentials**. Music is added to Drive manually (Drive app or web); the app discovers, tags, groups and plays it.

### Preserved feature set (from the v1 R2 platform)

- Queue-based playback with persistent, lock-screen-controllable audio
- Shuffle via random index mapping (original queue order never mutated)
- Repeat off / all / one
- Album grouping with responsive cover grid + album detail pages
- Artist grouping + artist pages
- Instant client-side search/filter (songs, albums, artists)
- Now-Playing sheet with scrubbing, marquee title, queue access
- Mini player with live progress hairline
- Resume-on-reload (queue, track, position, shuffle/repeat state)
- Optional password gate, settings sheet, snackbar system

### Removed (deliberate scope cut for the Drive edition)

- Upload drawer / drag-and-drop upload (Drive app replaces it)
- All Vercel Serverless Functions (`/api/*`) and HMAC auth tokens
- `metadata.json` manifest + its editor UI (tags + filenames replace it)

## 2. System architecture

```
┌────────────────────────────┐        ┌──────────────────────────────────┐
│ Google Drive (your folder) │        │ Static host (Vercel / any)       │
│  ├─ Song.mp3 …             │        │  index.html + config.js (single file) │
│  ├─ AlbumSubfolder/…       │        │  config.js (folder ID + API key) │
│  └─ shared: anyone w/ link │        └───────────────┬──────────────────┘
└─────────────┬──────────────┘                        │  fetch (CORS OK)
              │  list + alt=media (Range)             ▼
              └────────────► www.googleapis.com/drive/v3 ◄── API key (public, restricted)
```

**Data flow at runtime**

1. **Boot** → validate `config.js` (fatal-error card if unset) → optional password gate → stale-while-revalidate library load.
2. **List** → `files.list` on the folder (`'FOLDER_ID' in parents and trashed=false`, paged, 200/page) → subfolders listed in parallel (cap 40, one level deep) → each file inherits the subfolder name as its album.
3. **Build** → extension/mime filtering → filename parsing (`NN - Artist - Title`) → track objects with direct media URLs (`files/{id}?alt=media&key=…`).
4. **Render** → cached library paints instantly; fresh scan replaces it; albums/artists regrouped automatically.
5. **Background pipelines** → sequential duration probing via hidden `Audio(preload=metadata)` (localStorage cache) → tag+cover extraction via jsmediatags over HTTP range requests (IndexedDB cache, canvas downscale to 512px JPEG).
6. **Play** → browser streams directly from Drive (`alt=media` supports HTTP Range → seeking, lock-screen scrubber and iOS playback work).

## 3. Frontend design system

- **Style**: Google **Material Design 3** structure (tonal surfaces, pill navigation indicator, bottom sheets, state layers, MD3 slider) rendered in a **Spotify palette** (`#0b0b0d` base, `#1ed760` primary, white circular play FAB, dark charcoal cards).
- **Fonts**: **Google Sans Flex** (`opsz,wght` variable axes) with an automatic fallback chain (bare family → Roboto); **Material Symbols Rounded** variable font with animated `FILL` axis for active states.
- **Layout**: mobile-first, max-width 760px app column, fixed bottom navigation bar + mini player, full-height Now-Playing sheet with pointer-drag dismissal, `env(safe-area-inset-*)` padding for notched devices.
- **Motion**: spring easings for sheet/mini-player entry, artwork spin-in on track change, equalizer bars for the playing row, `prefers-reduced-motion` respected.
- **Implementation**: hand-written CSS custom-property design system (≈600 lines) instead of the Tailwind runtime CDN used in v1 — zero JIT cost, full MD3 token control, no console warnings in production.

## 4. Key engineering decisions

| Decision | Rationale |
|---|---|
| **Drive API v3 + public API key instead of Apps Script** | `googleapis.com` serves CORS headers and honours HTTP `Range` on `alt=media`, which is mandatory for seeking/lock-screen scrubbing. Apps Script cannot reliably stream large media (execution limits, no Range support, response caps) and would add a fragile redirect layer for zero benefit. |
| **No `metadata.json`** | Manual JSON maintenance on mobile is hostile; ID3/MP4/FLAC tags + filename conventions cover personal libraries. Tags are parsed lazily in-browser and cached, so the folder stays the single source of truth. |
| **Subfolders = albums** | Matches how people already organize Drive; overrides ID3 album tags so folder layout is deterministic. Root files fall back to ID3 album, then a virtual “Singles” album. |
| **Stale-while-revalidate caching** | localStorage snapshot paints the library instantly on load; the fresh Drive listing replaces it silently. Duration (localStorage) and cover (IndexedDB) caches survive reloads; `navigator.connection.saveData` skips duration probing. |
| **Cover pipeline** | jsmediatags reads tags over ranged fetches → picture frame → `<canvas>` center-crop downscale to ≤512px JPEG (~40–80 KB) → IndexedDB. Missing art renders deterministic two-tone gradient placeholders (hash-hued per album) everywhere, including Media Session artwork. |
| **Single persistent `<audio>`** | Created once in static HTML, never re-created — swapping `src` preserves the media session and background-play permission on mobile. This is the pattern that keeps Android lock-screen controls and iOS background audio stable. |
| **Shuffle = index permutation** | `shuffleOrder(n, first)` Fisher–Yates-shuffles all indices except the current one and unshifts the current index — original queue array is untouched, so un-shuffling is lossless. |
| **Inline libraries** | Alpine.js 3.14.9 and jsmediatags 3.9.7 are vendored into the HTML (MIT). No CDN JS dependency for core functionality; fonts stay on Google Fonts CDN per design requirements. Alpine loads **last** so `alpine:init` store registration is pre-registered. |
| **Demo mode `?mock=1`** | Renders the full app against a synthetic 9-track library without Drive — used for CI-free verification and for previewing the UI before configuring anything. |

## 5. Component map (single file, ≈2,340 lines)

| Section | Contents |
|---|---|
| `<head>` CSS | MD3 token block, reset, splash, gate, topbar, buttons/chips, album cards/shelves, track rows, equalizer, empty states, nav bar, mini player, sheets, Now Playing, MD3 range slider, queue, settings, search, pushed pages, snackbar, responsive + reduced-motion rules |
| Body markup | splash, password gate, fatal-error card, three tab views (Home/Search/Library), pushed album/artist page layer, mini player, bottom nav, scrim, Now-Playing sheet, queue sheet, settings sheet, snackbar, persistent `<audio>` |
| `js1-utils` | Pure helpers: extension/mime detection, filename parser, album/artist grouping, in-album sorting, Fisher–Yates order, time/total formatters, hue hashing, greeting, debounce — **Node-unit-testable** |
| `js2-core` | Config, media URL builders, localStorage + IndexedDB wrappers, Drive listing with paged queries and error→UX mapping (403 quota / disabled API / referrer / unshared, 404 folder, 400 bad request), library cache merge, tag reading, canvas downscaling, duration probing, demo dataset |
| `js3-ui` | Playback engine (queue/order/tick/persist/restore, error-streak guard), Media Session wiring (metadata, artwork, position state, all action handlers), Alpine store (views, sheets, pages, search getters, toasts), library loader + background pipelines, sheet drag-to-dismiss, keyboard shortcuts, boot sequence |

## 6. Caching layers

| Data | Store | Key | Invalidation |
|---|---|---|---|
| Library snapshot | localStorage `hum.library.v2` | whole array | every successful rescan (merged) |
| Durations | localStorage `hum.durations.v2` | Drive file ID | automatic re-probe on miss |
| Cover art | IndexedDB `hum-cache/art` | Drive file ID | Settings → “Clear cover cache” |
| Playback state | localStorage `hum.player.v2` | queue/order/position | every 5 s while playing + on pause/track change |
| Placeholder art | in-memory map | album key | per page load |

## 7. Verification performed before delivery

1. **Build gate** (`scripts/build.py`): style/script tag balance, audio element presence, no `</script` inside inlined JS, markup binding scan, Alpine-last ordering.
2. **Syntax**: `node --check` on the extracted application script and `config.js`.
3. **Unit tests** (`scripts/test-utils.mjs`, 26 assertions): filename parsing matrix (track numbers, dashes, en/em dashes, underscores, no-artist), audio extension/mime filtering, slug stability, album/artist grouping + common-artist election + in-album ordering, shuffle permutation contract (bijection, current-first, source untouched, uniformness smoke), time formatting edge cases, greeting boundaries, merge semantics.
4. **Structural HTML check** (`scripts/verify-frontend.py`): tag balance via HTML parser, Alpine expression scan against the store API, icon-name whitelist check, config/docs cross-references.
5. **Headless browser E2E** (demo mode): app boots past splash, library renders, playback state transitions, tabs/sheets/pages open, no console errors; screenshots reviewed (home, Now Playing, queue, library).
6. **Manual edge review**: autoplay-block toast path, offline rescan with cache, quota/403/404 error cards, `saveData` skip, iOS safe-area padding, Firefox slider fallbacks.

## 8. Known limitations (by design)

- Cover art requires embedded pictures (or a re-tag); there is no per-album image upload.
- Album subfolder nesting deeper than one level is flattened into the top-level album.
- The password gate is cosmetic privacy, not access control (documented in the guide).
- Lyrics, gapless playback, equalizer and offline mode are out of scope for v2.

## 9. Changelog v1 → v2

- **Removed**: `api/*` (auth/stream/upload/metadata), `lib/core.js`, R2/AWS SDK, presigned URL flow, upload drawer, metadata editors, HMAC session tokens, `.env.example` variables.
- **Added**: Google Drive listing/streaming layer, API-key config, tag/art extraction pipelines, IndexedDB art cache, demo mode, MD3+Spotify design system, Google Sans Flex + Material Symbols, pushed album/artist pages, artist grouping, drag-to-dismiss sheets, keyboard shortcuts, `saveData` awareness, settings sheet with cache management.
- **Changed**: hosting is fully static (framework “Other” on Vercel); authentication moved from server-verified tokens to an optional cosmetic gate; album grouping moved from manual tags to subfolders/ID3; Tailwind CDN replaced by a hand-written design system.
