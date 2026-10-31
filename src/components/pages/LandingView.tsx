import React from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { ScrollCinematic } from '../landing/ScrollCinematic';
import {
  Radio,
  ArrowRight,
  Shield,
  WifiOff,
  Plane,
  Server,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Layers,
  Terminal,
  Clock,
  ChevronRight,
  Lock,
  LogIn,
  FileText,
  Activity,
} from 'lucide-react';
import { Spotlight } from '../ui/spotlight';
import { FloatingNav } from '../ui/floating-navbar';
import { TextGenerateEffect } from '../ui/text-generate-effect';
import { CardContainer, CardBody, CardItem } from '../ui/3d-card';

export const LandingView: React.FC = () => {
  const { setActiveTab } = useApp();
  const { isAuthenticated, startGuestDemo } = useAuth();

  const handleLaunchConsole = async () => {
    if (!isAuthenticated) {
      try {
        await startGuestDemo();
        setActiveTab('overview');
      } catch {
        setActiveTab('login');
      }
    } else {
      setActiveTab('overview');
    }
  };

  const handleOpenLogin = () => {
    setActiveTab('login');
  };

  const navItems = [
    {
      name: 'Overview',
      link: '#hero',
      icon: <Radio className="w-4 h-4" />,
      onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
    },
    {
      name: 'Problem',
      link: '#problem',
      icon: <WifiOff className="w-4 h-4" />,
      onClick: () => {
        document.getElementById('problem')?.scrollIntoView({ behavior: 'smooth' });
      },
    },
    {
      name: 'Architecture',
      link: '#architecture',
      icon: <Layers className="w-4 h-4" />,
      onClick: () => {
        document.getElementById('architecture')?.scrollIntoView({ behavior: 'smooth' });
      },
    },
    ...(!isAuthenticated
      ? [
          {
            name: 'Sign In',
            icon: <LogIn className="w-4 h-4" />,
            onClick: handleOpenLogin,
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-[#070a0f] text-slate-100 flex flex-col selection:bg-cyan-500/20 selection:text-cyan-300 relative">
      {/* Aceternity Floating Navbar */}
      <FloatingNav
        navItems={navItems}
        ctaText={isAuthenticated ? 'Console' : 'Launch Demo'}
        ctaIcon={<ArrowRight className="w-3.5 h-3.5 ml-1" />}
        onCtaClick={handleLaunchConsole}
        brand={
          <div
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2 cursor-pointer pr-1 select-none"
          >
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_8px_rgba(6,182,212,0.4)]">
              <Radio className="w-3.5 h-3.5 text-slate-950" />
            </div>
            <span className="font-mono font-bold text-xs text-white tracking-wider hidden md:inline-block">
              SKYBRIDGE
            </span>
          </div>
        }
      />

      {/* Top Public Navigation (Sticky Header Bar for Accessibility) */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 sticky top-0 z-30 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.3)]">
            <Radio className="w-4 h-4 text-slate-950" />
          </div>
          <span className="font-mono font-bold tracking-tight text-lg text-slate-100">
            SKYBRIDGE
          </span>
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 hidden sm:inline-block">
            MERN + LoRa
          </span>
        </div>

        <div className="flex items-center gap-3">
          {!isAuthenticated && (
            <button
              onClick={handleOpenLogin}
              className="text-xs text-cyan-400 hover:text-cyan-300 px-3 py-1.5 rounded-lg border border-cyan-800/60 bg-cyan-950/40 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
          <button
            onClick={handleLaunchConsole}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-all shadow-[0_0_15px_rgba(6,182,212,0.25)] flex items-center gap-1.5 cursor-pointer"
          >
            <span>{isAuthenticated ? 'Return to Console' : 'Launch Demo Console'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* 1. Scroll-Cinematic Hero Sequence with Aceternity Spotlight Background */}
      <section id="hero" className="relative w-full overflow-hidden">
        {/* Aceternity Spotlight Beams */}
        <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="#06b6d4" />
        <Spotlight className="-top-10 right-0 md:top-10 md:right-40" fill="#3b82f6" />

        {/* Ambient Subtle Grid */}
        <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,#17255418_1px,transparent_1px),linear-gradient(to_bottom,#17255418_1px,transparent_1px)] [background-size:48px_48px] select-none" />

        {/* Preserved 7-Scene Scroll Cinematic GSAP sequence */}
        <ScrollCinematic />
      </section>

      {/* Anchor for keyboard skip link */}
      <div id="landing-content-start" className="scroll-mt-16" />

      {/* 2. The Problem Statement */}
      <section id="problem" className="py-20 px-6 border-b border-slate-800/60 max-w-5xl mx-auto relative">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="text-xs font-mono text-rose-400 uppercase tracking-wider mb-2 font-semibold">
            Operational Challenge
          </div>
          {/* Aceternity Text Generate Effect */}
          <TextGenerateEffect
            words="Communication shouldn't stop when infrastructure does."
            className="text-2xl sm:text-4xl font-bold text-slate-100 font-sans tracking-tight"
            duration={0.6}
          />
          <p className="text-sm text-slate-400 mt-4 leading-relaxed">
            In earthquakes, flash floods, landslides, and remote wilderness search operations, traditional communications crumble within minutes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-rose-500/30 transition-colors shadow-lg">
            <WifiOff className="w-6 h-6 text-rose-400 mb-3" />
            <h3 className="text-sm font-semibold text-slate-200 mb-2">Cellular Blackouts</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Base stations lose power, backhaul fiber lines sever, and cell towers collapse, leaving ground teams isolated without basic messaging.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-amber-500/30 transition-colors shadow-lg">
            <MountainIcon className="w-6 h-6 text-amber-400 mb-3" />
            <h3 className="text-sm font-semibold text-slate-200 mb-2">Line-of-Sight Blockage</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Rugged ridges, collapsed buildings, and dense canopy obstruct UHF/VHF handheld radios from reaching forward headquarters.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-cyan-500/30 transition-colors shadow-lg">
            <Server className="w-6 h-6 text-cyan-400 mb-3" />
            <h3 className="text-sm font-semibold text-slate-200 mb-2">Lack of Central Coordination</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Commanders cannot maintain an auditable timeline of tactical sitreps, triage needs, or victim discoveries without a digital log.
            </p>
          </div>
        </div>
      </section>

      {/* 3. How SkyBridge Works */}
      <section id="architecture" className="py-20 px-6 border-b border-slate-800/60 bg-slate-950/40 relative">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-xs font-mono text-cyan-400 uppercase tracking-wider mb-2 font-semibold">
              The Architecture
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
              Airborne Store-and-Forward LoRa
            </h2>
            <p className="text-sm text-slate-400 mt-3">
              By hoisting a low-power LoRa repeater into the air aboard an F450 quadcopter, SkyBridge establishes an elevated radio horizon above terrain obstacles.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5 hover:border-cyan-500/40 transition-colors">
              <div className="text-xs font-mono text-cyan-400 font-bold">STEP 01</div>
              <h4 className="text-sm font-semibold text-slate-200">Ground Input</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Team A selects a priority template (e.g. "VICTIM FOUND") or drafts a short packet on their ESP32 console.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5 hover:border-cyan-500/40 transition-colors">
              <div className="text-xs font-mono text-cyan-400 font-bold">STEP 02</div>
              <h4 className="text-sm font-semibold text-slate-200">LoRa Uplink</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                SX1278 transmits the formatted JSON packet over 433 MHz with a unique <code className="text-cyan-300">msgID</code>.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5 hover:border-cyan-500/40 transition-colors">
              <div className="text-xs font-mono text-cyan-400 font-bold">STEP 03</div>
              <h4 className="text-sm font-semibold text-slate-200">Airborne Repeat</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                The drone payload verifies the ID against its cache to prevent loops, buffers the packet, and re-broadcasts.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5 hover:border-cyan-500/40 transition-colors">
              <div className="text-xs font-mono text-cyan-400 font-bold">STEP 04</div>
              <h4 className="text-sm font-semibold text-slate-200">Delivery & ACK</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Team B receives the alert on their OLED display and buzzer, and returns an automated verification ACK.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Project Highlights with Aceternity 3D Card Effect */}
      <section className="py-20 px-6 border-b border-slate-800/60 max-w-5xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-xs font-mono text-cyan-400 uppercase tracking-wider mb-2 font-semibold">
            System Design
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
            Tactical Emergency Communication Capabilities
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Engineered to restore critical communications when terrestrial infrastructure is disabled.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Airborne Relay Highlights */}
          <CardContainer containerClassName="py-1 w-full" className="w-full">
            <CardBody className="p-6 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 hover:border-cyan-500/60 transition-all duration-300 space-y-4 w-full shadow-xl">
              <CardItem translateZ={30} className="w-full">
                <div className="flex items-center gap-2 text-cyan-400 font-mono text-sm font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>AIRBORNE LORA REPEATER</span>
                </div>
              </CardItem>
              <CardItem translateZ={50} className="w-full">
                <ul className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 font-bold">•</span>
                    <span><strong>Elevated Radio Horizon:</strong> Hoists relay above terrain obstacles to bridge isolated sectors</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 font-bold">•</span>
                    <span><strong>Store-and-Forward:</strong> Autonomous airborne packet reception, buffering, and rebroadcasting</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 font-bold">•</span>
                    <span><strong>Loop Prevention:</strong> Automatic packet deduplication prevents infinite echoes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 font-bold">•</span>
                    <span><strong>Verified Delivery:</strong> Automated hop-by-hop acknowledgment verification</span>
                  </li>
                </ul>
              </CardItem>
            </CardBody>
          </CardContainer>

          {/* Mission Command Console Highlights */}
          <CardContainer containerClassName="py-1 w-full" className="w-full">
            <CardBody className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-purple-500/40 transition-all duration-300 space-y-4 w-full shadow-xl">
              <CardItem translateZ={30} className="w-full">
                <div className="flex items-center gap-2 text-purple-400 font-mono text-sm font-bold">
                  <Server className="w-5 h-5" />
                  <span>MISSION COMMAND CONSOLE</span>
                </div>
              </CardItem>
              <CardItem translateZ={50} className="w-full">
                <ul className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 font-bold">•</span>
                    <span><strong>Tactical Dashboard:</strong> Real-time message streaming with priority triage classification</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 font-bold">•</span>
                    <span><strong>Hardware & Demo Modes:</strong> Live serial gateway or simulated test harness for evaluations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 font-bold">•</span>
                    <span><strong>Role-Based Access:</strong> Dedicated accounts for Command, Team Alpha, and Team Bravo</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 font-bold">•</span>
                    <span><strong>Incident Reporting:</strong> Automated SITREP generation and auditable mission timeline</span>
                  </li>
                </ul>
              </CardItem>
            </CardBody>
          </CardContainer>
        </div>
      </section>

      {/* 5. Call to Action Footer */}
      <footer className="mt-auto py-16 px-6 border-t border-slate-800 bg-slate-950 text-center space-y-6">
        <div className="max-w-xl mx-auto space-y-4">
          <h3 className="text-2xl font-bold text-slate-100">Ready to inspect the network?</h3>
          <p className="text-xs text-slate-400">
            Access the live operations console with interactive packet transmission, SITREP reporting, and diagnostic tests.
          </p>
          <div className="flex items-center justify-center gap-3 pt-3">
            <button
              onClick={handleLaunchConsole}
              className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all shadow-[0_0_20px_rgba(6,182,212,0.35)] flex items-center gap-2 cursor-pointer font-mono"
            >
              <span>{isAuthenticated ? 'Return to Console' : 'Launch Demo Console'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="text-[11px] font-mono text-slate-400 pt-8 border-t border-slate-900 flex flex-wrap justify-between items-center max-w-4xl mx-auto">
          <span>SkyBridge Tactical Emergency Communication Network</span>
          <span>Drone Relay System</span>
        </div>
      </footer>
    </div>
  );
};

function MountainIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
    </svg>
  );
}
