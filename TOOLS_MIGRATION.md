# Tools Migration Guide

## Overview

The build tools and asset fetching scripts have been moved to a separate repository to keep this repository focused on the core game (HTML, CSS, and JavaScript).

## Moved Files

The following files have been moved to the `game-flag-app-tools` repository:

- `package.json` - npm package configuration with asset fetching scripts
- `tools/fetch-assets.mjs` - Script to download country data and flag images

## New Repository

**Repository:** `herico/game-flag-app-tools`  
**Purpose:** Build tools and scripts for preparing assets for the Flag Recognition Game

## Using the Tools

To use the asset fetching tools:

1. Clone the tools repository:
   ```sh
   git clone https://github.com/herico/game-flag-app-tools.git
   cd game-flag-app-tools
   ```

2. Run the desired npm script:
   ```sh
   # Fetch only the countries.json file
   npm run fetch:json

   # Download all SVG flags
   npm run fetch:svg

   # Download all PNG flags
   npm run fetch:png

   # Download both SVG and PNG flags
   npm run fetch:flags

   # Download a sample of ~30 flags for testing
   npm run fetch:sample
   ```

3. Copy the generated assets to your game directory:
   ```sh
   # Copy the generated assets to the game repository
   cp -r assets/* /path/to/game-flag-app/assets/
   ```

## Why the Separation?

This repository is a static PWA (Progressive Web App) consisting only of:
- HTML, CSS, and JavaScript
- Static assets (flags and country data)
- Service worker for offline functionality

The tools are Node.js-based development utilities that:
- Require Node 18+ runtime
- Are only needed during development/preparation
- Are not part of the deployed application

Separating them keeps the game repository clean and focused on the actual application code.
