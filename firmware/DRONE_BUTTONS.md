# Drone alert node buttons

Build the airborne alert node with `pio run -e drone_relay -t upload --upload-port <COM port>`.
The four inputs are active-low: connect each momentary push button between its GPIO and GND.
The ESP32 internal pull-ups are enabled by firmware.

| Button | Default GPIO | LoRa message | Priority |
| --- | ---: | --- | --- |
| 1 | 32 | `VICTIM DETECTED` | Critical |
| 2 | 33 | `MEDICAL ASSISTANCE REQUIRED` | Urgent |
| 3 | 25 | `EXTRACTION REQUIRED` | Urgent |
| 4 | 27 | `AREA SECURE` | Routine |

Each debounced press broadcasts one LoRa packet from `DRONE`, mirrors the packet to USB
for the laptop gateway, and flashes the drone status LED. A LoRa-ready handshake is
required before the gateway reports the drone online.
