import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // Admin: Update User Password
  app.post("/api/admin/update-password", async (req, res) => {
    const { uid, newPassword, adminToken } = req.body;
    
    if (!uid || !newPassword || !adminToken) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      // Verify the admin token
      const decodedToken = await admin.auth().verifyIdToken(adminToken);
      
      // Check if the user is actually an admin in Firestore
      const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
      const userData = userDoc.data();

      if (userData?.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized: Admin privileges required" });
      }

      // Update the user's password
      await admin.auth().updateUser(uid, { password: newPassword });
      
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
      const doc = await admin.firestore().collection("settings").doc("github").get();
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
      const docRef = admin.firestore().collection("settings").doc("github");
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
      const doc = await admin.firestore().collection("settings").doc("github").get();
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
      const doc = await admin.firestore().collection("settings").doc("github").get();
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
