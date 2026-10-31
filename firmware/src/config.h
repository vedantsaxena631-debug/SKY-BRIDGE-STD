#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// -------------------------------------------------------------
// Node Roles
// -------------------------------------------------------------
#define NODE_ROLE_A       0
#define NODE_ROLE_B       1
#define NODE_ROLE_DRONE   2

#ifndef THIS_NODE_ROLE
#define THIS_NODE_ROLE    NODE_ROLE_A
#endif

#ifndef NODE_CALLSIGN
#if THIS_NODE_ROLE == NODE_ROLE_A
#define NODE_CALLSIGN "TEAM_A"
#elif THIS_NODE_ROLE == NODE_ROLE_B
#define NODE_CALLSIGN "TEAM_B"
#else
#define NODE_CALLSIGN "DRONE"
#endif
#endif

#ifndef SERIAL_BAUD
#define SERIAL_BAUD 115200
#endif

// -------------------------------------------------------------
// SX1278 LoRa Radio Pins (Shared SPI Bus)
// -------------------------------------------------------------
#define LORA_SCK_PIN      18
#define LORA_MISO_PIN     19
#define LORA_MOSI_PIN     23
#define LORA_SS_PIN       5
#define LORA_RST_PIN      14
#define LORA_DIO0_PIN     2

// -------------------------------------------------------------
// Ground Node Peripherals (Team A & Team B)
// -------------------------------------------------------------
#define OLED_SDA_PIN      21
#define OLED_SCL_PIN      22
#define OLED_RESET        -1
#define SCREEN_WIDTH      128
#define SCREEN_HEIGHT     64
#define OLED_I2C_ADDR     0x3C

#define BTN_CYCLE_PIN     32   // Active-low with INPUT_PULLUP
#define BTN_SEND_PIN      33   // Active-low with INPUT_PULLUP
#define BUZZER_PIN        26   // Active piezo buzzer (active-HIGH)
#define BATTERY_ADC_PIN   34   // ADC1 input for voltage divider

// -------------------------------------------------------------
// Drone Relay Peripherals
// -------------------------------------------------------------
#define DRONE_LED_PIN     26   // Status indicator LED

// -------------------------------------------------------------
// LoRa RF Parameters
// -------------------------------------------------------------
#define LORA_FREQUENCY    433.0E6   // 433 MHz ISM Band
#define LORA_SYNC_WORD    0x3C      // Network sync word to isolate team traffic
#define LORA_SF           7         // Spreading Factor 7
#define LORA_BANDWIDTH    125.0E3   // 125 kHz Bandwidth
#define LORA_CODING_RATE  5         // 4/5 Coding Rate
#define LORA_TX_POWER     17        // +17 dBm Output Power

// -------------------------------------------------------------
// Protocol Timers
// -------------------------------------------------------------
#define ACK_TIMEOUT_MS      4500    // Wait 4.5s for ACK before marking unacknowledged
#define HEARTBEAT_INTERVAL  7000    // Transmit heartbeat every 7s
#define RECENT_ID_CAPACITY  25      // Ring buffer capacity for loop suppression

#endif // CONFIG_H
