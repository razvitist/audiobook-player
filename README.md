# 🎧 Audiobook Player

A private, **local-first** audiobook player that runs entirely in your browser — no accounts, no uploads, no server. Import individual audio files or a whole folder of chapters, and everything (files, cover art, and your exact listening position) is stored on your own device using IndexedDB. Deploys to GitHub Pages as a static site.

Built with **Vite · TypeScript · React · Tailwind CSS · shadcn/ui**.

---

## ✨ Features

- **Single `<audio>` engine** — one audio element drives all playback (via a small controller/context), so state stays consistent.
- **Import files _or_ folders** — an **Add files** button for loose audio files and an **Add folder** button for a whole folder. Each imported folder becomes a book with its chapters ordered naturally (`Chapter 2` before `Chapter 10`).
- **Drag & drop** — drop files or folders anywhere on the window.
- **Embedded chapters** — a single-file audiobook (e.g. an `.m4b` with chapter markers) is split into real, navigable chapters; multi-file books use one chapter per file. Chapter navigation works the same in both cases.
- **Reads embedded metadata** — pulls title, **author**, and **cover art** straight from the audio files' tags (ID3 / MP4 / FLAC / Ogg …), so your books show real info and artwork.
- **Buffering indicator** and graceful handling if stored audio is missing.
- **Persistent library** — audio blobs live in IndexedDB and metadata in `localStorage`, so your books and progress survive reloads without re-importing.
- **Resume exactly where you left off** — per-chapter positions are saved continuously and on page exit.
- **Remove books** — delete a book from the library (also frees its stored audio) via the trash button on each row.
- **Full transport controls** — play/pause, previous/next chapter, skip back 15s / forward 30s, scrubbing.
- **Playback speed** — 0.75×–2×.
- **Volume & mute**, **sleep timer** (timed or "end of chapter").
- **Cover art** — from an embedded tag or a `cover`/`folder` image in the imported folder, with a generated gradient fallback.
- **Chapter list** with a live "now playing" equalizer indicator.
- **OS media controls** via the Media Session API (lock screen / media keys).
- **Keeps the screen awake** while playing (Screen Wake Lock API), re-acquiring when you return to the tab.
- **Keyboard shortcuts** and a responsive, theme-aware (dark by default) design.

### ⌨️ Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `→` / `←` | Forward 30s / back 15s (hold `Shift` for 60s) |
| `↑` / `↓` | Volume up / down |
| `N` / `P` | Next / previous chapter |
| `M` | Mute |

### Supported formats

Whatever the browser can decode — typically `.mp3`, `.m4a`, `.m4b`, `.aac`, `.ogg`/`.opus`, `.wav`, `.flac`. (`.m4b` support depends on the browser.)

---

## 🚀 Getting started (local development)

Requires **Node.js 18+**.

```bash
npm install      # install dependencies
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # type-check + production build into dist/
npm run preview  # preview the production build locally
```

---

## 📦 Deploying to GitHub Pages

The app uses a **relative base path** (`base: "./"` in `vite.config.ts`), so it works from any GitHub Pages URL — including project sites at `https://<user>.github.io/<repo>/` — without hardcoding your repository name.

### Option A — Automatic deploy with GitHub Actions (recommended)

A workflow is included at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) that builds and publishes on every push to `main`.

1. **Create a repository** and push this project:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
2. In your repository, go to **Settings → Pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions**.
4. Push to `main` (or run the workflow manually from the **Actions** tab). When it finishes, your site is live at:
   ```
   https://<user>.github.io/<repo>/
   ```

That's it — every subsequent push to `main` redeploys automatically.

### Option B — Manual deploy with the `gh-pages` branch

The `gh-pages` package is included as a dev dependency and a `deploy` script is set up.

1. Build and publish the `dist/` folder to a `gh-pages` branch:
   ```bash
   npm run deploy
   ```
2. In **Settings → Pages**, set the **Source** to **Deploy from a branch**, choose the **`gh-pages`** branch and the **`/ (root)`** folder, and save.
3. Your site will be available at `https://<user>.github.io/<repo>/`.

### Deploying to a user/organization site or a custom domain

- **User/org site** (`https://<user>.github.io/`): works as-is thanks to the relative base.
- **Custom domain**: add a `CNAME` file to the `public/` folder containing your domain, and configure the domain under **Settings → Pages**.

> **Tip:** If assets 404 after deploying, confirm `base: "./"` is present in `vite.config.ts` and that Pages is serving the `dist` output (Actions) or the `gh-pages` branch root (manual).

---

## 🔒 Privacy

Everything happens client-side. Your audio files never leave your device — they are read locally and stored in your browser's IndexedDB. Clearing your browser storage for the site removes the library.

> Because storage is per-browser and per-device, your library and progress won't sync across machines.

---

## 🗂️ Project structure

```
src/
├─ audio/
│  └─ AudioProvider.tsx   # the single <audio> element + controller context
├─ components/
│  ├─ ui/                 # shadcn/ui primitives (button, slider, …)
│  ├─ Library.tsx         # sidebar: book list + import controls
│  ├─ Player.tsx          # now-playing header, transport, speed, sleep timer
│  ├─ SeekBar.tsx         # scrubber with hover-time preview
│  ├─ ChapterList.tsx     # per-book chapter navigation
│  ├─ ImportControls.tsx  # file + folder import buttons
│  └─ BookCover.tsx       # cover image / gradient fallback
├─ lib/
│  ├─ db.ts               # IndexedDB blob storage (idb-keyval)
│  ├─ import.ts           # turn a file/folder selection into books
│  ├─ metadata.ts         # read embedded tags + cover art + chapters
│  ├─ chapters.ts         # build/derive chapters across files or markers
│  ├─ dropFiles.ts        # collect files (incl. folders) from a drop
│  ├─ progress.ts         # book progress estimation
│  └─ format.ts / utils.ts
├─ store/
│  └─ useLibrary.ts       # Zustand store (persisted metadata + prefs)
└─ types.ts
```

---

## 🛠️ Tech stack

| Concern | Choice |
| --- | --- |
| Build tool | Vite 6 |
| Language | TypeScript |
| UI | React 18 |
| Styling | Tailwind CSS 3 |
| Components | shadcn/ui + Radix primitives |
| State | Zustand (with `persist`) |
| File storage | IndexedDB via `idb-keyval` |
| Tag/cover parsing | `music-metadata` |
| Icons | lucide-react |

## 📄 License

MIT — do whatever you like.
