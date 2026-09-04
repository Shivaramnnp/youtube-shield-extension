/**
 * Tier 1 Unit Test Suite: Milestone 2 - Design Tokens & Shared Theme System
 * File: tests/tier1/design-tokens.test.js
 * 
 * Verifies:
 * 1. Isomorphic module exports (window.DesignTokens and module.exports)
 * 2. Token completeness across Palette, Typography, Spacing, Radii, Shadows, Z-Index, Transitions
 * 3. CSS Custom Properties generator / mapper consistency with HUD & Dashboard styling
 */

require('../harness/mock-extension-env');
const { test, describe, assert } = require('../harness/test-helpers');
const DesignTokens = require('../../utils/design-tokens');

describe('M2: Shared Design Tokens & Theme System', () => {

  test('M2.T1: DesignTokens is exported cleanly as CommonJS module and attached to window', () => {
    assert.ok(DesignTokens, 'DesignTokens module exported');
    assert.equal(typeof DesignTokens, 'object', 'DesignTokens is an object');
    assert.ok(global.window.DesignTokens, 'window.DesignTokens is populated on global window');
    assert.strictEqual(DesignTokens, global.window.DesignTokens, 'CommonJS export strictly equals window.DesignTokens');
  });

  test('M2.T2: Palette tokens include all brand accents, backgrounds, text, and status colors', () => {
    const { colors } = DesignTokens;
    assert.ok(colors, 'colors group exists');

    // Accents
    assert.equal(colors.accentIndigo, '#6366f1');
    assert.equal(colors.accentPurple, '#a855f7');
    assert.equal(colors.accentPink, '#ec4899');
    assert.equal(colors.accentEmerald, '#10b981');
    assert.equal(colors.accentBlue, '#3b82f6');
    assert.equal(colors.accentGold, '#f59e0b');

    // Nested Accents
    assert.equal(colors.accents.indigo, '#6366f1');
    assert.equal(colors.accents.purple, '#a855f7');
    assert.equal(colors.accents.emerald, '#10b981');

    // Backgrounds
    assert.equal(colors.bgBase, '#0b0f19');
    assert.ok(colors.bgSurface, 'bgSurface defined');
    assert.ok(colors.bgGlassPanel, 'bgGlassPanel defined');
    assert.ok(colors.bgCard, 'bgCard defined');
    assert.equal(colors.bg.base, '#0b0f19');

    // Text
    assert.equal(colors.textPrimary, '#f8fafc');
    assert.equal(colors.textSecondary, '#cbd5e1');
    assert.equal(colors.textMuted, '#94a3b8');
    assert.equal(colors.textAccent, '#a78bfa');
    assert.equal(colors.text.primary, '#f8fafc');

    // Borders
    assert.ok(colors.borderSubtle, 'borderSubtle defined');
    assert.ok(colors.borderDefault, 'borderDefault defined');
    assert.ok(colors.borders.glass, 'borders.glass defined');

    // Status
    assert.equal(colors.statusSuccess, '#10b981');
    assert.equal(colors.statusWarning, '#f59e0b');
    assert.equal(colors.statusDanger, '#ef4444');
    assert.equal(colors.statusInfo, '#3b82f6');
  });

  test('M2.T3: Gamification rank tier colors are fully specified', () => {
    const { rankColors, colors } = DesignTokens;
    assert.ok(rankColors, 'rankColors group exists');
    assert.ok(colors.badgeTiers, 'colors.badgeTiers exists');

    assert.equal(rankColors.bronze, '#cd7f32');
    assert.equal(rankColors.silver, '#c0c0c0');
    assert.equal(rankColors.gold, '#ffd700');
    assert.equal(rankColors.platinum, '#00b4d8');
    assert.equal(rankColors.diamond, '#00bfff');
    assert.equal(rankColors.master, '#9370db');
    assert.equal(rankColors.heroic, '#9370db');
    assert.equal(rankColors.grandmaster, '#ff4500');

    assert.equal(colors.badgeTiers.bronze.color, '#cd7f32');
    assert.equal(colors.badgeTiers.gold.color, '#ffd700');
    assert.equal(colors.badgeTiers.grandmaster.color, '#ff4500');
  });

  test('M2.T4: Typography tokens define font families, scales, and font weights', () => {
    const { typography } = DesignTokens;
    assert.ok(typography, 'typography group exists');

    assert.ok(typography.fontFamily, 'fontFamily defined');
    assert.ok(typography.fontFamily.sans.includes('Inter'));
    assert.ok(typography.fontSize, 'fontSize scale defined');
    assert.equal(typography.fontSize.xs, '11px');
    assert.equal(typography.fontSize.sm, '12px');
    assert.equal(typography.fontSize.base, '14px');
    assert.equal(typography.fontSize.lg, '16px');
    assert.equal(typography.fontSize.xl, '20px');
    assert.equal(typography.fontSize['2xl'], '24px');
    assert.equal(typography.fontSize.timer, '30px');

    assert.ok(typography.fontWeight, 'fontWeight defined');
    assert.equal(typography.fontWeight.regular, 400);
    assert.equal(typography.fontWeight.medium, 500);
    assert.equal(typography.fontWeight.semibold, 600);
    assert.equal(typography.fontWeight.bold, 700);
  });

  test('M2.T5: Spacing, border radii, and layout bounds tokens are defined', () => {
    const { spacing, radii, layout } = DesignTokens;
    assert.ok(spacing, 'spacing group exists');
    assert.ok(radii, 'radii group exists');
    assert.ok(layout, 'layout group exists');

    assert.equal(spacing['0'], '0px');
    assert.equal(spacing['1'], '4px');
    assert.equal(spacing['2'], '8px');
    assert.equal(spacing['3'], '12px');
    assert.equal(spacing['4'], '16px');
    assert.equal(spacing['6'], '24px');

    assert.equal(radii.sm, '6px');
    assert.equal(radii.md, '8px');
    assert.equal(radii.lg, '12px');
    assert.equal(radii.xl, '16px');
    assert.equal(radii.full, '9999px');
    assert.equal(radii.pill, '999px');

    assert.equal(layout.hudWidth, '320px');
    assert.ok(layout.hudMaxHeight.includes('480px') || layout.hudMaxHeight.includes('72vh'));
  });

  test('M2.T6: Z-Index hierarchy prevents overlay collisions', () => {
    const { zIndex } = DesignTokens;
    assert.ok(zIndex, 'zIndex group exists');

    assert.ok(zIndex.base < zIndex.dropdown);
    assert.ok(zIndex.dropdown < zIndex.header);
    assert.ok(zIndex.header < zIndex.sticky);
    assert.ok(zIndex.sticky < zIndex.tooltip);
    assert.ok(zIndex.tooltip < zIndex.hud);
    assert.ok(zIndex.hud <= zIndex.overlay);
    assert.equal(zIndex.overlay, 2147483647, 'Overlay z-index has maximum integer value');
  });

  test('M2.T7: CSS Custom Properties generators output valid CSS variable mappings and declarations', () => {
    assert.equal(typeof DesignTokens.toCSSVariables, 'function', 'toCSSVariables method exists');
    assert.equal(typeof DesignTokens.toCssVariables, 'function', 'toCssVariables method exists');

    const cssVarsObj = DesignTokens.toCSSVariables();
    assert.equal(typeof cssVarsObj, 'object', 'toCSSVariables returns key-value object');
    assert.equal(cssVarsObj['--gm-bg-base'], '#0b0f19');
    assert.equal(cssVarsObj['--gm-accent-indigo'], '#6366f1');
    assert.equal(cssVarsObj['--gm-accent-purple'], '#a855f7');
    assert.equal(cssVarsObj['--gm-text-primary'], '#f8fafc');

    const cssVarsStr = DesignTokens.toCssVariables();
    assert.equal(typeof cssVarsStr, 'string', 'toCssVariables returns CSS string');
    assert.ok(cssVarsStr.includes('--gm-accent-indigo: #6366f1;'));
    assert.ok(cssVarsStr.includes('--gm-accent-purple: #a855f7;'));
    assert.ok(cssVarsStr.includes('--gm-text-primary: #f8fafc;'));
    assert.ok(cssVarsStr.includes('--gm-bg-base: #0b0f19;'));
  });

});
