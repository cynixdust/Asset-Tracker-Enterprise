import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import crypto from "crypto";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pure JS Fallback class mimicking sqlite3.Database API
class SQLiteFallback {
  private filepath: string;
  private data: {
    documents: Array<{ collection: string; id: string; data: string; createdAt: string; updatedAt: string }>;
    local_users: Array<{ username: string; password: string; role: string; uid: string; email: string; displayName: string }>;
  };

  constructor(filepath: string, callback?: (err: Error | null) => void) {
    this.filepath = filepath.replace(/\.db$/, ".json");
    this.data = { documents: [], local_users: [] };
    
    try {
      if (fs.existsSync(this.filepath)) {
        const fileContent = fs.readFileSync(this.filepath, "utf-8");
        this.data = JSON.parse(fileContent);
      } else {
        this.save();
      }
      if (callback) setTimeout(() => callback(null), 0);
    } catch (e: any) {
      if (callback) setTimeout(() => callback(e), 0);
    }
  }

  private save() {
    try {
      fs.writeFileSync(this.filepath, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to save JSON fallback database:", e);
    }
  }

  serialize(callback: () => void) {
    callback();
  }

  run(sql: string, params: any[] | any, callback?: any) {
    let actualParams = Array.isArray(params) ? params : [];
    let actualCallback = typeof params === "function" ? params : callback;

    try {
      const query = sql.replace(/\s+/g, " ").trim();

      if (query.toUpperCase().startsWith("CREATE TABLE")) {
        if (actualCallback) setTimeout(() => actualCallback.call({ changes: 0, lastID: 0 }, null), 0);
        return;
      }

      if (query.toUpperCase().startsWith("INSERT OR IGNORE INTO LOCAL_USERS")) {
        const [username, password, role, uid, email, displayName] = actualParams;
        const exists = this.data.local_users.some(u => u.username === username);
        if (!exists) {
          this.data.local_users.push({ username, password, role, uid, email, displayName });
          this.save();
        }
        if (actualCallback) setTimeout(() => actualCallback.call({ changes: exists ? 0 : 1, lastID: 1 }, null), 0);
        return;
      }

      if (query.toUpperCase().startsWith("INSERT OR IGNORE INTO DOCUMENTS")) {
        const [collection, id, dataStr, createdAt, updatedAt] = actualParams;
        const exists = this.data.documents.some(d => d.collection === collection && d.id === id);
        if (!exists) {
          this.data.documents.push({ collection, id, data: dataStr, createdAt, updatedAt });
          this.save();
        }
        if (actualCallback) setTimeout(() => actualCallback.call({ changes: exists ? 0 : 1, lastID: 1 }, null), 0);
        return;
      }

      if (query.toUpperCase().startsWith("INSERT INTO LOCAL_USERS")) {
        const [username, password, role, uid, email, displayName] = actualParams;
        const exists = this.data.local_users.some(u => u.username === username);
        if (exists) {
          const err = new Error("SQLITE_CONSTRAINT: UNIQUE constraint failed: local_users.username");
          if (actualCallback) setTimeout(() => actualCallback(err), 0);
          return;
        }
        this.data.local_users.push({ username, password, role, uid, email, displayName });
        this.save();
        if (actualCallback) setTimeout(() => actualCallback.call({ changes: 1, lastID: 1 }, null), 0);
        return;
      }

      if (query.toUpperCase().startsWith("INSERT INTO DOCUMENTS")) {
        const [collection, id, dataStr, createdAt, updatedAt] = actualParams;
        const isUpsert = query.toUpperCase().includes("ON CONFLICT");
        const idx = this.data.documents.findIndex(d => d.collection === collection && d.id === id);

        if (idx !== -1) {
          if (isUpsert) {
            this.data.documents[idx].data = dataStr;
            this.data.documents[idx].updatedAt = updatedAt;
            this.save();
            if (actualCallback) setTimeout(() => actualCallback.call({ changes: 1, lastID: 1 }, null), 0);
          } else {
            const err = new Error("SQLITE_CONSTRAINT: UNIQUE constraint failed: documents.collection, documents.id");
            if (actualCallback) setTimeout(() => actualCallback(err), 0);
          }
          return;
        }

        this.data.documents.push({ collection, id, data: dataStr, createdAt, updatedAt });
        this.save();
        if (actualCallback) setTimeout(() => actualCallback.call({ changes: 1, lastID: 1 }, null), 0);
        return;
      }

      if (query.toUpperCase().startsWith("DELETE FROM LOCAL_USERS")) {
        const [uid] = actualParams;
        const initialLen = this.data.local_users.length;
        this.data.local_users = this.data.local_users.filter(u => u.uid !== uid);
        const changes = initialLen - this.data.local_users.length;
        if (changes > 0) this.save();
        if (actualCallback) setTimeout(() => actualCallback.call({ changes, lastID: 0 }, null), 0);
        return;
      }

      if (query.toUpperCase().startsWith("UPDATE LOCAL_USERS")) {
        const [password, uid] = actualParams;
        const user = this.data.local_users.find(u => u.uid === uid);
        let changes = 0;
        if (user) {
          user.password = password;
          changes = 1;
          this.save();
        }
        if (actualCallback) setTimeout(() => actualCallback.call({ changes, lastID: 0 }, null), 0);
        return;
      }

      if (query.toUpperCase().startsWith("DELETE FROM DOCUMENTS")) {
        const [collection, id] = actualParams;
        const initialLen = this.data.documents.length;
        this.data.documents = this.data.documents.filter(d => !(d.collection === collection && d.id === id));
        const changes = initialLen - this.data.documents.length;
        if (changes > 0) this.save();
        if (actualCallback) setTimeout(() => actualCallback.call({ changes, lastID: 0 }, null), 0);
        return;
      }

      if (actualCallback) setTimeout(() => actualCallback(null), 0);
    } catch (e: any) {
      if (actualCallback) setTimeout(() => actualCallback(e), 0);
    }
  }

  get(sql: string, params: any[] | any, callback?: any) {
    let actualParams = Array.isArray(params) ? params : [];
    let actualCallback = typeof params === "function" ? params : callback;

    try {
      const query = sql.replace(/\s+/g, " ").trim();

      if (query.toUpperCase().startsWith("SELECT * FROM LOCAL_USERS")) {
        const [usernameOrEmail] = actualParams;
        const cleanName = usernameOrEmail && usernameOrEmail.includes('@') ? usernameOrEmail.split('@')[0] : usernameOrEmail;
        const user = this.data.local_users.find(u => 
          u.username === usernameOrEmail || 
          u.email === usernameOrEmail || 
          (cleanName && (u.username === cleanName || u.email === cleanName))
        );
        if (actualCallback) setTimeout(() => actualCallback(null, user || null), 0);
        return;
      }

      if (query.toUpperCase().startsWith("SELECT DATA FROM DOCUMENTS")) {
        const [collection, id] = actualParams;
        const doc = this.data.documents.find(d => d.collection === collection && d.id === id);
        if (actualCallback) setTimeout(() => actualCallback(null, doc || null), 0);
        return;
      }

      if (actualCallback) setTimeout(() => actualCallback(null, null), 0);
    } catch (e: any) {
      if (actualCallback) setTimeout(() => actualCallback(e, null), 0);
    }
  }

  all(sql: string, params: any[] | any, callback?: any) {
    let actualParams = Array.isArray(params) ? params : [];
    let actualCallback = typeof params === "function" ? params : callback;

    try {
      const query = sql.replace(/\s+/g, " ").trim();

      if (query.toUpperCase().startsWith("SELECT ID, DATA FROM DOCUMENTS")) {
        const [collection] = actualParams;
        const docs = this.data.documents.filter(d => d.collection === collection);
        if (actualCallback) setTimeout(() => actualCallback(null, docs), 0);
        return;
      }

      if (actualCallback) setTimeout(() => actualCallback(null, []), 0);
    } catch (e: any) {
      if (actualCallback) setTimeout(() => actualCallback(e, []), 0);
    }
  }
}

// Safely load sqlite3 dynamically
let sqlite3: any = null;
try {
  // @ts-ignore
  sqlite3 = await import("sqlite3");
} catch (e) {
  console.warn("Native sqlite3 driver failed to load. Falling back to pure JS simulated database.");
}

const DatabaseClass = sqlite3 ? (sqlite3.default?.Database || sqlite3.Database) : null;

// Initialize SQLite database
const DB_FILE = path.join(process.cwd(), "assetlink-local.db");
let db: any;

if (DatabaseClass) {
  try {
    db = new DatabaseClass(DB_FILE, (err: any) => {
      if (err) {
        console.error("Could not connect to SQLite database, falling back to simulated DB:", err);
      } else {
        console.log("Connected to SQLite database at:", DB_FILE);
        initializeTables();
      }
    });
  } catch (err) {
    console.warn("Failed to instantiate real sqlite3 Database, falling back to simulated DB:", err);
  }
}

if (!db) {
  db = new SQLiteFallback(DB_FILE, (err: any) => {
    if (err) {
      console.error("Could not initialize simulated DB:", err);
    } else {
      console.log("Connected to pure JS simulated SQLite database at:", DB_FILE.replace(/\.db$/, ".json"));
      initializeTables();
    }
  });
}

function initializeTables() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS documents (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        data TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        PRIMARY KEY (collection, id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS local_users (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        uid TEXT NOT NULL,
        email TEXT NOT NULL,
        displayName TEXT NOT NULL
      )
    `);

    // Seed default admin user
    db.run(
      `INSERT OR IGNORE INTO local_users (username, password, role, uid, email, displayName)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        "assetadmin",
        "adminasset",
        "admin",
        "local-admin-uid",
        "admin.assetlink@internal.local",
        "AssetLink Administrator"
      ],
      (err) => {
        if (err) console.error("Error seeding default user:", err);
      }
    );

    // Seed corresponding users document
    const now = new Date().toISOString();
    const adminProfile = {
      uid: "local-admin-uid",
      email: "admin.assetlink@internal.local",
      username: "assetadmin",
      displayName: "AssetLink Administrator",
      role: "admin",
      lastLogin: now
    };

    db.run(
      `INSERT OR IGNORE INTO documents (collection, id, data, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?)`,
      [
        "users",
        "local-admin-uid",
        JSON.stringify(adminProfile),
        now,
        now
      ],
      (err) => {
        if (err) console.error("Error seeding default user document:", err);
      }
    );
  });
}

// Initialize Firebase Admin with config from firebase-applet-config.json
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    
    if (config.firestoreDatabaseId) {
      process.env.FIRESTORE_DATABASE = config.firestoreDatabaseId;
    }
    if (config.projectId) {
      process.env.GCLOUD_PROJECT = config.projectId;
      process.env.GOOGLE_CLOUD_PROJECT = config.projectId;
    }

    admin.initializeApp({
      projectId: config.projectId
    });
    console.log(`Firebase Admin initialized successfully with projectId: ${config.projectId}, database: ${config.firestoreDatabaseId}`);
  } else {
    admin.initializeApp();
    console.log("Firebase Admin initialized with default credentials.");
  }
} catch (error) {
  console.warn("Firebase Admin failed to initialize. Admin actions may fail.", error);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // --- SQLite Fallback / Local Auth Routes ---

  // Auth: Login
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const cleanUsername = username.includes('@') ? username.split('@')[0] : username;

    db.get(
      "SELECT * FROM local_users WHERE username = ? OR email = ? OR username = ? OR email = ?",
      [username, username, cleanUsername, cleanUsername],
      (err, user: any) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        if (!user || user.password !== password) {
          return res.status(401).json({ error: "Invalid username or password" });
        }

        res.json({
          success: true,
          user: {
            uid: user.uid,
            username: user.username,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
          },
        });
      }
    );
  });

  // Auth: Register User
  app.post("/api/auth/register", (req, res) => {
    const { username, email, password, displayName } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email, and password are required" });
    }

    const uid = crypto.randomUUID();
    const role = "user";
    const finalDisplayName = displayName || username;

    db.run(
      "INSERT INTO local_users (username, password, role, uid, email, displayName) VALUES (?, ?, ?, ?, ?, ?)",
      [username, password, role, uid, email, finalDisplayName],
      function (err) {
        if (err) {
          if (err.message.includes("UNIQUE")) {
            return res.status(400).json({ error: "Username already exists" });
          }
          return res.status(500).json({ error: err.message });
        }

        // Also seed user document in documents table for standard application queries
        const now = new Date().toISOString();
        const userProfile = {
          uid,
          email,
          username,
          displayName: finalDisplayName,
          role,
          lastLogin: now,
        };

        db.run(
          "INSERT INTO documents (collection, id, data, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
          ["users", uid, JSON.stringify(userProfile), now, now],
          function (err2) {
            if (err2) {
              console.error("Failed to seed document profile for registered user:", err2);
            }
            res.json({
              success: true,
              user: userProfile,
            });
          }
        );
      }
    );
  });

  // Auth: Delete User
  app.delete("/api/auth/users/:uid", (req, res) => {
    const { uid } = req.params;
    db.run("DELETE FROM local_users WHERE uid = ?", [uid], function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true });
    });
  });

  // Admin: Local Update Password
  app.post("/api/admin/update-password-local", (req, res) => {
    const { uid, newPassword } = req.body;
    if (!uid || !newPassword) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    db.run(
      "UPDATE local_users SET password = ? WHERE uid = ?",
      [newPassword, uid],
      function (err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, message: "Password updated successfully in SQLite" });
      }
    );
  });

  // SQLite DB: Get Collection Documents
  app.get("/api/db/:collection", (req, res) => {
    const { collection } = req.params;
    db.all(
      "SELECT id, data FROM documents WHERE collection = ?",
      [collection],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        const results = rows.map((row: any) => {
          try {
            return { id: row.id, ...JSON.parse(row.data) };
          } catch (e) {
            return { id: row.id };
          }
        });
        res.json(results);
      }
    );
  });

  // SQLite DB: Get Single Document
  app.get("/api/db/:collection/:id", (req, res) => {
    const { collection, id } = req.params;
    db.get(
      "SELECT data FROM documents WHERE collection = ? AND id = ?",
      [collection, id],
      (err, row: any) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        if (!row) {
          return res.status(404).json({ error: "Document not found" });
        }
        try {
          res.json({ id, ...JSON.parse(row.data) });
        } catch (e) {
          res.status(500).json({ error: "Failed to parse document data" });
        }
      }
    );
  });

  // SQLite DB: Add Document
  app.post("/api/db/:collection", (req, res) => {
    const { collection } = req.params;
    const data = req.body;
    const id = data.id || crypto.randomUUID();
    delete data.id;

    const now = new Date().toISOString();
    db.run(
      "INSERT INTO documents (collection, id, data, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
      [collection, id, JSON.stringify(data), now, now],
      function (err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ id, ...data });
      }
    );
  });

  // SQLite DB: Set / Update Document
  app.post("/api/db/:collection/:id", (req, res) => {
    const { collection, id } = req.params;
    const updateData = req.body;
    delete updateData.id;

    db.get(
      "SELECT data FROM documents WHERE collection = ? AND id = ?",
      [collection, id],
      (err, row: any) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        let existingData = {};
        if (row) {
          try {
            existingData = JSON.parse(row.data);
          } catch (e) {}
        }

        const mergedData = { ...existingData, ...updateData };
        const now = new Date().toISOString();

        db.run(
          "INSERT INTO documents (collection, id, data, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?) " +
          "ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data, updatedAt = excluded.updatedAt",
          [collection, id, JSON.stringify(mergedData), now, now],
          function (err2) {
            if (err2) {
              return res.status(500).json({ error: err2.message });
            }
            res.json({ id, ...mergedData });
          }
        );
      }
    );
  });

  // SQLite DB: Delete Document
  app.delete("/api/db/:collection/:id", (req, res) => {
    const { collection, id } = req.params;
    db.run(
      "DELETE FROM documents WHERE collection = ? AND id = ?",
      [collection, id],
      function (err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
      }
    );
  });

  // Admin: Update User Password
  app.post("/api/admin/update-password", async (req, res) => {
    const { uid, newPassword, adminToken } = req.body;
    
    if (!uid || !newPassword || !adminToken) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      // Verify the admin token
      const decodedToken = await getAuth().verifyIdToken(adminToken);
      
      // Check if the user is actually an admin in Firestore
      const userDoc = await getFirestore().collection('users').doc(decodedToken.uid).get();
      const userData = userDoc.data();

      if (userData?.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized: Admin privileges required" });
      }

      // Update the user's password
      await getAuth().updateUser(uid, { password: newPassword });
      
      res.json({ success: true, message: "Password updated successfully" });
    } catch (error: any) {
      console.error("Admin Password Update Error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // GET: Local Git Status
  app.get("/api/github/status", async (req, res) => {
    try {
      const branchResult = await execAsync("git branch --show-current").catch(() => ({ stdout: "master" }));
      const branch = branchResult.stdout.trim() || "master";
      
      let lastCommit = null;
      try {
        const logResult = await execAsync('git log -1 --format="%h|%an|%s|%ci"');
        const parts = logResult.stdout.trim().split('|');
        if (parts.length >= 4) {
          lastCommit = {
            hash: parts[0],
            author: parts[1],
            subject: parts[2],
            date: parts[3]
          };
        }
      } catch (e) {
        console.warn("No git commits yet or git log failed:", e);
      }

      const statusResult = await execAsync("git status --porcelain").catch(() => ({ stdout: "" }));
      const hasChanges = statusResult.stdout.trim().length > 0;

      res.json({
        branch,
        lastCommit,
        hasChanges,
        statusOutput: statusResult.stdout.trim()
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET: GitHub Integration Config
  app.get("/api/github/config", async (req, res) => {
    try {
      const doc = await getFirestore().collection("settings").doc("github").get();
      if (doc.exists) {
        const data = doc.data();
        const maskedToken = data?.token ? "••••" + data.token.slice(-4) : "";
        res.json({
          owner: data?.owner || "",
          repo: data?.repo || "",
          branch: data?.branch || "master",
          hasToken: !!data?.token,
          maskedToken
        });
      } else {
        res.json({ owner: "", repo: "", branch: "master", hasToken: false });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST: GitHub Integration Config
  app.post("/api/github/config", async (req, res) => {
    const { owner, repo, branch, token } = req.body;
    try {
      const docRef = getFirestore().collection("settings").doc("github");
      const doc = await docRef.get();
      
      const updateData: any = {
        owner: owner || "",
        repo: repo || "",
        branch: branch || "master",
        updatedAt: new Date()
      };

      if (token && !token.startsWith("••••")) {
        updateData.token = token;
      } else if (token === "") {
        updateData.token = null;
      }

      await docRef.set(updateData, { merge: true });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET: Latest GitHub Commits
  app.get("/api/github/latest", async (req, res) => {
    try {
      const doc = await getFirestore().collection("settings").doc("github").get();
      const config = doc.exists ? doc.data() : null;

      const owner = (req.query.owner as string) || config?.owner;
      const repo = (req.query.repo as string) || config?.repo;
      const branch = (req.query.branch as string) || config?.branch || "master";
      
      let token = req.query.token as string;
      if (!token && config?.token) {
        token = config.token;
      }

      if (!owner || !repo) {
        return res.status(400).json({ error: "Repository owner and name are required." });
      }

      const headers: any = {
        "User-Agent": "AssetTrack-Applet"
      };

      if (token && !token.startsWith("••••")) {
        headers["Authorization"] = `token ${token}`;
      }

      const url = `https://api.github.com/repos/${owner}/${repo}/commits?sha=${branch}&per_page=5`;
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ error: `GitHub API error: ${response.statusText}`, details: errText });
      }

      const commits: any = await response.json();
      const formattedCommits = commits.map((c: any) => ({
        sha: c.sha,
        shortSha: c.sha.slice(0, 7),
        message: c.commit.message,
        author: c.commit.author.name,
        date: c.commit.author.date,
        url: c.html_url
      }));

      res.json({ commits: formattedCommits });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST: Trigger Application Update/Pull
  app.post("/api/github/update", async (req, res) => {
    const { mode } = req.body; // 'stash' or 'force'
    const logs: string[] = [];
    
    const log = (msg: string) => {
      const timestamp = new Date().toLocaleTimeString();
      logs.push(`[${timestamp}] ${msg}`);
      console.log(`[GitHub Update] ${msg}`);
    };

    try {
      const doc = await getFirestore().collection("settings").doc("github").get();
      if (!doc.exists) {
        return res.status(400).json({ error: "GitHub integration is not configured." });
      }
      const config = doc.data();
      const { owner, repo, branch, token } = config || {};

      if (!owner || !repo) {
        return res.status(400).json({ error: "GitHub repository owner and name are required." });
      }

      log(`Starting application update from repository: ${owner}/${repo} (branch: ${branch})`);

      let remoteUrl = `https://github.com/${owner}/${repo}.git`;
      if (token) {
        remoteUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
      }

      log("Configuring git remote...");
      try {
        await execAsync("git remote remove origin");
      } catch (e) {}
      
      await execAsync(`git remote add origin ${remoteUrl}`);
      log("Git remote origin configured successfully.");

      log("Fetching latest commits from remote...");
      const fetchResult = await execAsync(`git fetch origin ${branch}`);
      if (fetchResult.stderr) {
        log(`Fetch output: ${fetchResult.stderr}`);
      }

      if (mode === "force") {
        log("Reset mode selected: Discarding any local uncommitted changes and forcing reset to origin...");
        const resetResult = await execAsync(`git reset --hard origin/${branch}`);
        log(`Reset completed: ${resetResult.stdout}`);
      } else {
        log("Stash-and-Pull mode selected: Saving any local uncommitted changes first...");
        const stashResult = await execAsync("git stash");
        log(`Stash status: ${stashResult.stdout}`);
        
        log(`Pulling updates on branch: ${branch}...`);
        const pullResult = await execAsync(`git pull origin ${branch}`);
        log(`Pull completed: ${pullResult.stdout}`);

        if (!stashResult.stdout.includes("No local changes to save")) {
          log("Popping stashed local changes...");
          try {
            const popResult = await execAsync("git stash pop");
            log(`Stash pop: ${popResult.stdout}`);
          } catch (stashPopError: any) {
            log(`Warning while popping stash (possible merge conflicts): ${stashPopError.message}`);
          }
        }
      }

      log("Checking for dependency updates in package.json...");
      try {
        const npmInstallResult = await execAsync("npm install");
        log("NPM dependencies verified and updated.");
      } catch (npmError: any) {
        log(`Warning: npm install command completed with messages: ${npmError.message}`);
      }

      log("Compiling production application build (npm run build)...");
      try {
        const buildResult = await execAsync("npm run build");
        log("Build compiled successfully.");
      } catch (buildError: any) {
        log(`Error compiling build: ${buildError.message}`);
        throw new Error(`Build compilation failed: ${buildError.message}`);
      }

      log("GitHub application update completed successfully! Reloading UI components...");
      res.json({ success: true, logs });
    } catch (error: any) {
      log(`ERROR: Update failed: ${error.message}`);
      res.status(500).json({ error: error.message, logs });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
