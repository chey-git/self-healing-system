// ------------------- ELEMENT REFERENCES -------------------
const cpuText = document.getElementById("cpu");
const latencyText = document.getElementById("latency");
const statusText = document.getElementById("status");
const actionText = document.getElementById("action");
const logList = document.getElementById("log-list");
const alertSound = document.getElementById("alert-sound");
const downloadBtn = document.getElementById("downloadBtn");
const healBtn = document.getElementById("healBtn");
const healingEffect = document.getElementById("healingEffect"); // healing animation box

const API_BASE = window.location.origin;

// ------------------- CHART.JS SETUP -------------------
const ctx = document.getElementById("chart").getContext("2d");
const chart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [],
    datasets: [
      { label: "CPU Usage (%)", borderColor: "#ff6384", data: [], tension: 0.3 },
      { label: "Latency (ms)", borderColor: "#36a2eb", data: [], tension: 0.3 },
    ],
  },
  options: {
    animation: { duration: 400 },
    scales: {
      y: { beginAtZero: true, grid: { color: "#222" } },
      x: { grid: { display: false } },
    },
    plugins: { legend: { display: true, position: "bottom" } },
  },
});

// ------------------- STATE VARIABLES -------------------
let allLogs = [];
let lastLogTimestamp = null;

// ------------------- HELPER: ADD LOG ENTRY -------------------
function addLogEntry(level, action, cpu, latency, prepend = true) {
  const time = new Date().toLocaleTimeString();
  const li = document.createElement("li");
  li.classList.add(level.toLowerCase());
  li.textContent = `[${time}] ${level}: ${action} (CPU: ${cpu}%, Latency: ${latency}ms)`;
  if (prepend) logList.prepend(li);
  else logList.append(li);
  allLogs.push(li.textContent);
}

// ------------------- HEALING ANIMATION -------------------
function triggerHealingAnimation(duration = 6000, message = "Healing in progress...") {
  healingEffect.innerHTML = `
    <div class="pulse-circle"></div>
    <h3>${message}</h3>
  `;
  healingEffect.classList.add("active");
  setTimeout(() => healingEffect.classList.remove("active"), duration);
}

// ------------------- FETCH METRICS -------------------
async function fetchMetrics() {
  try {
    const res = await fetch(`${API_BASE}/api/metrics`);
    const data = await res.json();

    const { cpuUsage, latency, level } = data;

    cpuText.textContent = cpuUsage;
    latencyText.textContent = latency;

    let status = "✅ Normal";
    let action = "System Stable";
    let levelType = "Normal";

    // ---------- AI DETECTION ----------
    if (level === "AI-Detected") {
      status = "🤖 AI Agent Active";
      action = "AI detected anomaly and triggered healing";
      levelType = "AI-Detected";
      statusText.style.color = "#00ffff";
      alertSound.play();
      triggerHealingAnimation(7000, "🤖 AI Agent Healing the System...");
    }

    // ---------- CRITICAL / WARNING STATES ----------
    else if (cpuUsage > 85 || latency > 400) {
      status = "🚨 Critical";
      action = "Restarting database service...";
      levelType = "Critical";
      statusText.style.color = "red";
      alertSound.play();
      triggerHealingAnimation(6000, "Restarting Database Service...");
    } else if (cpuUsage > 70 || latency > 250) {
      status = "⚠️ Warning";
      action = "Optimizing slow queries...";
      levelType = "Warning";
      statusText.style.color = "orange";
      triggerHealingAnimation(5000, "Optimizing Performance...");
    } else {
      statusText.style.color = "limegreen";
    }

    statusText.textContent = status;
    actionText.textContent = action;

    // ---------- CHART UPDATE ----------
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
    statusText.style.color = "gray";
  }
}

// ------------------- FETCH LOGS -------------------
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

// ------------------- MANUAL HEAL -------------------
healBtn.addEventListener("click", async () => {
  try {
    const res = await fetch(`${API_BASE}/api/heal`, { method: "POST" });
    const data = await res.json();

    actionText.textContent = data.action;
    addLogEntry("Manual", data.action, cpuText.textContent, latencyText.textContent);
    triggerHealingAnimation(4000, "🛠️ Manual Healing Initiated...");

    alert("✅ " + data.status + "\nAction: " + data.action);
    fetchLogs();
  } catch (error) {
    console.error("❌ Healing failed:", error);
  }
});

// ------------------- DOWNLOAD LOGS -------------------
downloadBtn.addEventListener("click", () => {
  const blob = new Blob([allLogs.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "healing_log.txt";
  a.click();
  URL.revokeObjectURL(url);
});

// ------------------- AUTO REFRESH -------------------
fetchLogs(true);
fetchMetrics();

setInterval(fetchMetrics, 5000);
setInterval(fetchLogs, 8000);
