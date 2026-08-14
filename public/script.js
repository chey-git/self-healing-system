// ------------------- ELEMENT REFERENCES -------------------
const cpuText = document.getElementById("cpu");
const latencyText = document.getElementById("latency");
const statusText = document.getElementById("status");
const actionText = document.getElementById("action");
const logList = document.getElementById("log-list");
const alertSound = document.getElementById("alert-sound");
const downloadBtn = document.getElementById("downloadBtn");
const healBtn = document.getElementById("healBtn");
const healingEffect = document.getElementById("healingEffect");
const healthScoreEl = document.getElementById("healthScore");
const healthLabelEl = document.getElementById("healthLabel");
const eventCountEl = document.getElementById("eventCount");
const uptimeEl = document.getElementById("uptime");

const API_BASE = window.location.origin;

let eventCount = 0;
let metricsHistory = [];
const MAX_HISTORY = 20;

const ctx = document.getElementById("chart").getContext("2d");
const chart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [],
    datasets: [
      { label: "CPU Usage (%)", borderColor: "#60a5fa", data: [], tension: 0.3, fill: false, tension: 0.4 },
      { label: "Latency (ms)", borderColor: "#34d399", data: [], tension: 0.3, fill: false, tension: 0.4 },
    ],
  },
  options: {
    animation: { duration: 400 },
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      y: { 
        beginAtZero: true, 
        grid: { color: "rgba(148, 163, 184, 0.1)" },
        ticks: { color: "#94a3b8" }
      },
      x: { 
        grid: { display: false },
        ticks: { color: "#94a3b8" }
      },
    },
    plugins: { 
      legend: { display: true, position: "bottom", labels: { color: "#cbd5e1" } } 
    },
  },
});

let allLogs = [];
let lastLogTimestamp = null;

function updateHealthScore() {
  if (metricsHistory.length === 0) return;
  
  const recent = metricsHistory.slice(-5);
  let healthScore = 100;
  
  for (const metric of recent) {
    if (metric.cpuUsage > 85) healthScore -= 15;
    else if (metric.cpuUsage > 75) healthScore -= 8;
    
    if (metric.latency > 350) healthScore -= 15;
    else if (metric.latency > 250) healthScore -= 8;
  }
  
  healthScore = Math.max(0, Math.min(100, healthScore));
  
  healthScoreEl.textContent = healthScore + "%";
  healthScoreEl.className = "metric " + (
    healthScore >= 80 ? "health-good" : 
    healthScore >= 50 ? "health-warn" : 
    "health-crit"
  );
  
  healthLabelEl.textContent = 
    healthScore >= 80 ? "Excellent" :
    healthScore >= 60 ? "Good" :
    healthScore >= 40 ? "Warning" :
    "Critical";
}

function updateEventCount() {
  eventCountEl.textContent = eventCount;
}

function showNotification(title, message, icon = "ℹ️") {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, {
      body: message,
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='50' font-size='50' text-anchor='middle' dy='.3em'>" + icon + "</text></svg>",
    });
  }
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function addLogEntry(level, action, cpu, latency, prepend = true) {
  const time = new Date().toLocaleTimeString();
  const li = document.createElement("li");
  li.classList.add(level.toLowerCase());
  li.textContent = `[${time}] ${level}: ${action} (CPU: ${cpu}%, Latency: ${latency}ms)`;
  if (prepend) logList.prepend(li);
  else logList.append(li);
  allLogs.push(li.textContent);
  
  if (level !== "Normal") {
    eventCount += 1;
    updateEventCount();
    showNotification("🚨 System Event", action, "🔔");
  }
}

function triggerHealingAnimation(duration = 6000, message = "Healing in progress...") {
  healingEffect.innerHTML = `
    <div class="pulse-circle"></div>
    <h3>${message}</h3>
  `;
  healingEffect.classList.add("active");
  setTimeout(() => healingEffect.classList.remove("active"), duration);
}

async function fetchMetrics() {
  try {
    const res = await fetch(`${API_BASE}/api/metrics`);
    const data = await res.json();

    const { cpuUsage, latency, level } = data;

    cpuText.textContent = cpuUsage;
    latencyText.textContent = latency;

    metricsHistory.push({ cpuUsage, latency });
    if (metricsHistory.length > MAX_HISTORY) metricsHistory.shift();
    updateHealthScore();

    let status = "✅ Normal";
    let action = "System Stable";

    if (level === "AI-Detected") {
      status = "🤖 AI Agent Active";
      action = "AI detected anomaly and triggered healing";
      statusText.style.color = "#7dd3fc";
      alertSound.play();
      triggerHealingAnimation(7000, "🤖 AI Agent Healing the System...");
      showNotification("🤖 AI Detection", action, "🧠");
    } else if (cpuUsage > 85 || latency > 400) {
      status = "🚨 Critical";
      action = "Restarting database service...";
      statusText.style.color = "#f87171";
      alertSound.play();
      triggerHealingAnimation(6000, "Restarting Database Service...");
      showNotification("🚨 Critical Alert", "Database experiencing critical load", "⚠️");
    } else if (cpuUsage > 70 || latency > 250) {
      status = "⚠️ Warning";
      action = "Optimizing slow queries...";
      statusText.style.color = "#fbbf24";
      triggerHealingAnimation(5000, "Optimizing Performance...");
      showNotification("⚠️ Warning", "System performance degrading", "⚡");
    } else {
      statusText.style.color = "#34d399";
    }

    statusText.textContent = status;
    actionText.textContent = action;

    const time = new Date().toLocaleTimeString();
    chart.data.labels.push(time);
    chart.data.datasets[0].data.push(cpuUsage);
    chart.data.datasets[1].data.push(latency);

    if (chart.data.labels.length > 10) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
      chart.data.datasets[1].data.shift();
    }

    chart.update("none");
  } catch (error) {
    console.error("Error fetching metrics:", error);
    statusText.textContent = "❌ Backend Disconnected";
    statusText.style.color = "#64748b";
    uptimeEl.textContent = "❌";
  }
}

async function fetchLogs(initial = false) {
  try {
    const res = await fetch(`${API_BASE}/api/logs`);
    const logs = await res.json();

    if (initial) {
      logList.innerHTML = "";
      logs.reverse().forEach((log) =>
        addLogEntry(log.level, log.action, log.cpu, log.latency, false)
      );
      if (logs.length > 0) lastLogTimestamp = logs[0].timestamp;
      eventCount = logs.filter(l => l.level !== "Normal").length;
      updateEventCount();
    } else {
      if (logs.length > 0 && logs[0].timestamp !== lastLogTimestamp) {
        const newLogs = logs.filter((log) => log.timestamp !== lastLogTimestamp);
        newLogs.reverse().forEach((log) =>
          addLogEntry(log.level, log.action, log.cpu, log.latency, true)
        );
        lastLogTimestamp = logs[0].timestamp;
      }
    }
  } catch (error) {
    console.error("Error fetching logs:", error);
  }
}

healBtn.addEventListener("click", async () => {
  try {
    const res = await fetch(`${API_BASE}/api/heal`, { method: "POST" });
    const data = await res.json();

    actionText.textContent = data.action;
    addLogEntry("Manual", data.action, cpuText.textContent, latencyText.textContent);
    triggerHealingAnimation(4000, "🛠️ Manual Healing Initiated...");
    showNotification("🛠️ Manual Heal", data.action, "✅");

    alert("✅ " + data.status + "\nAction: " + data.action);
    fetchLogs();
  } catch (error) {
    console.error("❌ Healing failed:", error);
  }
});

downloadBtn.addEventListener("click", () => {
  const blob = new Blob([allLogs.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "healing_log_" + new Date().toISOString().slice(0, 10) + ".txt";
  a.click();
  URL.revokeObjectURL(url);
});

requestNotificationPermission();
fetchLogs(true);
fetchMetrics();
setInterval(fetchMetrics, 5000);
setInterval(fetchLogs, 8000);
