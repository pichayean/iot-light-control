คุณคือ Full-stack IoT Developer ช่วยสร้างโปรเจกต์โครงงานนักศึกษาแบบครบทุก component

โปรเจกต์ชื่อ:
IoT Light Control System

เป้าหมาย:
สร้างระบบควบคุมไฟแสดงสว่างอัตโนมัติผ่านเว็บไซต์ โดยจำลองไฟทั้งหมด 5 ดวง ใช้ ESP32 ควบคุม Relay 5 Channel และมี Website + Backend แยกจาก ESP32

ภาพรวมระบบ:
- ผู้ใช้เปิดเว็บไซต์
- ผู้ใช้กดปุ่มเปิด/ปิดไฟแต่ละดวง
- Website ส่งคำสั่งไป Backend API
- Backend บันทึกสถานะไฟลงฐานข้อมูลแบบไฟล์ JSON
- ESP32 เรียก API จาก Backend เป็นระยะ
- ESP32 อ่านสถานะไฟทั้ง 5 ดวง
- ESP32 สั่ง Relay เปิด/ปิดไฟตามสถานะ

Tech Stack:
Frontend:
- HTML
- CSS
- JavaScript

Backend:
- Node.js
- Express.js
- CORS
- ใช้ไฟล์ lights.json เป็น database แบบง่าย

Hardware/Firmware:
- ESP32
- Relay Module 5 Channel หรือ 8 Channel
- ไฟจำลอง 5 ดวง
- Arduino IDE
- Library: WiFi.h, HTTPClient.h, ArduinoJson.h

ขอให้สร้างโครงสร้างโปรเจกต์แบบนี้:

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
└── README.md

รายละเอียด Backend:
1. ใช้ Express.js
2. เปิด server ที่ port 3000
3. เปิดใช้งาน CORS
4. เสิร์ฟ static frontend จากโฟลเดอร์ frontend
5. ใช้ lights.json เก็บสถานะไฟ
6. สถานะไฟต้องอยู่ในรูปแบบ:

{
  "light1": false,
  "light2": false,
  "light3": false,
  "light4": false,
  "light5": false
}

7. API ที่ต้องมี:
- GET /api/lights
  ใช้สำหรับดึงสถานะไฟทั้งหมด

- GET /api/lights/:id
  ใช้สำหรับดึงสถานะไฟดวงเดียว id ต้องเป็น 1-5

- POST /api/lights/:id/:state
  ใช้สำหรับเปิด/ปิดไฟแต่ละดวง
  id ต้องเป็น 1-5
  state ต้องเป็น on หรือ off

- POST /api/lights/all/:state
  ใช้สำหรับเปิด/ปิดไฟทั้งหมด
  state ต้องเป็น on หรือ off

8. Backend ต้อง validate input:
- ถ้า id ไม่ใช่ 1-5 ให้ส่ง status 400
- ถ้า state ไม่ใช่ on/off ให้ส่ง status 400
- response ควรเป็น JSON ทุกครั้ง

9. Response ตัวอย่างเมื่อสำเร็จ:

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

รายละเอียด Frontend:
1. ทำหน้าเว็บ Dashboard สำหรับควบคุมไฟ 5 ดวง
2. หน้าเว็บควรมี:
- ชื่อระบบ
- Card สำหรับไฟแต่ละดวง รวม 5 card
- แสดงสถานะ ON/OFF ของแต่ละดวง
- ปุ่ม เปิด
- ปุ่ม ปิด
- ปุ่ม Toggle
- ปุ่ม เปิดไฟทั้งหมด
- ปุ่ม ปิดไฟทั้งหมด
- ข้อความแสดงสถานะการเชื่อมต่อ Backend เช่น Online / Offline
3. ใช้ JavaScript fetch เรียก API
4. โหลดสถานะไฟจาก GET /api/lights
5. หลังจากกดเปิด/ปิดไฟ ให้ reload สถานะใหม่ทันที
6. ตั้ง auto refresh ทุก 2 วินาที
7. UI ต้องดูสะอาด ทันสมัย ใช้งานง่าย
8. ใช้ CSS ปกติ ไม่ใช้ framework
9. สถานะ ON ให้แสดงเด่นชัด เช่น สีเขียว
10. สถานะ OFF ให้แสดงชัด เช่น สีเทา/แดง
11. รองรับหน้าจอมือถือแบบ responsive

รายละเอียด ESP32:
1. เขียนไฟล์ esp32_light_control.ino
2. ใช้ WiFi.h เชื่อมต่อ Wi-Fi
3. ใช้ HTTPClient.h เรียก API
4. ใช้ ArduinoJson.h parse JSON
5. กำหนด Wi-Fi แบบนี้:

const char* ssid = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";

6. กำหนด server URL แบบนี้:

const char* serverUrl = "http://YOUR_SERVER_IP:3000/api/lights";

7. ใช้ GPIO สำหรับ Relay ดังนี้:
- Relay 1 = GPIO 23
- Relay 2 = GPIO 22
- Relay 3 = GPIO 21
- Relay 4 = GPIO 19
- Relay 5 = GPIO 18

8. Relay เป็นแบบ Active LOW:
- LOW = เปิด Relay
- HIGH = ปิด Relay

9. ตอนเริ่มต้นระบบ ให้ตั้ง Relay ทุกตัวเป็น OFF ก่อน
10. ESP32 ต้องเรียก GET /api/lights ทุก 1 วินาที
11. ถ้า Wi-Fi หลุด ให้พยายาม reconnect
12. แสดง log ผ่าน Serial Monitor:
- สถานะการเชื่อมต่อ Wi-Fi
- IP Address ของ ESP32
- HTTP status code
- JSON payload ที่ได้รับ
- สถานะไฟแต่ละดวง
13. ถ้าเรียก API ไม่สำเร็จ ห้ามทำให้ Relay ค้างผิดพลาด ให้คงสถานะล่าสุดไว้
14. เขียนโค้ดให้มี function แยกชัดเจน เช่น:
- connectWiFi()
- fetchLightStatus()
- updateRelays()
- printLightStatus()

รายละเอียด README.md:
ช่วยสร้าง README ที่อธิบายครบ:
1. คำอธิบายโปรเจกต์
2. Features
3. System Architecture
4. Project Structure
5. Hardware Required
6. Wiring Table
7. API Documentation
8. วิธีติดตั้ง Backend
9. วิธี Run Server
10. วิธีเปิด Website
11. วิธีตั้งค่า ESP32
12. วิธี Upload โค้ดเข้า ESP32
13. วิธีทดสอบระบบ
14. ปัญหาที่พบบ่อย
15. แนวทางพัฒนาต่อ

คำสั่งติดตั้ง Backend:
npm install

คำสั่ง Run:
npm start

package.json ต้องมี script:
"start": "node server.js"

ข้อควรระวังที่ต้องอธิบายใน README:
- ESP32 ห้ามใช้ localhost เป็น serverUrl
- ต้องใช้ IP ของเครื่องที่รัน Backend เช่น http://192.168.1.10:3000/api/lights
- เครื่องที่รัน Backend และ ESP32 ควรอยู่ Wi-Fi วงเดียวกัน
- ถ้าเข้าไม่ได้ ให้ตรวจ Firewall และ Port 3000
- GND ของ ESP32 และ Relay ต้องต่อร่วมกัน
- หากใช้ Relay กับไฟบ้าน 220V ต้องระวังอันตราย ควรให้ผู้เชี่ยวชาญดูแล
- สำหรับโครงงานนักศึกษา แนะนำใช้ LED จำลองแทนไฟบ้านจริง

ขอให้สร้างโค้ดครบทุกไฟล์ตามโครงสร้างด้านบน
โค้ดต้องสามารถ copy ไปใช้งานได้จริง
ใส่ comment อธิบายจุดสำคัญในโค้ด
อย่าใช้ database จริง
อย่าใช้ Firebase
อย่าใช้ MQTT
เน้นระบบ minimal แต่ครบทั้ง Frontend, Backend, Database JSON และ ESP32 Firmware