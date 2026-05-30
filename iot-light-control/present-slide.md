# Presentation Plan (15 นาที)

## Slide 1 — Title (0:30)
- Project: IoT Light Control System
- Team / รายวิชา / วัตถุประสงค์

## Slide 2 — Problem & Goal (1:00)
- ปัญหา: ควบคุมไฟหลายจุดไม่สะดวก
- เป้าหมาย:
  - ควบคุมผ่านเว็บ
  - รองรับ Auto ด้วย sensor แสง
  - เลือกหลอดที่ให้ sensor คุมได้

## Slide 3 — Solution Overview (1:00)
- Web Dashboard + Backend API + MQTT Broker + ESP32
- Manual + Auto Mode ในระบบเดียว

## Slide 4 — System Architecture (1:30)
- แสดงภาพ Data Flow
- อธิบายแต่ละ service:
  - Frontend (UI)
  - Backend (state + business logic)
  - MQTT (message bus)
  - ESP32 (device control)

## Slide 5 — Hardware Setup (1:30)
- ESP32, LED 5 ดวง, Relay 2CH, LDR Sensor, บ้านโมเดล
- พอร์ตและ GPIO สำคัญ

## Slide 6 — Circuit Diagram (1:30)
- Diagram logical wiring
- อธิบาย Active-LOW/Active-HIGH ที่ต้อง calibrate

## Slide 7 — Core User Flow (1:30)
1. กดปุ่มจากเว็บ
2. Backend บันทึก state
3. Publish ไป MQTT
4. ESP32 รับคำสั่งและสั่ง GPIO/Relay

## Slide 8 — Sensor-per-Light Feature (1:30)
- เลือกหลอดผ่าน checkbox
- sensorTargets ถูกเก็บที่ backend
- เมื่อมืด/สว่าง ESP32 ส่ง sensor command
- Backend คุมเฉพาะหลอดที่เลือก

## Slide 9 — Demo Scenario (2:00)
- Scenario A: Manual เปิด/ปิดรายดวง
- Scenario B: เลือกหลอด 1,5 ให้ sensor คุม
- บังแสง/ส่องแสงแล้วดูหลอดเปลี่ยน

## Slide 10 — Debug Journey / Lessons Learned (1:30)
- ปัญหาที่เจอ:
  - MQTT reconnect ไม่เสถียร
  - payload ใหญ่เกินไป
  - logic relay/sensor กลับด้าน
- วิธีแก้:
  - ลด payload เฉพาะ field จำเป็น
  - ปรับ reconnect flow
  - calibrate ON/OFF logic

## Slide 11 — Cost Estimate (1:00)
- ESP32: ~120–220
- Relay 2CH: ~70–130
- LDR module: ~20–40
- LED 5 ดวง: ~5–25
- บ้านโมเดล: ~150–600
- รวมโดยประมาณ: ~365–1,015 บาท (ไม่รวม power supply/สายพิเศษ)

## Slide 12 — Value & Next Steps (0:30)
- จุดเด่น: ใช้งานง่าย, ขยายระบบง่าย, แยก service ชัด
- Next steps:
  - เพิ่ม auth
  - เพิ่ม history/dashboard analytics
  - เพิ่ม OTA update สำหรับ ESP32

---

## Presenter Notes (แนะนำ)
- เตรียม demo สำรอง: ใช้ `curl` เผื่อ UI สะดุด
- เปิด 2 จอพร้อมกัน:
  - หน้าเว็บ
  - serial log ESP32 / backend log
- สรุปท้ายให้ชัดว่า "Manual + Sensor-per-light ทำงานจริง"
