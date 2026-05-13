const API_BASE = "/api/lights";

let autoRefreshInterval = null;
let isLoading = false;
let sensorTargets = [];

async function loadLights() {
  // ป้องกัน fetch ซ้อนกันระหว่าง setInterval กับ setLight/setAllLights
  if (isLoading) return;
  isLoading = true;

  try {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const lights = await res.json();

    // sync รายการหลอดที่ใช้ sensor จาก backend
    sensorTargets = Array.isArray(lights.sensorTargets)
      ? lights.sensorTargets.map(Number)
      : [];

    renderLights(lights);
    renderSensorInfo();
    renderDeviceInfo(lights.device);
    setConnectionStatus(true);
  } catch (err) {
    console.error("[loadLights]", err);
    setConnectionStatus(false);
  } finally {
    isLoading = false;
  }
}

function renderLights(lights) {
  const grid = document.getElementById("lightsGrid");
  grid.innerHTML = "";

  for (let i = 1; i <= 5; i++) {
    const isOn = lights[`light${i}`];
    const useSensor = sensorTargets.includes(i);

    const card = document.createElement("div");
    card.className = `card ${isOn ? "on" : ""} ${useSensor ? "sensor-enabled" : ""}`;

    card.innerHTML = `
      <div class="card-header">
        <span class="card-title">
          ไฟดวงที่ ${i}${i === 1 || i === 2 ? " (ผ่าน Relay)" : ""}
        </span>
        <span class="bulb ${isOn ? "on" : "off"}">💡</span>
      </div>

      <div>
        <span class="status-badge ${isOn ? "on" : "off"}">
          ${isOn ? "ON" : "OFF"}
        </span>
      </div>

      <div class="sensor-option">
        <label>
          <input
            type="checkbox"
            ${useSensor ? "checked" : ""}
            onchange="toggleSensorTarget(${i}, this.checked)"
          />
          ใช้ Sensor แสง
        </label>
      </div>

      <div class="card-buttons">
        <button class="btn btn-on" onclick="setLight(${i}, 'on')">เปิด</button>
        <button class="btn btn-off" onclick="setLight(${i}, 'off')">ปิด</button>
        <button class="btn btn-toggle" onclick="toggleLight(${i}, ${isOn})">Toggle</button>
      </div>
    `;

    grid.appendChild(card);
  }
}

function renderSensorInfo() {
  const sensorInfo = document.getElementById("sensorInfo");
  if (!sensorInfo) return;

  if (!sensorTargets.length) {
    sensorInfo.innerHTML = `
      <div class="sensor-card">
        <span class="sensor-label">Sensor แสง:</span>
        <span class="sensor-value">ยังไม่ได้เลือกหลอด</span>
      </div>
    `;
    return;
  }

  sensorInfo.innerHTML = `
    <div class="sensor-card active">
      <span class="sensor-label">Sensor แสงควบคุม:</span>
      <span class="sensor-value">
        หลอด ${sensorTargets.join(", ")}
      </span>
    </div>
  `;
}

function renderDeviceInfo(device) {
  const deviceInfo = document.getElementById("deviceInfo");

  if (!deviceInfo) return;

  if (!device) {
    deviceInfo.innerHTML = `
      <div class="device-card offline compact-device">
        <span class="device-label">ESP32:</span>
        <span class="wifi-name">ยังไม่มีข้อมูล Wi-Fi</span>
      </div>
    `;
    return;
  }

  deviceInfo.innerHTML = `
    <div class="device-card compact-device">
      <span class="device-label">Wi-Fi:</span>
      <span class="wifi-name">${device.ssid || "-"}</span>
      <span class="wifi-rssi">${device.rssi ?? "-"} dBm</span>
      ${
        typeof device.isDark !== "undefined"
          ? `<span class="sensor-state">Sensor: ${device.isDark ? "มืด" : "สว่าง"}</span>`
          : ""
      }
    </div>
  `;
}

function formatLastSeen(lastSeen) {
  if (!lastSeen) return "-";

  const date = new Date(lastSeen);

  if (Number.isNaN(date.getTime())) {
    return lastSeen;
  }

  return date.toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

function setConnectionStatus(online) {
  const dot = document.getElementById("statusDot");
  const label = document.getElementById("connectionStatus");

  if (online) {
    dot.className = "status-dot online";
    label.textContent = "Backend Online";
  } else {
    dot.className = "status-dot offline";
    label.textContent = "Backend Offline";
  }
}

async function setLight(id, state) {
  try {
    const res = await fetch(`${API_BASE}/${id}/${state}`, {
      method: "POST",
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    await loadLights();
  } catch (err) {
    console.error("[setLight]", err);
    setConnectionStatus(false);
  }
}

async function toggleLight(id, currentState) {
  const newState = currentState ? "off" : "on";
  await setLight(id, newState);
}

async function setAllLights(state) {
  try {
    const res = await fetch(`${API_BASE}/all/${state}`, {
      method: "POST",
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    await loadLights();
  } catch (err) {
    console.error("[setAllLights]", err);
    setConnectionStatus(false);
  }
}

async function toggleSensorTarget(id, enabled) {
  if (enabled) {
    if (!sensorTargets.includes(id)) {
      sensorTargets.push(id);
    }
  } else {
    sensorTargets = sensorTargets.filter((item) => item !== id);
  }

  sensorTargets.sort((a, b) => a - b);

  try {
    const res = await fetch(`${API_BASE}/sensor-config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sensorTargets }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    await loadLights();
  } catch (err) {
    console.error("[toggleSensorTarget]", err);
    setConnectionStatus(false);
  }
}

// โหลดสถานะครั้งแรก แล้ว auto refresh ทุก 2 วินาที
loadLights();
autoRefreshInterval = setInterval(loadLights, 2000);