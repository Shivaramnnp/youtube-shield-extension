/**
 * GodMode Chrome Extension — Universal Shared Design Tokens
 * 
 * Centralized single source of truth for the GodMode Design System.
 * Supports CommonJS (Node.js/Jest/custom runners), Chrome MV3 Service Worker,
 * Extension content scripts, and HTML pages.
 */

const DesignTokens = {
  // ── 1. Color Palette ────────────────────────────────────────────────────────
  colors: {
    // Dark Obsidian & Purple Canvas Backgrounds
    bg: {
      base: '#0b0f19',
      dark: '#0b0f19',
      radialGradient: 'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #0f172a 60%, #0b0f19 100%)',
      radialGradientOptions: 'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #0b0f19 75%)',
      glassPanel: 'rgba(15, 23, 42, 0.85)',
      glassPanelDense: 'rgba(15, 15, 26, 0.94)',
      glassCard: 'rgba(30, 41, 59, 0.70)',
      glassCardLight: 'rgba(30, 41, 59, 0.45)',
      glassCardHover: 'rgba(30, 41, 59, 0.85)',
      glassModal: 'rgba(15, 15, 26, 0.92)',
      glassHeader: 'rgba(33, 33, 33, 0.85)',
      input: 'rgba(15, 23, 42, 0.75)',
      sidebar: 'rgba(15, 23, 42, 0.75)'
    },

    // Background Convenience Aliases
    bgBase: '#0b0f19',
    bgSurface: 'rgba(15, 23, 42, 0.85)',
    bgGlassPanel: 'rgba(15, 15, 26, 0.94)',
    bgCard: 'rgba(30, 41, 59, 0.70)',
    bgCardHover: 'rgba(30, 41, 59, 0.85)',

    // Vibrant Brand & Functional Accents
    accents: {
      indigo: '#6366f1',
      indigoHover: '#4f46e5',
      indigoDark: '#4338ca',
      purple: '#a855f7',
      purpleLight: '#a78bfa',
      purpleDark: '#7c3aed',
      emerald: '#10b981',
      emeraldDark: '#059669',
      emeraldLight: '#34d399',
      gold: '#f59e0b',
      goldLight: '#fbbf24',
      sky: '#38bdf8',
      skyDark: '#2563eb',
      danger: '#ef4444',
      dangerDark: '#dc2626',
      pink: '#ec4899',
      blue: '#3b82f6'
    },

    // Accent Convenience Aliases
    accentIndigo: '#6366f1',
    accentPurple: '#a855f7',
    accentPink: '#ec4899',
    accentEmerald: '#10b981',
    accentBlue: '#3b82f6',
    accentGold: '#f59e0b',
    accentSky: '#38bdf8',
    accentDanger: '#ef4444',

    // Status Colors
    statusSuccess: '#10b981',
    statusWarning: '#f59e0b',
    statusDanger: '#ef4444',
    statusInfo: '#3b82f6',

    // Linear Gradients
    gradients: {
      brand: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
      indigo: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
      purple: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
      emerald: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      sky: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
      danger: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      gold: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      studyHero: 'linear-gradient(135deg, rgba(99, 102, 241, 0.30) 0%, rgba(168, 85, 247, 0.25) 100%)',
      battleHero: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 27, 75, 0.85) 50%, rgba(15, 23, 42, 0.85) 100%)',
      xpTrack: 'linear-gradient(90deg, #6366f1, #a855f7, #ec4899)'
    },

    // Slate & Contrast Typography
    text: {
      primary: '#f8fafc',
      secondary: '#cbd5e1',
      muted: '#94a3b8',
      subtle: '#64748b',
      accent: '#a78bfa',
      accentIndigo: '#818cf8',
      accentPurple: '#c084fc',
      accentEmerald: '#34d399',
      accentGold: '#fbbf24',
      accentSky: '#38bdf8',
      accentDanger: '#f87171'
    },

    // Text Convenience Aliases
    textPrimary: '#f8fafc',
    textSecondary: '#cbd5e1',
    textMuted: '#94a3b8',
    textSubtle: '#64748b',
    textAccent: '#a78bfa',

    // Glass Borders
    borders: {
      glass: 'rgba(255, 255, 255, 0.08)',
      glassHover: 'rgba(255, 255, 255, 0.18)',
      glassSubtle: 'rgba(255, 255, 255, 0.05)',
      glassStrong: 'rgba(255, 255, 255, 0.12)',
      borderSubtle: 'rgba(255, 255, 255, 0.05)',
      borderDefault: 'rgba(255, 255, 255, 0.08)',
      borderStrong: 'rgba(255, 255, 255, 0.12)',
      glowIndigo: 'rgba(99, 102, 241, 0.40)',
      glowPurple: 'rgba(168, 85, 247, 0.35)',
      glowEmerald: 'rgba(16, 185, 129, 0.40)',
      glowGold: 'rgba(251, 191, 36, 0.40)'
    },

    // Border Convenience Aliases
    borderSubtle: 'rgba(255, 255, 255, 0.05)',
    borderDefault: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.12)',

    // Shadows & Glowing Outer Rings
    shadows: {
      glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      glassDeep: '0 20px 40px rgba(0, 0, 0, 0.70), 0 0 0 1px rgba(255, 255, 255, 0.12)',
      card: '0 4px 16px rgba(0, 0, 0, 0.25)',
      cardHover: '0 12px 40px rgba(0, 0, 0, 0.45), 0 0 20px rgba(99, 102, 241, 0.20)',
      modal: '0 25px 50px -12px rgba(0, 0, 0, 0.70), 0 0 30px rgba(99, 102, 241, 0.12)',
      glowIndigo: '0 0 14px rgba(99, 102, 241, 0.50)',
      glowPurple: '0 0 14px rgba(168, 85, 247, 0.40)',
      glowEmerald: '0 0 14px rgba(16, 185, 129, 0.50)',
      glowGold: '0 0 14px rgba(245, 158, 11, 0.40)',
      glowDanger: '0 0 14px rgba(239, 68, 68, 0.50)',
      highlight: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.10)'
    },

    // Gamification Rank Tiers
    badgeTiers: {
      bronze: { color: '#cd7f32', border: 'rgba(205, 127, 50, 0.6)', bg: 'rgba(205, 127, 50, 0.15)', glow: '0 0 18px rgba(205, 127, 50, 0.5)' },
      silver: { color: '#c0c0c0', border: 'rgba(192, 192, 192, 0.6)', bg: 'rgba(192, 192, 192, 0.15)', glow: '0 0 18px rgba(192, 192, 192, 0.5)' },
      gold: { color: '#ffd700', border: 'rgba(255, 215, 0, 0.7)', bg: 'rgba(245, 158, 11, 0.15)', glow: '0 0 20px rgba(255, 215, 0, 0.6)' },
      platinum: { color: '#00b4d8', border: 'rgba(0, 180, 216, 0.75)', bg: 'rgba(0, 180, 216, 0.15)', glow: '0 0 20px rgba(0, 180, 216, 0.6)' },
      diamond: { color: '#00bfff', border: 'rgba(0, 191, 255, 0.8)', bg: 'rgba(0, 191, 255, 0.15)', glow: '0 0 22px rgba(0, 191, 255, 0.7)' },
      master: { color: '#9370db', border: 'rgba(147, 112, 219, 0.8)', bg: 'rgba(147, 112, 219, 0.15)', glow: '0 0 24px rgba(147, 112, 219, 0.8)' },
      heroic: { color: '#9370db', border: 'rgba(147, 112, 219, 0.8)', bg: 'rgba(147, 112, 219, 0.15)', glow: '0 0 24px rgba(147, 112, 219, 0.8)' },
      grandmaster: { color: '#ff4500', border: 'rgba(255, 69, 0, 0.9)', bg: 'rgba(255, 69, 0, 0.15)', glow: '0 0 28px rgba(255, 69, 0, 0.9)' }
    }
  },

  // Rank Colors Direct Mapping
  rankColors: {
    bronze: '#cd7f32',
    silver: '#c0c0c0',
    gold: '#ffd700',
    platinum: '#00b4d8',
    diamond: '#00bfff',
    master: '#9370db',
    heroic: '#9370db',
    grandmaster: '#ff4500'
  },

  // ── 2. Typography ───────────────────────────────────────────────────────────
  typography: {
    fontFamily: {
      sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      mono: "'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace"
    },
    fontSize: {
      '2xs': '8px',
      xs: '11px',
      sm: '12px',
      base: '14px',
      md: '14px',
      lg: '16px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '28px',
      '4xl': '34px',
      timer: '30px',
      hero: '68px'
    },
    fontWeight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
      black: 900
    },
    lineHeight: {
      none: 1,
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75
    },
    letterSpacing: {
      tighter: '-0.03em',
      tight: '-0.01em',
      normal: '0',
      wide: '0.05em',
      wider: '0.08em',
      widest: '0.12em'
    }
  },

  // ── 3. Spacing Scale ────────────────────────────────────────────────────────
  spacing: {
    '0': '0px',
    '1': '4px',
    '2': '8px',
    '3': '12px',
    '4': '16px',
    '5': '20px',
    '6': '24px',
    '8': '32px',
    '10': '40px',
    none: '0',
    '2xs': '2px',
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '28px',
    '4xl': '32px',
    '5xl': '40px'
  },

  // ── 4. Border Radii ─────────────────────────────────────────────────────────
  radii: {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    '2xl': '20px',
    '3xl': '24px',
    '4xl': '20px',
    '5xl': '24px',
    pill: '999px',
    full: '9999px',
    circle: '50%'
  },

  // ── 5. Layout Bounds ────────────────────────────────────────────────────────
  layout: {
    hudWidth: '320px',
    hudMaxHeight: 'min(72vh, 480px)',
    popupWidth: '328px',
    sidebarWidth: '260px'
  },

  // ── 6. Z-Index Layers ───────────────────────────────────────────────────────
  zIndex: {
    base: 1,
    dropdown: 10,
    header: 100,
    sticky: 200,
    tooltip: 1000,
    hud: 2147483640,
    studyBanner: 2147483642,
    focusReminder: 2147483645,
    timeManagerModal: 2147483646,
    goalModeModal: 2147483647,
    modalBackdrop: 2147483646,
    modal: 2147483647,
    overlay: 2147483647
  },

  // ── 7. Transitions & Motion ─────────────────────────────────────────────────
  transitions: {
    fast: '0.15s ease',
    normal: '0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    smooth: '0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: '0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    slow: '0.35s ease'
  },

  // ── 8. CSS Custom Properties Map & String Generators ────────────────────────
  toCSSVariables() {
    return {
      '--gm-bg-base': this.colors.bg.base,
      '--gm-bg-gradient': this.colors.bg.radialGradient,
      '--gm-bg-glass-panel': this.colors.bg.glassPanelDense,
      '--gm-bg-glass-card': this.colors.bg.glassCard,
      '--gm-bg-glass-card-hover': this.colors.bg.glassCardHover,
      '--gm-bg-glass-header': this.colors.bg.glassHeader,
      '--gm-accent-indigo': this.colors.accents.indigo,
      '--gm-accent-indigo-hover': this.colors.accents.indigoHover,
      '--gm-accent-purple': this.colors.accents.purple,
      '--gm-accent-purple-light': this.colors.accents.purpleLight,
      '--gm-accent-emerald': this.colors.accents.emerald,
      '--gm-accent-gold': this.colors.accents.gold,
      '--gm-accent-sky': this.colors.accents.sky,
      '--gm-accent-danger': this.colors.accents.danger,
      '--gm-accent-gradient': this.colors.gradients.brand,
      '--gm-emerald-gradient': this.colors.gradients.emerald,
      '--gm-study-gradient': this.colors.gradients.studyHero,
      '--gm-text-primary': this.colors.text.primary,
      '--gm-text-secondary': this.colors.text.secondary,
      '--gm-text-muted': this.colors.text.muted,
      '--gm-text-subtle': this.colors.text.subtle,
      '--gm-border-glass': this.colors.borders.glass,
      '--gm-border-glass-hover': this.colors.borders.glassHover,
      '--gm-border-glass-strong': this.colors.borders.glassStrong,
      '--gm-shadow-glass': this.colors.shadows.glass,
      '--gm-shadow-hud': this.colors.shadows.glassDeep,
      '--gm-shadow-modal': this.colors.shadows.modal,
      '--gm-font-sans': this.typography.fontFamily.sans,
      '--gm-radius-sm': this.radii.sm,
      '--gm-radius-md': this.radii.md,
      '--gm-radius-lg': this.radii.lg,
      '--gm-radius-xl': this.radii.xl,
      '--gm-radius-2xl': this.radii['2xl'],
      '--gm-radius-pill': this.radii.pill,
      '--gm-bg-canvas': this.colors.bg.base,
      '--gm-bg-card': 'rgba(15, 23, 42, 0.88)',
      '--gm-bg-glass': this.colors.bg.glassCard,
      '--gm-blur': '16px',
      '--gm-transition': this.transitions.normal,
      '--gm-transition-normal': this.transitions.normal
    };
  },

  toCssVariables() {
    const vars = this.toCSSVariables();
    const declarations = Object.entries(vars)
      .map(([key, val]) => `  ${key}: ${val};`)
      .join('\n');
    return `:root {\n${declarations}\n}`;
  }
};

// ── 9. Universal Module Exports ───────────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.DesignTokens = DesignTokens;
}
if (typeof global !== 'undefined' && global.window) {
  global.window.DesignTokens = DesignTokens;
}
if (typeof globalThis !== 'undefined') {
  globalThis.DesignTokens = DesignTokens;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DesignTokens;
}
