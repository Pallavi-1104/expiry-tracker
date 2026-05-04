require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const path = require("path");
const cron = require("node-cron");
const { sendExpiryAlerts } = require("./utils/emailService");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "frontend")));

// ── PWA: Serve service worker file ──────────────────────
// sw.js must be served from root (/) not from /frontend/
// That is why we need this special route
app.get("/sw.js", (req, res) => {
    res.set("Content-Type", "application/javascript");
    res.set("Service-Worker-Allowed", "/");
    res.sendFile(path.join(__dirname, "frontend", "sw.js"));
});

// ── PWA: Serve manifest file ─────────────────────────────
app.get("/manifest.json", (req, res) => {
    res.set("Content-Type", "application/manifest+json");
    res.sendFile(path.join(__dirname, "frontend", "manifest.json"));
});

// ── PWA: Serve offline page ──────────────────────────────
app.get("/offline.html", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "offline.html"));
});

// ── PWA: Serve icons folder ──────────────────────────────
app.use("/icons", express.static(
    path.join(__dirname, "frontend", "icons")
));

// MySQL Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.log("❌ MySQL Error:", err.message);
    return;
  }
  console.log("✅ MySQL Connected Successfully!");
});

// Share DB
app.set("db", db);

// Routes
app.use("/auth", require("./routes/auth"));
app.use("/", require("./routes/items"));

// Cron Job (8 AM)
cron.schedule("0 8 * * *", async () => {
  console.log("🔔 Daily expiry check running at 8AM...");
  await sendExpiryAlerts(db);
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
