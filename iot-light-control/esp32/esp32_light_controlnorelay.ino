#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ===== ตั้งค่า Wi-Fi =====
const char* ssid     = "home88_53_2.4G";
const char* password = "P@ssw0rdasdf";

// ===== ตั้งค่า Backend =====
// ห้ามใช้ localhost — ต้องใส่ IP จริงของเครื่องที่รัน Backend
const char* serverUrl = "http://192.168.1.44:3000/api/lights";

// ===== GPIO ไฟ 5 ดวงเดิม =====
// ให้ไฟ 5 ดวงแรกทำงานเหมือนเดิม
const int lightPins[5] = {23, 22, 21, 19, 18};

// ===== GPIO Relay เพิ่มใหม่ =====
// Relay 1 ทำงานตาม Light 1
// Relay 2 ทำงานตาม Light 2
const int relay1Pin = 26;
const int relay2Pin = 27;

// ===== Logic ของไฟเดิม =====
// ใช้ค่าเดิมตามโค้ดที่คุณบอกว่าใช้งานได้แล้ว
#define LIGHT_ON  HIGH
#define LIGHT_OFF LOW

// ===== Logic ของ Relay =====
// Relay Module ส่วนใหญ่เป็น Active LOW
#define RELAY_ON  HIGH
#define RELAY_OFF LOW

bool lightStates[5] = {false, false, false, false, false};

void setup() {
  Serial.begin(115200);

  // ตั้งค่าไฟ 5 ดวงเดิม
  for (int i = 0; i < 5; i++) {
    pinMode(lightPins[i], OUTPUT);
    digitalWrite(lightPins[i], LIGHT_OFF);
  }

  // ตั้งค่า Relay เพิ่มใหม่
  pinMode(relay1Pin, OUTPUT);
  pinMode(relay2Pin, OUTPUT);

  digitalWrite(relay1Pin, RELAY_OFF);
  digitalWrite(relay2Pin, RELAY_OFF);

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

void connectWiFi() {
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
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  HTTPClient http;
  WiFiClient client;

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
    } else {
      for (int i = 0; i < 5; i++) {
        String key = "light" + String(i + 1);
        lightStates[i] = doc[key].as<bool>();
      }

      updateOutputs();
      printLightStatus();
    }
  } else {
    Serial.println("[HTTP] Error — keeping last known state");
  }

  http.end();
}

void updateOutputs() {
  // ไฟ 5 ดวงเดิม
  for (int i = 0; i < 5; i++) {
    digitalWrite(lightPins[i], lightStates[i] ? LIGHT_ON : LIGHT_OFF);
  }

  // Relay เพิ่มใหม่
  // Relay 1 ทำงานตาม Light 1
  digitalWrite(relay1Pin, lightStates[0] ? RELAY_ON : RELAY_OFF);

  // Relay 2 ทำงานตาม Light 2
  digitalWrite(relay2Pin, lightStates[1] ? RELAY_ON : RELAY_OFF);
}

void printLightStatus() {
  Serial.println("[STATUS] -------- Light Status --------");

  for (int i = 0; i < 5; i++) {
    Serial.printf("[STATUS] Light %d GPIO %d: %s\n",
      i + 1,
      lightPins[i],
      lightStates[i] ? "ON" : "OFF"
    );
  }

  Serial.printf("[STATUS] Relay 1 GPIO %d follows Light 1: %s\n",
    relay1Pin,
    lightStates[0] ? "ON" : "OFF"
  );

  Serial.printf("[STATUS] Relay 2 GPIO %d follows Light 2: %s\n",
    relay2Pin,
    lightStates[1] ? "ON" : "OFF"
  );

  Serial.println("[STATUS] --------------------------------");
}