# Handoff Report — Milestone 2 Explorer 2: Shared Design Tokens & CSS Harmonization

**Agent**: Explorer 2 (`explorer_m2_2_iter2`)  
**Working Directory**: `/Users/shivarampatel/Desktop/shorts-shield/.agents/explorer_m2_2_iter2`  
**Date**: 2026-08-15  
**Target Scope**: `utils/design-tokens.js`, `content/css/header-button.css`, `popup/popup.css`, `options/options.css`, `manifest.json`, `popup/popup.html`, `options/options.html`  
**Requirements Addressed**: R1 (Visual Polish & Theming), R3 (Shared Design Tokens & Code Organization)

---

## 1. Observation

Direct observations from examining the codebase:

### 1.1 `utils/design-tokens.js` Status
- **Finding**: `utils/design-tokens.js` does **not** currently exist in the filesystem (`find_by_name` returned 0 results).
- **Impact**: There is no centralized single source of truth for color constants, spacing scales, font sizes, transitions, z-index layers, or badge tiers across the extension.

### 1.2 Fragmented CSS Custom Properties across UI Surfaces
Comparing CSS variable declarations across `popup/popup.css` and `options/options.css`:

1. **`popup/popup.css` (Lines 3–32)**:
   ```css
   :root {
     --bg-dark: #0b0f19;
     --bg-gradient: radial-gradient(circle at 50% 0%, #1e1b4b 0%, #0f172a 60%, #0b0f19 100%);
     --glass-bg: rgba(30, 41, 59, 0.55);
     --glass-panel: rgba(15, 23, 42, 0.65);
     --glass-card: rgba(30, 41, 59, 0.45);
     --glass-border: rgba(255, 255, 255, 0.08);
     --glass-border-hover: rgba(255, 255, 255, 0.18);
     --glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
     --accent-indigo: #6366f1;
     --accent-purple: #a855f7;
     --accent-emerald: #10b981;
     --accent-gold: #f59e0b;
     --accent-sky: #38bdf8;
     --accent-gradient: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
     --emerald-gradient: linear-gradient(135deg, #10b981 0%, #059669 100%);
     --text-primary: #f8fafc;
     --text-secondary: #94a3b8;
     --text-muted: #64748b;
     --glow-indigo: 0 0 14px rgba(99, 102, 241, 0.5);
     --glow-emerald: 0 0 14px rgba(16, 185, 129, 0.5);
     --glow-gold: 0 0 14px rgba(245, 158, 11, 0.4);
   }
   ```

2. **`options/options.css` (Lines 6–38)**:
   ```css
   :root {
     --bg-color: #0b0f19;
     --bg-gradient: radial-gradient(circle at 50% 0%, #1e1b4b 0%, #0b0f19 75%);
     --sidebar-bg: rgba(15, 23, 42, 0.75);
     --card-bg: rgba(30, 41, 59, 0.7);
     --card-bg-hover: rgba(30, 41, 59, 0.85);
     --text-primary: #f8fafc;
     --text-secondary: #cbd5e1;
     --text-muted: #94a3b8;
     --accent-color: #6366f1;
     --accent-gradient: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
     --accent-hover: #4f46e5;
     --accent-glow: rgba(99, 102, 241, 0.5);
     --success-color: #10b981;
     --success-glow: rgba(16, 185, 129, 0.4);
     --warning-color: #fbbf24;
     --warning-glow: rgba(251, 191, 36, 0.4);
     --purple-accent: #a855f7;
     --purple-glow: rgba(168, 85, 247, 0.4);
     --border-color: rgba(255, 255, 255, 0.08);
     --border-glow: rgba(168, 85, 247, 0.35);
     --glass-blur: blur(12px);
     --glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4);
     --glass-highlight: inset 0 1px 0 0 rgba(255, 255, 255, 0.1);
     --font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
   }
   ```
   *Inconsistency Identified*:
   - Background variable: `--bg-dark` in popup vs `--bg-color` in options.
   - Card background: `--glass-card` (`0.45` alpha) in popup vs `--card-bg` (`0.7` alpha) in options.
   - Text secondary: `#94a3b8` in popup vs `#cbd5e1` in options.
   - Accent color: `--accent-indigo` in popup vs `--accent-color` in options.
   - Success/Warning: `--accent-emerald`/`--accent-gold` in popup vs `--success-color`/`--warning-color` in options.

3. **`content/css/header-button.css`**:
   - **Lines 76–97 (`.ss-popup-dialog`)**: Uses hardcoded `background-color: rgba(15, 15, 15, 0.92); backdrop-filter: blur(16px); color: #f7fafc; border-radius: 16px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.12);`.
   - **Lines 208–210 (`.ss-popup-header`)**: Uses hardcoded `background-color: rgba(33, 33, 33, 0.85); border-bottom: 1px solid rgba(255, 255, 255, 0.08);`.
   - **Lines 295–302 (`.ss-popup-study-card`)**: Uses `background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);` (solid bright blue), whereas popup uses a dark purple-indigo glass card `linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.2) 100%)`.
   - **Lines 147–176 (`.ss-section`, `.ss-section-header`)**: Uses `#94a3b8`, `#a78bfa`, and `rgba(255,255,255,0.06)` directly.

### 1.3 Gamification Tier & Badge Color Integration
`utils/gamification-engine.js` lines 43–50 defines rank tiers with exact metallic/tier hex codes:
- Bronze: `#CD7F32`
- Silver: `#C0C0C0`
- Gold: `#FFD700`
- Diamond: `#00BFFF`
- Heroic: `#9370DB`
- Grandmaster: `#FF4500`

`options/options.css` lines 747–752 defines corresponding border & box-shadow styles (`.rank-bronze`, `.rank-silver`, `.rank-gold`, `.rank-diamond`, `.rank-heroic`, `.rank-grandmaster`).

### 1.4 Manifest and HTML Script Ingestion
- `manifest.json` `content_scripts[0].js` loads:
  `["utils/dom-utils.js", "utils/audio-engine.js", "utils/gamification-engine.js", "utils/storage.js", "utils/time-tracker.js", ...]`
  `utils/design-tokens.js` must be added before content scripts execute.
- `popup/popup.html` (lines 282–285) and `options/options.html` (lines 605–609) load `storage.js`, `audio-engine.js`, `gamification-engine.js`. They should also include `design-tokens.js`.

---

## 2. Logic Chain

1. **Requirement R3** mandates extracting shared design tokens (colors, spacing, typography, radii, z-index, transitions) into one unified JavaScript module (`utils/design-tokens.js`) for visual consistency across HUD, popup, and options pages.
2. **Universal Module Pattern**: To support both Node.js automated test environments (`require()`), Chrome Extension Content Scripts (window/global scope), and Extension HTML pages (DOM `<script>`), `utils/design-tokens.js` must export via:
   ```javascript
   if (typeof window !== 'undefined') window.DesignTokens = DesignTokens;
   if (typeof globalThis !== 'undefined') globalThis.DesignTokens = DesignTokens;
   if (typeof module !== 'undefined' && module.exports) module.exports = DesignTokens;
   ```
3. **Harmonized CSS Variable System (`--gm-*`)**:
   - Establishing the `--gm-*` namespace (`--gm-bg-base`, `--gm-accent-indigo`, `--gm-accent-purple`, `--gm-text-primary`, `--gm-border-glass`, etc.) provides a single clear naming convention.
   - Retaining existing legacy aliases (`--bg-dark`, `--accent-color`, `--card-bg`, etc.) mapped to `--gm-*` variables ensures 100% backward compatibility with existing styles without breaking any visual components or tests.
4. **Visual Polish without Rebranding (Requirement R1)**:
   - Harmonizing the HUD Study Card (`.ss-popup-study-card`) from raw opaque blue (`#1e40af` -> `#3b82f6`) to the refined purple-indigo glassmorphism (`linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(168, 85, 247, 0.25) 100%)`) eliminates the visual clash between the HUD and popup while preserving the dark purple aesthetic.
   - Aligning scrollbars, section chevrons (`#a78bfa`), borders, and active glow rings (`rgba(99, 102, 241, 0.5)`) delivers a cohesive, sleek UI across all surfaces.

---

## 3. Caveats

- **No CSS Rebranding**: Do NOT change brand colors away from the signature Dark Obsidian + Indigo/Purple palette (`#0b0f19`, `#6366f1`, `#a855f7`).
- **Preserve Element IDs**: All 20+ HUD element IDs (`#ss-popup-dialog`, `#ss-toggle-master`, `#ss-vol-slider`, `#ss-bass-slider`, `#ss-eq-rack`, etc.) and popup/options IDs must remain untouched.
- **Node.js Test Runner Compatibility**: `utils/design-tokens.js` must not throw when required in a pure Node environment where `window` or `document` is undefined.
- **Zero External Dependencies**: Tokens must be plain JavaScript objects with zero third-party packages.

---

## 4. Conclusion & Technical Specifications

### 4.1 Specification: `utils/design-tokens.js`

Create `/Users/shivarampatel/Desktop/shorts-shield/utils/design-tokens.js` with the following comprehensive schema:

```javascript
/**
 * GodMode Chrome Extension — Universal Shared Design Tokens
 * 
 * Centralized single source of truth for the GodMode Design System.
 * Supports Node.js (CommonJS), Chrome MV3 Service Worker, Browser Window, and Web Worker contexts.
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
      glassPanel: 'rgba(15, 23, 42, 0.75)',
      glassPanelDense: 'rgba(15, 15, 26, 0.94)',
      glassCard: 'rgba(30, 41, 59, 0.70)',
      glassCardLight: 'rgba(30, 41, 59, 0.45)',
      glassCardHover: 'rgba(30, 41, 59, 0.85)',
      glassModal: 'rgba(15, 15, 26, 0.92)',
      glassHeader: 'rgba(33, 33, 33, 0.85)',
      input: 'rgba(15, 23, 42, 0.75)',
      sidebar: 'rgba(15, 23, 42, 0.75)'
    },

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
      pink: '#ec4899'
    },

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
      accentIndigo: '#818cf8',
      accentPurple: '#c084fc',
      accentEmerald: '#34d399',
      accentGold: '#fbbf24',
      accentSky: '#38bdf8',
      accentDanger: '#f87171'
    },

    // Glass Borders
    borders: {
      glass: 'rgba(255, 255, 255, 0.08)',
      glassHover: 'rgba(255, 255, 255, 0.18)',
      glassSubtle: 'rgba(255, 255, 255, 0.05)',
      glassStrong: 'rgba(255, 255, 255, 0.12)',
      glowIndigo: 'rgba(99, 102, 241, 0.40)',
      glowPurple: 'rgba(168, 85, 247, 0.35)',
      glowEmerald: 'rgba(16, 185, 129, 0.40)',
      glowGold: 'rgba(251, 191, 36, 0.40)'
    },

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
      diamond: { color: '#00bfff', border: 'rgba(0, 191, 255, 0.8)', bg: 'rgba(0, 191, 255, 0.15)', glow: '0 0 22px rgba(0, 191, 255, 0.7)' },
      heroic: { color: '#9370db', border: 'rgba(147, 112, 219, 0.8)', bg: 'rgba(147, 112, 219, 0.15)', glow: '0 0 24px rgba(147, 112, 219, 0.8)' },
      grandmaster: { color: '#ff4500', border: 'rgba(255, 69, 0, 0.9)', bg: 'rgba(255, 69, 0, 0.15)', glow: '0 0 28px rgba(255, 69, 0, 0.9)' }
    }
  },

  // ── 2. Typography ───────────────────────────────────────────────────────────
  typography: {
    fontFamily: {
      sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      mono: "'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace"
    },
    fontSize: {
      '2xs': '8px',
      xs: '10px',
      sm: '12px',
      md: '14px',
      lg: '16px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '28px',
      '4xl': '34px',
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
    lg: '10px',
    xl: '12px',
    '2xl': '14px',
    '3xl': '16px',
    '4xl': '20px',
    '5xl': '24px',
    pill: '999px',
    circle: '50%'
  },

  // ── 5. Z-Index Layers ───────────────────────────────────────────────────────
  zIndex: {
    base: 1,
    dropdown: 10,
    header: 100,
    tooltip: 1000,
    hud: 2147483640,
    modalBackdrop: 2147483646,
    modal: 2147483647
  },

  // ── 6. Transitions & Motion ─────────────────────────────────────────────────
  transitions: {
    fast: '0.15s ease',
    normal: '0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    smooth: '0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: '0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    slow: '0.35s ease'
  },

  // ── 7. CSS Custom Properties Map Generator ──────────────────────────────────
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
      '--gm-radius-2xl': this.radii['4xl'],
      '--gm-radius-pill': this.radii.pill,
      '--gm-transition-normal': this.transitions.normal
    };
  }
};

// ── 8. Universal Module Exports ───────────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.DesignTokens = DesignTokens;
}
if (typeof globalThis !== 'undefined') {
  globalThis.DesignTokens = DesignTokens;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DesignTokens;
}
```

---

### 4.2 CSS Harmonization Mapping

#### A. Scoped Theming in `content/css/header-button.css`
Add at the top of `header-button.css`:
```css
:root, .godmode-hud-theme, .ss-popup-dialog {
  --gm-bg-base: #0b0f19;
  --gm-bg-glass-panel: rgba(15, 15, 26, 0.94);
  --gm-bg-glass-header: rgba(33, 33, 33, 0.85);
  --gm-border-glass: rgba(255, 255, 255, 0.08);
  --gm-border-glass-hover: rgba(255, 255, 255, 0.18);
  --gm-border-glass-strong: rgba(255, 255, 255, 0.12);
  --gm-accent-indigo: #6366f1;
  --gm-accent-purple: #a855f7;
  --gm-accent-purple-light: #a78bfa;
  --gm-accent-emerald: #10b981;
  --gm-accent-gold: #f59e0b;
  --gm-accent-sky: #38bdf8;
  --gm-accent-danger: #ef4444;
  --gm-accent-gradient: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
  --gm-emerald-gradient: linear-gradient(135deg, #10b981 0%, #059669 100%);
  --gm-study-gradient: linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(168, 85, 247, 0.25) 100%);
  --gm-text-primary: #f8fafc;
  --gm-text-secondary: #cbd5e1;
  --gm-text-muted: #94a3b8;
  --gm-text-subtle: #64748b;
  --gm-shadow-hud: 0 20px 40px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.12);
  --gm-shadow-modal: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(99, 102, 241, 0.12);
  --gm-font-sans: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --gm-radius-sm: 6px;
  --gm-radius-md: 10px;
  --gm-radius-lg: 12px;
  --gm-radius-xl: 16px;
  --gm-radius-2xl: 20px;
  --gm-radius-pill: 999px;
  --gm-transition-fast: 0.15s ease;
  --gm-transition-normal: 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  --gm-transition-smooth: 0.25s ease;
}
```

Update key HUD rules:
- `.ss-popup-dialog`: `background-color: var(--gm-bg-glass-panel, rgba(15, 15, 26, 0.94)) !important; border-radius: var(--gm-radius-xl, 16px) !important; font-family: var(--gm-font-sans) !important;`
- `.ss-popup-header`: `background-color: var(--gm-bg-glass-header, rgba(33, 33, 33, 0.85)) !important; border-bottom: 1px solid var(--gm-border-glass, rgba(255, 255, 255, 0.08)) !important;`
- `.ss-popup-study-card`: `background: var(--gm-study-gradient, linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(168, 85, 247, 0.25) 100%)) !important; border: 1px solid var(--gm-border-glass-strong, rgba(255, 255, 255, 0.12)) !important;`
- `.ss-section-header`: `color: var(--gm-text-muted, #94a3b8) !important; font-family: var(--gm-font-sans) !important;`
- `.ss-section-header.ss-expanded`: `color: var(--gm-accent-purple-light, #a78bfa) !important;`
- `.ss-minimize-btn:hover`: `color: var(--gm-accent-purple-light, #a78bfa) !important; background: rgba(167, 139, 250, 0.12) !important;`

#### B. Harmonization in `popup/popup.css` & `options/options.css`
Map legacy variables to `--gm-*` properties in `:root`:
- Both `:root` blocks expose `--gm-*` unified tokens.
- All legacy variables (`--bg-dark`, `--bg-color`, `--glass-panel`, `--sidebar-bg`, `--accent-indigo`, `--accent-color`, etc.) point directly to `var(--gm-*)`.
- This ensures existing class names and future extensions access the same shared design tokens.

---

### 4.3 Proposed Unit Test Suite: `tests/tier1/design-tokens.test.js`

To verify design tokens integrity across Node and browser contexts, add `tests/tier1/design-tokens.test.js`:

```javascript
/**
 * Tier 1 Unit Test: Shared Design Tokens & Theme Harmonization
 */

const { assertEqual, assertTrue } = require('../harness/test-helpers');
const DesignTokens = require('../../utils/design-tokens');

module.exports = async function runDesignTokensTestSuite() {
  console.log('  Testing DesignTokens Schema & Universal Export...');

  // Test 1: Module structure and immutability checks
  assertTrue(typeof DesignTokens === 'object' && DesignTokens !== null, 'DesignTokens must be an object');
  assertTrue(typeof DesignTokens.colors === 'object', 'DesignTokens.colors must exist');
  assertTrue(typeof DesignTokens.typography === 'object', 'DesignTokens.typography must exist');
  assertTrue(typeof DesignTokens.spacing === 'object', 'DesignTokens.spacing scale must exist');
  assertTrue(typeof DesignTokens.radii === 'object', 'DesignTokens.radii must exist');
  assertTrue(typeof DesignTokens.zIndex === 'object', 'DesignTokens.zIndex layers must exist');
  assertTrue(typeof DesignTokens.transitions === 'object', 'DesignTokens.transitions must exist');
  assertTrue(typeof DesignTokens.toCSSVariables === 'function', 'DesignTokens.toCSSVariables() must be a function');

  // Test 2: Core Color Palette verification
  assertEqual(DesignTokens.colors.bg.base, '#0b0f19', 'Base background must be #0b0f19');
  assertEqual(DesignTokens.colors.accents.indigo, '#6366f1', 'Accent indigo must be #6366f1');
  assertEqual(DesignTokens.colors.accents.purple, '#a855f7', 'Accent purple must be #a855f7');
  assertEqual(DesignTokens.colors.accents.emerald, '#10b981', 'Accent emerald must be #10b981');
  assertEqual(DesignTokens.colors.text.primary, '#f8fafc', 'Primary text must be #f8fafc');

  // Test 3: Badge Tiers definition
  assertTrue(DesignTokens.colors.badgeTiers.bronze.color === '#cd7f32', 'Bronze tier color match');
  assertTrue(DesignTokens.colors.badgeTiers.gold.color === '#ffd700', 'Gold tier color match');
  assertTrue(DesignTokens.colors.badgeTiers.grandmaster.color === '#ff4500', 'Grandmaster tier color match');

  // Test 4: CSS Variable generation
  const cssVars = DesignTokens.toCSSVariables();
  assertTrue(typeof cssVars === 'object', 'toCSSVariables returns key-value object');
  assertEqual(cssVars['--gm-bg-base'], '#0b0f19', '--gm-bg-base variable correctly mapped');
  assertEqual(cssVars['--gm-accent-indigo'], '#6366f1', '--gm-accent-indigo variable correctly mapped');
  assertEqual(cssVars['--gm-accent-purple'], '#a855f7', '--gm-accent-purple variable correctly mapped');
  assertEqual(cssVars['--gm-text-primary'], '#f8fafc', '--gm-text-primary variable correctly mapped');

  // Test 5: Universal export availability in global scope
  assertTrue(typeof global.DesignTokens !== 'undefined' || typeof window.DesignTokens !== 'undefined', 'DesignTokens registered in global/window scope');
};
```

---

## 5. Verification Method

### 5.1 Verification Commands
Run the master test runner and syntax validator:
```bash
# 1. Static syntax check across all JavaScript files (including new design-tokens.js and tests)
node tests/syntax/syntax-checker.js

# 2. Master automated test suite (must pass 100% clean across all 4 tiers)
npm test
```

### 5.2 Specific Code Verification Checklist
1. **File Existence & Syntax**:
   - `utils/design-tokens.js` exists and passes `node -c utils/design-tokens.js`.
   - `tests/tier1/design-tokens.test.js` exists and passes `node -c tests/tier1/design-tokens.test.js`.
2. **Manifest and HTML Linkage**:
   - `manifest.json`: `"utils/design-tokens.js"` is listed under `content_scripts[0].js`.
   - `popup/popup.html`: Contains `<script src="../utils/design-tokens.js"></script>`.
   - `options/options.html`: Contains `<script src="../utils/design-tokens.js"></script>`.
3. **CSS Variable Harmonization**:
   - `content/css/header-button.css`: Scoped root `--gm-*` custom properties present.
   - `popup/popup.css`: Scoped root `--gm-*` custom properties present.
   - `options/options.css`: Scoped root `--gm-*` custom properties present.
4. **Visual Polish**:
   - HUD Study Card (`.ss-popup-study-card`) uses harmonized glassmorphic gradient instead of harsh solid blue.
   - HUD scrollbar, minimize pill button, and collapsible accordion chevrons use `#a78bfa` and sleek purple glass styling.

### 5.3 Invalidation Conditions
- Any syntax error reported by `node tests/syntax/syntax-checker.js`.
- Any regression or test failure in `npm test` (all 331+ tests must pass).
- Any broken reference to existing element IDs or CSS classes.
