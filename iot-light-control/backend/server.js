const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const mqtt = require("mqtt");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DB_FILE = path.join(__dirname, "lights.json");
const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const MQTT_LIGHT_TOPIC = process.env.MQTT_LIGHT_TOPIC || "iot-light-control/lights/state";
const MQTT_DEVICE_TOPIC = process.env.MQTT_DEVICE_TOPIC || "iot-light-control/device/status";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const LOG_MQTT_ONLY = true;

function log(level, message, meta = null) {
  if (LOG_MQTT_ONLY && !message.startsWith("MQTT publish")) {
    return;
  }

  const ts = new Date().toISOString();
  if (meta) {
    console.log(`[${ts}] [${level.toUpperCase()}] ${message}`, meta);
    return;
  }
  console.log(`[${ts}] [${level.toUpperCase()}] ${message}`);
}

app.use(cors({
  origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",").map((origin) => origin.trim()),
}));
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

function normalizeLights(lights = {}) {
  return {
    ...DEFAULT_LIGHTS,
    ...lights,
    sensorTargets: normalizeSensorTargets(lights.sensorTargets || []),
    device: {
      ...DEFAULT_LIGHTS.device,
      ...(lights.device || {}),
    },
  };
}

function readNormalizedLights() {
  return normalizeLights(readLights());
}

function writeNormalizedLights(lights) {
  writeLights(normalizeLights(lights));
}

let mqttClient = null;

function publishMqtt(topic, payload, options = {}) {
  if (!mqttClient || !mqttClient.connected) {
    log("warn", "MQTT publish skipped: client not connected", { topic });
    return;
  }

    mqttClient.publish(topic, JSON.stringify(payload), {
    qos: 1,
    retain: true,
    ...options,
  }, (err) => {
    if (err) {
      log("error", "MQTT publish failed", {
        topic,
        error: err.message,
      });
      return;
    }
    log("info", "MQTT publish success", {
      topic,
      source: payload?.source || "unknown",
      updatedAt: payload?.updatedAt || null,
    });
  });
}

function publishLightState(lights, source = "backend") {
  publishMqtt(MQTT_LIGHT_TOPIC, {
    ...normalizeLights(lights),
    source,
    updatedAt: new Date().toISOString(),
  });
}

function publishDeviceState(device, source = "backend") {
  publishMqtt(MQTT_DEVICE_TOPIC, {
    ...DEFAULT_LIGHTS.device,
    ...(device || {}),
    source,
    updatedAt: new Date().toISOString(),
  });
}

function persistLightsAndBroadcast(lights, source) {
  const normalizedLights = normalizeLights(lights);
  writeNormalizedLights(normalizedLights);
  publishLightState(normalizedLights, source);
  return normalizedLights;
}

function persistDeviceAndBroadcast(device, source) {
  const currentLights = readNormalizedLights();

  currentLights.device = {
    ...DEFAULT_LIGHTS.device,
    ...(device || {}),
    lastSeen: typeof device?.lastSeen === "string" ? device.lastSeen : new Date().toISOString(),
  };

  writeNormalizedLights(currentLights);
  if (source !== "mqtt") {
    publishDeviceState(currentLights.device, source);
  }
  return currentLights.device;
}

function connectMqtt() {
  mqttClient = mqtt.connect(MQTT_URL, {
    clientId: `iot-light-control-backend-${Math.random().toString(16).slice(2, 10)}`,
    reconnectPeriod: 5000,
  });

  mqttClient.on("connect", () => {
    mqttClient.subscribe([MQTT_LIGHT_TOPIC, MQTT_DEVICE_TOPIC], { qos: 1 }, (err) => {
      if (err) {
        return;
      }

      publishLightState(readNormalizedLights(), "backend-startup");
    });
  });

  mqttClient.on("message", (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());

      if (topic === MQTT_LIGHT_TOPIC) {
        const current = readNormalizedLights();
        const nextLights = normalizeLights({
          ...current,
          light1: Boolean(payload.light1),
          light2: Boolean(payload.light2),
          light3: Boolean(payload.light3),
          light4: Boolean(payload.light4),
          light5: Boolean(payload.light5),
          sensorTargets: Array.isArray(payload.sensorTargets) ? payload.sensorTargets : current.sensorTargets,
        });

        writeNormalizedLights(nextLights);
        return;
      }

      if (topic === MQTT_DEVICE_TOPIC) {
        persistDeviceAndBroadcast({
          ssid: typeof payload.ssid === "string" ? payload.ssid : "",
          ip: typeof payload.ip === "string" ? payload.ip : "",
          rssi: typeof payload.rssi === "number" ? payload.rssi : 0,
          lastSeen: typeof payload.lastSeen === "string" ? payload.lastSeen : new Date().toISOString(),
          lightSensor: typeof payload.lightSensor === "number" ? payload.lightSensor : null,
          isDark: typeof payload.isDark === "boolean" ? payload.isDark : null,
        }, "mqtt");
      }
    } catch (err) {
      console.error(`[MQTT] Message processing failed: ${topic}`, err.message);
    }
  });

  mqttClient.on("error", (err) => {
    console.error("[MQTT] Client error", err.message);
  });
}

// ถ้า lights.json หาย, JSON เสีย, หรือ key ไม่ครบ ให้ซ่อมข้อมูล
function initDB() {
  try {
    writeNormalizedLights(readLights());
  } catch {
    console.log("[DB] lights.json not found or invalid — creating with defaults");
    writeLights(DEFAULT_LIGHTS);
  }
}

initDB();
connectMqtt();

// GET /api/lights — ดึงสถานะไฟทั้งหมด + ข้อมูล ESP32 + sensor config
app.get("/api/lights", (req, res) => {
  try {
    res.json(readNormalizedLights());
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
    const lights = readNormalizedLights();

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
    const oldData = readNormalizedLights();
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

    persistLightsAndBroadcast(lights, "rest-api");

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
    const lights = readNormalizedLights();
    const normalizedTargets = normalizeSensorTargets(sensorTargets);

    lights.sensorTargets = normalizedTargets;

    persistLightsAndBroadcast(lights, "rest-api");

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
    const lights = readNormalizedLights();

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
    const lights = readNormalizedLights();
    const targets = normalizeSensorTargets(lights.sensorTargets || []);
    const value = state === "on";

    targets.forEach((id) => {
      lights[`light${id}`] = value;
    });

    lights.sensorTargets = targets;

    persistLightsAndBroadcast(lights, "rest-api");

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
    const lights = readNormalizedLights();

    lights[`light${id}`] = state === "on";
    lights.sensorTargets = normalizeSensorTargets(lights.sensorTargets || []);

    persistLightsAndBroadcast(lights, "rest-api");

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
    const device = persistDeviceAndBroadcast({
      ssid,
      ip,
      rssi,
      lastSeen: new Date().toISOString(),
      lightSensor: typeof lightSensor === "number" ? lightSensor : null,
      isDark: typeof isDark === "boolean" ? isDark : null,
    }, "rest-api");

    res.json({
      success: true,
      message: "Device status updated",
      device,
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
    const lights = readNormalizedLights();

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
  console.log(`Server running on ${PUBLIC_BASE_URL}`);
  console.log(`ESP32 API: ${PUBLIC_BASE_URL}/api/lights`);
});
