# Wiring Guide — IoT Light Control System

ESP32 + Relay 5 Channel + LED จำลองไฟ 5 ดวง

---

## อุปกรณ์ที่ใช้

| อุปกรณ์                        | จำนวน | หมายเหตุ                          |
|-------------------------------|-------|----------------------------------|
| ESP32 Development Board        | 1     | ESP32-WROOM-32 หรือรุ่นเทียบเท่า  |
| Relay Module 5 Channel         | 1     | Active LOW, 5V coil              |
| LED (สีใดก็ได้)                 | 5     | จำลองหลอดไฟ                       |
| Resistor 220Ω                  | 5     | จำกัดกระแสให้ LED                  |
| Breadboard                     | 1     |                                  |
| สาย Jumper Male-to-Male        | ~20   |                                  |
| สาย Jumper Male-to-Female      | ~10   | สำหรับต่อ ESP32 กับ Relay         |
| สาย USB Micro / USB-C          | 1     | จ่ายไฟให้ ESP32                   |

---

## ตารางการต่อสาย ESP32 → Relay Module

| Relay Module Pin | ESP32 Pin  | สี Jumper แนะนำ |
|-----------------|------------|----------------|
| IN1             | GPIO 23    | เหลือง          |
| IN2             | GPIO 22    | เหลือง          |
| IN3             | GPIO 21    | เหลือง          |
| IN4             | GPIO 19    | เหลือง          |
| IN5             | GPIO 18    | เหลือง          |
| VCC             | 5V (VIN)   | แดง             |
| GND             | GND        | ดำ              |

> **สำคัญมาก:** GND ของ ESP32 และ GND ของ Relay Module ต้องต่อสายเข้าหากัน (Common GND)
> ถ้าไม่ Common GND สัญญาณ IN จะไม่ทำงาน

---

## ตารางการต่อสาย Relay → LED (จำลองไฟ)

Relay Module แต่ละ channel มี 3 ขา: **COM**, **NO** (Normally Open), **NC** (Normally Closed)

สำหรับโครงงานนี้ใช้ขา **COM** และ **NO** เท่านั้น

| Relay Channel | COM     | NO          | LED Anode (+) | LED Cathode (−) | Resistor |
|--------------|---------|-------------|---------------|-----------------|---------|
| CH1          | 5V      | LED1 (+)    | ต่อจาก NO     | ต่อ Resistor → GND | 220Ω    |
| CH2          | 5V      | LED2 (+)    | ต่อจาก NO     | ต่อ Resistor → GND | 220Ω    |
| CH3          | 5V      | LED3 (+)    | ต่อจาก NO     | ต่อ Resistor → GND | 220Ω    |
| CH4          | 5V      | LED4 (+)    | ต่อจาก NO     | ต่อ Resistor → GND | 220Ω    |
| CH5          | 5V      | LED5 (+)    | ต่อจาก NO     | ต่อ Resistor → GND | 220Ω    |

---

## แผนผังวงจรแบบ Block Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Power Supply                             │
│                    USB 5V (จาก Computer)                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │ USB
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                      ESP32 Dev Board                             │
│                                                                  │
│   GPIO23 ──────────────────────────────────► IN1                │
│   GPIO22 ──────────────────────────────────► IN2                │
│   GPIO21 ──────────────────────────────────► IN3   Relay        │
│   GPIO19 ──────────────────────────────────► IN4   Module       │
│   GPIO18 ──────────────────────────────────► IN5   5 CH         │
│                                                                  │
│   5V (VIN) ────────────────────────────────► VCC                │
│   GND ─────────────────────────────────────► GND                │
└──────────────────────────────────────────────────────────────────┘
```

```
Relay Module 5 Channel
┌──────────────────────────────────────────────────────────────────┐
│  IN1  IN2  IN3  IN4  IN5    VCC  GND                            │
│   │    │    │    │    │      │    │                              │
│  CH1  CH2  CH3  CH4  CH5                                         │
│                                                                  │
│  CH1: COM──NO    CH2: COM──NO    CH3: COM──NO                   │
│  CH4: COM──NO    CH5: COM──NO                                    │
└──────────┬───────────────────────────────────────────────────────┘
           │ COM ต่อ 5V ทุก channel
           │ NO ต่อ LED (+)
           ▼
┌──────────────────────────────────────────────────────────────────┐
│                     LED Circuit (×5)                             │
│                                                                  │
│   NO ──── LED Anode(+) ──[LED]── Cathode(−) ──[220Ω]── GND     │
│                                                                  │
│   เมื่อ Relay เปิด (coil ON): วงจร NO-COM ต่อกัน → LED ติด      │
│   เมื่อ Relay ปิด (coil OFF): วงจร NO เปิด → LED ดับ            │
└──────────────────────────────────────────────────────────────────┘
```

---

## แผนผังวงจร LED แต่ละดวง (Schematic)

```
         Relay CH1
         ┌────────┐
5V ──────┤ COM    │
         │        │
         │   NO   ├──────┬──────────────────────────────────────┐
         └────────┘      │                                      │
                         │                                      │
                       Anode                                    │
                       ┌───┐                                    │
                       │ L │  LED1                              │
                       │ E │                                    │
                       │ D │                                    │
                       └───┘                                    │
                       Cathode                                  │
                         │                                      │
                       ┌───┐                                    │
                       │220│  Resistor                          │
                       │ Ω │                                    │
                       └───┘                                    │
                         │                                      │
GND ─────────────────────┴──────────────────────────────────────┘
```

วงจร LED ดวงที่ 2–5 ต่อแบบเดียวกัน เพียงแต่ใช้ NO ของ CH2–CH5 ตามลำดับ

---

## แผนผัง Breadboard (มุมมองจากด้านบน)

```
                    BREADBOARD
    +──────────────────────────────────────+
    │  +  -  a b c d e   f g h i j  +  -  │
    │                                      │
    │  [ESP32 Dev Board]                   │
    │   วางตรงกลาง Breadboard              │
    │                                      │
    │  [Relay Module]                      │
    │   ต่อด้วย Jumper ไปยัง ESP32         │
    │                                      │
    │  LED1 ─ 220Ω ─ GND Rail (−)         │
    │  LED2 ─ 220Ω ─ GND Rail (−)         │
    │  LED3 ─ 220Ω ─ GND Rail (−)         │
    │  LED4 ─ 220Ω ─ GND Rail (−)         │
    │  LED5 ─ 220Ω ─ GND Rail (−)         │
    │                                      │
    │  Power Rail (+) ─── 5V (VIN)        │
    │  GND Rail (−)  ─── GND              │
    +──────────────────────────────────────+
```

---

## ขา ESP32 ที่ใช้ทั้งหมด

```
ESP32 Dev Board
                  ┌─────────┐
            3V3 ──┤         ├── GND
             EN ──┤         ├── GPIO23 ──► Relay IN1
          GPIO36 ──┤         ├── GPIO22 ──► Relay IN2
          GPIO39 ──┤         ├── GPIO21 ──► Relay IN3
          GPIO34 ──┤         ├── GPIO19 ──► Relay IN4
          GPIO35 ──┤  ESP32  ├── GPIO18 ──► Relay IN5
          GPIO32 ──┤         ├── GPIO5
          GPIO33 ──┤         ├── GPIO17
          GPIO25 ──┤         ├── GPIO16
          GPIO26 ──┤         ├── GPIO4
          GPIO27 ──┤         ├── GPIO0
          GPIO14 ──┤         ├── GPIO2
          GPIO12 ──┤         ├── GPIO15
          GPIO13 ──┤         ├── GPIO8
            GND ──┤         ├── GPIO7
            VIN ──┤         ├── GPIO6
                  └─────────┘
                  (VIN = 5V Input)

ขาที่ใช้:  GPIO23, GPIO22, GPIO21, GPIO19, GPIO18 (Relay IN1-IN5)
           VIN (5V → Relay VCC)
           GND (Common GND)
```

---

## ลำดับขั้นตอนการต่อวงจร

### ขั้นที่ 1 — ต่อ GND ร่วม (สำคัญที่สุด)
```
ESP32 GND ────────────────────────► Relay GND
ESP32 GND ────────────────────────► Breadboard GND Rail (−)
```

### ขั้นที่ 2 — ต่อไฟเลี้ยง Relay
```
ESP32 VIN (5V) ───────────────────► Relay VCC
ESP32 VIN (5V) ───────────────────► Breadboard Power Rail (+)
```

### ขั้นที่ 3 — ต่อสัญญาณควบคุม (IN1–IN5)
```
ESP32 GPIO23 ─────────────────────► Relay IN1
ESP32 GPIO22 ─────────────────────► Relay IN2
ESP32 GPIO21 ─────────────────────► Relay IN3
ESP32 GPIO19 ─────────────────────► Relay IN4
ESP32 GPIO18 ─────────────────────► Relay IN5
```

### ขั้นที่ 4 — ต่อ COM ของ Relay ทุก channel เข้า 5V
```
Relay CH1 COM ────────────────────► Breadboard Power Rail (+)
Relay CH2 COM ────────────────────► Breadboard Power Rail (+)
Relay CH3 COM ────────────────────► Breadboard Power Rail (+)
Relay CH4 COM ────────────────────► Breadboard Power Rail (+)
Relay CH5 COM ────────────────────► Breadboard Power Rail (+)
```

### ขั้นที่ 5 — ต่อ LED แต่ละดวง
```
Relay CH1 NO ── LED1 Anode ── LED1 Cathode ── Resistor 220Ω ── GND Rail
Relay CH2 NO ── LED2 Anode ── LED2 Cathode ── Resistor 220Ω ── GND Rail
Relay CH3 NO ── LED3 Anode ── LED3 Cathode ── Resistor 220Ω ── GND Rail
Relay CH4 NO ── LED4 Anode ── LED4 Cathode ── Resistor 220Ω ── GND Rail
Relay CH5 NO ── LED5 Anode ── LED5 Cathode ── Resistor 220Ω ── GND Rail
```

> **แยกแยะขา LED:** ขา Anode (+) ยาวกว่า, ขา Cathode (−) สั้นกว่า

---

## การทำงานของ Relay (Active LOW)

Relay Module ที่ใช้ทั่วไปเป็นแบบ **Active LOW**

| สัญญาณ IN (GPIO) | Relay Coil | ผลลัพธ์       | LED  |
|----------------|-----------|--------------|------|
| HIGH (3.3V)    | OFF       | COM–NO เปิด  | ดับ  |
| LOW  (0V)      | ON        | COM–NO ต่อกัน | ติด  |

โค้ดในไฟล์ `.ino` กำหนดไว้แล้ว:
```cpp
#define RELAY_ON  LOW   // LOW  = เปิด Relay → ไฟติด
#define RELAY_OFF HIGH  // HIGH = ปิด Relay → ไฟดับ
```

และตอน `setup()` ตั้งค่าเริ่มต้น Relay ทุกตัวเป็น OFF:
```cpp
digitalWrite(relayPins[i], RELAY_OFF);  // HIGH = ปิดทุกดวงก่อน
```

---

## ข้อควรระวัง

| ข้อ | รายละเอียด |
|-----|----------|
| GND ร่วม | ต้องต่อ GND ของ ESP32 กับ GND ของ Relay เข้าหากันเสมอ มิฉะนั้น IN signal จะไม่ทำงาน |
| แรงดัน Relay | Relay Module ใช้ไฟ 5V อย่าต่อ VCC เข้า 3.3V เพราะ coil จะไม่ทำงาน |
| ขั้ว LED | ขา Anode (+) = ขายาว, ขา Cathode (−) = ขาสั้น ถ้าต่อกลับ LED จะไม่ติด |
| Resistor | ต้องใส่ resistor 220Ω ทุกครั้ง ถ้าไม่ใส่ LED จะเสียทันที |
| ไฟบ้าน 220V | สำหรับโครงงานนักศึกษาแนะนำใช้ LED จำลองเท่านั้น ห้ามต่อกับไฟบ้าน 220V โดยไม่มีผู้เชี่ยวชาญดูแล |
| GPIO0 | หลีกเลี่ยงการใช้ GPIO0 เป็น output เพราะใช้สำหรับ boot mode |

---

## การทดสอบวงจรก่อน Upload Code

ทดสอบ Relay ด้วยการ short IN pin ลง GND ด้วยมือ (ใช้สาย Jumper):
- ต่อ IN1 ลง GND → ได้ยินเสียง "คลิก" และ LED ดวงที่ 1 ติด = ✅ วงจรถูกต้อง
- ถอดสาย → LED ดับ = ✅ ถูกต้อง

ถ้าไม่ได้ยินเสียงคลิก ให้ตรวจ:
1. VCC ของ Relay ได้รับ 5V หรือไม่ (วัดด้วย Multimeter)
2. GND ต่อร่วมกันหรือไม่
3. Jumper สาย IN หลวมหรือไม่
