import { Message, MessagePriority, NodeId, SystemEvent } from '../types';

interface SimulatorCallbacks {
  onMessageUpdate: (msg: Message) => void;
  onEvent: (event: SystemEvent) => void;
  onAckReceived?: (msg: Message) => void;
}

export class DemoSimulator {
  private recentMsgIds = new Set<number>();
  private nextMsgId = 200;

  /**
   * Generates a unique msgID
   */
  getNextMsgId(): number {
    this.nextMsgId += 1;
    return this.nextMsgId;
  }

  /**
   * Check if packet is duplicate (loop prevention)
   */
  checkLoopDuplicate(msgId: number): boolean {
    if (this.recentMsgIds.has(msgId)) {
      return true; // Duplicate detected - drop
    }
    this.recentMsgIds.add(msgId);
    // Keep set bounded to last 50 IDs
    if (this.recentMsgIds.size > 50) {
      const first = Array.from(this.recentMsgIds)[0];
      this.recentMsgIds.delete(first);
    }
    return false;
  }

  /**
   * Simulate full LoRa hop transmission:
   * Node A/B -> Drone Relay -> Node B/A -> Return ACK
   */
  simulateHopTransmission(
    initialMessage: Message,
    callbacks: SimulatorCallbacks
  ) {
    const isDuplicate = this.checkLoopDuplicate(initialMessage.msgID);
    if (isDuplicate) {
      callbacks.onEvent({
        id: `evt_loop_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        type: 'WARNING',
        message: `LOOP PREVENTION: Repeated msgID ${initialMessage.msgID} received at Drone Relay. Dropped packet to prevent transmission loop.`,
        isDemo: true,
      });
      return;
    }

    // Step 1: Queued & Sent to Serial Bridge
    callbacks.onEvent({
      id: `evt_bridge_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      type: 'INFO',
      message: `[SERIAL-BRIDGE] Handshake initialized. Packet ${initialMessage.msgID} buffered for LoRa broadcast.`,
      sourceNode: initialMessage.from,
      isDemo: true,
    });

    const step1Msg: Message = {
      ...initialMessage,
      status: 'SENT_TO_BRIDGE',
      hops: [
        {
          node: initialMessage.from,
          action: 'Transmitted via ESP32 + SX1278 (433MHz)',
          timestamp: new Date().toLocaleTimeString(),
        },
      ],
    };
    callbacks.onMessageUpdate(step1Msg);

    // Step 2: Relayed by Drone (after 1.2s)
    setTimeout(() => {
      callbacks.onEvent({
        id: `evt_relay_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        type: 'RELAY',
        message: `DRONE RELAY: Airborne SX1278 intercepted packet ${initialMessage.msgID} from ${initialMessage.from}. Rebroadcasting to ${initialMessage.to}.`,
        sourceNode: 'DRONE_RELAY',
        isDemo: true,
      });

      const step2Msg: Message = {
        ...step1Msg,
        status: 'RELAYED',
        relayCount: 1,
        hops: [
          ...(step1Msg.hops || []),
          {
            node: 'DRONE_RELAY',
            action: 'Airborne Store-and-Forward Repeat',
            timestamp: new Date().toLocaleTimeString(),
          },
        ],
      };
      callbacks.onMessageUpdate(step2Msg);

      // Step 3: Delivered to Destination Ground Node (after 1.1s)
      setTimeout(() => {
        callbacks.onEvent({
          id: `evt_deliv_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          type: 'INFO',
          message: `${initialMessage.to} received payload: "${initialMessage.payload}". OLED updated & buzzer pulsed.`,
          sourceNode: initialMessage.to,
          isDemo: true,
        });

        const step3Msg: Message = {
          ...step2Msg,
          status: 'DELIVERED',
          hops: [
            ...(step2Msg.hops || []),
            {
              node: initialMessage.to,
              action: 'Ground Node Received & Verified',
              timestamp: new Date().toLocaleTimeString(),
            },
          ],
        };
        callbacks.onMessageUpdate(step3Msg);

        // Step 4: Acknowledgment returned through Drone back to sender (after 1.0s)
        setTimeout(() => {
          const nowStr = new Date().toLocaleTimeString();
          callbacks.onEvent({
            id: `evt_ack_${Date.now()}`,
            timestamp: nowStr,
            type: 'ACK',
            message: `ACK-RECEIVE: Verification ACK for msgID ${initialMessage.msgID} confirmed by ${initialMessage.from} through Drone Relay.`,
            sourceNode: initialMessage.to,
            isDemo: true,
          });

          const step4Msg: Message = {
            ...step3Msg,
            status: 'ACKNOWLEDGED',
            ackReceivedAt: nowStr,
            hops: [
              ...(step3Msg.hops || []),
              {
                node: initialMessage.to,
                action: `ACK Return Packet Verified at ${initialMessage.from}`,
                timestamp: nowStr,
              },
            ],
          };
          callbacks.onMessageUpdate(step4Msg);
          if (callbacks.onAckReceived) {
            callbacks.onAckReceived(step4Msg);
          }
        }, 1000);
      }, 1100);
    }, 1200);
  }
}

export const demoSimulator = new DemoSimulator();
