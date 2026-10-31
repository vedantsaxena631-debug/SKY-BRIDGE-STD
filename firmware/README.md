# SkyBridge ESP32 + SX1278 LoRa Relay Firmware (v1.0)

Production-grade C++ Arduino/PlatformIO firmware for the three physical nodes of the SkyBridge emergency communication network:
1. **Team A (Ground Base Station - Serial Gateway)**
2. **Team B (Ground Search Unit)**
3. **Drone Relay (Airborne Store-and-Forward Repeater)**

---

## 1. Quick Start / How to Flash via PlatformIO

To flash any of the three boards, connect the ESP32 via USB and run the corresponding environment:

```bash
# Flash Team A (Ground Base Station)
pio run -e team_a -t upload

# Flash Team B (Ground Field Station)
pio run -e team_b -t upload

# Flash Drone Relay (Airborne Repeater)
pio run -e drone_relay -t upload
```

---

## 2. Wiring Reference & Pin Maps

### Shared LoRa SX1278 (Ra-02) SPI Bus (All 3 Boards)
- **SCK:** GPIO 18
- **MISO:** GPIO 19
- **MOSI:** GPIO 23
- **NSS (CS):** GPIO 5
- **RST:** GPIO 14
- **DIO0 (IRQ):** GPIO 2
- **3.3V & GND:** Direct 3.3V rail (Do NOT connect SX1278 to 5V!)

### Ground Nodes (Team A / Team B)
- **OLED I2C:** SDA → GPIO 21, SCL → GPIO 22, VCC → 3.3V
- **Button 1 (Cycle Predefined Messages):** GPIO 32 to GND (internal pull-up enabled)
- **Button 2 (Confirm / Transmit Message):** GPIO 33 to GND (internal pull-up enabled)
- **Active Buzzer:** GPIO 26 (Signal) and GND
- **Battery Sense:** GPIO 34 through 100kΩ/100kΩ voltage divider from TP4056 output

### Drone Relay
- **Status LED:** GPIO 26 with 330Ω resistor to GND
- **Power:** 5V 3A UBEC buck converter stepped down from drone 3S LiPo battery, feeding ESP32 5V/VIN pin.
- **Flight Controller:** ZERO electrical or software connection. Flight is manually piloted via FlySky FS-i6X 2.4GHz RC system.

---

## 3. Wire Protocol & Loop Prevention

All packets over LoRa and USB Serial follow the newline-delimited JSON schema:
```json
{"from":"TEAM_A","to":"TEAM_B","msgID":105,"payload":"VICTIM FOUND","priority":"CRITICAL","relayCount":0,"type":"MSG"}
```

- **Loop Prevention:** Every node maintains a 25-entry ring buffer of recent `msgID`s. When an airborne packet is picked up, it is immediately discarded if `alreadySeen(msgID)` is true, preventing endless RF echo loops.
- **ACK Reliability:** When destination receives `MSG`, it immediately returns `ACK` with the same `msgID`. The sender marks `DELIVERED` or flags `NO_ACK_TIMEOUT` after 4.5 seconds.
- **Honest Hardware State:** No GPS, altitude, or speed is fabricated. RSSI is emitted only when measured by the physical transceiver register upon packet arrival.
