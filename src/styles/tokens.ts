// SKYBRIDGE DESIGN & ANIMATION SYSTEM TOKENS (v1.0)
// Centralized source of truth for UI colors, motion timing, easings, and spacing.

export const colorTokens = {
  light: {
    bg: '#FFFFFF',             // page canvas: pure white, not gray
    bgShell: '#F3F5F8',        // sidebar/top-bar background only — the one place a soft gray belongs
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',  // (+ shadow-1, visibly lifts off page)
    border: '#DDE3EA',         // visible, not washed-out
    borderSubtle: '#EDEFF2',
    textPrimary: '#0B1220',     // near-black for real contrast
    textSecondary: '#3F4A5C',
    textMuted: '#6B7686',
    accent: '#2F6FED',         // vivid, clear blue — not a dark/navy tone
    accentCyan: '#06AED4',
    success: '#16A34A',
    warning: '#F59E0B',
    critical: '#EF4444',
    info: '#2F6FED',
    neutral: '#9AA3AF',        // offline/unavailable
    demo: '#8B5CF6',           // reserved — never reused elsewhere
  },
  dark: {
    bg: '#0B0F14',
    bgShell: '#070A0F',
    surface: '#12171F',
    surfaceRaised: '#171D27',
    border: '#232B36',
    borderSubtle: '#1B222C',
    textPrimary: '#E8EBEF',
    textSecondary: '#9AA4B2',
    textMuted: '#626C7A',
    accent: '#3B82F6',
    accentCyan: '#22D3EE',
    success: '#22C55E',
    warning: '#F59E0B',
    critical: '#EF4444',
    info: '#3B82F6',
    neutral: '#4B5563',
    demo: '#A78BFA',
  },
  highContrast: {
    bg: '#000000',
    surface: '#0A0A0A',
    surfaceRaised: '#121212',
    border: '#FFFFFF',
    borderSubtle: '#CCCCCC',
    textPrimary: '#FFFFFF',
    textSecondary: '#EEEEEE',
    textMuted: '#B0B0B0',
    accent: '#60A5FA',
    accentCyan: '#38BDF8',
    success: '#4ADE80',
    warning: '#FBBF24',
    critical: '#F87171',
    info: '#60A5FA',
    neutral: '#9CA3AF',
    demo: '#C084FC',
  },
} as const;

export const motionTokens = {
  duration: {
    instant: 0.1,    // 100ms
    fast: 0.15,      // 150ms
    base: 0.25,      // 250ms
    slow: 0.4,       // 400ms
    packetHop: 0.75, // 750ms per LoRa hop traversal
  },
  ease: {
    standard: [0.4, 0.0, 0.2, 1.0] as const,     // cubic-bezier(0.4, 0, 0.2, 1)
    decelerate: [0.0, 0.0, 0.2, 1.0] as const,   // entrances
    accelerate: [0.4, 0.0, 1.0, 1.0] as const,   // exits
  },
  spring: {
    bellShake: { type: 'spring', stiffness: 450, damping: 25 },
  },
} as const;

export const spacingTokens = {
  baseUnit: 4,
  radii: {
    badge: '6px',
    control: '8px',
    card: '12px',
    modal: '16px',
  },
} as const;
