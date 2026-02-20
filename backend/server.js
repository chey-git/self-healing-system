// ---------------------- IMPORTS ----------------------
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { exec } = require("child_process");
const path = require("path");
const notifier = require("node-notifier");
const { detectAnomaly } = require("./aiAgent");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// ---------------------- MONGODB CONNECTION ----------------------
mongoose
  .connect("mongodb://127.0.0.1:27017/selfHealingDB")
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection failed:", err));

// ---------------------- SCHEMA ----------------------
const healingLogSchema = new mongoose.Schema({
  level: String,
  action: String,
  cpu: Number,
  latency: Number,
  timestamp: { type: Date, default: Date.now },
});
const HealingLog = mongoose.model("HealingLog", healingLogSchema);

// ---------------------- GENERATE METRICS ----------------------
function generateMetrics() {
  const cpuUsage = Math.floor(Math.random() * 60) + 40; // 40–100
  const latency = Math.floor(Math.random() * 450) + 50; // 50–500
  const errors = Math.floor(Math.random() * 10);
  return { cpuUsage, latency, errors, timestamp: new Date().toISOString() };
}

// ---------------------- STATE TRACKERS ----------------------
let warningCount = 0;
let criticalCount = 0;
let cooldownActive = false;

// ---------------------- ROUTE: GET METRICS ----------------------
app.get("/metrics", async (req, res) => {
  const metrics = generateMetrics();
  let level = "Normal";
  let action = "System stable";

  // ---------------- AI ANOMALY DETECTION ----------------
  const isAnomaly = detectAnomaly(metrics);
  if (isAnomaly) {
    console.log("🤖 AI Agent detected an anomaly — triggering healing response!");
    level = "AI-Detected";
    action = "AI Agent initiated self-healing";

    notifier.notify({
      title: "🤖 AI Agent Alert",
      message: "Anomaly detected — healing initiated automatically",
      sound: true,
    });

    exec(`node "${path.join(__dirname, "actions", "optimizeQueries.js")}"`);

    const log = new HealingLog({
      level,
      action,
      cpu: metrics.cpuUsage,
      latency: metrics.latency,
    });
    await log.save();
  }

  // ---------------- DETECT CONDITIONS ----------------
  if (metrics.cpuUsage > 85 || metrics.latency > 400) {
    criticalCount++;
    warningCount = 0;
    console.log(`⚠️ Critical detected (${criticalCount}/3)`);
  } else if (metrics.cpuUsage > 70 || metrics.latency > 250) {
    warningCount++;
    criticalCount = 0;
    console.log(`⚠️ Warning detected (${warningCount}/3)`);
  } else {
    warningCount = 0;
    criticalCount = 0;
    console.log("✅ Stable metrics detected. Counters reset.");
  }

  // ---------------- COOLDOWN CHECK ----------------
  if (cooldownActive) {
    console.log("⏸️ Healing cooldown active (30s). Skipping healing...");
    return res.json(metrics);
  }

  // ---------------- CRITICAL ACTION (after 3 consistent cycles) ----------------
  if (criticalCount >= 3) {
    level = "Critical";
    action = "Restarted database service automatically";
    criticalCount = 0;
    cooldownActive = true;

    notifier.notify({
      title: "🚨 Self-Healing Database Alert",
      message: "Critical issue persisted — Restarting DB service...",
      sound: true,
    });

    exec(`node "${path.join(__dirname, "actions", "restartDB.js")}"`, (err) => {
      if (err) console.error("Error executing restart script:", err);
      else console.log("🧠 Restart action executed successfully!");
    });

    setTimeout(() => (cooldownActive = false), 30000);
  }

  // ---------------- WARNING ACTION (after 3 consistent cycles) ----------------
  else if (warningCount >= 3) {
    level = "Warning";
    action = "Killed slow queries automatically";
    warningCount = 0;
    cooldownActive = true;

    notifier.notify({
      title: "⚠️ Performance Warning",
      message: "Warning persisted — Optimizing database queries...",
      sound: false,
    });

    exec(`node "${path.join(__dirname, "actions", "optimizeQueries.js")}"`, (err) => {
      if (err) console.error("Error executing optimization script:", err);
      else console.log("⚙️ Optimization action executed successfully!");
    });

    setTimeout(() => (cooldownActive = false), 30000);
  }

  // ---------------- LOGGING TO DATABASE ----------------
  if (level !== "Normal") {
    try {
      const log = new HealingLog({
        level,
        action,
        cpu: metrics.cpuUsage,
        latency: metrics.latency,
      });
      await log.save();
      console.log(`🧠 Logged ${level} event: ${action}`);
    } catch (err) {
      console.error("❌ Error saving log to MongoDB:", err);
    }
  }

  // Return metrics to frontend
  res.json(metrics);
});

// ---------------------- ROUTE: MANUAL HEAL ----------------------
app.post("/heal", async (req, res) => {
  const healActions = [
    "Restarted database services successfully.",
    "Rebuilt indexes and optimized queries.",
    "Cleared cache and improved performance.",
    "Scaled database cluster to handle load.",
    "Reconnected replica nodes and synced data.",
  ];

  const randomAction = healActions[Math.floor(Math.random() * healActions.length)];

  const log = new HealingLog({
    level: "Manual",
    action: randomAction,
    cpu: Math.floor(Math.random() * 100),
    latency: Math.floor(Math.random() * 500),
  });
  await log.save();

  notifier.notify({
    title: "🛠️ Manual Heal Triggered",
    message: randomAction,
    sound: true,
  });

  res.json({
    status: "Healing Completed ✅",
    action: randomAction,
    timestamp: new Date().toISOString(),
  });

  console.log("🧩 Manual healing action executed:", randomAction);
});

// ---------------------- ROUTE: VIEW ALL LOGS ----------------------
app.get("/logs", async (req, res) => {
  try {
    const logs = await HealingLog.find().sort({ timestamp: -1 }).limit(20);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: "Error fetching logs" });
  }
});

// ---------------------- DEFAULT ROUTE ----------------------
app.get("/", (req, res) => {
  res.send("✅ Self-Healing Database Backend Running — use /metrics, /heal, or /logs");
});

// ---------------------- START SERVER ----------------------
app.listen(PORT, () => {
  console.log(`✅ Backend server running on http://localhost:${PORT}`);
});
