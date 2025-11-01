# Flag Recognition Quiz – Offline Assets

This PWA supports using local data and images so gameplay doesn’t re-hit external APIs on every question and works offline.

## What changed
- The app now looks for `assets/countries.json` first to load the countries list.
  - If not found, it falls back to the REST Countries API and caches a simplified copy in `localStorage` for next time.
- Flag images prefer local files in `assets/flags/` (`xx.svg` or `xx.png`) before trying CDNs.
- The service worker caches cross-origin images (opaque responses) so once fetched, they’re available offline.

## Prefetch assets (optional but recommended)
Node 18+ is required (uses built-in `fetch`).

```sh
# From the repo root
npm run fetch:json         # writes assets/countries.json
npm run fetch:svg          # downloads all SVG flags into assets/flags/
# or
npm run fetch:flags        # downloads both SVG and PNG flags (bigger)
# or a quick sample for testing
npm run fetch:sample       # ~30 flags only
```

Notes:
- SVGs from flagcdn.com are crisp and small; PNGs from flagsapi.com are larger. SVG-only is usually sufficient.
- You can re-run the commands; existing files are skipped.

## Development
Just open `index.html` or serve locally to get proper PWA behavior.

## Dark mode
- The UI supports light and dark themes.
- It follows your system setting by default.
- Use the moon/sun toggle in the header to switch and persist your preference (stored in `localStorage`).
- The browser address bar color updates to match the active theme.

## Caching behavior
- Same-origin files are served cache-first by the service worker.
- Images (any origin) are cache-first and stored even if responses are opaque (cross-origin without CORS headers).
- If `assets/countries.json` exists, it will be used and cached. Otherwise, the app fetches from the network and remembers the simplified list in `localStorage`.
