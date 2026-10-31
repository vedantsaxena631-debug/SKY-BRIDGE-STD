#ifndef MESSAGE_PROTOCOL_H
#define MESSAGE_PROTOCOL_H

#include <Arduino.h>
#include <ArduinoJson.h>

struct SkyMessage {
  char from[16];
  char to[16];
  uint32_t msgID;
  char payload[180];
  char priority[16];
  uint8_t relayCount;
  char type[16];
  int rssi;           // Measured by SX1278 hardware on receive (0 if transmitting)
};

// Functions
bool serializeMessage(const SkyMessage& msg, String& outputJson, bool includeRssi = false);
bool deserializeMessage(const String& inputJson, SkyMessage& msg);

#endif // MESSAGE_PROTOCOL_H
