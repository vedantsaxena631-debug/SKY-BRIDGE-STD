#include <Arduino.h>
#include "config.h"
#include "loraLink.h"
#include "serialBridge.h"
#include "loopPrevention.h"
#include "roleGroundNode.h"
#include "roleDrone.h"

void setup() {
  // 1. Initialize USB Serial Bridge at 115200 baud
  serialBridge.begin(SERIAL_BAUD);

  // 2. Initialize SX1278 SPI LoRa Transceiver
  if (!radio.begin()) {
    // Hardware failure alert
    serialBridge.emitRawEvent("RADIO_INIT_FAILED", "Failed to initialize SX1278 on SPI bus. Check NSS/RST/DIO0 wiring.");

#if THIS_NODE_ROLE == NODE_ROLE_DRONE
    // Rapid strobe on Drone LED indicates radio fault
    pinMode(DRONE_LED_PIN, OUTPUT);
    while (true) {
      digitalWrite(DRONE_LED_PIN, !digitalRead(DRONE_LED_PIN));
      delay(100);
    }
#else
    while (true) {
      delay(1000);
    }
#endif
  }

  // 3. Initialize Role-Specific Hardware
#if THIS_NODE_ROLE == NODE_ROLE_DRONE
  initDroneRelay();
  serialBridge.emitRawEvent("NODE_ONLINE", "Drone Airborne Repeater initialized successfully.");
#else
  initGroundNode();
  serialBridge.emitRawEvent("NODE_ONLINE", "Ground Base Station initialized successfully.");
#endif
}

void loop() {
  // --- Check Incoming Over-the-Air LoRa Packets ---
  SkyMessage incomingMsg;
  if (radio.receive(incomingMsg)) {
#if THIS_NODE_ROLE == NODE_ROLE_DRONE
    handleDroneRelayIncoming(incomingMsg);
#else
    handleGroundNodeIncoming(incomingMsg);
#endif
  }

  // --- Check Incoming Host Commands from Web Dashboard (USB UART) ---
#if THIS_NODE_ROLE != NODE_ROLE_DRONE
  SkyMessage hostCmd;
  if (serialBridge.checkIncoming(hostCmd)) {
    // Send host-originated message over the air
    triggerGroundNodeSend(hostCmd.payload, hostCmd.priority);
  }
#endif

  // --- Role Background Timers & Polling ---
#if THIS_NODE_ROLE == NODE_ROLE_DRONE
  updateDroneRelay();
#else
  updateGroundNode();
#endif
}
