#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ===== ตั้งค่า Wi-Fi =====
const char* ssid     = "home88_53_2.4G";
const char* password = "P@ssw0rdasdf";

// ===== ตั้งค่า Backend =====
// ห้ามใช้ localhost — ต้องใส่ IP จริงของเครื่องที่รัน Backend
const char* serverUrl = "http://192.168.1.44:3000/api/lights";

// ===== GPIO Relay (Active LOW) =====
const int relayPins[5] = {23, 22, 21, 19, 18};

#define RELAY_ON  LOW   // Active LOW: LOW = เปิด Relay
#define RELAY_OFF HIGH  // Active LOW: HIGH = ปิด Relay

// สถานะไฟล่าสุด (เก็บไว้กรณี API ล้มเหลว)
bool lightStates[5] = {false, false, false, false, false};

// ===========================
void setup() {
  Serial.begin(115200);

  // ตั้ง Relay ทุกตัวเป็น OFF ก่อน
  for (int i = 0; i < 5; i++) {
    pinMode(relayPins[i], OUTPUT);
    digitalWrite(relayPins[i], RELAY_OFF);
  }

  connectWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Disconnected — reconnecting...");
    connectWiFi();
  }

  fetchLightStatus();
  delay(1000);
}

// ===========================
void connectWiFi() {
  // ตั้ง Station mode และ disconnect ก่อนเสมอ เพื่อป้องกัน WiFi ค้างจาก session เดิม
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true);
  delay(100);

  Serial.printf("[WiFi] Connecting to %s", ssid);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.printf("[WiFi] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WiFi] Connection failed — will retry in next loop");
  }
}

void fetchLightStatus() {
  HTTPClient http;
  WiFiClient client;
  // begin(WiFiClient, url) — รูปแบบที่ถูกต้องสำหรับ ESP32 core v2+ และ v3+
  // begin(url) เวอร์ชันเก่าถูก deprecated และ compile ไม่ผ่านใน core รุ่นใหม่
  http.begin(client, serverUrl);
  http.setTimeout(5000);

  int httpCode = http.GET();
  Serial.printf("[HTTP] GET %s => %d\n", serverUrl, httpCode);

  if (httpCode == 200) {
    String payload = http.getString();
    Serial.printf("[HTTP] Payload: %s\n", payload.c_str());

    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (error) {
      Serial.printf("[JSON] Parse error: %s\n", error.c_str());
      // คงสถานะล่าสุดไว้ ไม่เปลี่ยน Relay
    } else {
      for (int i = 0; i < 5; i++) {
        String key = "light" + String(i + 1);
        lightStates[i] = doc[key].as<bool>();
      }

      updateRelays();
      printLightStatus();
    }
  } else {
    Serial.printf("[HTTP] Error — keeping last known state\n");
    // คงสถานะล่าสุดไว้ ไม่เปลี่ยน Relay
  }

  http.end();
}

void updateRelays() {
  for (int i = 0; i < 5; i++) {
    digitalWrite(relayPins[i], lightStates[i] ? RELAY_ON : RELAY_OFF);
  }
}

void printLightStatus() {
  Serial.println("[STATUS] -------- Light Status --------");
  for (int i = 0; i < 5; i++) {
    Serial.printf("[STATUS]   Light %d (GPIO %d): %s\n",
      i + 1, relayPins[i], lightStates[i] ? "ON" : "OFF");
  }
  Serial.println("[STATUS] ---------------------------------");
}
