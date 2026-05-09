# IoT Light Control System

ระบบควบคุมไฟแสดงสว่างอัตโนมัติผ่านเว็บไซต์ โดยใช้ ESP32 ควบคุม Relay 5 Channel

---

## Features

- ควบคุมไฟ 5 ดวงผ่านหน้าเว็บ Dashboard
- เปิด / ปิด / Toggle ไฟแต่ละดวงแยกกัน
- เปิด / ปิดไฟทั้ง 5 ดวงพร้อมกันด้วยปุ่มเดียว
- แสดงสถานะการเชื่อมต่อ Backend (Online / Offline)
- Auto refresh สถานะทุก 2 วินาที
- ESP32 ดึงสถานะจาก API ทุก 1 วินาทีและสั่ง Relay

---

## System Architecture

```
Website (Browser)
     │ HTTP POST (เปิด/ปิดไฟ)
     ▼
Backend API (Node.js + Express)
     │ อ่าน/เขียน
     ▼
lights.json (Database)
     │ ESP32 HTTP GET ทุก 1 วินาที
     ▼
ESP32
     │ GPIO Digital Write
     ▼
Relay Module 5 Channel
     │
     ▼
ไฟ 5 ดวง
```

---

## Project Structure

```
iot-light-control/
├── backend/
│   ├── server.js       ← Express API Server
│   ├── package.json
│   └── lights.json     ← Database ไฟล์ JSON
│
├── frontend/
│   ├── index.html      ← Dashboard UI
│   ├── style.css
│   └── script.js
│
├── esp32/
│   └── esp32_light_control.ino
│
└── README.md
```

---

## Hardware Required

| อุปกรณ์                  | จำนวน |
|--------------------------|-------|
| ESP32 Development Board  | 1     |
| Relay Module 5 Channel   | 1     |
| LED (จำลองไฟ)            | 5     |
| Resistor 220Ω            | 5     |
| สาย Jumper               | ตามต้องการ |
| Breadboard               | 1     |

---

## Wiring Table

| Relay Module | ESP32 GPIO |
|-------------|------------|
| IN1         | GPIO 23    |
| IN2         | GPIO 22    |
| IN3         | GPIO 21    |
| IN4         | GPIO 19    |
| IN5         | GPIO 18    |
| VCC         | 5V         |
| GND         | GND (ร่วมกัน) |

> **สำคัญ:** GND ของ ESP32 และ GND ของ Relay Module ต้องต่อเข้าหากัน (Common GND)

---

## API Documentation

### GET /api/lights
ดึงสถานะไฟทั้งหมด

**Response:**
```json
{
  "light1": false,
  "light2": true,
  "light3": false,
  "light4": false,
  "light5": false
}
```

---

### GET /api/lights/:id
ดึงสถานะไฟดวงเดียว (`id` = 1–5)

**Response:**
```json
{ "success": true, "id": 1, "state": true }
```

---

### POST /api/lights/:id/:state
เปิด/ปิดไฟดวงเดียว (`id` = 1–5, `state` = `on` หรือ `off`)

**Response:**
```json
{
  "success": true,
  "message": "Light 1 turned on",
  "lights": {
    "light1": true,
    "light2": false,
    "light3": false,
    "light4": false,
    "light5": false
  }
}
```

---

### POST /api/lights/all/:state
เปิด/ปิดไฟทั้งหมด (`state` = `on` หรือ `off`)

**Response:**
```json
{
  "success": true,
  "message": "All lights turned on",
  "lights": {
    "light1": true,
    "light2": true,
    "light3": true,
    "light4": true,
    "light5": true
  }
}
```

---

## วิธีติดตั้ง Backend

### 1. ติดตั้ง Node.js
ดาวน์โหลด Node.js จาก https://nodejs.org (แนะนำ LTS)

### 2. ติดตั้ง Dependencies

```bash
cd backend
npm install
```

---

## วิธี Run Server

```bash
cd backend
npm start
```

ถ้าสำเร็จจะแสดง:
```
Server running on http://localhost:3000
```

---

## วิธีเปิด Website

เปิด Browser แล้วไปที่:
```
http://localhost:3000
```

หรือถ้าต้องการให้ ESP32 เข้าถึงได้ด้วย ให้ใช้ IP ของเครื่อง:
```
http://192.168.x.x:3000
```

(ดู IP ของเครื่องได้ด้วยคำสั่ง `ipconfig` บน Windows หรือ `ifconfig` บน Mac/Linux)

---

## วิธีตั้งค่า ESP32

แก้ไขไฟล์ `esp32/esp32_light_control.ino` บรรทัดนี้:

```cpp
const char* ssid     = "YOUR_WIFI_NAME";      // ชื่อ Wi-Fi
const char* password = "YOUR_WIFI_PASSWORD";  // รหัส Wi-Fi
const char* serverUrl = "http://192.168.x.x:3000/api/lights";  // IP ของเครื่องที่รัน Backend
```

> **ห้ามใช้ `localhost`** — ในมุมมองของ ESP32, `localhost` หมายถึงตัว ESP32 เอง

---

## วิธี Upload โค้ดเข้า ESP32

1. เปิด Arduino IDE
2. เปิดไฟล์ `esp32_light_control.ino`
3. ติดตั้ง Library ที่จำเป็น ผ่าน Library Manager:
   - `ArduinoJson` by Benoit Blanchon
4. เลือก Board: **ESP32 Dev Module** (Tools → Board)
5. เลือก Port ที่ ESP32 เชื่อมต่ออยู่
6. กด **Upload**
7. เปิด Serial Monitor (baud rate: 115200) เพื่อดู log

---

## วิธีทดสอบระบบ

1. รัน `npm start` ใน folder `backend`
2. เปิด Browser ไปที่ `http://localhost:3000`
3. กดปุ่ม "เปิด" บนไฟดวงใดก็ได้ แล้วตรวจสอบว่า:
   - สถานะบนเว็บเปลี่ยนเป็น **ON** (สีเขียว)
4. Upload โค้ดเข้า ESP32 แล้วเปิด Serial Monitor ตรวจสอบ:
   - แสดง `Connected! IP: ...`
   - แสดง payload JSON ทุก 1 วินาที
   - Relay ทำงานตรงกับสถานะบนเว็บ

---

## ปัญหาที่พบบ่อย

| ปัญหา | วิธีแก้ |
|-------|---------|
| ESP32 ต่อ Wi-Fi ไม่ได้ | ตรวจสอบ ssid/password ในโค้ด |
| ESP32 เรียก API ไม่สำเร็จ | ตรวจสอบว่าใส่ IP จริง ไม่ใช่ localhost |
| Port 3000 เข้าไม่ได้ | ปิด Firewall ชั่วคราว หรือเพิ่ม Exception สำหรับ Port 3000 |
| Relay ทำงานกลับกัน | Relay เป็น Active LOW — LOW = เปิด, HIGH = ปิด (ถูกต้องแล้ว) |
| เว็บขึ้น "Backend Offline" | ตรวจสอบว่า Backend รันอยู่ และ URL ถูกต้อง |
| GND ไม่ร่วมกัน | ต่อ GND ของ ESP32 กับ GND ของ Relay Module เข้าด้วยกัน |

---

## แนวทางพัฒนาต่อ

- เพิ่ม Scheduler — ตั้งเวลาเปิด/ปิดไฟอัตโนมัติ
- เพิ่ม Light Sensor — เปิดไฟเมื่อแสงน้อย
- เพิ่ม Authentication — Login ก่อนใช้งาน
- เปลี่ยน Database จาก JSON เป็น SQLite หรือ MongoDB
- Deploy Backend ขึ้น Cloud เช่น Railway, Render
- เพิ่ม WebSocket เพื่อ Real-time Update แทน Polling

---

## ข้อควรระวัง

- สำหรับโครงงานนักศึกษา แนะนำใช้ **LED จำลอง** แทนไฟบ้าน 220V
- หากต้องการใช้กับไฟบ้าน **ต้องให้ผู้เชี่ยวชาญด้านไฟฟ้าดูแล** เนื่องจากมีอันตรายถึงชีวิต
- ESP32 จ่ายไฟได้ 3.3V — หาก Relay ต้องการ 5V ให้ใช้ไฟเลี้ยงแยก
