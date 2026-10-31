#ifndef LORA_LINK_H
#define LORA_LINK_H

#include <Arduino.h>
#include <SPI.h>
#include <LoRa.h>
#include "config.h"
#include "messageProtocol.h"

class LoraLink {
public:
  LoraLink();
  bool begin();
  bool transmit(const SkyMessage& msg);
  bool receive(SkyMessage& outMsg);

  bool isInitialized() const { return initialized; }

private:
  bool initialized;
};

extern LoraLink radio;

#endif // LORA_LINK_H
