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
  device: {
    ssid: "",
    ip: "",
    rssi: 0,
    lastSeen: "",
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
  return ["1", "2", "3", "4", "5"].includes(id);
}

function isValidState(state) {
  return ["on", "off"].includes(state);
}

// ถ้า lights.json หาย, JSON เสีย, หรือ key ไม่ครบ ให้ซ่อมข้อมูล
function initDB() {
  try {
    const lights = readLights();

    const mergedLights = {
      ...DEFAULT_LIGHTS,
      ...lights,
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

// GET /api/lights — ดึงสถานะไฟทั้งหมด + ข้อมูล ESP32
app.get("/api/lights", (req, res) => {
  try {
    const lights = readLights();
    res.json(lights);
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
  const { ssid, ip, rssi } = req.body;

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
    };

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
      device: lights.device || DEFAULT_LIGHTS.device,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Cannot read device status",
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`ESP32 API: http://YOUR_SERVER_IP:${PORT}/api/lights`);
});