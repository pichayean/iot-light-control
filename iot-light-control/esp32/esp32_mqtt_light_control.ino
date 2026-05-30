#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFiManager.h>

struct WiFiCredential {
  const char* ssid;
  const char* password;
};

WiFiCredential wifiList[] = {
  {"FakeHotspots", "P@ssw0rdasdf"},
  {"Home_2.4G", "asdf1234"},
  {"home88_53_2.4G", "P@ssw0rdasdf"},
  {"MasterShifu", "@12345678"}
};

const int wifiCount = sizeof(wifiList) / sizeof(wifiList[0]);

// ===== MQTT Broker =====
// เปลี่ยนเป็น IP ของเครื่องที่รัน docker compose
const char* mqttHost = "144.126.140.118";
const int mqttPort = 1883;
const char* mqttLightTopic = "iot-light-control/lights/state";
const char* mqttDeviceTopic = "iot-light-control/device/status";
const char* mqttLoopbackTopic = "iot-light-control/debug/loopback";
const char* sensorOnUrl = "http://144.126.140.118:3099/api/lights/sensor/on";
const char* sensorOffUrl = "http://144.126.140.118:3099/api/lights/sensor/off";
const bool ENABLE_LOOPBACK_TEST = false;
const bool ENABLE_SELF_LIGHT_TEST = false;

// ===== GPIO ไฟ 5 ดวง =====
const int lightPins[5] = {23, 22, 21, 19, 18};

// ===== GPIO Relay =====
const int relay1Pin = 26;
const int relay2Pin = 27;
const int lightSensorPin = 34;

#define LIGHT_ON  HIGH
#define LIGHT_OFF LOW
#define RELAY_ON  HIGH
#define RELAY_OFF LOW
#define DARK_STATE LOW

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

bool lightStates[5] = {false, false, false, false, false};

unsigned long lastDeviceUpdate = 0;
unsigned long lastReconnectTry = 0;
unsigned long lastMqttReconnectTry = 0;

const unsigned long DEVICE_UPDATE_INTERVAL = 120000;
const unsigned long RECONNECT_INTERVAL = 20000;
const unsigned long MQTT_RECONNECT_INTERVAL = 5000;
const unsigned long WIFI_PORTAL_TRIGGER_INTERVAL = 60000;
const unsigned long WIFI_PORTAL_TIMEOUT_SECONDS = 180;
const unsigned long LOOPBACK_INTERVAL = 15000;
const unsigned long LOOPBACK_TIMEOUT = 5000;
const unsigned long SELF_LIGHT_TEST_INTERVAL = 20000;
const unsigned long SENSOR_CHECK_INTERVAL = 500;

const char* configPortalSsid = "ESP32-Light-Setup";
const char* configPortalPass = "12345678";

int currentWifiIndex = -1;
int reconnectFailCount = 0;
unsigned long wifiLostSince = 0;
unsigned long lastLoopbackAt = 0;
unsigned long lastLoopbackSentAt = 0;
int lastLoopbackSeq = 0;
bool loopbackAcked = true;
unsigned long lastSelfLightTestAt = 0;
bool selfTestLightOn = false;
bool isDark = false;
bool lastSentDark = false;
bool hasSentSensorState = false;
unsigned long lastSensorCheck = 0;

bool connectWiFi();
bool reconnectWiFi();
bool openWiFiConfigPortal();
void connectMqtt();
void onMqttMessage(char* topic, byte* payload, unsigned int length);
void publishLightState(const char* source);
void publishDeviceStatus();
void updateOutputs();
void printLightStatus();
void sendLoopbackPing();
void sendSelfLightTest();
void checkLightSensorAndSendToServer();
void sendSensorLightsCommand(bool turnOn);

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println();
  Serial.println("[SYSTEM] ESP32 MQTT Light Controller Starting...");

  WiFi.mode(WIFI_STA);
  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);
  WiFi.setSleep(false);

  for (int i = 0; i < 5; i++) {
    pinMode(lightPins[i], OUTPUT);
    digitalWrite(lightPins[i], LIGHT_OFF);
  }

  pinMode(relay1Pin, OUTPUT);
  pinMode(relay2Pin, OUTPUT);
  digitalWrite(relay1Pin, RELAY_OFF);
  digitalWrite(relay2Pin, RELAY_OFF);
  pinMode(lightSensorPin, INPUT);

  mqttClient.setServer(mqttHost, mqttPort);
  mqttClient.setCallback(onMqttMessage);

  bool wifiReady = connectWiFi();
  if (!wifiReady) {
    Serial.println("[WiFi] No known Wi-Fi available — opening config portal...");
    wifiReady = openWiFiConfigPortal();
  }

  if (!wifiReady) {
    Serial.println("[WiFi] Unable to configure Wi-Fi. Restarting...");
    delay(1000);
    ESP.restart();
  }

  connectMqtt();
  publishDeviceStatus();
}

void loop() {
  unsigned long now = millis();

  if (WiFi.status() != WL_CONNECTED) {
    if (wifiLostSince == 0) {
      wifiLostSince = now;
    }

    if (now - lastReconnectTry >= RECONNECT_INTERVAL) {
      lastReconnectTry = now;
      Serial.println("[WiFi] Lost connection — reconnecting...");
      if (reconnectWiFi()) {
        wifiLostSince = 0;
        connectMqtt();
        publishDeviceStatus();
      }
    }

    if (wifiLostSince > 0 && now - wifiLostSince >= WIFI_PORTAL_TRIGGER_INTERVAL) {
      Serial.println("[WiFi] Disconnected too long — opening config portal...");
      if (openWiFiConfigPortal()) {
        wifiLostSince = 0;
        connectMqtt();
        publishDeviceStatus();
      } else {
        Serial.println("[WiFi] Config portal timed out. Restarting...");
        delay(1000);
        ESP.restart();
      }
    }

    delay(100);
    return;
  }

  wifiLostSince = 0;

  if (!mqttClient.connected()) {
    if (now - lastMqttReconnectTry >= MQTT_RECONNECT_INTERVAL) {
      lastMqttReconnectTry = now;
      connectMqtt();
    }
  } else {
    mqttClient.loop();
  }

  if (now - lastDeviceUpdate >= DEVICE_UPDATE_INTERVAL) {
    lastDeviceUpdate = now;
    publishDeviceStatus();
  }

  if (ENABLE_LOOPBACK_TEST && mqttClient.connected() && now - lastLoopbackAt >= LOOPBACK_INTERVAL) {
    lastLoopbackAt = now;
    sendLoopbackPing();
  }

  if (ENABLE_LOOPBACK_TEST && !loopbackAcked && now - lastLoopbackSentAt > LOOPBACK_TIMEOUT) {
    Serial.printf("[LOOPBACK] Timeout waiting ack seq=%d\n", lastLoopbackSeq);
    loopbackAcked = true;
  }

  if (ENABLE_SELF_LIGHT_TEST && mqttClient.connected() && now - lastSelfLightTestAt >= SELF_LIGHT_TEST_INTERVAL) {
    lastSelfLightTestAt = now;
    sendSelfLightTest();
  }

  if (now - lastSensorCheck >= SENSOR_CHECK_INTERVAL) {
    lastSensorCheck = now;
    checkLightSensorAndSendToServer();
  }

  delay(10);
}

bool connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  WiFi.mode(WIFI_STA);
  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);
  WiFi.setSleep(false);

  Serial.println("[WiFi] Trying saved Wi-Fi list...");

  for (int i = 0; i < wifiCount; i++) {
    Serial.println();
    Serial.printf("[WiFi] Trying SSID: %s\n", wifiList[i].ssid);

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
      return true;
    }

    Serial.println();
    Serial.printf("[WiFi] Failed: %s\n", wifiList[i].ssid);
    delay(300);
  }

  Serial.println("[WiFi] All Wi-Fi failed");
  return false;
}

bool reconnectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

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
      return true;
    }

    reconnectFailCount++;
    Serial.println();
    Serial.printf("[WiFi] Same SSID reconnect failed count: %d\n", reconnectFailCount);
  }

  if (reconnectFailCount >= 3 || currentWifiIndex == -1) {
    Serial.println("[WiFi] Same Wi-Fi failed too many times — trying all networks...");
    currentWifiIndex = -1;
    reconnectFailCount = 0;
    return connectWiFi();
  }

  return false;
}

bool openWiFiConfigPortal() {
  WiFiManager wm;
  wm.setConfigPortalTimeout(WIFI_PORTAL_TIMEOUT_SECONDS);
  wm.setConnectTimeout(20);
  wm.setBreakAfterConfig(true);

  String suffix = String((uint32_t)ESP.getEfuseMac(), HEX);
  if (suffix.length() > 4) {
    suffix = suffix.substring(suffix.length() - 4);
  }
  String apName = String(configPortalSsid) + "-" + suffix;

  Serial.printf("[WiFi] Starting portal SSID: %s\n", apName.c_str());
  bool connected = wm.autoConnect(apName.c_str(), configPortalPass);

  if (!connected || WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Portal finished without Wi-Fi connection");
    return false;
  }

  currentWifiIndex = -1;
  reconnectFailCount = 0;

  Serial.println("[WiFi] Connected via config portal");
  Serial.printf("[WiFi] SSID: %s\n", WiFi.SSID().c_str());
  Serial.printf("[WiFi] IP: %s\n", WiFi.localIP().toString().c_str());
  Serial.printf("[WiFi] RSSI: %d dBm\n", WiFi.RSSI());
  return true;
}

void connectMqtt() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  if (mqttClient.connected()) {
    mqttClient.loop();
    return;
  }

  String clientId = "esp32-light-" + String((uint32_t)ESP.getEfuseMac(), HEX);

  Serial.printf("[MQTT] Connecting to %s:%d...\n", mqttHost, mqttPort);
  if (mqttClient.connect(clientId.c_str())) {
    Serial.println("[MQTT] Connected");
    mqttClient.subscribe(mqttLightTopic, 1);
    if (ENABLE_LOOPBACK_TEST) {
      mqttClient.subscribe(mqttLoopbackTopic, 1);
      Serial.printf("[MQTT] Subscribed: %s, %s\n", mqttLightTopic, mqttLoopbackTopic);
    } else {
      Serial.printf("[MQTT] Subscribed: %s\n", mqttLightTopic);
    }
    publishDeviceStatus();
  } else {
    Serial.printf("[MQTT] Connect failed, state=%d\n", mqttClient.state());
  }
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String message;
  message.reserve(length + 1);

  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.printf("[MQTT] Message on %s: %s\n", topic, message.c_str());

  if (ENABLE_LOOPBACK_TEST && String(topic) == mqttLoopbackTopic) {
    StaticJsonDocument<256> loopDoc;
    DeserializationError loopErr = deserializeJson(loopDoc, message);
    if (loopErr) {
      Serial.printf("[LOOPBACK] Parse error: %s\n", loopErr.c_str());
      return;
    }

    String source = loopDoc["source"] | "";
    int seq = loopDoc["seq"] | -1;
    if (source == "esp32" && seq == lastLoopbackSeq) {
      loopbackAcked = true;
      Serial.printf("[LOOPBACK] ACK ok seq=%d\n", seq);
    } else {
      Serial.printf("[LOOPBACK] Received non-self payload source=%s seq=%d\n", source.c_str(), seq);
    }
    return;
  }

  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, message);
  if (error) {
    Serial.printf("[JSON] Parse error: %s\n", error.c_str());
    return;
  }

  String source = doc["source"] | "";
  if (source == "esp32") {
    Serial.printf("[MQTT] Ignore self/state message from source=%s\n", source.c_str());
    return;
  }

  bool changed = false;
  for (int i = 0; i < 5; i++) {
    String key = "light" + String(i + 1);
    if (!doc.containsKey(key)) {
      continue;
    }

    bool newState = doc[key].as<bool>();
    if (newState != lightStates[i]) {
      changed = true;
    }
    lightStates[i] = newState;
  }

  updateOutputs();
  printLightStatus();

  if (changed) {
    Serial.println("[MQTT] Applied new light state from broker");
    publishLightState("esp32");
  } else {
    Serial.println("[MQTT] State unchanged (no GPIO update needed)");
  }
}

void publishLightState(const char* source) {
  if (!mqttClient.connected()) {
    return;
  }

  StaticJsonDocument<256> doc;
  for (int i = 0; i < 5; i++) {
    String key = "light" + String(i + 1);
    doc[key] = lightStates[i];
  }
  doc["source"] = source;
  doc["updatedAt"] = millis();

  String body;
  serializeJson(doc, body);
  mqttClient.publish(mqttLightTopic, body.c_str(), true);
}

void publishDeviceStatus() {
  if (WiFi.status() != WL_CONNECTED || !mqttClient.connected()) {
    return;
  }

  StaticJsonDocument<256> doc;
  doc["ssid"] = WiFi.SSID();
  doc["ip"] = WiFi.localIP().toString();
  doc["rssi"] = WiFi.RSSI();
  doc["lastSeen"] = millis();
  doc["lightSensor"] = digitalRead(lightSensorPin);
  doc["isDark"] = isDark;
  doc["source"] = "esp32";

  String body;
  serializeJson(doc, body);
  mqttClient.publish(mqttDeviceTopic, body.c_str(), true);
  Serial.printf("[DEVICE] MQTT publish => %s\n", body.c_str());
}

void checkLightSensorAndSendToServer() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  int sensorState = digitalRead(lightSensorPin);
  isDark = sensorState == DARK_STATE;

  if (!hasSentSensorState || isDark != lastSentDark) {
    hasSentSensorState = true;
    lastSentDark = isDark;
    Serial.printf("[SENSOR] state changed: isDark=%s\n", isDark ? "YES" : "NO");
    sendSensorLightsCommand(!isDark);
    publishDeviceStatus();
  }
}

void sendSensorLightsCommand(bool turnOn) {
  WiFiClient client;
  HTTPClient http;

  client.setTimeout(3000);
  const char* url = turnOn ? sensorOnUrl : sensorOffUrl;
  if (!http.begin(client, url)) {
    Serial.println("[SENSOR->SERVER] HTTP begin failed");
    return;
  }

  http.setTimeout(3000);
  http.addHeader("Connection", "close");
  int httpCode = http.POST("");
  Serial.printf("[SENSOR->SERVER] POST %s => %d\n", turnOn ? "/api/lights/sensor/on" : "/api/lights/sensor/off", httpCode);
  http.end();
  client.stop();
}

void sendLoopbackPing() {
  if (!mqttClient.connected()) {
    return;
  }

  lastLoopbackSeq++;
  lastLoopbackSentAt = millis();
  loopbackAcked = false;

  StaticJsonDocument<192> doc;
  doc["source"] = "esp32";
  doc["seq"] = lastLoopbackSeq;
  doc["sentAt"] = lastLoopbackSentAt;

  String body;
  serializeJson(doc, body);
  mqttClient.publish(mqttLoopbackTopic, body.c_str(), false);
  Serial.printf("[LOOPBACK] Publish seq=%d payload=%s\n", lastLoopbackSeq, body.c_str());
}

void sendSelfLightTest() {
  if (!mqttClient.connected()) {
    return;
  }

  selfTestLightOn = !selfTestLightOn;

  StaticJsonDocument<256> doc;
  doc["light1"] = selfTestLightOn;
  doc["light2"] = false;
  doc["light3"] = false;
  doc["light4"] = false;
  doc["light5"] = false;
  doc["source"] = "loopback-test";
  doc["updatedAt"] = millis();

  String body;
  serializeJson(doc, body);
  mqttClient.publish(mqttLightTopic, body.c_str(), true);
  Serial.printf("[SELF-TEST] Publish light1=%s payload=%s\n", selfTestLightOn ? "ON" : "OFF", body.c_str());
}

void updateOutputs() {
  for (int i = 0; i < 5; i++) {
    digitalWrite(lightPins[i], lightStates[i] ? LIGHT_ON : LIGHT_OFF);
  }

  digitalWrite(relay1Pin, lightStates[0] ? RELAY_ON : RELAY_OFF);
  digitalWrite(relay2Pin, lightStates[1] ? RELAY_ON : RELAY_OFF);
}

void printLightStatus() {
  Serial.println("[STATUS] -------- Light Status --------");

  for (int i = 0; i < 5; i++) {
    Serial.printf("[STATUS] Light %d GPIO %d: %s\n", i + 1, lightPins[i], lightStates[i] ? "ON" : "OFF");
  }

  Serial.printf("[STATUS] Relay 1 GPIO %d follows Light 1: %s\n", relay1Pin, lightStates[0] ? "ON" : "OFF");
  Serial.printf("[STATUS] Relay 2 GPIO %d follows Light 2: %s\n", relay2Pin, lightStates[1] ? "ON" : "OFF");
  Serial.println("[STATUS] --------------------------------");
}
