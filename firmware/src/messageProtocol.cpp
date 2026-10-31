#include "messageProtocol.h"

bool serializeMessage(const SkyMessage& msg, String& outputJson, bool includeRssi) {
  StaticJsonDocument<384> doc;
  doc["from"] = msg.from;
  doc["to"] = msg.to;
  doc["msgID"] = msg.msgID;
  doc["payload"] = msg.payload;
  doc["priority"] = msg.priority;
  doc["relayCount"] = msg.relayCount;
  doc["type"] = msg.type;

  // Only emit real RSSI if explicitly measured upon physical packet reception
  if (includeRssi && msg.rssi != 0) {
    doc["rssi"] = msg.rssi;
  }

  outputJson = "";
  serializeJson(doc, outputJson);
  return true;
}

bool deserializeMessage(const String& inputJson, SkyMessage& msg) {
  StaticJsonDocument<384> doc;
  DeserializationError err = deserializeJson(doc, inputJson);
  if (err) {
    return false;
  }

  strlcpy(msg.from, doc["from"] | "UNKNOWN", sizeof(msg.from));
  strlcpy(msg.to, doc["to"] | "BROADCAST", sizeof(msg.to));
  msg.msgID = doc["msgID"] | 0;
  strlcpy(msg.payload, doc["payload"] | "", sizeof(msg.payload));
  strlcpy(msg.priority, doc["priority"] | "ROUTINE", sizeof(msg.priority));
  msg.relayCount = doc["relayCount"] | 0;
  strlcpy(msg.type, doc["type"] | "MSG", sizeof(msg.type));
  msg.rssi = doc["rssi"] | 0;

  return true;
}
