# AssetLink Pro — Enterprise Asset Management & Tracking System

AssetLink Pro is a modern, high-performance, and secure Enterprise Asset Management & Tracking System. It features interactive local network discovery, asset tracking, history logs, visual reporting, and local user authentication.

## Core Architecture

- **Frontend**: React 19, Vite 6, Tailwind CSS 4, and Lucide Icons.
- **Backend**: Node.js, Express, and a high-performance **Pure-JS SQLite Database engine** with local JSON storage (`assetlink-local.json`).
- **Desktop Client**: Electron desktop wrapping with IPC integrations for low-level network discovery scanning.
- **Hybrid Core**: Seamlessly fallback to standard Web browser view or robust Electron frame depending on host system.

## Offline Capabilities & Portability

This application is engineered for complete **air-gapped and offline local server environments**. It requires zero internet access to download, build, run, or package!

For comprehensive steps on moving, installing, and building this application on an air-gapped server, please refer to:
👉 **[OFFLINE_GUIDE.md](./OFFLINE_GUIDE.md)**

## Setup & Running Locally (Online / Standard)

### Prerequisites

- Node.js (v18 or higher recommended)
- npm (v9 or higher)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Dev Server (Vite + Express)
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### 3. Run Electron Desktop (Dev Mode)
```bash
npm run electron:dev
```

### 4. Build Production Web Files
```bash
npm run build
```

### 5. Build Desktop Installers
```bash
npm run electron:build
```

---

## Local User Credentials

A default system administrator account is pre-seeded into the database upon startup:

- **Username**: `assetadmin`
- **Password**: `adminasset`
- **Role**: `admin`
- **Email**: `admin.assetlink@internal.local`
