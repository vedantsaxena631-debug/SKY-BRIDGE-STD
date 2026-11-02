#include "roleDrone.h"
#include "config.h"
#include "loraLink.h"
#include "loopPrevention.h"
#include "serialBridge.h"
#include <esp_system.h>

#ifndef DRONE_BUTTON_1_PIN
#define DRONE_BUTTON_1_PIN 32
#endif
#ifndef DRONE_BUTTON_2_PIN
#define DRONE_BUTTON_2_PIN 33
#endif
#ifndef DRONE_BUTTON_3_PIN
#define DRONE_BUTTON_3_PIN 25
#endif
#ifndef DRONE_BUTTON_4_PIN
#define DRONE_BUTTON_4_PIN 27
#endif

static unsigned long lastHeartbeatTime = 0;
static uint32_t nextAlertMsgId = 0;

struct DroneAlertButton {
  uint8_t pin;
  const char* payload;
  const char* priority;
  bool lastReading;
  bool stablePressed;
  unsigned long changedAt;
};

static DroneAlertButton alertButtons[] = {
  {DRONE_BUTTON_1_PIN, "VICTIM DETECTED", "CRITICAL", false, false, 0},
  {DRONE_BUTTON_2_PIN, "MEDICAL ASSISTANCE REQUIRED", "URGENT", false, false, 0},
  {DRONE_BUTTON_3_PIN, "EXTRACTION REQUIRED", "URGENT", false, false, 0},
  {DRONE_BUTTON_4_PIN, "AREA SECURE", "ROUTINE", false, false, 0},
};

static void sendDroneButtonAlert(const DroneAlertButton& button) {
  if (nextAlertMsgId == 0) {
    nextAlertMsgId = esp_random() & 0x7FFFFFFF;
    if (nextAlertMsgId == 0) nextAlertMsgId = 1;
  }

  SkyMessage alert = {};
  strlcpy(alert.from, "DRONE", sizeof(alert.from));
  strlcpy(alert.to, "BROADCAST", sizeof(alert.to));
  alert.msgID = nextAlertMsgId++;
  if (nextAlertMsgId == 0 || nextAlertMsgId > 0x7FFFFFFF) nextAlertMsgId = 1;
  strlcpy(alert.payload, button.payload, sizeof(alert.payload));
  strlcpy(alert.priority, button.priority, sizeof(alert.priority));
  alert.relayCount = 0;
  strlcpy(alert.type, "MSG", sizeof(alert.type));
  alert.rssi = 0;

  // Mark locally originated traffic so the relay does not rebroadcast its own alert.
  loopFilter.markSeen(alert.msgID);
  if (!radio.transmit(alert)) {
    Serial.println("[drone] button alert radio transmission failed");
    return;
  }

  // The USB gateway mirrors this verified LoRa transmission into the live website.
  serialBridge.emit(alert);
  digitalWrite(DRONE_LED_PIN, LOW);
  delay(70);
  digitalWrite(DRONE_LED_PIN, HIGH);
  Serial.println("[drone] alert sent: " + String(button.payload));
}

static void pollDroneAlertButtons(unsigned long now) {
  for (DroneAlertButton& button : alertButtons) {
    const bool readingPressed = digitalRead(button.pin) == LOW;
    if (readingPressed != button.lastReading) {
      button.lastReading = readingPressed;
      button.changedAt = now;
    }

    if (now - button.changedAt >= 35 && readingPressed != button.stablePressed) {
      button.stablePressed = readingPressed;
      if (button.stablePressed) sendDroneButtonAlert(button);
    }
  }
}

void initDroneRelay() {
  pinMode(DRONE_LED_PIN, OUTPUT);
  digitalWrite(DRONE_LED_PIN, HIGH); // Solid ON = Idle & Powered
  const unsigned long now = millis();
  for (DroneAlertButton& button : alertButtons) {
    pinMode(button.pin, INPUT_PULLUP);
    button.lastReading = digitalRead(button.pin) == LOW;
    button.stablePressed = button.lastReading;
    button.changedAt = now;
  }
}

void handleDroneRelayIncoming(SkyMessage& msg) {
  // 1. Loop Prevention check: Have we already forwarded or originated this msgID?
  if (loopFilter.alreadySeen(msg.msgID)) {
    // Duplicate suppressed: silently drop to avoid endless RF ping-pong
    return;
  }

  // 2. Mark seen immediately
  loopFilter.markSeen(msg.msgID);

  // 3. Visual feedback: Quick double-blink indicating active repeater operation
  digitalWrite(DRONE_LED_PIN, LOW);
  delay(30);
  digitalWrite(DRONE_LED_PIN, HIGH);
  delay(30);
  digitalWrite(DRONE_LED_PIN, LOW);
  delay(30);
  digitalWrite(DRONE_LED_PIN, HIGH);

  // 4. Increment hop counter and rebroadcast
  msg.relayCount++;
  
  // Re-transmit over air
  radio.transmit(msg);

  // If connected to test bench UART, mirror for diagnostics
  serialBridge.emit(msg);
}

void updateDroneRelay() {
  // Broadcast periodic heartbeat every HEARTBEAT_INTERVAL
  unsigned long now = millis();
  pollDroneAlertButtons(now);
  if (now - lastHeartbeatTime >= HEARTBEAT_INTERVAL) {
    lastHeartbeatTime = now;

    SkyMessage hb;
    strlcpy(hb.from, "DRONE", sizeof(hb.from));
    strlcpy(hb.to, "BROADCAST", sizeof(hb.to));
    hb.msgID = 0; // Heartbeat identifier
    strlcpy(hb.payload, "PING", sizeof(hb.payload));
    strlcpy(hb.priority, "ROUTINE", sizeof(hb.priority));
    hb.relayCount = 0;
    strlcpy(hb.type, "HEARTBEAT", sizeof(hb.type));
    hb.rssi = 0;

    radio.transmit(hb);
  }
}
