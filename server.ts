import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
// On Google Cloud / Cloud Run, this will automatically use the service account
try {
  admin.initializeApp();
} catch (error) {
  console.warn("Firebase Admin failed to initialize with default credentials. Admin actions may fail.", error);
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
