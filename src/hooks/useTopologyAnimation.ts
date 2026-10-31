import { useState, useEffect, useRef, useCallback } from 'react';
import { Message, MessagePriority, NodeId } from '../types';
import { colorTokens, motionTokens } from '../styles/tokens';

export type HopPath = 'A_TO_DRONE' | 'DRONE_TO_B' | 'B_TO_DRONE' | 'DRONE_TO_A';

export interface AnimatedPacket {
  id: string;
  msgID: number;
  priority: MessagePriority;
  isDemo: boolean;
  hop: HopPath;
  fromNode: NodeId;
  toNode: NodeId;
  color: string;
  startTime: number;
  durationMs: number;
}

export interface NodeFlashState {
  nodeId: NodeId;
  timestamp: number;
}

export interface EdgeHighlightState {
  edge: 'A_DRONE' | 'DRONE_B';
  highlighted: boolean;
  color: string;
}

export function useTopologyAnimation(
  activeTransmission: Message | null,
  theme: 'dark' | 'light' = 'dark',
  reducedMotion: boolean = false
) {
  const [inFlightPackets, setInFlightPackets] = useState<AnimatedPacket[]>([]);
  const [flashingNode, setFlashingNode] = useState<NodeFlashState | null>(null);
  const [edgeHighlights, setEdgeHighlights] = useState<Record<'A_DRONE' | 'DRONE_B', boolean>>({
    A_DRONE: false,
    DRONE_B: false,
  });

  const lastProcessedTxRef = useRef<string | null>(null);
  const tokens = theme === 'dark' ? colorTokens.dark : colorTokens.light;

  // Resolve color by priority and demo state
  const getPacketColor = useCallback(
    (priority: MessagePriority, isDemo: boolean) => {
      if (isDemo) return tokens.demo;
      switch (priority) {
        case 'CRITICAL':
          return tokens.critical;
        case 'URGENT':
          return tokens.warning;
        case 'ROUTINE':
        default:
          return tokens.info;
      }
    },
    [tokens]
  );

  // Trigger an animated packet along a designated hop
  const triggerHop = useCallback(
    (
      msgID: number,
      from: NodeId,
      to: NodeId,
      priority: MessagePriority,
      isDemo: boolean,
      hopOverride?: HopPath
    ) => {
      let hop: HopPath = 'A_TO_DRONE';
      if (hopOverride) {
        hop = hopOverride;
      } else if (from === 'TEAM_A' && to === 'TEAM_B') {
        hop = 'A_TO_DRONE';
      } else if (from === 'TEAM_B' && to === 'TEAM_A') {
        hop = 'B_TO_DRONE';
      } else if (from === 'DRONE_RELAY' && to === 'TEAM_B') {
        hop = 'DRONE_TO_B';
      } else if (from === 'DRONE_RELAY' && to === 'TEAM_A') {
        hop = 'DRONE_TO_A';
      }

      const packetId = `pkt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const durationMs = motionTokens.duration.packetHop * 1000;

      if (reducedMotion) {
        // Reduced-motion fallback: No traveling marker. Flash receiving node immediately.
        setFlashingNode({ nodeId: to, timestamp: Date.now() });
        const edge = hop.includes('DRONE_TO_B') || hop.includes('B_TO_DRONE') ? 'DRONE_B' : 'A_DRONE';
        setEdgeHighlights((prev) => ({ ...prev, [edge]: true }));
        setTimeout(() => {
          setEdgeHighlights((prev) => ({ ...prev, [edge]: false }));
        }, 200);
        return;
      }

      const newPacket: AnimatedPacket = {
        id: packetId,
        msgID,
        priority,
        isDemo,
        hop,
        fromNode: from,
        toNode: to,
        color: getPacketColor(priority, isDemo),
        startTime: Date.now(),
        durationMs,
      };

      // Add to packet queue (supports multiple simultaneous packets)
      setInFlightPackets((prev) => [...prev, newPacket]);

      // Highlight edge upon arrival (150ms)
      const edge = hop.includes('DRONE_TO_B') || hop.includes('B_TO_DRONE') ? 'DRONE_B' : 'A_DRONE';
      setTimeout(() => {
        setEdgeHighlights((prev) => ({ ...prev, [edge]: true }));
        setFlashingNode({ nodeId: to, timestamp: Date.now() });
        setTimeout(() => {
          setEdgeHighlights((prev) => ({ ...prev, [edge]: false }));
        }, 150);
      }, durationMs);

      // Clean up finished packet from queue
      setTimeout(() => {
        setInFlightPackets((prev) => prev.filter((p) => p.id !== packetId));
      }, durationMs + 200);
    },
    [getPacketColor, reducedMotion]
  );

  // Watch activeTransmission changes to trigger realistic hops
  useEffect(() => {
    if (!activeTransmission) return;

    const txKey = `${activeTransmission.id}_${activeTransmission.status}_${activeTransmission.relayCount}`;
    if (lastProcessedTxRef.current === txKey) return;
    lastProcessedTxRef.current = txKey;

    const { msgID, from, to, priority, isDemo, status } = activeTransmission;

    if (status === 'SENT_TO_BRIDGE' || status === 'QUEUED') {
      // Step 1: Ground Station -> Drone
      triggerHop(msgID, from, 'DRONE_RELAY', priority, isDemo, from === 'TEAM_B' ? 'B_TO_DRONE' : 'A_TO_DRONE');
    } else if (status === 'RELAYED') {
      // Step 2: Drone -> Destination
      triggerHop(msgID, 'DRONE_RELAY', to, priority, isDemo, to === 'TEAM_B' ? 'DRONE_TO_B' : 'DRONE_TO_A');
    } else if (status === 'ACKNOWLEDGED') {
      // Step 3: ACK return trip
      triggerHop(msgID, to, 'DRONE_RELAY', 'ROUTINE', isDemo, to === 'TEAM_B' ? 'B_TO_DRONE' : 'A_TO_DRONE');
    }
  }, [activeTransmission, triggerHop]);

  return {
    inFlightPackets,
    flashingNode,
    edgeHighlights,
    triggerHop,
  };
}
