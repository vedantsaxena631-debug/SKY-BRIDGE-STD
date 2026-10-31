import React from 'react';
import { motion } from 'motion/react';
import { Message, MessageStatus } from '../../types';
import { useApp } from '../../context/AppContext';
import { AlertTriangle, Clock, Radio, Check, XCircle } from 'lucide-react';

interface TransmissionProgressStepperProps {
  message: Message;
}

interface StepConfig {
  key: string;
  label: string;
  statuses: MessageStatus[];
}

const STEPS: StepConfig[] = [
  { key: 'queued', label: 'Queued', statuses: ['QUEUED'] },
  { key: 'bridge', label: 'Sent to Bridge', statuses: ['SENT_TO_BRIDGE'] },
  { key: 'relayed', label: 'Drone Relayed', statuses: ['RELAYED'] },
  { key: 'delivered', label: 'Delivered', statuses: ['DELIVERED', 'ACKNOWLEDGED'] },
];

export const TransmissionProgressStepper: React.FC<TransmissionProgressStepperProps> = ({ message }) => {
  const { theme } = useApp();
  const isLight = theme === 'light';

  const isFailed = message.status === 'FAILED_NO_ACK';

  // Determine current active index
  const getStepIndex = (status: MessageStatus): number => {
    switch (status) {
      case 'QUEUED':
        return 0;
      case 'SENT_TO_BRIDGE':
        return 1;
      case 'RELAYED':
        return 2;
      case 'DELIVERED':
      case 'ACKNOWLEDGED':
        return 3;
      case 'FAILED_NO_ACK':
        return 1; // Failed at bridge or drone
      default:
        return 0;
    }
  };

  const currentIndex = getStepIndex(message.status);

  // Determine step color theme
  const getAccentColor = () => {
    if (message.isDemo) return '#8B5CF6';
    if (message.priority === 'CRITICAL') return '#EF4444';
    if (message.priority === 'URGENT') return '#F59E0B';
    return '#16A34A';
  };

  const accentColor = getAccentColor();

  return (
    <div
      className={`p-4 rounded-xl border transition-colors ${
        isLight
          ? 'bg-white border-[#DDE3EA] shadow-[0_1px_3px_0_rgba(0,0,0,0.06)]'
          : 'bg-[#12171F] border-[#232B36]'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
          <span
            className={`text-xs font-mono font-bold tracking-wide uppercase ${
              isLight ? 'text-[#0B1220]' : 'text-slate-200'
            }`}
          >
            Packet Pipeline: #{message.msgID}
          </span>
          {message.isDemo && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/30 font-bold">
              DEMO
            </span>
          )}
          {message.priority === 'CRITICAL' && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-500 border border-rose-500/30 font-bold">
              CRITICAL
            </span>
          )}
        </div>

        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
          {message.from} → {message.to}
        </span>
      </div>

      {/* Horizontal Step Progression (Section 4.6) */}
      <div className="grid grid-cols-4 gap-2 pt-2">
        {STEPS.map((step, idx) => {
          const isCompleted = !isFailed && idx < currentIndex;
          const isActive = !isFailed && idx === currentIndex;
          const isPending = !isFailed && idx > currentIndex;
          const isFailedStep = isFailed && idx === currentIndex;

          return (
            <div key={step.key} className="flex flex-col items-center text-center relative">
              {/* Connector line between steps */}
              {idx < STEPS.length - 1 && (
                <div
                  className={`absolute top-4 left-1/2 w-full h-0.5 -z-0 transition-colors duration-200 ${
                    idx < currentIndex
                      ? isLight ? 'bg-emerald-500' : 'bg-emerald-500'
                      : isLight ? 'bg-[#DDE3EA]' : 'bg-[#232B36]'
                  }`}
                />
              )}

              {/* Step Icon Badge */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs z-10 transition-all duration-200 ${
                  isCompleted
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : isActive
                    ? 'ring-4 ring-cyan-500/30 bg-cyan-500 text-slate-950 font-bold animate-pulse'
                    : isFailedStep
                    ? 'bg-rose-500 text-white ring-4 ring-rose-500/30'
                    : isLight
                    ? 'bg-[#F3F5F8] border border-[#DDE3EA] text-slate-400'
                    : 'bg-[#171D27] border border-[#232B36] text-slate-500'
                }`}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <motion.path
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.2 }}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : isFailedStep ? (
                  <XCircle className="w-4 h-4" />
                ) : (
                  <span className="font-mono text-xs">{idx + 1}</span>
                )}
              </div>

              {/* Step Label */}
              <span
                className={`text-[11px] font-medium mt-1.5 line-clamp-1 ${
                  isActive
                    ? isLight ? 'text-[#0B1220] font-bold' : 'text-cyan-300 font-bold'
                    : isCompleted
                    ? isLight ? 'text-emerald-700 font-semibold' : 'text-emerald-400'
                    : isFailedStep
                    ? 'text-rose-500 font-semibold'
                    : isLight ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {step.label}
              </span>

              {/* Status Note */}
              <span className="text-[9px] font-mono text-slate-400">
                {isCompleted ? 'OK' : isActive ? 'IN PROGRESS' : isFailedStep ? 'TIMEOUT' : 'WAIT'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
