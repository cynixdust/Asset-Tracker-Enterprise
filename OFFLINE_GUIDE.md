# Enterprise Offline & Air-Gapped Deployment Guide

This guide describes how to run, compile, and package **AssetLink Pro** in local environments with restricted, firewalled, or completely offline (air-gapped) internet connections.

---

## 🛠 Why AssetLink Pro is Perfect for Offline Servers

1. **Zero Native C++ Compiles**: We removed the native `sqlite3` dependency (which requires active internet to pull prebuilt binaries or compilers like node-gyp and python) and replaced it with a custom, high-performance **Pure-JS Simulated SQLite Engine** writing to `assetlink-local.json` automatically.
2. **Local Mock Network Driver**: The standard `local-devices` scanner depends on the `ip` module. Since installing `ip` normally triggers npm lookups, we bundled a fully self-contained, light-weight version of `ip` inside `/libs/ip-mock` and pointed npm directly to it using local file resolution (`file:./libs/ip-mock`).
3. **No External CDNs**: All stylesheets, icons (`lucide-react`), and fonts (`@fontsource-variable/geist`) are pre-installed as local ESModules and bundled at build-time. There are zero requests to Google Fonts or cloud CDNs.

---

## 📦 How to Copy and Transfer the Code Offline

To move the code from a machine with internet access to your offline/air-gapped server:

### Option A: Pack Everything (Recommended & Simplest)
If you already have a machine with internet access:
1. Run `npm install` on the online machine to populate the `node_modules` folder completely.
2. Create a compressed archive (`.zip` or `.tar.gz`) of the entire project folder, **including the `node_modules` directory**.
3. Copy this archive to your offline server via USB drive, local network share, or secure media.
4. Extract the archive on your offline server.
5. You can now immediately run `npm run dev`, `npm run build`, or `npm run electron:dev` without running any installer!

### Option B: Using standard NPM Offline Cache
If you cannot copy the `node_modules` folder directly, you can pre-fetch the packages into npm cache:
1. On the online machine, run:
   ```bash
   npm install --package-lock-only
   ```
2. Download all tarballs using an offline packer tool or copy your local global npm cache folder (usually located at `~/.npm` on Linux/macOS or `%LocalAppData%\npm-cache` on Windows) to the offline server.
3. On the offline server, run:
   ```bash
   npm install --offline
   ```

---

## 🚀 Running the Offline Commands

Once the code is on the offline server, use the standard commands:

### 1. Build Production Web Assets
```bash
npm run build
```
*Creates a fully compiled static bundle inside `/dist`.*

### 2. Run local Dev Server (Vite + Express Backend)
```bash
npm run dev
```
*Launches the Express server on port `3000` with hot module reloading.*

### 3. Start local Electron Desktop in Dev Mode
```bash
npm run electron:dev
```
*Launches both the server and the Electron GUI.*

---

## 🖥 Offline Electron Packaging (`npm run electron:build`)

When you run `npm run electron:build` to compile a standalone executable, `electron-builder` tries to fetch the target pre-built Electron binaries from GitHub. To do this offline, follow these steps:

### How to Cache Electron Binaries Offline

1. **Pre-download the Electron ZIP**:
   Identify the Electron version in `package.json` (e.g., `^41.2.0`). Download the corresponding `.zip` file for your target platform from the [Electron Releases page on GitHub](https://github.com/electron/electron/releases).
   * For Windows 64-bit: `electron-v41.2.0-win32-x64.zip`
   * For Linux 64-bit: `electron-v41.2.0-linux-x64.zip`

2. **Place ZIP in the Electron Cache Folder**:
   Copy the `.zip` file into the default offline cache folder on your target machine:
   * **Windows**: `%LOCALAPPDATA%\electron\Cache\`
   * **Linux / macOS**: `~/.cache/electron/`

3. **Pre-download electron-builder binaries (if needed)**:
   If packaging on Windows/Linux, download the required utility binaries (such as `nsis` or `winCodeSign`) and place them in:
   * **Windows**: `%LOCALAPPDATA%\electron-builder\Cache\`
   * **Linux / macOS**: `~/.cache/electron-builder/`

4. **Execute Offline Build**:
   ```bash
   npm run electron:build
   ```
   `electron-builder` will detect the cached ZIP files and construct your installer cleanly with zero network connections!
