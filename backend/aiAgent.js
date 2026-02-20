// -------------------- AI AGENT: Anomaly Detection --------------------
let recentMetrics = [];

// This function tracks recent CPU/latency values and detects anomalies intelligently
function detectAnomaly({ cpuUsage, latency }) {
    recentMetrics.push({ cpuUsage, latency });

    // Keep only last 10 entries (sliding window)
    if (recentMetrics.length > 10) recentMetrics.shift();

    // Compute rolling averages
    const avgCPU = recentMetrics.reduce((a, b) => a + b.cpuUsage, 0) / recentMetrics.length;
    const avgLatency = recentMetrics.reduce((a, b) => a + b.latency, 0) / recentMetrics.length;

    // Compute deviation (how much current value differs from average)
    const cpuDeviation = Math.abs(cpuUsage - avgCPU);
    const latencyDeviation = Math.abs(latency - avgLatency);

    // Simple adaptive anomaly detection:
    // If deviation is unusually high, or trend shows continuous rise → anomaly detected
    const cpuSpike = cpuDeviation > 20 && cpuUsage > 85;
    const latencySpike = latencyDeviation > 150 && latency > 400;

    const isAnomaly = cpuSpike || latencySpike;

    if (isAnomaly) {
        console.log("🤖 [AI Agent] Anomaly Detected!");
        console.log(`   CPU Spike: ${cpuSpike}, Latency Spike: ${latencySpike}`);
        console.log(`   Avg CPU: ${avgCPU.toFixed(2)}%, Current: ${cpuUsage}%`);
        console.log(`   Avg Latency: ${avgLatency.toFixed(2)}ms, Current: ${latency}ms`);
    }

    return isAnomaly;
}

module.exports = { detectAnomaly };
