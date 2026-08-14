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
const uptimePercentEl = document.getElementById("uptime-percent");
const detectionLatencyEl = document.getElementById("detectionLatency");
const issuesResolvedEl = document.getElementById("issuesResolved");
const successRateEl = document.getElementById("successRate");

const API_BASE = window.location.origin;

let eventCount = 0;
let issuesResolved = 0;
let metricsHistory = [];
const MAX_HISTORY = 20;
let startTime = Date.now();
let downtime = 0;

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
let autoRefreshEnabled = true;
let metricsIntervalId = null;
let logsIntervalId = null;

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
  
  updateUptimePercent(healthScore);
}

function updateUptimePercent(healthScore) {
  const baseUptime = 99.9;
  const adjustedUptime = Math.max(95, baseUptime - (100 - healthScore) * 0.05);
  uptimePercentEl.textContent = adjustedUptime.toFixed(1) + "%";
}

function updateDetectionLatency() {
  const avg = metricsHistory.length > 0 ? 
    Math.round(metricsHistory.reduce((a, m) => a + m.latency, 0) / metricsHistory.length) : 0;
  
  let latency = "< 2s";
  if (avg > 200) latency = "< 3s";
  if (avg > 300) latency = "< 5s";
  
  detectionLatencyEl.textContent = latency;
}

function updateIssuesResolved() {
  issuesResolvedEl.textContent = issuesResolved;
}

function updateSuccessRate() {
  const rate = eventCount > 0 ? Math.round((issuesResolved / eventCount) * 100) : 100;
  successRateEl.textContent = rate + "%";
}

function updateEventCount() {
  eventCountEl.textContent = eventCount;
}

function updateGauges(cpuUsage, latency) {
  // Update CPU gauge
  const cpuPercentage = Math.min(100, cpuUsage);
  const cpuCircumference = 283;
  const cpuOffset = cpuCircumference - (cpuPercentage / 100) * cpuCircumference;
  
  const cpuGaugeEl = document.getElementById("cpuGauge");
  if (cpuGaugeEl) {
    cpuGaugeEl.style.strokeDashoffset = cpuOffset;
    cpuGaugeEl.style.stroke = cpuUsage > 80 ? "#f87171" : cpuUsage > 60 ? "#fbbf24" : "#34d399";
  }
  
  document.getElementById("cpuGaugeValue").textContent = cpuUsage + "%";
  
  // Update Latency health bar
  const maxLatency = 500;
  const healthPercentage = Math.max(0, 100 - (latency / maxLatency) * 100);
  const latencyBar = document.getElementById("latencyHealthBar");
  if (latencyBar) {
    latencyBar.style.width = healthPercentage + "%";
    latencyBar.style.background = 
      latency > 350 ? "linear-gradient(90deg, #f87171, #dc2626)" :
      latency > 250 ? "linear-gradient(90deg, #fbbf24, #f59e0b)" :
      "linear-gradient(90deg, #34d399, #22c55e)";
  }
  
  document.getElementById("latencyHealthValue").textContent = 
    latency > 350 ? "Critical" :
    latency > 250 ? "Warning" :
    "Excellent";
  
  // Update System Load bar
  const avgLoad = metricsHistory.length > 0 ?
    Math.round(metricsHistory.reduce((a, m) => a + m.cpuUsage, 0) / metricsHistory.length) : 0;
  
  const loadBar = document.getElementById("systemLoadBar");
  if (loadBar) {
    loadBar.style.width = Math.min(100, avgLoad) + "%";
    loadBar.className = avgLoad > 80 ? "load-bar critical" :
                        avgLoad > 60 ? "load-bar warning" :
                        "load-bar normal";
  }
  
  document.getElementById("systemLoadValue").textContent = 
    avgLoad > 80 ? "Critical" :
    avgLoad > 60 ? "High" :
    avgLoad > 40 ? "Medium" :
    "Low";
}

function updateAlerts(cpuUsage, latency) {
  const alertsSection = document.getElementById("alertSection");
  const alertsList = document.getElementById("alertsList");
  const alerts = [];
  
  if (cpuUsage > 85) {
    alerts.push({
      level: "🚨 Critical",
      message: "CPU usage is critically high (" + cpuUsage + "%)"
    });
  }
  if (latency > 350) {
    alerts.push({
      level: "🚨 Critical",
      message: "Latency exceeds critical threshold (" + latency + "ms)"
    });
  }
  if (cpuUsage > 70 || latency > 250) {
    alerts.push({
      level: "⚠️ Warning",
      message: "System performance is degrading"
    });
  }
  
  if (alerts.length > 0) {
    alertsSection.style.display = "block";
    alertsList.innerHTML = alerts.map(alert => 
      `<div class="alert-item">
         <p style="color: ${alert.level.includes("🚨") ? "#fca5a5" : "#fcd34d"};"><strong>${alert.level}</strong></p>
         <p style="color: #cbd5e1;">${alert.message}</p>
       </div>`
    ).join("");
  } else {
    alertsSection.style.display = "none";
  }
}

function toggleAutoRefresh() {
  autoRefreshEnabled = !autoRefreshEnabled;
  const btn = document.getElementById("refreshToggle");
  btn.textContent = "🔄 Auto-Refresh: " + (autoRefreshEnabled ? "ON" : "OFF");
  
  if (autoRefreshEnabled) {
    metricsIntervalId = setInterval(fetchMetrics, 5000);
    logsIntervalId = setInterval(fetchLogs, 8000);
  } else {
    clearInterval(metricsIntervalId);
    clearInterval(logsIntervalId);
  }
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
    issuesResolved += 1;
    updateEventCount();
    updateIssuesResolved();
    updateSuccessRate();
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
    updateDetectionLatency();
    updateGauges(cpuUsage, latency);
    updateAlerts(cpuUsage, latency);

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
    downtime += 5;
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
      issuesResolved = logs.filter(l => ["Critical", "Warning", "AI-Detected"].includes(l.level)).length;
      updateEventCount();
      updateIssuesResolved();
      updateSuccessRate();
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
metricsIntervalId = setInterval(fetchMetrics, 5000);
logsIntervalId = setInterval(fetchLogs, 8000);

// Add refresh toggle
document.getElementById("refreshToggle").addEventListener("click", toggleAutoRefresh);
