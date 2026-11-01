#include "roleGroundNode.h"
#include "config.h"
#include "loraLink.h"
#include "serialBridge.h"
#include "loopPrevention.h"
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Bounce2.h>

static Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
static Bounce debouncerCycle = Bounce();
static Bounce debouncerSend = Bounce();

// Standard emergency presets mirroring web dashboard
static const char* PRESETS[] = {
  "VICTIM FOUND",
  "SEND LOCATION",
  "HELP REQUIRED",
  "AREA CLEAR",
  "MESSAGE RECEIVED"
};
static const uint8_t PRESET_COUNT = 5;
static uint8_t currentPresetIdx = 0;

// Outgoing ACK state tracking
static uint32_t awaitingAckMsgID = 0;
static unsigned long ackSentTime = 0;
static bool waitingForAck = false;
static uint32_t localMsgCounter = (THIS_NODE_ROLE == NODE_ROLE_A) ? 0x10000000UL : 0x20000000UL;
static const uint8_t RECEIVED_MSG_CACHE_CAPACITY = 25;
struct ReceivedMessageKey {
  uint32_t msgID;
  char from[16];
};
static ReceivedMessageKey recentIncomingMessages[RECEIVED_MSG_CACHE_CAPACITY] = {};
static uint8_t recentIncomingCount = 0;
static uint8_t recentIncomingIndex = 0;

// Last status message for OLED
static String lastStatusText = "STANDBY / READY";
static String lastMessagePayload = "None";
static String lastMessageSender = "-";

// Forward declarations
static void refreshOled();
static void soundBuzzer(const char* priority);
static float readBatteryVoltage();
static bool transmitGroundNodeMessage(const SkyMessage& outgoing, bool echoToUsb);
static void emitHostCommandStatus(uint32_t msgID, const char* status);
static bool alreadyReceivedMessage(const SkyMessage& msg);
static void rememberReceivedMessage(const SkyMessage& msg);
static void transmitIncomingAck(const SkyMessage& msg);

void initGroundNode() {
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // Initialize Debouncers
  debouncerCycle.attach(BTN_CYCLE_PIN, INPUT_PULLUP);
  debouncerCycle.interval(25);
  debouncerSend.attach(BTN_SEND_PIN, INPUT_PULLUP);
  debouncerSend.interval(25);

  // Initialize OLED
  Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN);
  if (display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR)) {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println("SKYBRIDGE LORA");
    display.println(NODE_CALLSIGN);
    display.println("Initializing...");
    display.display();
  }

  // Startup chirp
  digitalWrite(BUZZER_PIN, HIGH);
  delay(60);
  digitalWrite(BUZZER_PIN, LOW);

  refreshOled();
}

void triggerGroundNodeSend(const char* payload, const char* priority) {
  if (waitingForAck) {
    lastStatusText = "BUSY - WAIT ACK";
    refreshOled();
    return;
  }

  SkyMessage outgoing;
  strlcpy(outgoing.from, NODE_CALLSIGN, sizeof(outgoing.from));
  strlcpy(outgoing.to, (THIS_NODE_ROLE == NODE_ROLE_A) ? "TEAM_B" : "TEAM_A", sizeof(outgoing.to));
  outgoing.msgID = ++localMsgCounter;
  strlcpy(outgoing.payload, payload, sizeof(outgoing.payload));
  strlcpy(outgoing.priority, priority, sizeof(outgoing.priority));
  outgoing.relayCount = 0;
  strlcpy(outgoing.type, "MSG", sizeof(outgoing.type));
  outgoing.rssi = 0;

  transmitGroundNodeMessage(outgoing, true);
}

void triggerGroundNodeSend(const SkyMessage& hostCommand) {
  const char* expectedTo = (THIS_NODE_ROLE == NODE_ROLE_A) ? "TEAM_B" : "TEAM_A";
  const bool supportedType = strcmp(hostCommand.type, "MSG") == 0 || strcmp(hostCommand.type, "PING") == 0;

  if (waitingForAck) {
    emitHostCommandStatus(hostCommand.msgID, "HOST_CMD_BUSY");
    lastStatusText = "BUSY - WAIT ACK";
    refreshOled();
    return;
  }

  if (!supportedType || hostCommand.msgID == 0 || hostCommand.payload[0] == '\0' ||
      strcmp(hostCommand.from, NODE_CALLSIGN) != 0 || strcmp(hostCommand.to, expectedTo) != 0) {
    emitHostCommandStatus(hostCommand.msgID, "HOST_CMD_REJECTED");
    return;
  }

  SkyMessage outgoing = hostCommand;
  strlcpy(outgoing.type, "MSG", sizeof(outgoing.type));
  outgoing.relayCount = 0;
  outgoing.rssi = 0;

  if (strcmp(outgoing.priority, "CRITICAL") == 0 || strcmp(outgoing.priority, "EMERGENCY") == 0) {
    strlcpy(outgoing.priority, "CRITICAL", sizeof(outgoing.priority));
  } else if (strcmp(outgoing.priority, "URGENT") == 0) {
    strlcpy(outgoing.priority, "URGENT", sizeof(outgoing.priority));
  } else {
    strlcpy(outgoing.priority, "ROUTINE", sizeof(outgoing.priority));
  }

  if (!transmitGroundNodeMessage(outgoing, false)) {
    emitHostCommandStatus(hostCommand.msgID, "RADIO_TX_FAILED");
  }
}

static bool transmitGroundNodeMessage(const SkyMessage& outgoing, bool echoToUsb) {
  // Suppress an immediate radio echo of this packet.
  loopFilter.markSeen(outgoing.msgID);

  lastStatusText = "TRANSMITTING...";
  refreshOled();

  bool success = radio.transmit(outgoing);
  if (success) {
    waitingForAck = true;
    awaitingAckMsgID = outgoing.msgID;
    ackSentTime = millis();
    lastStatusText = "SENT - AWAIT ACK";

    // Button-originated messages need to be recorded by the connected gateway.
    // Web-originated messages already exist in the cloud and must not be duplicated.
    if (echoToUsb) serialBridge.emit(outgoing);
  } else {
    lastStatusText = "TX FAILED (RADIO)";
  }
  refreshOled();
  return success;
}

static void emitHostCommandStatus(uint32_t msgID, const char* status) {
  SkyMessage result;
  strlcpy(result.from, NODE_CALLSIGN, sizeof(result.from));
  strlcpy(result.to, "HOST", sizeof(result.to));
  result.msgID = msgID;
  strlcpy(result.payload, status, sizeof(result.payload));
  strlcpy(result.priority, "URGENT", sizeof(result.priority));
  result.relayCount = 0;
  strlcpy(result.type, "STATUS", sizeof(result.type));
  result.rssi = 0;
  serialBridge.emit(result);
}

static bool alreadyReceivedMessage(const SkyMessage& msg) {
  if (msg.msgID == 0) return false;
  for (uint8_t i = 0; i < recentIncomingCount; i++) {
    if (recentIncomingMessages[i].msgID == msg.msgID &&
        strcmp(recentIncomingMessages[i].from, msg.from) == 0) {
      return true;
    }
  }
  return false;
}

static void rememberReceivedMessage(const SkyMessage& msg) {
  if (msg.msgID == 0) return;
  ReceivedMessageKey& entry = recentIncomingMessages[recentIncomingIndex];
  entry.msgID = msg.msgID;
  strlcpy(entry.from, msg.from, sizeof(entry.from));
  recentIncomingIndex = (recentIncomingIndex + 1) % RECEIVED_MSG_CACHE_CAPACITY;
  if (recentIncomingCount < RECEIVED_MSG_CACHE_CAPACITY) recentIncomingCount++;
}

static void transmitIncomingAck(const SkyMessage& msg) {
  SkyMessage ackPkt;
  strlcpy(ackPkt.from, NODE_CALLSIGN, sizeof(ackPkt.from));
  strlcpy(ackPkt.to, msg.from, sizeof(ackPkt.to));
  ackPkt.msgID = msg.msgID;
  strlcpy(ackPkt.payload, "ACK", sizeof(ackPkt.payload));
  strlcpy(ackPkt.priority, "ROUTINE", sizeof(ackPkt.priority));
  ackPkt.relayCount = 0;
  strlcpy(ackPkt.type, "ACK", sizeof(ackPkt.type));
  ackPkt.rssi = 0;

  delay(100);
  if (radio.transmit(ackPkt)) {
    serialBridge.emit(ackPkt);
  } else {
    emitHostCommandStatus(msg.msgID, "RADIO_ACK_TX_FAILED");
  }
}

void handleGroundNodeIncoming(const SkyMessage& msg) {
  const bool addressedMessage = strcmp(msg.type, "MSG") == 0 &&
      (strcmp(msg.to, NODE_CALLSIGN) == 0 || strcmp(msg.to, "BROADCAST") == 0);

  // A sender may retry if its ACK was lost. Re-ACK duplicates without displaying
  // the message twice or producing duplicate cloud receive events.
  if (addressedMessage && alreadyReceivedMessage(msg)) {
    transmitIncomingAck(msg);
    return;
  }
  if (addressedMessage) rememberReceivedMessage(msg);

  // Always emit to serial so the connected laptop overhears/records it
  serialBridge.emit(msg);

  // If this packet is an ACK confirming our pending message
  if (strcmp(msg.type, "ACK") == 0) {
    if (waitingForAck && msg.msgID == awaitingAckMsgID) {
      waitingForAck = false;
      lastStatusText = "DELIVERED (ACK OK)";
      refreshOled();

      // Confirmation beep
      digitalWrite(BUZZER_PIN, HIGH);
      delay(80);
      digitalWrite(BUZZER_PIN, LOW);
      delay(60);
      digitalWrite(BUZZER_PIN, HIGH);
      delay(80);
      digitalWrite(BUZZER_PIN, LOW);
    }
    return;
  }

  // If this packet is an incoming message addressed to us (or BROADCAST)
  if (addressedMessage) {
    
    lastMessageSender = msg.from;
    lastMessagePayload = msg.payload;
    lastStatusText = "MSG RECEIVED!";
    refreshOled();

    // Audible alert based on priority
    soundBuzzer(msg.priority);

    // Immediately transmit return ACK. Only report delivery to USB when LoRa
    // accepted the ACK packet; retries will make the receiver replay it if needed.
    transmitIncomingAck(msg);
  }
}

void updateGroundNode() {
  debouncerCycle.update();
  debouncerSend.update();

  // Button 1: Cycle through preset messages
  if (debouncerCycle.fell()) {
    currentPresetIdx = (currentPresetIdx + 1) % PRESET_COUNT;
    lastStatusText = "SELECTING MSG...";
    refreshOled();
  }

  // Button 2: Send current preset
  if (debouncerSend.fell()) {
    const char* selectedPayload = PRESETS[currentPresetIdx];
    const char* pLevel = (strcmp(selectedPayload, "VICTIM FOUND") == 0 ||
                          strcmp(selectedPayload, "HELP REQUIRED") == 0)
                         ? "CRITICAL" : "ROUTINE";
    triggerGroundNodeSend(selectedPayload, pLevel);
  }

  // Check ACK timeout
  if (waitingForAck && (millis() - ackSentTime > ACK_TIMEOUT_MS)) {
    waitingForAck = false;
    lastStatusText = "FAIL: NO ACK RCVD";
    refreshOled();

    // Alert timeout over serial so dashboard flags it
    SkyMessage timeoutStatus;
    strlcpy(timeoutStatus.from, NODE_CALLSIGN, sizeof(timeoutStatus.from));
    strlcpy(timeoutStatus.to, "HOST", sizeof(timeoutStatus.to));
    timeoutStatus.msgID = awaitingAckMsgID;
    strlcpy(timeoutStatus.payload, "FAILED_NO_ACK", sizeof(timeoutStatus.payload));
    strlcpy(timeoutStatus.priority, "URGENT", sizeof(timeoutStatus.priority));
    timeoutStatus.relayCount = 0;
    strlcpy(timeoutStatus.type, "STATUS", sizeof(timeoutStatus.type));
    timeoutStatus.rssi = 0;
    serialBridge.emit(timeoutStatus);
  }
}

static void refreshOled() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  // Top header: Callsign and battery
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print(NODE_CALLSIGN);
  display.print(" | ");
  float vBat = readBatteryVoltage();
  if (vBat > 1.5f) {
    display.print(vBat, 1);
    display.print("V");
  } else {
    display.print("USB");
  }

  display.drawLine(0, 10, 127, 10, SSD1306_WHITE);

  // Status banner
  display.setCursor(0, 14);
  display.print("STATUS: ");
  display.println(lastStatusText);

  // Preset composer preview
  display.setCursor(0, 27);
  display.print("SELECT: ");
  display.println(PRESETS[currentPresetIdx]);

  // Last received payload preview
  display.drawLine(0, 42, 127, 42, SSD1306_WHITE);
  display.setCursor(0, 46);
  display.print("RX: ");
  display.print(lastMessageSender);
  display.print(" > ");
  display.println(lastMessagePayload.substring(0, 14));

  display.display();
}

static void soundBuzzer(const char* priority) {
  if (strcmp(priority, "CRITICAL") == 0) {
    // Critical alert: short-short-long
    for (int i = 0; i < 2; i++) {
      digitalWrite(BUZZER_PIN, HIGH);
      delay(80);
      digitalWrite(BUZZER_PIN, LOW);
      delay(60);
    }
    digitalWrite(BUZZER_PIN, HIGH);
    delay(280);
    digitalWrite(BUZZER_PIN, LOW);
  } else {
    // Routine beep
    digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(BUZZER_PIN, LOW);
  }
}

static float readBatteryVoltage() {
  // ADC1 read pin 34. Resistor divider 100k/100k -> factor ~ 2.0 * (3.3 / 4095)
  int raw = analogRead(BATTERY_ADC_PIN);
  if (raw < 100) return 0.0f; // Not connected
  float vPin = (raw / 4095.0f) * 3.3f;
  return vPin * 2.0f;
}
