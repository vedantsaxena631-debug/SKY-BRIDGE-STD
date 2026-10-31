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

// Last status message for OLED
static String lastStatusText = "STANDBY / READY";
static String lastMessagePayload = "None";
static String lastMessageSender = "-";

// Forward declarations
static void refreshOled();
static void soundBuzzer(const char* priority);
static float readBatteryVoltage();

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
  static uint32_t localMsgCounter = (THIS_NODE_ROLE == NODE_ROLE_A) ? 100 : 500;
  localMsgCounter++;

  SkyMessage outgoing;
  strlcpy(outgoing.from, NODE_CALLSIGN, sizeof(outgoing.from));
  strlcpy(outgoing.to, (THIS_NODE_ROLE == NODE_ROLE_A) ? "TEAM_B" : "TEAM_A", sizeof(outgoing.to));
  outgoing.msgID = localMsgCounter;
  strlcpy(outgoing.payload, payload, sizeof(outgoing.payload));
  strlcpy(outgoing.priority, priority, sizeof(outgoing.priority));
  outgoing.relayCount = 0;
  strlcpy(outgoing.type, "MSG", sizeof(outgoing.type));
  outgoing.rssi = 0;

  // Mark in local loop prevention so we don't process our own echo
  loopFilter.markSeen(outgoing.msgID);

  // Transmit over radio
  lastStatusText = "TRANSMITTING...";
  refreshOled();

  bool success = radio.transmit(outgoing);
  if (success) {
    waitingForAck = true;
    awaitingAckMsgID = outgoing.msgID;
    ackSentTime = millis();
    lastStatusText = "SENT - AWAIT ACK";

    // Also mirror to USB serial if tethered to PC
    serialBridge.emit(outgoing);
  } else {
    lastStatusText = "TX FAILED (RADIO)";
  }
  refreshOled();
}

void handleGroundNodeIncoming(const SkyMessage& msg) {
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
  if (strcmp(msg.type, "MSG") == 0 &&
      (strcmp(msg.to, NODE_CALLSIGN) == 0 || strcmp(msg.to, "BROADCAST") == 0)) {
    
    lastMessageSender = msg.from;
    lastMessagePayload = msg.payload;
    lastStatusText = "MSG RECEIVED!";
    refreshOled();

    // Audible alert based on priority
    soundBuzzer(msg.priority);

    // Immediately transmit return ACK
    SkyMessage ackPkt;
    strlcpy(ackPkt.from, NODE_CALLSIGN, sizeof(ackPkt.from));
    strlcpy(ackPkt.to, msg.from, sizeof(ackPkt.to));
    ackPkt.msgID = msg.msgID; // Reuse same msgID so sender knows what is acked
    strlcpy(ackPkt.payload, "ACK", sizeof(ackPkt.payload));
    strlcpy(ackPkt.priority, "ROUTINE", sizeof(ackPkt.priority));
    ackPkt.relayCount = 0;
    strlcpy(ackPkt.type, "ACK", sizeof(ackPkt.type));
    ackPkt.rssi = 0;

    delay(100); // Tiny pause before returning ACK
    radio.transmit(ackPkt);
    serialBridge.emit(ackPkt);
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
