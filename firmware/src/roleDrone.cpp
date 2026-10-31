#include "roleDrone.h"
#include "config.h"
#include "loraLink.h"
#include "loopPrevention.h"
#include "serialBridge.h"

static unsigned long lastHeartbeatTime = 0;

void initDroneRelay() {
  pinMode(DRONE_LED_PIN, OUTPUT);
  digitalWrite(DRONE_LED_PIN, HIGH); // Solid ON = Idle & Powered
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
