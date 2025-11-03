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

> **Note:** The new repository needs to be created manually. See the setup instructions at the end of this document.

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

## Setting Up the New Repository

Since the tools have been removed from this repository, you'll need to create the new `game-flag-app-tools` repository and add the files to it.

### Quick Setup Steps:

1. **Create the repository** on GitHub:
   - Go to https://github.com/new
   - Name: `game-flag-app-tools`
   - Description: "Build tools and asset fetching scripts for the Flag Recognition Game"
   - Don't initialize with README

2. **Retrieve the moved files:**
   
   The files are available in the git history (before they were removed):
   ```sh
   # In the game-flag-app repository
   # First, find the commit before the removal:
   git log --oneline | grep -B1 "Move tools"
   
   # Use the commit hash before the removal (replace COMMIT_HASH with actual hash):
   git show COMMIT_HASH^:package.json > package.json
   git show COMMIT_HASH^:tools/fetch-assets.mjs > fetch-assets.mjs
   
   # Or use the parent of the current HEAD if you're on the branch:
   git show HEAD~2:package.json > package.json
   git show HEAD~2:tools/fetch-assets.mjs > fetch-assets.mjs
   ```

3. **Set up the new repository:**
   ```sh
   mkdir game-flag-app-tools
   cd game-flag-app-tools
   git init
   
   # Create directory structure
   mkdir -p tools
   mkdir -p assets/flags
   
   # Move the files
   mv /path/to/package.json .
   mv /path/to/fetch-assets.mjs tools/
   
   # Create .gitignore
   cat > .gitignore << 'EOF'
   node_modules/
   assets/countries.json
   assets/flags/*.svg
   assets/flags/*.png
   .DS_Store
   EOF
   
   # Add README.md (see sample below)
   # Commit and push
   git add .
   git commit -m "Initial commit: Tools from game-flag-app"
   git remote add origin https://github.com/herico/game-flag-app-tools.git
   git branch -M main
   git push -u origin main
   ```

4. **Test the tools:**
   ```sh
   npm install
   npm run fetch:sample
   ```

For detailed instructions and all necessary file contents, see the agent's temporary files or contact the repository maintainer.
