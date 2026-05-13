const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, "lights.json");

app.use(cors());
app.use(express.json());

// เสิร์ฟ static frontend จากโฟลเดอร์ frontend
app.use(express.static(path.join(__dirname, "../frontend")));

const DEFAULT_LIGHTS = {
  light1: false,
  light2: false,
  light3: false,
  light4: false,
  light5: false,

  // หลอดที่ให้ sensor แสงควบคุม
  // เช่น [1, 2] = sensor คุมหลอด 1 และ 2
  sensorTargets: [],

  device: {
    ssid: "",
    ip: "",
    rssi: 0,
    lastSeen: "",
    lightSensor: null,
    isDark: null,
  },
};

function readLights() {
  const data = fs.readFileSync(DB_FILE, "utf8");
  return JSON.parse(data);
}

function writeLights(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
}

function isValidLightId(id) {
  return ["1", "2", "3", "4", "5"].includes(String(id));
}

function isValidState(state) {
  return ["on", "off"].includes(state);
}

function normalizeSensorTargets(targets) {
  if (!Array.isArray(targets)) {
    return [];
  }

  return [...new Set(
    targets
      .map(Number)
      .filter((id) => id >= 1 && id <= 5)
  )].sort((a, b) => a - b);
}

// ถ้า lights.json หาย, JSON เสีย, หรือ key ไม่ครบ ให้ซ่อมข้อมูล
function initDB() {
  try {
    const lights = readLights();

    const mergedLights = {
      ...DEFAULT_LIGHTS,
      ...lights,
      sensorTargets: normalizeSensorTargets(lights.sensorTargets || []),
      device: {
        ...DEFAULT_LIGHTS.device,
        ...(lights.device || {}),
      },
    };

    writeLights(mergedLights);
  } catch {
    console.log("[DB] lights.json not found or invalid — creating with defaults");
    writeLights(DEFAULT_LIGHTS);
  }
}

initDB();

// GET /api/lights — ดึงสถานะไฟทั้งหมด + ข้อมูล ESP32 + sensor config
app.get("/api/lights", (req, res) => {
  try {
    const lights = readLights();

    res.json({
      ...DEFAULT_LIGHTS,
      ...lights,
      sensorTargets: normalizeSensorTargets(lights.sensorTargets || []),
      device: {
        ...DEFAULT_LIGHTS.device,
        ...(lights.device || {}),
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Cannot read lights data",
    });
  }
});

// GET /api/lights/:id — ดึงสถานะไฟดวงเดียว
app.get("/api/lights/:id", (req, res) => {
  const { id } = req.params;

  if (!isValidLightId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid light id. Must be 1-5",
    });
  }

  try {
    const lights = readLights();

    res.json({
      success: true,
      id: Number(id),
      state: lights[`light${id}`],
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Cannot read lights data",
    });
  }
});

// POST /api/lights/all/:state — เปิด/ปิดไฟทั้งหมด
app.post("/api/lights/all/:state", (req, res) => {
  const { state } = req.params;

  if (!isValidState(state)) {
    return res.status(400).json({
      success: false,
      message: "Invalid state. Must be 'on' or 'off'",
    });
  }

  try {
    const oldData = readLights();
    const value = state === "on";

    const lights = {
      ...oldData,
      light1: value,
      light2: value,
      light3: value,
      light4: value,
      light5: value,
      sensorTargets: normalizeSensorTargets(oldData.sensorTargets || []),
      device: {
        ...DEFAULT_LIGHTS.device,
        ...(oldData.device || {}),
      },
    };

    writeLights(lights);

    res.json({
      success: true,
      message: `All lights turned ${state}`,
      lights,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Cannot write lights data",
    });
  }
});

// POST /api/lights/sensor-config — frontend ตั้งค่าว่าหลอดไหนใช้ sensor
app.post("/api/lights/sensor-config", (req, res) => {
  const { sensorTargets } = req.body;

  if (!Array.isArray(sensorTargets)) {
    return res.status(400).json({
      success: false,
      message: "sensorTargets must be an array",
    });
  }

  try {
    const lights = readLights();
    const normalizedTargets = normalizeSensorTargets(sensorTargets);

    lights.sensorTargets = normalizedTargets;

    writeLights(lights);

    res.json({
      success: true,
      message: "Sensor config updated",
      sensorTargets: normalizedTargets,
      lights,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Cannot write sensor config",
    });
  }
});

// GET /api/lights/sensor-config — ดู config หลอดที่ใช้ sensor
app.get("/api/lights/sensor-config", (req, res) => {
  try {
    const lights = readLights();

    res.json({
      success: true,
      sensorTargets: normalizeSensorTargets(lights.sensorTargets || []),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Cannot read sensor config",
    });
  }
});

// POST /api/lights/sensor/:state
// ESP32 เรียก endpoint นี้ตอน sensor เจอมืด/สว่าง
// on  = เปิดเฉพาะหลอดที่ติ๊กใช้ sensor
// off = ปิดเฉพาะหลอดที่ติ๊กใช้ sensor
app.post("/api/lights/sensor/:state", (req, res) => {
  const { state } = req.params;

  if (!isValidState(state)) {
    return res.status(400).json({
      success: false,
      message: "Invalid state. Must be 'on' or 'off'",
    });
  }

  try {
    const lights = readLights();
    const targets = normalizeSensorTargets(lights.sensorTargets || []);
    const value = state === "on";

    targets.forEach((id) => {
      lights[`light${id}`] = value;
    });

    lights.sensorTargets = targets;

    writeLights(lights);

    res.json({
      success: true,
      message: `Sensor target lights turned ${state}`,
      state,
      sensorTargets: targets,
      lights,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Cannot write sensor lights data",
    });
  }
});

// POST /api/lights/:id/:state — เปิด/ปิดไฟดวงเดียว
app.post("/api/lights/:id/:state", (req, res) => {
  const { id, state } = req.params;

  if (!isValidLightId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid light id. Must be 1-5",
    });
  }

  if (!isValidState(state)) {
    return res.status(400).json({
      success: false,
      message: "Invalid state. Must be 'on' or 'off'",
    });
  }

  try {
    const lights = readLights();

    lights[`light${id}`] = state === "on";
    lights.sensorTargets = normalizeSensorTargets(lights.sensorTargets || []);

    writeLights(lights);

    res.json({
      success: true,
      message: `Light ${id} turned ${state}`,
      lights,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Cannot write lights data",
    });
  }
});

// POST /api/device — ESP32 ส่งข้อมูล Wi-Fi / Device status
app.post("/api/device", (req, res) => {
  const { ssid, ip, rssi, lightSensor, isDark } = req.body;

  if (typeof ssid !== "string") {
    return res.status(400).json({
      success: false,
      message: "ssid must be string",
    });
  }

  if (typeof ip !== "string") {
    return res.status(400).json({
      success: false,
      message: "ip must be string",
    });
  }

  if (typeof rssi !== "number") {
    return res.status(400).json({
      success: false,
      message: "rssi must be number",
    });
  }

  try {
    const lights = readLights();

    lights.device = {
      ssid,
      ip,
      rssi,
      lastSeen: new Date().toISOString(),

      // optional จาก ESP32
      lightSensor: typeof lightSensor === "number" ? lightSensor : null,
      isDark: typeof isDark === "boolean" ? isDark : null,
    };

    lights.sensorTargets = normalizeSensorTargets(lights.sensorTargets || []);

    writeLights(lights);

    res.json({
      success: true,
      message: "Device status updated",
      device: lights.device,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Cannot write device status",
    });
  }
});

// GET /api/device — frontend เรียกดูข้อมูล ESP32 แยกได้
app.get("/api/device", (req, res) => {
  try {
    const lights = readLights();

    res.json({
      success: true,
      device: {
        ...DEFAULT_LIGHTS.device,
        ...(lights.device || {}),
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Cannot read device status",
    });
  }
});

// fallback ให้เปิดหน้าเว็บได้เวลา refresh route อื่น
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`ESP32 API: http://YOUR_SERVER_IP:${PORT}/api/lights`);
});