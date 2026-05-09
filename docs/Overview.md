ได้ครับ **ทางเลือกที่ 2: มี Backend แยก** จะดูเป็นระบบ IoT มากขึ้น เหมาะถ้าต้องการให้โครงงานดูจริงจังและต่อยอดได้ง่าย

## ภาพรวมระบบ

```text
Website
   ↓
Backend Server / API
   ↓
Database
   ↓
ESP32
   ↓
Relay 5 Channel
   ↓
ไฟ 5 ดวง
```

ระบบนี้จะแยกเป็น 3 ส่วนหลัก:

1. **Website** — หน้าเว็บสำหรับกดเปิด/ปิดไฟ
2. **Backend API** — ตัวกลางรับคำสั่งจากเว็บ และเก็บสถานะไฟ
3. **ESP32** — อ่านสถานะไฟจาก Backend แล้วสั่ง Relay

---

# 1. แนวคิดการทำงาน

ผู้ใช้ไม่ได้สั่ง ESP32 โดยตรง แต่จะสั่งผ่านเว็บไซต์ก่อน

```text
ผู้ใช้กดเปิดไฟดวงที่ 1
        ↓
Website ส่งคำสั่งไป Backend
        ↓
Backend อัปเดตสถานะไฟดวงที่ 1 = ON
        ↓
ESP32 อ่านสถานะจาก Backend
        ↓
ESP32 สั่ง Relay 1 ทำงาน
        ↓
ไฟดวงที่ 1 ติด
```

ข้อดีคือ ESP32 กับ Website ไม่จำเป็นต้องอยู่ Wi-Fi วงเดียวกัน ถ้า Backend อยู่บน Cloud หรือ Firebase

---

# 2. โครงสร้างที่แนะนำสำหรับนักศึกษา

แนะนำใช้แบบนี้:

```text
Frontend: HTML + CSS + JavaScript
Backend: Node.js + Express
Database: JSON file หรือ Firebase
Hardware: ESP32 + Relay 5 Channel
```

ถ้าอยากทำง่ายสุดแต่ยังเป็น Backend แยก:

```text
Website + Backend อยู่ใน Node.js Server
ESP32 เรียก API จาก Node.js
```

---

# 3. Architecture แบบเข้าใจง่าย

```text
┌──────────────┐
│   Website    │
│  Control UI  │
└──────┬───────┘
       │ HTTP Request
       ↓
┌──────────────┐
│  Backend API │
│   Node.js    │
└──────┬───────┘
       │ Save / Read status
       ↓
┌──────────────┐
│   Database   │
│ JSON/Firebase│
└──────┬───────┘
       │ ESP32 Fetch Status
       ↓
┌──────────────┐
│    ESP32     │
│ Relay Control│
└──────┬───────┘
       ↓
┌──────────────┐
│  Relay x 5   │
└──────┬───────┘
       ↓
┌──────────────┐
│  Light x 5   │
└──────────────┘
```

---

# 4. API ที่ควรมี

Backend ควรมี API ประมาณนี้:

| Method | Endpoint              | หน้าที่            |
| ------ | --------------------- | ------------------ |
| GET    | `/api/lights`         | ดึงสถานะไฟทั้งหมด  |
| GET    | `/api/lights/1`       | ดึงสถานะไฟดวงที่ 1 |
| POST   | `/api/lights/1/on`    | เปิดไฟดวงที่ 1     |
| POST   | `/api/lights/1/off`   | ปิดไฟดวงที่ 1      |
| POST   | `/api/lights/all/on`  | เปิดไฟทั้งหมด      |
| POST   | `/api/lights/all/off` | ปิดไฟทั้งหมด       |

ตัวอย่างข้อมูลสถานะไฟ:

```json
{
  "light1": false,
  "light2": true,
  "light3": false,
  "light4": false,
  "light5": true
}
```

ความหมาย:

```text
true  = เปิดไฟ
false = ปิดไฟ
```

---

# 5. Flow ฝั่ง Website

หน้าเว็บจะมีปุ่มควบคุมไฟ 5 ดวง

```text
ไฟดวงที่ 1  [เปิด] [ปิด]
ไฟดวงที่ 2  [เปิด] [ปิด]
ไฟดวงที่ 3  [เปิด] [ปิด]
ไฟดวงที่ 4  [เปิด] [ปิด]
ไฟดวงที่ 5  [เปิด] [ปิด]

[เปิดไฟทั้งหมด]
[ปิดไฟทั้งหมด]
```

เมื่อกดปุ่ม:

```javascript
fetch('/api/lights/1/on', {
  method: 'POST'
});
```

แล้ว Backend จะเปลี่ยนสถานะไฟดวงที่ 1 เป็น `true`

---

# 6. Flow ฝั่ง Backend

Backend มีหน้าที่:

1. รับคำสั่งจาก Website
2. อัปเดตสถานะไฟ
3. ส่งสถานะไฟให้ ESP32
4. ส่งสถานะล่าสุดกลับไปแสดงบน Website

ตัวอย่าง logic:

```text
POST /api/lights/1/on
        ↓
เปลี่ยน light1 = true
        ↓
บันทึกลง database
        ↓
ส่ง response กลับไปว่า success
```

---

# 7. Flow ฝั่ง ESP32

ESP32 จะคอยอ่านสถานะไฟจาก Backend ทุก ๆ 1-2 วินาที

```text
ESP32 เรียก GET /api/lights
        ↓
ได้ข้อมูล JSON
        ↓
อ่านค่า light1-light5
        ↓
สั่ง Relay ตามสถานะ
        ↓
วนซ้ำ
```

ตัวอย่างแนวคิด:

```cpp
GET http://server-ip:3000/api/lights

ผลลัพธ์:
{
  "light1": true,
  "light2": false,
  "light3": true,
  "light4": false,
  "light5": false
}
```

ESP32 จะนำค่าไปควบคุม Relay:

```text
light1 = true  → เปิด Relay 1
light2 = false → ปิด Relay 2
light3 = true  → เปิด Relay 3
light4 = false → ปิด Relay 4
light5 = false → ปิด Relay 5
```

---

# 8. โครงสร้างโปรเจกต์

```text
iot-light-control/
├── backend/
│   ├── server.js
│   ├── package.json
│   └── lights.json
│
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
│
├── esp32/
│   └── esp32_light_control.ino
│
└── docs/
    ├── block-diagram.png
    ├── flowchart.png
    └── report.pdf
```

---

# 9. ตัวอย่าง Database แบบง่าย

ใช้ไฟล์ `lights.json`

```json
{
  "light1": false,
  "light2": false,
  "light3": false,
  "light4": false,
  "light5": false
}
```

ข้อดี:

* ทำง่าย
* ไม่ต้องติดตั้ง Database จริง
* เหมาะกับโครงงานนักศึกษา

ข้อเสีย:

* ไม่เหมาะกับระบบใหญ่
* ถ้ามีผู้ใช้หลายคนพร้อมกัน อาจจัดการยาก

---

# 10. ตัวอย่าง Backend แบบ Node.js

ติดตั้งก่อน:

```bash
npm init -y
npm install express cors
```

ตัวอย่าง `server.js`

```javascript
const express = require("express");
const cors = require("cors");
const fs = require("fs");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("../frontend"));

const DB_FILE = "./lights.json";

function readLights() {
  const data = fs.readFileSync(DB_FILE);
  return JSON.parse(data);
}

function writeLights(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.get("/api/lights", (req, res) => {
  const lights = readLights();
  res.json(lights);
});

app.post("/api/lights/:id/:state", (req, res) => {
  const { id, state } = req.params;

  if (!["1", "2", "3", "4", "5"].includes(id)) {
    return res.status(400).json({ error: "Invalid light id" });
  }

  if (!["on", "off"].includes(state)) {
    return res.status(400).json({ error: "Invalid state" });
  }

  const lights = readLights();
  lights[`light${id}`] = state === "on";

  writeLights(lights);

  res.json({
    success: true,
    lights
  });
});

app.post("/api/lights/all/:state", (req, res) => {
  const { state } = req.params;

  if (!["on", "off"].includes(state)) {
    return res.status(400).json({ error: "Invalid state" });
  }

  const value = state === "on";

  const lights = {
    light1: value,
    light2: value,
    light3: value,
    light4: value,
    light5: value
  };

  writeLights(lights);

  res.json({
    success: true,
    lights
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

สร้างไฟล์ `lights.json`

```json
{
  "light1": false,
  "light2": false,
  "light3": false,
  "light4": false,
  "light5": false
}
```

---

# 11. ตัวอย่าง Frontend

ไฟล์ `index.html`

```html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <title>IoT Light Control</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <h1>ระบบควบคุมไฟผ่านเว็บไซต์</h1>

  <div id="lights"></div>

  <button onclick="setAllLights('on')">เปิดไฟทั้งหมด</button>
  <button onclick="setAllLights('off')">ปิดไฟทั้งหมด</button>

  <script src="script.js"></script>
</body>
</html>
```

ไฟล์ `script.js`

```javascript
async function loadLights() {
  const response = await fetch("/api/lights");
  const lights = await response.json();

  const container = document.getElementById("lights");
  container.innerHTML = "";

  for (let i = 1; i <= 5; i++) {
    const status = lights[`light${i}`] ? "ON" : "OFF";

    container.innerHTML += `
      <div class="card">
        <h2>ไฟดวงที่ ${i}</h2>
        <p>สถานะ: ${status}</p>
        <button onclick="setLight(${i}, 'on')">เปิด</button>
        <button onclick="setLight(${i}, 'off')">ปิด</button>
      </div>
    `;
  }
}

async function setLight(id, state) {
  await fetch(`/api/lights/${id}/${state}`, {
    method: "POST"
  });

  loadLights();
}

async function setAllLights(state) {
  await fetch(`/api/lights/all/${state}`, {
    method: "POST"
  });

  loadLights();
}

loadLights();
setInterval(loadLights, 2000);
```

ไฟล์ `style.css`

```css
body {
  font-family: Arial, sans-serif;
  padding: 30px;
  background: #f4f4f4;
}

h1 {
  text-align: center;
}

.card {
  background: white;
  padding: 20px;
  margin: 15px auto;
  border-radius: 12px;
  max-width: 400px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

button {
  padding: 10px 16px;
  margin: 5px;
  cursor: pointer;
}
```

---

# 12. ตัวอย่าง ESP32 Logic

แนวคิดโค้ด ESP32:

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";

const char* serverUrl = "http://YOUR_SERVER_IP:3000/api/lights";

int relayPins[5] = {23, 22, 21, 19, 18};

// Relay ส่วนใหญ่เป็น Active LOW
#define RELAY_ON LOW
#define RELAY_OFF HIGH

void setup() {
  Serial.begin(115200);

  for (int i = 0; i < 5; i++) {
    pinMode(relayPins[i], OUTPUT);
    digitalWrite(relayPins[i], RELAY_OFF);
  }

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.println("Connecting WiFi...");
  }

  Serial.println("WiFi connected");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);

    int httpCode = http.GET();

    if (httpCode == 200) {
      String payload = http.getString();
      Serial.println(payload);

      StaticJsonDocument<256> doc;
      deserializeJson(doc, payload);

      for (int i = 0; i < 5; i++) {
        String key = "light" + String(i + 1);
        bool status = doc[key];

        digitalWrite(relayPins[i], status ? RELAY_ON : RELAY_OFF);
      }
    }

    http.end();
  }

  delay(1000);
}
```

ต้องติดตั้ง Library เพิ่มใน Arduino IDE:

```text
ArduinoJson
```

---

# 13. การเชื่อมต่อวงจร

## ESP32 ไป Relay

| Relay Channel | GPIO ESP32 |
| ------------- | ---------- |
| IN1           | GPIO 23    |
| IN2           | GPIO 22    |
| IN3           | GPIO 21    |
| IN4           | GPIO 19    |
| IN5           | GPIO 18    |
| VCC           | 5V         |
| GND           | GND        |

สำคัญมาก:

```text
GND ของ ESP32 ต้องต่อร่วมกับ GND ของ Relay
```

ถ้าใช้ Relay 5V และมีโหลดหลายช่อง แนะนำใช้ไฟเลี้ยง Relay แยก 5V

---

# 14. วิธี Run ระบบ

## 1. Run Backend

เข้าโฟลเดอร์ `backend`

```bash
cd backend
node server.js
```

ถ้าสำเร็จจะขึ้น:

```text
Server running on http://localhost:3000
```

## 2. เปิด Website

เข้าเว็บ:

```text
http://localhost:3000
```

ถ้า ESP32 อยู่ใน Wi-Fi เดียวกัน ให้ใช้ IP ของเครื่องที่รัน Backend เช่น:

```text
http://192.168.1.10:3000
```

## 3. ตั้งค่า ESP32

ในโค้ด ESP32 ให้แก้:

```cpp
const char* ssid = "ชื่อ WiFi";
const char* password = "รหัส WiFi";
const char* serverUrl = "http://192.168.1.10:3000/api/lights";
```

จากนั้นอัปโหลดโค้ดเข้า ESP32

---

# 15. ข้อควรระวัง

ถ้าใช้ Notebook เป็น Backend:

* Notebook และ ESP32 ต้องอยู่ Wi-Fi วงเดียวกัน
* Firewall อาจบล็อก Port 3000
* ต้องใช้ IP จริงของ Notebook ไม่ใช่ `localhost`

ผิดบ่อยสุดคือใส่แบบนี้ใน ESP32:

```cpp
http://localhost:3000/api/lights
```

อันนี้ใช้ไม่ได้ เพราะ `localhost` ในมุม ESP32 หมายถึงตัว ESP32 เอง ไม่ใช่คอมพิวเตอร์

ต้องใช้แบบนี้แทน:

```cpp
http://192.168.x.x:3000/api/lights
```

---

# 16. แผนพัฒนา 4 สัปดาห์

## สัปดาห์ที่ 1: ออกแบบระบบ

* ออกแบบ Architecture
* กำหนด API
* กำหนด GPIO
* ออกแบบหน้า Website
* เตรียมอุปกรณ์

## สัปดาห์ที่ 2: ทำ Backend + Website

* สร้าง Node.js Server
* ทำ API เปิด/ปิดไฟ
* ทำหน้าเว็บควบคุมไฟ
* ทดสอบผ่าน Browser

## สัปดาห์ที่ 3: ทำ ESP32 + Relay

* เขียนโค้ด ESP32 เชื่อม Wi-Fi
* อ่าน API จาก Backend
* ควบคุม Relay 5 ช่อง
* ทดสอบไฟแต่ละดวง

## สัปดาห์ที่ 4: รวมระบบ + ทำรายงาน

* ทดสอบทั้งระบบ
* แก้ปัญหา Delay / Wi-Fi / Relay
* ทำเอกสารรายงาน
* ทำสไลด์นำเสนอ
* เตรียม Demo

---

# 17. สิ่งที่ควรใส่ในรายงาน

หัวข้อรายงานแนะนำ:

```text
1. บทนำ
2. วัตถุประสงค์
3. ขอบเขตของโครงงาน
4. ทฤษฎีที่เกี่ยวข้อง
   - Internet of Things
   - ESP32
   - Relay Module
   - Web Application
   - API
5. การออกแบบระบบ
   - Block Diagram
   - System Architecture
   - Flowchart
   - Database Structure
6. การพัฒนาโปรแกรม
   - Frontend
   - Backend
   - ESP32 Firmware
7. การทดสอบระบบ
8. ปัญหาและวิธีแก้ไข
9. สรุปผล
10. แนวทางพัฒนาต่อ
```

---

## สรุปตัวเลือกที่แนะนำ

สำหรับทางเลือกที่ 2 ผมแนะนำใช้ชุดนี้:

```text
Website: HTML/CSS/JavaScript
Backend: Node.js + Express
Database: lights.json
ESP32: อ่าน API ทุก 1 วินาที
Hardware: Relay 5 ช่อง + ไฟจำลอง 5 ดวง
```

ระบบนี้ทำไม่ยากเกินไป แต่ดูเป็นโครงงาน IoT แบบครบจริง เพราะมีทั้ง **Website + Backend + Database + ESP32 + Relay** ครบทุกส่วนครับ
