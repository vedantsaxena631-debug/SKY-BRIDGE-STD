#include "serialBridge.h"

SerialBridge serialBridge;

SerialBridge::SerialBridge() {
  rxBuffer.reserve(256);
}

void SerialBridge::begin(unsigned long baud) {
  Serial.begin(baud);
}

void SerialBridge::emit(const SkyMessage& msg) {
  String json;
  serializeMessage(msg, json, true);
  Serial.println(json);
}

void SerialBridge::emitRawEvent(const char* eventType, const char* details) {
  StaticJsonDocument<256> doc;
  doc["type"] = "SYSTEM_EVENT";
  doc["event"] = eventType;
  doc["details"] = details;
  doc["timestamp"] = millis();

  String out;
  serializeJson(doc, out);
  Serial.println(out);
}

bool SerialBridge::checkIncoming(SkyMessage& outMsg) {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (rxBuffer.length() > 0) {
        bool ok = deserializeMessage(rxBuffer, outMsg);
        rxBuffer = "";
        if (ok) {
          return true;
        }
      }
    } else {
      if (rxBuffer.length() < 250) {
        rxBuffer += c;
      }
    }
  }
  return false;
}
