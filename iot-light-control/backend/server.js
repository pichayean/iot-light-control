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
};

function readLights() {
  const data = fs.readFileSync(DB_FILE, "utf8");
  return JSON.parse(data);
}

function writeLights(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
}

// ถ้า lights.json หายหรือ JSON เสีย ให้สร้างใหม่ด้วยค่า default
function initDB() {
  try {
    readLights();
  } catch {
    console.log("[DB] lights.json not found or invalid — creating with defaults");
    writeLights(DEFAULT_LIGHTS);
  }
}

initDB();

// GET /api/lights — ดึงสถานะไฟทั้งหมด
app.get("/api/lights", (req, res) => {
  try {
    const lights = readLights();
    res.json(lights);
  } catch (err) {
    res.status(500).json({ success: false, message: "Cannot read lights data" });
  }
});

// GET /api/lights/:id — ดึงสถานะไฟดวงเดียว
app.get("/api/lights/:id", (req, res) => {
  const { id } = req.params;

  if (!["1", "2", "3", "4", "5"].includes(id)) {
    return res.status(400).json({ success: false, message: "Invalid light id. Must be 1-5" });
  }

  try {
    const lights = readLights();
    res.json({ success: true, id: Number(id), state: lights[`light${id}`] });
  } catch (err) {
    res.status(500).json({ success: false, message: "Cannot read lights data" });
  }
});

// POST /api/lights/all/:state — เปิด/ปิดไฟทั้งหมด (ต้องกำหนดก่อน route /:id/:state เพื่อไม่ให้ Express ตีความ "all" เป็น id)
app.post("/api/lights/all/:state", (req, res) => {
  const { state } = req.params;

  if (!["on", "off"].includes(state)) {
    return res.status(400).json({ success: false, message: "Invalid state. Must be 'on' or 'off'" });
  }

  try {
    const value = state === "on";
    const lights = {
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
    res.status(500).json({ success: false, message: "Cannot write lights data" });
  }
});

// POST /api/lights/:id/:state — เปิด/ปิดไฟดวงเดียว
app.post("/api/lights/:id/:state", (req, res) => {
  const { id, state } = req.params;

  if (!["1", "2", "3", "4", "5"].includes(id)) {
    return res.status(400).json({ success: false, message: "Invalid light id. Must be 1-5" });
  }

  if (!["on", "off"].includes(state)) {
    return res.status(400).json({ success: false, message: "Invalid state. Must be 'on' or 'off'" });
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
    res.status(500).json({ success: false, message: "Cannot write lights data" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
