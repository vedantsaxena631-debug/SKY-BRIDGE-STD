#include "loraLink.h"

LoraLink radio;

LoraLink::LoraLink() : initialized(false) {}

bool LoraLink::begin() {
  // Set explicit SPI pins for ESP32
  SPI.begin(LORA_SCK_PIN, LORA_MISO_PIN, LORA_MOSI_PIN, LORA_SS_PIN);
  LoRa.setPins(LORA_SS_PIN, LORA_RST_PIN, LORA_DIO0_PIN);

  if (!LoRa.begin(LORA_FREQUENCY)) {
    initialized = false;
    return false;
  }

  // Set calibrated radio parameters
  LoRa.setSyncWord(LORA_SYNC_WORD);
  LoRa.setSpreadingFactor(LORA_SF);
  LoRa.setSignalBandwidth(LORA_BANDWIDTH);
  LoRa.setCodingRate4(LORA_CODING_RATE);
  LoRa.setTxPower(LORA_TX_POWER);
  LoRa.enableCrc();

  initialized = true;
  return true;
}

bool LoraLink::transmit(const SkyMessage& msg) {
  if (!initialized) return false;

  String jsonLine;
  serializeMessage(msg, jsonLine, false);

  LoRa.beginPacket();
  LoRa.print(jsonLine);
  int result = LoRa.endPacket();
  return (result == 1);
}

bool LoraLink::receive(SkyMessage& outMsg) {
  if (!initialized) return false;

  int packetSize = LoRa.parsePacket();
  if (packetSize == 0) {
    return false;
  }

  String incoming = "";
  while (LoRa.available()) {
    incoming += (char)LoRa.read();
  }

  bool ok = deserializeMessage(incoming, outMsg);
  if (ok) {
    // Read honest physical hardware RSSI from SX1278 register
    outMsg.rssi = LoRa.packetRssi();
    return true;
  }

  return false;
}
