#ifndef SERIAL_BRIDGE_H
#define SERIAL_BRIDGE_H

#include <Arduino.h>
#include "messageProtocol.h"

class SerialBridge {
public:
  SerialBridge();
  void begin(unsigned long baud);
  void emit(const SkyMessage& msg);
  void emitRawEvent(const char* eventType, const char* details);
  bool checkIncoming(SkyMessage& outMsg);

private:
  String rxBuffer;
};

extern SerialBridge serialBridge;

#endif // SERIAL_BRIDGE_H
