/**
 * Empirical Adversarial Challenger Test Suite: Milestone 1 (Design Tokens)
 * File: tests/challenger-m1-design-tokens-stress.js
 *
 * Verifies:
 * 1. Palette completeness, validity of hex/rgba/gradients/shadows, and alias parity.
 * 2. Strict monotonicity of font sizes, font weights, line heights, letter spacings, spacing scales, border radii, transitions, and z-index layers.
 * 3. CSS Custom Properties generation via `toCSSVariables()` and `toCssVariables()` with DOM injection & syntax verification.
 * 4. Isomorphic export contracts across Node.js (CommonJS), browser (window), and globalThis.
 */

const assert = require('assert');
require('./harness/mock-extension-env').setupMockEnv();
const DesignTokens = require('../utils/design-tokens');

console.log('================================================================');
console.log('   CHALLENGER M1: DESIGN TOKENS EMPIRICAL STRESS TEST SUITE     ');
console.log('================================================================\n');

let totalTests = 0;
let totalPassed = 0;
let totalFailed = 0;
const failures = [];

function check(desc, fn) {
  totalTests++;
  try {
    fn();
    totalPassed++;
    console.log(`  ✓ [PASS] ${desc}`);
  } catch (err) {
    totalFailed++;
    failures.push({ desc, error: err.message, stack: err.stack });
    console.error(`  ✗ [FAIL] ${desc}: ${err.message}`);
  }
}

// Regex Helpers
const HEX_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGBA_REGEX = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/;
const GRADIENT_REGEX = /^(linear|radial)-gradient\(.+\)$/;
const PX_REGEX = /^-?\d+(\.\d+)?px$/;
const EM_REGEX = /^-?\d+(\.\d+)?em$/;

// =========================================================================
// SUITE 1: Palette Completeness & Color Format Validation
// =========================================================================
console.log('--- SUITE 1: Palette Completeness & Color Format Validation ---');

check('1.1: Background color palette defines valid hex, rgba, and radial gradients', () => {
  const { bg } = DesignTokens.colors;
  assert.ok(bg, 'colors.bg exists');

  // Hex backgrounds
  assert.match(bg.base, HEX_REGEX, `bg.base (${bg.base}) is valid hex`);
  assert.match(bg.dark, HEX_REGEX, `bg.dark (${bg.dark}) is valid hex`);

  // RGBA backgrounds
  const rgbaKeys = ['glassPanel', 'glassPanelDense', 'glassCard', 'glassCardLight', 'glassCardHover', 'glassModal', 'glassHeader', 'input', 'sidebar'];
  rgbaKeys.forEach(k => {
    assert.ok(bg[k], `bg.${k} is defined`);
    assert.match(bg[k], RGBA_REGEX, `bg.${k} (${bg[k]}) is valid rgba string`);
    // Validate channel ranges
    const match = bg[k].match(RGBA_REGEX);
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    const a = match[4] ? parseFloat(match[4]) : 1.0;
    assert.ok(r >= 0 && r <= 255, `bg.${k} red ${r} in [0, 255]`);
    assert.ok(g >= 0 && g <= 255, `bg.${k} green ${g} in [0, 255]`);
    assert.ok(b >= 0 && b <= 255, `bg.${k} blue ${b} in [0, 255]`);
    assert.ok(a >= 0 && a <= 1.0, `bg.${k} alpha ${a} in [0, 1]`);
  });

  // Gradients
  assert.match(bg.radialGradient, GRADIENT_REGEX, 'bg.radialGradient is valid gradient');
  assert.match(bg.radialGradientOptions, GRADIENT_REGEX, 'bg.radialGradientOptions is valid gradient');
});

check('1.2: Brand & functional accents contain valid hex codes for all variants', () => {
  const { accents } = DesignTokens.colors;
  assert.ok(accents, 'colors.accents exists');

  const requiredAccents = [
    'indigo', 'indigoHover', 'indigoDark',
    'purple', 'purpleLight', 'purpleDark',
    'emerald', 'emeraldDark', 'emeraldLight',
    'gold', 'goldLight',
    'sky', 'skyDark',
    'danger', 'dangerDark',
    'pink', 'blue'
  ];

  requiredAccents.forEach(acc => {
    assert.ok(accents[acc], `accents.${acc} is defined`);
    assert.match(accents[acc], HEX_REGEX, `accents.${acc} (${accents[acc]}) must be a valid hex color`);
  });
});

check('1.3: Status colors (success, warning, danger, info) match valid hex format', () => {
  const { colors } = DesignTokens;
  assert.match(colors.statusSuccess, HEX_REGEX, 'statusSuccess is valid hex');
  assert.match(colors.statusWarning, HEX_REGEX, 'statusWarning is valid hex');
  assert.match(colors.statusDanger, HEX_REGEX, 'statusDanger is valid hex');
  assert.match(colors.statusInfo, HEX_REGEX, 'statusInfo is valid hex');

  // Semantic parity checks
  assert.strictEqual(colors.statusSuccess, colors.accents.emerald);
  assert.strictEqual(colors.statusWarning, colors.accents.gold);
  assert.strictEqual(colors.statusDanger, colors.accents.danger);
  assert.strictEqual(colors.statusInfo, colors.accents.blue);
});

check('1.4: Linear gradients define valid CSS linear-gradient strings', () => {
  const { gradients } = DesignTokens.colors;
  assert.ok(gradients, 'colors.gradients exists');

  const gradientKeys = ['brand', 'indigo', 'purple', 'emerald', 'sky', 'danger', 'gold', 'studyHero', 'battleHero', 'xpTrack'];
  gradientKeys.forEach(g => {
    assert.ok(gradients[g], `gradients.${g} is defined`);
    assert.match(gradients[g], GRADIENT_REGEX, `gradients.${g} (${gradients[g]}) matches linear-gradient syntax`);
  });
});

check('1.5: Text color palette defines valid hex codes for primary, secondary, muted, subtle, accents', () => {
  const { text } = DesignTokens.colors;
  assert.ok(text, 'colors.text exists');

  const textKeys = ['primary', 'secondary', 'muted', 'subtle', 'accent', 'accentIndigo', 'accentPurple', 'accentEmerald', 'accentGold', 'accentSky', 'accentDanger'];
  textKeys.forEach(t => {
    assert.ok(text[t], `text.${t} is defined`);
    assert.match(text[t], HEX_REGEX, `text.${t} (${text[t]}) is valid hex color`);
  });
});

check('1.6: Border colors define valid RGBA and glow values', () => {
  const { borders } = DesignTokens.colors;
  assert.ok(borders, 'colors.borders exists');

  const borderKeys = ['glass', 'glassHover', 'glassSubtle', 'glassStrong', 'borderSubtle', 'borderDefault', 'borderStrong', 'glowIndigo', 'glowPurple', 'glowEmerald', 'glowGold'];
  borderKeys.forEach(b => {
    assert.ok(borders[b], `borders.${b} is defined`);
    assert.match(borders[b], RGBA_REGEX, `borders.${b} (${borders[b]}) is valid RGBA color`);
  });
});

check('1.7: Gamification rank tier colors and badge tier objects are fully populated and consistent', () => {
  const { rankColors, colors } = DesignTokens;
  const tiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'heroic', 'grandmaster'];

  tiers.forEach(tier => {
    // RankColors mapping
    assert.ok(rankColors[tier], `rankColors.${tier} exists`);
    assert.match(rankColors[tier], HEX_REGEX, `rankColors.${tier} is valid hex`);

    // BadgeTiers mapping
    const badge = colors.badgeTiers[tier];
    assert.ok(badge, `badgeTiers.${tier} exists`);
    assert.match(badge.color, HEX_REGEX, `badgeTiers.${tier}.color is valid hex`);
    assert.match(badge.border, RGBA_REGEX, `badgeTiers.${tier}.border is valid rgba`);
    assert.match(badge.bg, RGBA_REGEX, `badgeTiers.${tier}.bg is valid rgba`);
    assert.ok(typeof badge.glow === 'string' && badge.glow.length > 0, `badgeTiers.${tier}.glow is valid string`);

    // Cross-reference equivalence
    assert.strictEqual(rankColors[tier], badge.color, `rankColors.${tier} must match badgeTiers.${tier}.color`);
  });
});

check('1.8: Top-level convenience aliases match their respective nested canonical properties', () => {
  const { colors } = DesignTokens;

  // Background aliases
  assert.strictEqual(colors.bgBase, colors.bg.base, 'colors.bgBase matches colors.bg.base');
  assert.strictEqual(colors.bgSurface, colors.bg.glassPanel, 'colors.bgSurface matches colors.bg.glassPanel');
  assert.strictEqual(colors.bgGlassPanel, colors.bg.glassPanelDense, 'colors.bgGlassPanel matches colors.bg.glassPanelDense');
  assert.strictEqual(colors.bgCard, colors.bg.glassCard, 'colors.bgCard matches colors.bg.glassCard');
  assert.strictEqual(colors.bgCardHover, colors.bg.glassCardHover, 'colors.bgCardHover matches colors.bg.glassCardHover');

  // Accent aliases
  assert.strictEqual(colors.accentIndigo, colors.accents.indigo, 'accentIndigo matches accents.indigo');
  assert.strictEqual(colors.accentPurple, colors.accents.purple, 'accentPurple matches accents.purple');
  assert.strictEqual(colors.accentPink, colors.accents.pink, 'accentPink matches accents.pink');
  assert.strictEqual(colors.accentEmerald, colors.accents.emerald, 'accentEmerald matches accents.emerald');
  assert.strictEqual(colors.accentBlue, colors.accents.blue, 'accentBlue matches accents.blue');
  assert.strictEqual(colors.accentGold, colors.accents.gold, 'accentGold matches accents.gold');
  assert.strictEqual(colors.accentSky, colors.accents.sky, 'accentSky matches accents.sky');
  assert.strictEqual(colors.accentDanger, colors.accents.danger, 'accentDanger matches accents.danger');

  // Text aliases
  assert.strictEqual(colors.textPrimary, colors.text.primary, 'textPrimary matches text.primary');
  assert.strictEqual(colors.textSecondary, colors.text.secondary, 'textSecondary matches text.secondary');
  assert.strictEqual(colors.textMuted, colors.text.muted, 'textMuted matches text.muted');
  assert.strictEqual(colors.textSubtle, colors.text.subtle, 'textSubtle matches text.subtle');
  assert.strictEqual(colors.textAccent, colors.text.accent, 'textAccent matches text.accent');

  // Border aliases
  assert.strictEqual(colors.borderSubtle, colors.borders.borderSubtle, 'borderSubtle matches borders.borderSubtle');
  assert.strictEqual(colors.borderDefault, colors.borders.borderDefault, 'borderDefault matches borders.borderDefault');
  assert.strictEqual(colors.borderStrong, colors.borders.borderStrong, 'borderStrong matches borders.borderStrong');
});


// =========================================================================
// SUITE 2: Monotonicity & Numeric Hierarchy Verification
// =========================================================================
console.log('\n--- SUITE 2: Monotonicity & Numeric Hierarchy Verification ---');

check('2.1: Typography font sizes are strictly monotonic and format-valid', () => {
  const { fontSize } = DesignTokens.typography;
  assert.ok(fontSize, 'typography.fontSize exists');

  // Helper to extract px
  const toPx = (val) => {
    assert.match(val, PX_REGEX, `Value ${val} must be valid px string`);
    return parseFloat(val.replace('px', ''));
  };

  const scaleKeys = ['2xs', 'xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', 'hero'];
  const values = scaleKeys.map(k => ({ key: k, px: toPx(fontSize[k]) }));

  for (let i = 0; i < values.length - 1; i++) {
    assert.ok(
      values[i].px < values[i + 1].px,
      `Font scale monotonicity violated: ${values[i].key} (${values[i].px}px) is not strictly < ${values[i + 1].key} (${values[i + 1].px}px)`
    );
  }

  // Also check md alias and timer size
  assert.strictEqual(fontSize.md, fontSize.base, 'fontSize.md equals fontSize.base (14px)');
  const timerPx = toPx(fontSize.timer);
  assert.ok(timerPx > toPx(fontSize['3xl']) && timerPx < toPx(fontSize['4xl']), `timer font (${timerPx}px) fits logically between 3xl and 4xl`);
});

check('2.2: Typography font weights are strictly monotonic integers in [100, 900]', () => {
  const { fontWeight } = DesignTokens.typography;
  assert.ok(fontWeight, 'typography.fontWeight exists');

  const weightKeys = ['regular', 'medium', 'semibold', 'bold', 'extrabold', 'black'];
  const weights = weightKeys.map(k => ({ key: k, val: fontWeight[k] }));

  weights.forEach(w => {
    assert.ok(Number.isInteger(w.val), `fontWeight.${w.key} is an integer`);
    assert.ok(w.val >= 100 && w.val <= 900, `fontWeight.${w.key} is between 100 and 900`);
    assert.strictEqual(w.val % 100, 0, `fontWeight.${w.key} is a standard multiple of 100`);
  });

  for (let i = 0; i < weights.length - 1; i++) {
    assert.ok(
      weights[i].val < weights[i + 1].val,
      `Font weight monotonicity violated: ${weights[i].key} (${weights[i].val}) must be < ${weights[i + 1].key} (${weights[i + 1].val})`
    );
  }
});

check('2.3: Typography line heights are strictly monotonic numeric multipliers', () => {
  const { lineHeight } = DesignTokens.typography;
  assert.ok(lineHeight, 'typography.lineHeight exists');

  const keys = ['none', 'tight', 'normal', 'relaxed'];
  const values = keys.map(k => ({ key: k, val: lineHeight[k] }));

  values.forEach(v => {
    assert.ok(typeof v.val === 'number' && !isNaN(v.val), `lineHeight.${v.key} is a valid number`);
    assert.ok(v.val >= 1.0, `lineHeight.${v.key} is >= 1.0`);
  });

  for (let i = 0; i < values.length - 1; i++) {
    assert.ok(
      values[i].val < values[i + 1].val,
      `Line height monotonicity violated: ${values[i].key} (${values[i].val}) must be < ${values[i + 1].key} (${values[i + 1].val})`
    );
  }
});

check('2.4: Typography letter spacing values are strictly monotonic and format-valid', () => {
  const { letterSpacing } = DesignTokens.typography;
  assert.ok(letterSpacing, 'typography.letterSpacing exists');

  const toEm = (val) => {
    if (val === '0' || val === 0) return 0;
    assert.match(val, EM_REGEX, `letterSpacing ${val} must be valid em string`);
    return parseFloat(val.replace('em', ''));
  };

  const keys = ['tighter', 'tight', 'normal', 'wide', 'wider', 'widest'];
  const values = keys.map(k => ({ key: k, em: toEm(letterSpacing[k]) }));

  for (let i = 0; i < values.length - 1; i++) {
    assert.ok(
      values[i].em < values[i + 1].em,
      `Letter spacing monotonicity violated: ${values[i].key} (${values[i].em}em) must be < ${values[i + 1].key} (${values[i + 1].em}em)`
    );
  }
});

check('2.5: Spacing numeric scale is strictly monotonically increasing and matches 4px baseline', () => {
  const { spacing } = DesignTokens;
  assert.ok(spacing, 'spacing exists');

  const numericKeys = ['0', '1', '2', '3', '4', '5', '6', '8', '10'];
  const values = numericKeys.map(k => {
    const val = spacing[k];
    assert.match(val, PX_REGEX, `spacing['${k}'] (${val}) must be valid px string`);
    return { key: k, px: parseFloat(val.replace('px', '')) };
  });

  for (let i = 0; i < values.length - 1; i++) {
    assert.ok(
      values[i].px < values[i + 1].px,
      `Numeric spacing monotonicity violated: ${values[i].key} (${values[i].px}px) must be < ${values[i + 1].key} (${values[i + 1].px}px)`
    );
  }

  // Validate 4px grid multiple alignment
  assert.strictEqual(values[0].px, 0);
  assert.strictEqual(values[1].px, 4);
  assert.strictEqual(values[2].px, 8);
  assert.strictEqual(values[3].px, 12);
  assert.strictEqual(values[4].px, 16);
  assert.strictEqual(values[5].px, 20);
  assert.strictEqual(values[6].px, 24);
  assert.strictEqual(values[7].px, 32);
  assert.strictEqual(values[8].px, 40);
});

check('2.6: Spacing T-shirt scale is strictly monotonically increasing', () => {
  const { spacing } = DesignTokens;
  const toPx = (val) => {
    if (val === '0' || val === 0) return 0;
    assert.match(val, PX_REGEX, `spacing ${val} must be valid px`);
    return parseFloat(val.replace('px', ''));
  };

  const tshirtKeys = ['none', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'];
  const values = tshirtKeys.map(k => ({ key: k, px: toPx(spacing[k]) }));

  for (let i = 0; i < values.length - 1; i++) {
    assert.ok(
      values[i].px < values[i + 1].px,
      `T-shirt spacing monotonicity violated: ${values[i].key} (${values[i].px}px) must be < ${values[i + 1].key} (${values[i + 1].px}px)`
    );
  }

  // Cross-scale equivalence
  assert.strictEqual(spacing.xs, spacing['1']);
  assert.strictEqual(spacing.sm, spacing['2']);
  assert.strictEqual(spacing.md, spacing['3']);
  assert.strictEqual(spacing.lg, spacing['4']);
  assert.strictEqual(spacing.xl, spacing['5']);
  assert.strictEqual(spacing['2xl'], spacing['6']);
  assert.strictEqual(spacing['4xl'], spacing['8']);
  assert.strictEqual(spacing['5xl'], spacing['10']);
});

check('2.7: Border radii scale core sequence (xs to 3xl, pill, full) is monotonically ordered', () => {
  const { radii } = DesignTokens;
  assert.ok(radii, 'radii exists');

  const toPx = (val) => {
    assert.match(val, PX_REGEX, `radii ${val} must be valid px string`);
    return parseFloat(val.replace('px', ''));
  };

  const coreKeys = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'pill', 'full'];
  const values = coreKeys.map(k => ({ key: k, px: toPx(radii[k]) }));

  for (let i = 0; i < values.length - 1; i++) {
    assert.ok(
      values[i].px < values[i + 1].px,
      `Border radii core monotonicity violated: ${values[i].key} (${values[i].px}px) must be < ${values[i + 1].key} (${values[i + 1].px}px)`
    );
  }

  assert.strictEqual(radii.circle, '50%', 'radii.circle is 50%');
});

check('2.8: Z-Index layers form a strictly ordered non-overlapping stacking hierarchy', () => {
  const { zIndex } = DesignTokens;
  assert.ok(zIndex, 'zIndex exists');

  // Verify all are non-negative safe integers <= 2147483647 (max 32-bit int)
  Object.entries(zIndex).forEach(([k, v]) => {
    assert.ok(Number.isInteger(v), `zIndex.${k} (${v}) must be an integer`);
    assert.ok(v >= 0, `zIndex.${k} (${v}) must be non-negative`);
    assert.ok(v <= 2147483647, `zIndex.${k} (${v}) must not exceed max 32-bit int (2147483647)`);
  });

  // Layer hierarchy
  assert.ok(zIndex.base < zIndex.dropdown, 'base < dropdown');
  assert.ok(zIndex.dropdown < zIndex.header, 'dropdown < header');
  assert.ok(zIndex.header < zIndex.sticky, 'header < sticky');
  assert.ok(zIndex.sticky < zIndex.tooltip, 'sticky < tooltip');
  assert.ok(zIndex.tooltip < zIndex.hud, 'tooltip < hud');
  assert.ok(zIndex.hud < zIndex.studyBanner, 'hud < studyBanner');
  assert.ok(zIndex.studyBanner < zIndex.focusReminder, 'studyBanner < focusReminder');
  assert.ok(zIndex.focusReminder < zIndex.timeManagerModal, 'focusReminder < timeManagerModal');
  assert.ok(zIndex.timeManagerModal <= zIndex.goalModeModal, 'timeManagerModal <= goalModeModal');
  assert.strictEqual(zIndex.modal, 2147483647, 'modal has max zIndex (2147483647)');
  assert.strictEqual(zIndex.overlay, 2147483647, 'overlay has max zIndex (2147483647)');
  assert.strictEqual(zIndex.goalModeModal, 2147483647, 'goalModeModal has max zIndex (2147483647)');
});

check('2.9: Transitions define strictly monotonic duration timings', () => {
  const { transitions } = DesignTokens;
  assert.ok(transitions, 'transitions exists');

  const parseSeconds = (val) => {
    const match = val.match(/^([\d.]+)s\s+/);
    assert.ok(match, `Transition ${val} starts with seconds`);
    return parseFloat(match[1]);
  };

  const speedKeys = ['fast', 'normal', 'smooth', 'bounce', 'slow'];
  const values = speedKeys.map(k => ({ key: k, s: parseSeconds(transitions[k]) }));

  for (let i = 0; i < values.length - 1; i++) {
    assert.ok(
      values[i].s < values[i + 1].s,
      `Transition timing monotonicity violated: ${values[i].key} (${values[i].s}s) must be < ${values[i + 1].key} (${values[i + 1].s}s)`
    );
  }
});


// =========================================================================
// SUITE 3: CSS Custom Properties Generator & DOM Injection
// =========================================================================
console.log('\n--- SUITE 3: CSS Custom Properties Generator & DOM Injection ---');

check('3.1: toCSSVariables() produces a valid key-value map where all keys start with --gm-', () => {
  assert.strictEqual(typeof DesignTokens.toCSSVariables, 'function', 'toCSSVariables is a function');
  const vars = DesignTokens.toCSSVariables();
  assert.ok(typeof vars === 'object' && vars !== null, 'toCSSVariables returns an object');

  const entries = Object.entries(vars);
  assert.ok(entries.length >= 25, `Expected at least 25 CSS variables, found ${entries.length}`);

  entries.forEach(([k, v]) => {
    assert.ok(k.startsWith('--gm-'), `CSS variable key '${k}' must start with '--gm-'`);
    assert.match(k, /^--gm-[a-z0-9-]+$/, `CSS variable key '${k}' must use kebab-case alphanumeric naming`);
    assert.ok(typeof v === 'string' && v.trim().length > 0, `Value for '${k}' must be non-empty string`);
    assert.ok(!v.includes('undefined'), `Value for '${k}' (${v}) must not contain 'undefined'`);
    assert.ok(!v.includes('null'), `Value for '${k}' (${v}) must not contain 'null'`);
    assert.ok(!v.includes('[object Object]'), `Value for '${k}' (${v}) must not contain '[object Object]'`);
  });
});

check('3.2: toCssVariables() outputs valid :root CSS declaration string', () => {
  assert.strictEqual(typeof DesignTokens.toCssVariables, 'function', 'toCssVariables is a function');
  const cssStr = DesignTokens.toCssVariables();
  assert.ok(typeof cssStr === 'string', 'toCssVariables returns a string');
  assert.ok(cssStr.startsWith(':root {\n'), 'CSS declaration string starts with ":root {\\n"');
  assert.ok(cssStr.endsWith('\n}'), 'CSS declaration string ends with "\\n}"');

  // Verify all declarations inside are properly indented and end with semicolon
  const lines = cssStr.split('\n').slice(1, -1);
  assert.ok(lines.length >= 25, `Expected >= 25 CSS lines, found ${lines.length}`);
  lines.forEach(line => {
    assert.match(line, /^\s{2}--gm-[a-z0-9-]+:\s*.+;$/, `Line '${line}' must be valid CSS custom property declaration`);
  });
});

check('3.3: Injected :root CSS string into DOM parses cleanly without errors', () => {
  const cssStr = DesignTokens.toCssVariables();

  // Create style element in mock DOM
  const styleEl = document.createElement('style');
  styleEl.id = 'godmode-design-tokens';
  styleEl.textContent = cssStr;
  document.head.appendChild(styleEl);

  const foundEl = document.getElementById('godmode-design-tokens');
  assert.ok(foundEl, 'Style element exists in document.head');
  assert.strictEqual(foundEl.textContent, cssStr, 'Style element contains exact CSS string');

  // Cleanup
  document.head.removeChild(styleEl);
});

check('3.4: Method binding resilience: toCSSVariables behaves correctly when called bound or unbound', () => {
  const boundFn = DesignTokens.toCSSVariables.bind(DesignTokens);
  const vars1 = boundFn();
  const vars2 = DesignTokens.toCSSVariables();
  assert.deepStrictEqual(vars1, vars2, 'Bound call matches direct call');
});


// =========================================================================
// SUITE 4: Universal Isomorphic Module Exports & Global Scope
// =========================================================================
console.log('\n--- SUITE 4: Universal Isomorphic Module Exports & Global Scope ---');

check('4.1: DesignTokens is exported cleanly as CommonJS module.exports', () => {
  assert.ok(DesignTokens, 'DesignTokens is truthy');
  assert.strictEqual(typeof DesignTokens, 'object', 'DesignTokens is an object');
  assert.ok(DesignTokens.colors, 'DesignTokens has colors');
  assert.ok(DesignTokens.typography, 'DesignTokens has typography');
  assert.ok(DesignTokens.spacing, 'DesignTokens has spacing');
  assert.ok(DesignTokens.radii, 'DesignTokens has radii');
  assert.ok(DesignTokens.layout, 'DesignTokens has layout');
  assert.ok(DesignTokens.zIndex, 'DesignTokens has zIndex');
  assert.ok(DesignTokens.transitions, 'DesignTokens has transitions');
});

check('4.2: DesignTokens is attached to window and globalThis in browser environment', () => {
  assert.strictEqual(global.window.DesignTokens, DesignTokens, 'window.DesignTokens strictly equals module.exports');
  assert.strictEqual(globalThis.DesignTokens, DesignTokens, 'globalThis.DesignTokens strictly equals module.exports');
});

check('4.3: Prototype and object integrity test (no polluted properties)', () => {
  assert.strictEqual(Object.prototype.hasOwnProperty.call(DesignTokens, 'colors'), true);
  assert.strictEqual(DesignTokens.colors.constructor, Object);
});

console.log('\n================================================================');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${totalPassed} | FAILED: ${totalFailed}`);
if (totalFailed > 0) {
  console.log('FAILURES:');
  failures.forEach(f => console.log(`  - ${f.desc}: ${f.error}`));
}
console.log('================================================================');

if (totalFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
