import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { useApp } from '../../context/AppContext';
import {
  ArrowRight,
  Radio,
  Plane,
  Server,
  Zap,
  CheckCircle2,
  ChevronDown,
  Shield,
  Activity,
  Layers,
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface SceneCopy {
  title: string;
  subtitle?: string;
  prompt?: string;
}

const SCENE_DATA: { id: string; label: string; range: [number, number]; copy: SceneCopy }[] = [
  {
    id: 'scene-1',
    label: 'Connected',
    range: [0.0, 0.15],
    copy: {
      title: 'SkyBridge',
      subtitle: 'Drone-relay emergency communication network',
      prompt: 'Scroll to see why it exists',
    },
  },
  {
    id: 'scene-2',
    label: 'The Break',
    range: [0.15, 0.3],
    copy: {
      title: "Communication shouldn't stop when infrastructure does.",
      subtitle: 'Gorge faultline fractures terrestrial microwave repeaters and cell towers.',
    },
  },
  {
    id: 'scene-3',
    label: 'Isolated',
    range: [0.3, 0.45],
    copy: {
      title: 'Two teams. No link between them.',
      subtitle: 'Zero cellular, satellite, or VHF line-of-sight across the valley gorge.',
    },
  },
  {
    id: 'scene-4',
    label: 'Launch',
    range: [0.45, 0.65],
    copy: {
      title: 'A drone carries the link.',
      subtitle: 'Carrying a decoupled ESP32 and SX1278 LoRa transceiver above the ridge.',
    },
  },
  {
    id: 'scene-5',
    label: 'Relay',
    range: [0.65, 0.85],
    copy: {
      title: 'SkyBridge uses a drone-mounted ESP32 and LoRa relay to connect separated ground teams.',
      subtitle: 'Autonomous store-and-forward packet repeaters operate completely off-grid.',
    },
  },
  {
    id: 'scene-6',
    label: 'Monitor',
    range: [0.85, 1.0],
    copy: {
      title: 'Every message through the relay is logged, timestamped and monitored here.',
      subtitle: 'Logical topology transitions directly into live operations console.',
    },
  },
];

export const ScrollCinematic: React.FC = () => {
  const { setActiveTab, theme } = useApp();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [activeSceneIndex, setActiveSceneIndex] = useState<number>(0);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [isReducedMotion, setIsReducedMotion] = useState<boolean>(false);
  const isLight = theme === 'light';

  // Check reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useLayoutEffect(() => {
    if (isReducedMotion || !rootRef.current) return;

    // 1. Lenis Smooth Scrolling
    let lenis: Lenis | null = null;
    let rafCallback: ((time: number) => void) | null = null;

    try {
      lenis = new Lenis({
        duration: 1.1,
        smoothWheel: true,
      });

      lenis.on('scroll', ScrollTrigger.update);
      rafCallback = (time: number) => lenis?.raf(time * 1000);
      gsap.ticker.add(rafCallback);
      gsap.ticker.lagSmoothing(0);
    } catch (e) {
      console.warn('[ScrollCinematic] Lenis initialization skipped:', e);
    }

    // 2. GSAP Timeline with ScrollTrigger Pinning
    const ctx = gsap.context(() => {
      const isMobile = window.innerWidth < 768;
      const pinEnd = isMobile ? '+=320%' : '+=500%';

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top top',
          end: pinEnd,
          scrub: 1, // 1-second inertial glide
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const p = self.progress;
            setScrollProgress(p);

            // Determine active scene
            if (p < 0.15) setActiveSceneIndex(0);
            else if (p < 0.3) setActiveSceneIndex(1);
            else if (p < 0.45) setActiveSceneIndex(2);
            else if (p < 0.65) setActiveSceneIndex(3);
            else if (p < 0.85) setActiveSceneIndex(4);
            else setActiveSceneIndex(5);
          },
        },
      });

      // --- Scene 1 Initial Entrance Beat (progress 0) ---
      gsap.fromTo(
        '#cinematic-viewport',
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }
      );

      // --- Scene 2: The Break (0.15 -> 0.30) ---
      tl.to('#wordmark-group', { opacity: 0, y: -45, duration: 0.14 }, 0.14)
        // Tower connection lines go dark sequentially (~120ms equivalent)
        .to('#link-mast-a', { opacity: 0, duration: 0.05 }, 0.16)
        .to('#link-mast-b', { opacity: 0, duration: 0.05 }, 0.19)
        // Tower light turns amber warning then goes dark
        .to('#mast-beacon', { fill: '#F59E0B', duration: 0.04 }, 0.17)
        .to('#mast-beacon', { fill: '#475569', opacity: 0.3, duration: 0.05 }, 0.22)
        // Ravine fracture splits open
        .to('#fracture-line', { strokeDashoffset: 0, duration: 0.1 }, 0.18)
        .to('#ridge-mid', { scale: 1.05, transformOrigin: '50% 60%', duration: 0.14 }, 0.16)
        .to('#settlement-lights', { opacity: 0.15, duration: 0.12 }, 0.2);

      // --- Scene 3: Isolated (0.30 -> 0.45) ---
      // Differential descent into valley (deepening gorge)
      tl.to('#ridge-far', { yPercent: 8, duration: 0.15 }, 0.3)
        .to('#ridge-mid', { yPercent: 18, duration: 0.15 }, 0.3)
        .to('#terrain-near', { yPercent: 34, duration: 0.15 }, 0.3)
        // Node A and B pulse into focus as isolated stations
        .to(['#node-a-beacon', '#node-b-beacon'], { opacity: 1, scale: 1.2, duration: 0.08 }, 0.32)
        .to(['#node-a-beacon', '#node-b-beacon'], { scale: 1.0, duration: 0.07 }, 0.4);

      // --- Scene 4: Launch — The Money Shot (0.45 -> 0.65) ---
      // Drone lifts from Team A and climbs; terrain drops away underneath
      tl.to('#drone-aircraft', { opacity: 1, duration: 0.05 }, 0.44)
        .to(
          '#drone-aircraft',
          {
            x: 500, // Move to valley center
            y: 220, // Ascend to center altitude
            rotation: -2.5,
            duration: 0.2,
            ease: 'power1.inOut',
          },
          0.45
        )
        // Counter-swaying SX1278 wire antenna (sways 3° out of phase)
        .to('#drone-antenna', { rotation: 4.5, transformOrigin: 'top center', duration: 0.1 }, 0.47)
        .to('#drone-antenna', { rotation: -1.5, transformOrigin: 'top center', duration: 0.1 }, 0.57)
        // Rotor blur oscillation
        .to('.rotor-disc', { opacity: 0.3, duration: 0.05, yoyo: true, repeat: 3 }, 0.46)
        // World falls away beneath (differential downward parallax)
        .to('#ridge-far', { yPercent: 20, duration: 0.2 }, 0.45)
        .to('#ridge-mid', { yPercent: 35, duration: 0.2 }, 0.45)
        .to('#terrain-near', { yPercent: 60, duration: 0.2 }, 0.45);

      // --- Scene 5: Relay Established (0.65 -> 0.85) ---
      tl.to('#drone-aircraft', { rotation: 0, duration: 0.08 }, 0.65)
        // Arcs draw in sequentially: Team A -> Drone, then Drone -> Team B
        .to('#lora-arc-a-drone', { strokeDashoffset: 0, opacity: 0.95, duration: 0.09 }, 0.66)
        .to('#lora-arc-drone-b', { strokeDashoffset: 0, opacity: 0.95, duration: 0.09 }, 0.73)
        // Team B indicator lights up emerald green on successful packet bridge
        .to('#node-b-pulse', { fill: '#10B981', stroke: '#34D399', duration: 0.06 }, 0.79)
        // Packet dot traverses A -> Drone -> B
        .to('#flying-packet-dot', { opacity: 1, duration: 0.02 }, 0.75)
        .to(
          '#flying-packet-dot',
          {
            motionPath: {
              path: '#packet-travel-path',
              align: '#packet-travel-path',
              autoRotate: true,
              alignOrigin: [0.5, 0.5],
            },
            duration: 0.1,
            ease: 'none',
          },
          0.75
        );

      // --- Scene 6: Illustration Becomes Product (0.85 -> 1.00) ---
      // Terrain and mountains desaturate and fade out
      tl.to('.illustration-scenery', { opacity: 0, filter: 'grayscale(1)', duration: 0.14 }, 0.85)
        .to('#drone-aircraft', { opacity: 0, duration: 0.1 }, 0.86)
        .to('#lora-arc-a-drone', { opacity: 0.3, duration: 0.1 }, 0.87)
        .to('#lora-arc-drone-b', { opacity: 0.3, duration: 0.1 }, 0.87)
        // Real Schematic topology card fades in and scales smoothly into place
        .fromTo(
          '#topology-schematic-card',
          { opacity: 0, scale: 0.96, y: 20 },
          { opacity: 1, scale: 1, y: 0, duration: 0.14, ease: 'power2.out' },
          0.87
        )
        // Final action buttons reveal
        .fromTo(
          '#final-cta-buttons',
          { opacity: 0, y: 15 },
          { opacity: 1, y: 0, duration: 0.1 },
          0.91
        );
    }, rootRef);

    return () => {
      ctx.revert();
      if (rafCallback) gsap.ticker.remove(rafCallback);
      lenis?.destroy();
    };
  }, [isReducedMotion]);

  // Reduced motion alternative: static accessible presentation
  if (isReducedMotion) {
    return (
      <section
        id="scroll-cinematic-reduced"
        aria-label="SkyBridge Mission Overview"
        className="py-16 px-6 max-w-6xl mx-auto space-y-12"
      >
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
            <Radio className="w-3.5 h-3.5" />
            <span>Emergency Comms Narrative</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold font-mono text-slate-100">
            SkyBridge Drone-Relay Sequence
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto">
            When terrestrial infrastructure fractures, isolated search-and-rescue teams deploy an
            autonomous ESP32 + SX1278 LoRa drone payload to bridge communication across the gorge.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {SCENE_DATA.map((scene, idx) => (
            <div
              key={scene.id}
              className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2"
            >
              <div className="flex items-center justify-between text-xs font-mono text-cyan-400">
                <span>PHASE 0{idx + 1}</span>
                <span className="uppercase">{scene.label}</span>
              </div>
              <h2 className="text-lg font-bold text-slate-200">{scene.copy.title}</h2>
              {scene.copy.subtitle && (
                <p className="text-xs text-slate-400">{scene.copy.subtitle}</p>
              )}
            </div>
          ))}
        </div>

        <div className="text-center pt-4">
          <button
            onClick={() => setActiveTab('overview')}
            className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-sm inline-flex items-center gap-2 transition-all shadow-lg shadow-cyan-950/40"
          >
            <span>Launch Operations Console</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    );
  }

  const currentScene = SCENE_DATA[activeSceneIndex];

  return (
    <section
      ref={rootRef}
      id="scroll-cinematic-hero"
      aria-label="Interactive SkyBridge Drone Relay Demonstration"
      className="relative w-full h-screen bg-[#070a0f] text-slate-100 overflow-hidden select-none"
    >
      {/* Keyboard Accessibility Skip Link */}
      <a
        href="#landing-content-start"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-cyan-500 focus:text-slate-950 focus:font-mono focus:text-xs focus:rounded-lg focus:font-bold"
      >
        Skip sequence to page content
      </a>

      {/* Pinned Viewport Container */}
      <div
        id="cinematic-viewport"
        className="relative w-full h-full flex flex-col justify-between"
      >
        {/* SVG Artwork Canvas */}
        <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
          <svg
            ref={svgRef}
            viewBox="0 0 1000 700"
            preserveAspectRatio="xMidYMid slice"
            className="w-full h-full"
            aria-hidden="true"
          >
            <defs>
              {/* Sky linear gradient */}
              <linearGradient id="sky-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={isLight ? '#E2E8F0' : '#070A0F'} />
                <stop offset="50%" stopColor={isLight ? '#CBD5E1' : '#0E1726'} />
                <stop offset="100%" stopColor={isLight ? '#94A3B8' : '#17253B'} />
              </linearGradient>

              {/* LoRa RF Link Gradient */}
              <linearGradient id="lora-glow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#38BDF8" stopOpacity="1" />
                <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.8" />
              </linearGradient>

              {/* Atmospheric Depth Filter */}
              <filter id="distant-blur">
                <feGaussianBlur stdDeviation="1.5" />
              </filter>

              {/* Motion Path for Packet travel (A -> Drone -> B) */}
              <path
                id="packet-travel-path"
                d="M 170,430 Q 335,320 500,220 Q 665,320 830,430"
                fill="none"
              />
            </defs>

            {/* L0: Sky Background */}
            <rect width="1000" height="700" fill="url(#sky-gradient)" />

            {/* L1: Far Ridges (Lowest contrast, blurred, slow drift) */}
            <g id="ridge-far" className="illustration-scenery" filter="url(#distant-blur)">
              <path
                d="M 0,380 L 120,330 L 280,360 L 410,310 L 530,340 L 690,290 L 840,350 L 1000,310 L 1000,700 L 0,700 Z"
                fill={isLight ? '#B0C4DE' : '#131D2E'}
                opacity="0.6"
              />
              <path
                d="M 0,420 L 180,370 L 360,400 L 510,360 L 660,410 L 820,360 L 1000,390 L 1000,700 L 0,700 Z"
                fill={isLight ? '#9BB2CE' : '#17253B'}
                opacity="0.8"
              />
            </g>

            {/* L2: Mid Ridges & Ravine Gorge */}
            <g id="ridge-mid" className="illustration-scenery">
              {/* Left Canyon Wall */}
              <path
                d="M 0,480 L 160,450 L 310,480 L 440,560 L 420,700 L 0,700 Z"
                fill={isLight ? '#7E99B8' : '#1A2942'}
              />
              {/* Right Canyon Wall */}
              <path
                d="M 1000,480 L 840,450 L 690,480 L 560,560 L 580,700 L 1000,700 Z"
                fill={isLight ? '#7E99B8' : '#1A2942'}
              />
              {/* Central Mountain Spur carrying the Comms Mast */}
              <polygon
                points="430,560 500,410 570,560 500,680"
                fill={isLight ? '#6682A3' : '#121E31'}
              />

              {/* Fracture Crack across Central Ridge (Triggered in Scene 2) */}
              <path
                id="fracture-line"
                d="M 500,440 L 490,490 L 515,530 L 485,580 L 505,630 L 495,680"
                fill="none"
                stroke="#EF4444"
                strokeWidth="2.5"
                strokeDasharray="400"
                strokeDashoffset="400"
                opacity="0.9"
              />
            </g>

            {/* L3: Terrestrial Structures (Tower, Ground Bases, Settlement Lights) */}
            <g id="structures" className="illustration-scenery">
              {/* Central Terrestrial Communications Mast */}
              <g id="comms-mast">
                {/* Mast Lattice Base */}
                <line x1="492" y1="410" x2="500" y2="350" stroke="#64748B" strokeWidth="2.5" />
                <line x1="508" y1="410" x2="500" y2="350" stroke="#64748B" strokeWidth="2.5" />
                <line x1="496" y1="390" x2="504" y2="390" stroke="#64748B" strokeWidth="1.5" />
                <line x1="498" y1="370" x2="502" y2="370" stroke="#64748B" strokeWidth="1.5" />
                {/* Antenna Mast Pole */}
                <line x1="500" y1="350" x2="500" y2="320" stroke="#94A3B8" strokeWidth="2.5" />
                {/* Top Flashing Warning Beacon */}
                <circle id="mast-beacon" cx="500" cy="318" r="4" fill="#06B6D4" />
                {/* Microwave Dishes */}
                <path d="M 493,342 Q 497,345 493,348" fill="none" stroke="#CBD5E1" strokeWidth="2" />
                <path d="M 507,342 Q 503,345 507,348" fill="none" stroke="#CBD5E1" strokeWidth="2" />
              </g>

              {/* Settlement Light Specks (Distant civilization) */}
              <g id="settlement-lights" fill="#FDE047" opacity="0.6">
                <circle cx="80" cy="460" r="1.5" />
                <circle cx="110" cy="465" r="1" />
                <circle cx="140" cy="458" r="1.5" />
                <circle cx="860" cy="462" r="1.5" />
                <circle cx="900" cy="456" r="1.2" />
                <circle cx="930" cy="468" r="1.5" />
              </g>

              {/* Ground Node A (Left Rim) */}
              <g id="ground-node-a" transform="translate(170, 430)">
                <circle id="node-a-beacon" r="7" fill="#06B6D4" opacity="0.8" />
                <circle r="14" fill="none" stroke="#06B6D4" strokeWidth="1.5" opacity="0.4" />
                <rect x="-14" y="12" width="28" height="12" rx="3" fill="#0F172A" stroke="#06B6D4" strokeWidth="1" />
                <text x="0" y="21" fill="#38BDF8" fontSize="8" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                  TEAM A
                </text>
              </g>

              {/* Ground Node B (Right Rim) */}
              <g id="ground-node-b" transform="translate(830, 430)">
                <circle id="node-b-pulse" r="7" fill="#F59E0B" opacity="0.8" />
                <circle r="14" fill="none" stroke="#F59E0B" strokeWidth="1.5" opacity="0.4" />
                <rect x="-14" y="12" width="28" height="12" rx="3" fill="#0F172A" stroke="#F59E0B" strokeWidth="1" />
                <text x="0" y="21" fill="#FBBF24" fontSize="8" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                  TEAM B
                </text>
              </g>
            </g>

            {/* L4: Near Foreground Valley Rocks (Frame borders) */}
            <g id="terrain-near" className="illustration-scenery">
              <path
                d="M 0,570 L 140,530 L 260,580 L 330,700 L 0,700 Z"
                fill={isLight ? '#475569' : '#0B111A'}
              />
              <path
                d="M 1000,570 L 860,530 L 740,580 L 670,700 L 1000,700 Z"
                fill={isLight ? '#475569' : '#0B111A'}
              />
            </g>

            {/* L5: Network Link Lines (Cellular & LoRa) */}
            <g id="network-layer">
              {/* Pre-break Cellular Microwave Lines */}
              <line
                id="link-mast-a"
                x1="170"
                y1="430"
                x2="500"
                y2="345"
                stroke="#38BDF8"
                strokeWidth="2"
                strokeDasharray="4 4"
                opacity="0.85"
              />
              <line
                id="link-mast-b"
                x1="500"
                y1="345"
                x2="830"
                y2="430"
                stroke="#38BDF8"
                strokeWidth="2"
                strokeDasharray="4 4"
                opacity="0.85"
              />

              {/* LoRa Arcs drawn during Scene 5 */}
              <path
                id="lora-arc-a-drone"
                d="M 170,430 Q 335,320 500,220"
                fill="none"
                stroke="url(#lora-glow)"
                strokeWidth="3.5"
                strokeDasharray="500"
                strokeDashoffset="500"
                opacity="0"
              />
              <path
                id="lora-arc-drone-b"
                d="M 500,220 Q 665,320 830,430"
                fill="none"
                stroke="url(#lora-glow)"
                strokeWidth="3.5"
                strokeDasharray="500"
                strokeDashoffset="500"
                opacity="0"
              />

              {/* Traversal Packet Marker (Scene 5) */}
              <circle
                id="flying-packet-dot"
                r="6"
                fill="#38BDF8"
                opacity="0"
                filter="drop-shadow(0 0 8px #06B6D4)"
              />
            </g>

            {/* L6: The Aerial Drone (Quad with SX1278 antenna) */}
            <g
              id="drone-aircraft"
              transform="translate(170, 420)"
              opacity="0"
              className="will-change-transform"
            >
              {/* Drone Body Chassis */}
              <rect x="-18" y="-7" width="36" height="14" rx="4" fill="#0F172A" stroke="#06B6D4" strokeWidth="2" />
              {/* ESP32 Status LED */}
              <circle cx="-6" cy="0" r="2.5" fill="#10B981" />
              <circle cx="6" cy="0" r="2" fill="#38BDF8" />

              {/* Motor Arm 1 & 2 */}
              <line x1="-28" y1="-12" x2="28" y2="12" stroke="#64748B" strokeWidth="2.5" />
              <line x1="-28" y1="12" x2="28" y2="-12" stroke="#64748B" strokeWidth="2.5" />

              {/* Four Rotor Discs (Opacity blur simulation) */}
              <ellipse cx="-28" cy="-12" rx="14" ry="4" fill="#38BDF8" opacity="0.6" className="rotor-disc" />
              <ellipse cx="28" cy="-12" rx="14" ry="4" fill="#38BDF8" opacity="0.6" className="rotor-disc" />
              <ellipse cx="-28" cy="12" rx="14" ry="4" fill="#38BDF8" opacity="0.6" className="rotor-disc" />
              <ellipse cx="28" cy="12" rx="14" ry="4" fill="#38BDF8" opacity="0.6" className="rotor-disc" />

              {/* 433MHz SX1278 Hanging Wire Antenna with Terminal Bead */}
              <g id="drone-antenna">
                <line x1="0" y1="7" x2="0" y2="32" stroke="#94A3B8" strokeWidth="1.5" />
                <circle cx="0" cy="34" r="2.5" fill="#06B6D4" />
              </g>
            </g>
          </svg>
        </div>

        {/* Scene 6 Interactive Product Morph Card Container */}
        <div
          id="topology-schematic-card"
          className="absolute inset-x-4 md:inset-x-12 top-28 md:top-36 max-w-4xl mx-auto z-20 pointer-events-auto opacity-0"
        >
          <div className="bg-slate-900/95 border border-cyan-500/40 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
            {/* Schematic Header */}
            <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <div className="flex items-center gap-2.5">
                <Radio className="w-5 h-5 text-cyan-400" />
                <span className="font-mono font-bold text-sm tracking-wide text-slate-100 uppercase">
                  LOGICAL NETWORK TOPOLOGY
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-700 font-semibold">
                  SX1278 433MHz LoRa
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>RELAY ACTIVE — 433.000 MHz CLEAR</span>
              </div>
            </div>

            {/* Schematic Nodes Display */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              {/* Node 1: Team A Base */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    GROUND 01
                  </span>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold">ONLINE</span>
                </div>
                <div className="text-sm font-bold text-slate-100">TEAM A BASE</div>
                <div className="text-xs text-slate-400 font-mono">ESP32 + SX1278 (VSPI)</div>
              </div>

              {/* Node 2: Drone Relay */}
              <div className="p-4 rounded-xl bg-slate-950 border-2 border-cyan-500/60 text-center space-y-2 relative shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-cyan-500 text-slate-950 font-mono font-bold text-[10px] rounded uppercase">
                  Airborne Active
                </div>
                <div className="flex justify-center pt-1">
                  <Plane className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="text-sm font-bold text-cyan-300">DRONE STORE & FORWARD</div>
                <div className="text-xs text-slate-400 font-mono">Decoupled Comms Payload</div>
              </div>

              {/* Node 3: Team B Base */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    GROUND 02
                  </span>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold">ONLINE</span>
                </div>
                <div className="text-sm font-bold text-slate-100">TEAM B SEARCH</div>
                <div className="text-xs text-slate-400 font-mono">ESP32 + SX1278 (VSPI)</div>
              </div>
            </div>

            {/* Action Buttons in Scene 6 */}
            <div
              id="final-cta-buttons"
              className="mt-6 pt-5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4"
            >
              <div className="text-xs font-mono text-slate-400">
                Live link operating with zero cloud, cell, or satellite dependencies.
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTab('overview')}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-cyan-950/30 cursor-pointer"
                >
                  <span>Explore Operations Console</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setActiveTab('docs')}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs transition-colors cursor-pointer"
                >
                  View Architecture
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Scene 1 Centered Initial Wordmark */}
        <div
          id="wordmark-group"
          className="absolute inset-x-0 top-1/4 text-center px-6 pointer-events-none z-10"
        >
          <div className="max-w-2xl mx-auto space-y-3">
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight font-mono text-white drop-shadow-md">
              SkyBridge
            </h1>
            <p className="text-base sm:text-lg text-slate-300 font-medium">
              Drone-relay emergency communication network
            </p>
            <div className="inline-flex items-center gap-2 pt-4 text-xs font-mono text-cyan-400 animate-pulse">
              <span>Scroll to see why it exists</span>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Dynamic Scene Copy Overlay (Cross-fades with 8px rise) */}
        <div className="relative z-10 p-6 md:p-12 max-w-2xl pointer-events-none mt-auto mb-12">
          {activeSceneIndex > 0 && activeSceneIndex < 5 && (
            <div
              key={currentScene.id}
              className="space-y-2 bg-slate-950/75 p-5 rounded-2xl border border-slate-800/80 backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
            >
              <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>
                  Phase 0{activeSceneIndex + 1} — {currentScene.label}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-snug">
                {currentScene.copy.title}
              </h2>
              {currentScene.copy.subtitle && (
                <p className="text-xs sm:text-sm text-slate-300 font-normal leading-relaxed">
                  {currentScene.copy.subtitle}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Vertical Scene Progress Indicator Rail (Right Edge) */}
        <div
          id="scene-progress-rail"
          className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-30 flex flex-col items-end gap-5 pointer-events-auto"
        >
          {SCENE_DATA.map((scene, idx) => {
            const isActive = activeSceneIndex === idx;
            const isCompleted = activeSceneIndex > idx;

            return (
              <div key={scene.id} className="group relative flex items-center gap-3 cursor-default">
                {/* Hover / Active Label */}
                <span
                  className={`text-[11px] font-mono tracking-wider transition-all duration-200 hidden sm:block ${
                    isActive
                      ? 'text-cyan-400 font-bold opacity-100 translate-x-0'
                      : 'text-slate-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 translate-x-2'
                  }`}
                >
                  {scene.label}
                </span>

                {/* 4px Vertical Progress Mark */}
                <div
                  className={`w-1 rounded-full transition-all duration-300 ${
                    isActive
                      ? 'h-8 bg-cyan-400 shadow-[0_0_10px_#06B6D4]'
                      : isCompleted
                      ? 'h-4 bg-cyan-700/60'
                      : 'h-3 bg-slate-800'
                  }`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
