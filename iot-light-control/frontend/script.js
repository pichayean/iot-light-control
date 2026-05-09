const API_BASE = "/api/lights";
let autoRefreshInterval = null;
let isLoading = false;

async function loadLights() {
  // ป้องกัน fetch ซ้อนกันระหว่าง setInterval กับ setLight/setAllLights
  if (isLoading) return;
  isLoading = true;

  try {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const lights = await res.json();

    renderLights(lights);
    renderDeviceInfo(lights.device);
    setConnectionStatus(true);
  } catch (err) {
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
    const card = document.createElement("div");
    card.className = `card ${isOn ? "on" : ""}`;

    card.innerHTML = `
      <div class="card-header">
        <span class="card-title">
          ไฟดวงที่ ${i}${i === 1 || i === 2 ? " (ผ่าน Relay)" : ""}
        </span>
        <span class="bulb ${isOn ? "on" : "off"}">💡</span>
      </div>
      <div>
        <span class="status-badge ${isOn ? "on" : "off"}">${isOn ? "ON" : "OFF"}</span>
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

function renderDeviceInfo(device) {
  const deviceInfo = document.getElementById("deviceInfo");

  if (!deviceInfo) return;

  if (!device) {
    deviceInfo.innerHTML = `
      <div class="device-card offline">
        <h3>ESP32 Device</h3>
        <p>ยังไม่มีข้อมูลจาก ESP32</p>
      </div>
    `;
    return;
  }

  deviceInfo.innerHTML = `
    <div class="device-card">
      <h3>ESP32 Device</h3>
      <p><strong>Wi-Fi:</strong> ${device.ssid || "-"}</p>
      <p><strong>Signal:</strong> ${device.rssi ?? "-"} dBm</p>
      <p><strong>Last Seen:</strong> ${formatLastSeen(device.lastSeen)}</p>
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
    const res = await fetch(`${API_BASE}/${id}/${state}`, { method: "POST" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await loadLights();
  } catch (err) {
    setConnectionStatus(false);
  }
}

async function toggleLight(id, currentState) {
  const newState = currentState ? "off" : "on";
  await setLight(id, newState);
}

async function setAllLights(state) {
  try {
    const res = await fetch(`${API_BASE}/all/${state}`, { method: "POST" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await loadLights();
  } catch (err) {
    setConnectionStatus(false);
  }
}

// โหลดสถานะครั้งแรก แล้ว auto refresh ทุก 2 วินาที
loadLights();
autoRefreshInterval = setInterval(loadLights, 2000);