# Flag Recognition Game – Quiz and Pairs

This PWA now offers two ways to play and supports using local data and images so gameplay works fast and offline.

## Game modes
- Quiz (original): Guess the country name from a flag. 10 questions with a timer.
- Pairs (new): Match countries to their flags. A session has 20 pairs shown in sets of 5 at a time.

Use the “Game mode” selector in the header to switch. Your last choice is remembered.

## What changed
- The app now looks for `assets/countries.json` first to load the countries list.
  - If not found, it falls back to the REST Countries API and caches a simplified copy in `localStorage` for next time.
- Flag images prefer local files in `assets/flags/` (`xx.svg` or `xx.png`) before trying CDNs.
- The service worker caches cross-origin images (opaque responses) so once fetched, they’re available offline.

## Prefetch assets (optional but recommended)

To prefetch assets (countries data and flag images) for offline use, see the [game-flag-app-tools](https://github.com/herico/game-flag-app-tools) repository.

The tools repository contains scripts to:
- Download the countries.json file from REST Countries API
- Fetch all country flag images (SVG and/or PNG formats)
- Prepare assets for offline gameplay

For detailed instructions, see [TOOLS_MIGRATION.md](./TOOLS_MIGRATION.md).

## Development
Just open `index.html` or serve locally to get proper PWA behavior.

Tip: use the asset fetcher from the [game-flag-app-tools](https://github.com/herico/game-flag-app-tools) repository to make sure flags and country names are available offline.

## Dark mode
- The UI supports light and dark themes.
- It follows your system setting by default.
- Use the moon/sun toggle in the header to switch and persist your preference (stored in `localStorage`).
- The browser address bar color updates to match the active theme.

## Caching behavior
- Same-origin files are served cache-first by the service worker.
- Images (any origin) are cache-first and stored even if responses are opaque (cross-origin without CORS headers).
- If `assets/countries.json` exists, it will be used and cached. Otherwise, the app fetches from the network and remembers the simplified list in `localStorage`.
