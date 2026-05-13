#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

struct WiFiCredential {
  const char* ssid;
  const char* password;
};

WiFiCredential wifiList[] = {
  {"Home_2.4G", "asdf1234"},
  {"home88_53_2.4G", "P@ssw0rdasdf"},
  {"MasterShifu", "@12345678"},
  {"WiFi_สำรอง_2", "password2"},
  {"Hotspot_Phone", "password3"}
};

const int wifiCount = sizeof(wifiList) / sizeof(wifiList[0]);

// ===== Backend =====
const char* serverUrl = "http://144.126.140.118:3099/api/lights";
const char* deviceUrl = "http://144.126.140.118:3099/api/device";

// ===== GPIO ไฟ 5 ดวง =====
const int lightPins[5] = {23, 22, 21, 19, 18};

// ===== GPIO Relay =====
// Relay 1 ทำงานตาม Light 1
// Relay 2 ทำงานตาม Light 2
const int relay1Pin = 26;
const int relay2Pin = 27;

// ===== Logic ไฟ =====
#define LIGHT_ON  HIGH
#define LIGHT_OFF LOW

// ===== Logic Relay =====
// ถ้า Relay เป็น Active LOW ให้เปลี่ยนเป็น:
// #define RELAY_ON  LOW
// #define RELAY_OFF HIGH
#define RELAY_ON  HIGH
#define RELAY_OFF LOW

bool lightStates[5] = {false, false, false, false, false};

// ===== Timing =====
unsigned long lastDeviceUpdate = 0;
unsigned long lastLightFetch = 0;
unsigned long lastReconnectTry = 0;

const unsigned long DEVICE_UPDATE_INTERVAL = 120000; // ส่ง device ทุก 120 วิ
const unsigned long LIGHT_FETCH_INTERVAL = 2000;     // ดึงสถานะไฟทุก 3 วิ
const unsigned long RECONNECT_INTERVAL = 20000;      // ถ้าหลุด ลอง reconnect ทุก 20 วิ

// ===== Wi-Fi reconnect state =====
int currentWifiIndex = -1;
int reconnectFailCount = 0;

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println();
  Serial.println("[SYSTEM] ESP32 Light Controller Starting...");

  WiFi.mode(WIFI_STA);
  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);
  WiFi.setSleep(false);

  // ตั้งค่าไฟ 5 ดวง
  for (int i = 0; i < 5; i++) {
    pinMode(lightPins[i], OUTPUT);
    digitalWrite(lightPins[i], LIGHT_OFF);
  }

  // ตั้งค่า Relay
  pinMode(relay1Pin, OUTPUT);
  pinMode(relay2Pin, OUTPUT);

  digitalWrite(relay1Pin, RELAY_OFF);
  digitalWrite(relay2Pin, RELAY_OFF);

  connectWiFi();

  // ส่ง device status ครั้งแรกหลังต่อ Wi-Fi สำเร็จ
  if (WiFi.status() == WL_CONNECTED) {
    sendDeviceStatus();
    lastDeviceUpdate = millis();
  }
}

void loop() {
  unsigned long now = millis();

  if (WiFi.status() != WL_CONNECTED) {
    if (now - lastReconnectTry >= RECONNECT_INTERVAL) {
      lastReconnectTry = now;
      Serial.println("[WiFi] Lost connection — reconnecting same Wi-Fi first...");
      reconnectWiFi();
    }

    delay(100);
    return;
  }

  if (now - lastLightFetch >= LIGHT_FETCH_INTERVAL) {
    lastLightFetch = now;
    fetchLightStatus();
  }

  if (now - lastDeviceUpdate >= DEVICE_UPDATE_INTERVAL) {
    lastDeviceUpdate = now;
    sendDeviceStatus();
  }

  delay(10);
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  WiFi.mode(WIFI_STA);
  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);
  WiFi.setSleep(false);

  Serial.println("[WiFi] Trying saved Wi-Fi list...");

  for (int i = 0; i < wifiCount; i++) {
    Serial.println();
    Serial.printf("[WiFi] Trying SSID: %s", wifiList[i].ssid);

    WiFi.begin(wifiList[i].ssid, wifiList[i].password);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
      delay(500);
      Serial.print(".");
      attempts++;
      yield();
    }

    if (WiFi.status() == WL_CONNECTED) {
      currentWifiIndex = i;
      reconnectFailCount = 0;

      Serial.println();
      Serial.printf("[WiFi] Connected to: %s\n", WiFi.SSID().c_str());
      Serial.printf("[WiFi] IP: %s\n", WiFi.localIP().toString().c_str());
      Serial.printf("[WiFi] RSSI: %d dBm\n", WiFi.RSSI());
      return;
    }

    Serial.println();
    Serial.printf("[WiFi] Failed: %s\n", wifiList[i].ssid);

    delay(300);
  }

  Serial.println("[WiFi] All Wi-Fi failed");
}

void reconnectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  // ลอง reconnect Wi-Fi ตัวเดิมก่อน
  if (currentWifiIndex >= 0 && currentWifiIndex < wifiCount) {
    Serial.printf("[WiFi] Reconnecting to same SSID: %s\n", wifiList[currentWifiIndex].ssid);

    WiFi.begin(wifiList[currentWifiIndex].ssid, wifiList[currentWifiIndex].password);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 10) {
      delay(500);
      Serial.print(".");
      attempts++;
      yield();
    }

    if (WiFi.status() == WL_CONNECTED) {
      reconnectFailCount = 0;

      Serial.println();
      Serial.printf("[WiFi] Reconnected to: %s\n", WiFi.SSID().c_str());
      Serial.printf("[WiFi] IP: %s\n", WiFi.localIP().toString().c_str());
      Serial.printf("[WiFi] RSSI: %d dBm\n", WiFi.RSSI());

      sendDeviceStatus();
      lastDeviceUpdate = millis();

      return;
    }

    reconnectFailCount++;

    Serial.println();
    Serial.printf("[WiFi] Same SSID reconnect failed count: %d\n", reconnectFailCount);
  }

  // ถ้าตัวเดิม fail 3 รอบ ค่อยลอง Wi-Fi ทั้งหมด
  if (reconnectFailCount >= 3 || currentWifiIndex == -1) {
    Serial.println("[WiFi] Same Wi-Fi failed too many times — trying all networks...");

    currentWifiIndex = -1;
    reconnectFailCount = 0;

    connectWiFi();
  }
}

void closeHttp(HTTPClient &http, WiFiClient &client) {
  http.end();
  client.stop();
  delay(30);
  yield();
}

void fetchLightStatus() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  WiFiClient client;
  HTTPClient http;

  client.setTimeout(3000);

  if (!http.begin(client, serverUrl)) {
    Serial.println("[HTTP] begin failed");
    client.stop();
    delay(30);
    return;
  }

  http.setTimeout(3000);
  http.setReuse(false);
  http.useHTTP10(true);
  http.addHeader("Connection", "close");

  int httpCode = http.GET();

  Serial.printf("[HTTP] GET => %d\n", httpCode);

  if (httpCode == 200) {
    String payload = http.getString();
    Serial.printf("[HTTP] Payload: %s\n", payload.c_str());

    StaticJsonDocument<768> doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (error) {
      Serial.printf("[JSON] Parse error: %s\n", error.c_str());
    } else {
      for (int i = 0; i < 5; i++) {
        String key = "light" + String(i + 1);
        lightStates[i] = doc[key] | false;
      }

      updateOutputs();
      printLightStatus();
    }
  } else {
    Serial.println("[HTTP] Error — keeping last known state");
  }

  closeHttp(http, client);
}

void updateOutputs() {
  // ไฟ 5 ดวงเดิม
  for (int i = 0; i < 5; i++) {
    digitalWrite(lightPins[i], lightStates[i] ? LIGHT_ON : LIGHT_OFF);
  }

  // Relay 1 ทำงานตาม Light 1
  digitalWrite(relay1Pin, lightStates[0] ? RELAY_ON : RELAY_OFF);

  // Relay 2 ทำงานตาม Light 2
  digitalWrite(relay2Pin, lightStates[1] ? RELAY_ON : RELAY_OFF);
}

void printLightStatus() {
  Serial.println("[STATUS] -------- Light Status --------");

  for (int i = 0; i < 5; i++) {
    Serial.printf(
      "[STATUS] Light %d GPIO %d: %s\n",
      i + 1,
      lightPins[i],
      lightStates[i] ? "ON" : "OFF"
    );
  }

  Serial.printf(
    "[STATUS] Relay 1 GPIO %d follows Light 1: %s\n",
    relay1Pin,
    lightStates[0] ? "ON" : "OFF"
  );

  Serial.printf(
    "[STATUS] Relay 2 GPIO %d follows Light 2: %s\n",
    relay2Pin,
    lightStates[1] ? "ON" : "OFF"
  );

  Serial.println("[STATUS] --------------------------------");
}

void sendDeviceStatus() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  WiFiClient client;
  HTTPClient http;

  client.setTimeout(3000);

  if (!http.begin(client, deviceUrl)) {
    Serial.println("[DEVICE] begin failed");
    client.stop();
    delay(30);
    return;
  }

  http.setTimeout(3000);
  http.setReuse(false);
  http.useHTTP10(true);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Connection", "close");

  StaticJsonDocument<256> doc;
  doc["ssid"] = WiFi.SSID();
  doc["ip"] = WiFi.localIP().toString();
  doc["rssi"] = WiFi.RSSI();

  String body;
  serializeJson(doc, body);

  int httpCode = http.POST(body);

  Serial.printf("[DEVICE] POST => %d\n", httpCode);
  Serial.printf("[DEVICE] Body: %s\n", body.c_str());

  if (httpCode > 0) {
    String response = http.getString();
    Serial.printf("[DEVICE] Response: %s\n", response.c_str());
  } else {
    Serial.printf("[DEVICE] POST failed, code: %d\n", httpCode);
  }

  closeHttp(http, client);
}