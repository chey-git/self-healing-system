const { MongoClient } = require("mongodb");
const { detectAnomaly } = require("../../backend/aiAgent");

const state = {
  logs: [],
  warningCount: 0,
  criticalCount: 0,
  cooldownActive: false,
  demoIndex: 0,
};

let clientPromise = null;

function getMongoClient() {
  if (!process.env.MONGODB_URI) {
    return null;
  }

  if (!clientPromise) {
    clientPromise = new MongoClient(process.env.MONGODB_URI).connect();
  }

  return clientPromise;
}

async function getLogCollection() {
  const client = await getMongoClient();
  if (!client) return null;
  const db = client.db(process.env.MONGODB_DB_NAME || "selfHealingDB");
  return db.collection("healing_logs");
}

function sendJson(res, status, payload) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.status(status).json(payload);
}

function generateMetrics() {
  state.demoIndex += 1;
  const cycle = state.demoIndex % 5;

  let cpuUsage;
  let latency;
  let errors;

  if (cycle === 0) {
    cpuUsage = 95;
    latency = 420;
    errors = 9;
  } else if (cycle === 1) {
    cpuUsage = 82;
    latency = 310;
    errors = 6;
  } else if (cycle === 2) {
    cpuUsage = 68;
    latency = 180;
    errors = 2;
  } else if (cycle === 3) {
    cpuUsage = 88;
    latency = 330;
    errors = 7;
  } else {
    cpuUsage = 56;
    latency = 140;
    errors = 1;
  }

  return {
    cpuUsage,
    latency,
    errors,
    timestamp: new Date().toISOString(),
  };
}

async function addLog(level, action, cpu, latency) {
  const entry = {
    level,
    action,
    cpu,
    latency,
    timestamp: new Date().toISOString(),
  };

  const collection = await getLogCollection();
  if (collection) {
    await collection.insertOne(entry);
    const logs = await collection.find({}).sort({ timestamp: -1 }).limit(20).toArray();
    state.logs = logs;
    return entry;
  }

  state.logs.unshift(entry);
  state.logs = state.logs.slice(0, 20);
  return entry;
}

async function getLogs() {
  const collection = await getLogCollection();
  if (collection) {
    const logs = await collection.find({}).sort({ timestamp: -1 }).limit(20).toArray();
    state.logs = logs;
    return logs;
  }

  return state.logs;
}

function resetCounters() {
  state.warningCount = 0;
  state.criticalCount = 0;
}

function evaluateMetrics(metrics) {
  const result = {
    ...metrics,
    level: "Normal",
    action: "System stable",
  };

  const anomalyDetected = detectAnomaly(metrics);
  if (anomalyDetected) {
    result.level = "AI-Detected";
    result.action = "AI Agent initiated self-healing";
    addLog(result.level, result.action, metrics.cpuUsage, metrics.latency);
  }

  if (metrics.cpuUsage > 75 || metrics.latency > 220) {
    state.criticalCount += 1;
    state.warningCount = 0;
  } else if (metrics.cpuUsage > 60 || metrics.latency > 160) {
    state.warningCount += 1;
    state.criticalCount = 0;
  } else {
    resetCounters();
  }

  if (state.cooldownActive) {
    result.level = result.level === "Normal" ? "Normal" : result.level;
    return result;
  }

  if (state.criticalCount >= 1) {
    result.level = "Critical";
    result.action = "Restarted database service automatically";
    state.criticalCount = 0;
    state.cooldownActive = true;
    setTimeout(() => {
      state.cooldownActive = false;
    }, 10000);
    addLog(result.level, result.action, metrics.cpuUsage, metrics.latency);
  } else if (state.warningCount >= 1) {
    result.level = "Warning";
    result.action = "Killed slow queries automatically";
    state.warningCount = 0;
    state.cooldownActive = true;
    setTimeout(() => {
      state.cooldownActive = false;
    }, 10000);
    addLog(result.level, result.action, metrics.cpuUsage, metrics.latency);
  }

  return result;
}

async function triggerManualHeal() {
  const healActions = [
    "Restarted database services successfully.",
    "Rebuilt indexes and optimized queries.",
    "Cleared cache and improved performance.",
    "Scaled database cluster to handle load.",
    "Reconnected replica nodes and synced data.",
  ];

  const action = healActions[Math.floor(Math.random() * healActions.length)];
  await addLog("Manual", action, Math.floor(Math.random() * 100), Math.floor(Math.random() * 500));

  return {
    status: "Healing Completed ✅",
    action,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  generateMetrics,
  evaluateMetrics,
  getLogs,
  addLog,
  triggerManualHeal,
  sendJson,
};
