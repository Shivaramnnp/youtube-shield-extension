/**
 * YouTube Shield — Centralized Browser Detection & Capabilities Engine
 * Accurately distinguishes Safari on macOS/iOS from Chromium (Chrome, Brave, Edge, Opera) and Firefox.
 * Centralizes feature capability flags (e.g. supportsAudioDSP).
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BrowserDetection = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class BrowserDetectionClass {
    constructor() {
      this._cachedCapabilities = null;
      this._overrideCapabilities = null;
    }

    /**
     * Analyze userAgent, vendor, and browser environment globals to identify the browser.
     * @param {string} [customUa] - Optional custom User-Agent string (used for testing).
     * @param {string} [customVendor] - Optional custom vendor string.
     * @param {object} [customNav] - Optional custom navigator object.
     * @returns {object} Browser capabilities object.
     */
    detect(customUa, customVendor, customNav) {
      if (this._overrideCapabilities) {
        return { ...this._overrideCapabilities };
      }

      const ua = String(
        customUa !== undefined
          ? customUa
          : (typeof navigator !== 'undefined' ? navigator.userAgent : '')
      );
      const vendor = String(
        customVendor !== undefined
          ? customVendor
          : (typeof navigator !== 'undefined' ? navigator.vendor : '')
      );
      const nav = customNav || (typeof navigator !== 'undefined' ? navigator : {});
      const win = typeof window !== 'undefined' ? window : {};

      const lowerUa = ua.toLowerCase();
      const lowerVendor = vendor.toLowerCase();

      const isExplicitCheck = (customUa !== undefined);

      // 1. Edge Detection (Edg/)
      const isEdge = /edg\//i.test(ua);

      // 2. Opera / OPR Detection
      const isOpera = /opr\/|opera/i.test(ua) || (!isExplicitCheck && Boolean(win.opr || win.opera));

      // 3. Vivaldi Detection
      const isVivaldi = /vivaldi/i.test(ua);

      // 4. Brave Detection (navigator.brave API or user-agent token)
      const isBrave = Boolean(
        (nav.brave && typeof nav.brave.isBrave === 'function') ||
        /brave/i.test(ua)
      );

      // 5. Firefox Detection (Firefox / Fxios / InstallTrigger)
      const isFirefox = /firefox|fxios/i.test(ua) || (!isExplicitCheck && typeof win.InstallTrigger !== 'undefined');

      // 6. Chrome Detection (Chrome / CriOS, but not Edge/Brave/Opera/Vivaldi/Firefox)
      const hasChromeToken = /chrome|crios/i.test(ua);
      const isChrome =
        (hasChromeToken || (!isExplicitCheck && !ua && Boolean(win.chrome))) &&
        !isEdge &&
        !isBrave &&
        !isOpera &&
        !isVivaldi &&
        !isFirefox;

      // 7. Safari Detection (AppleWebKit / Safari, but strictly NOT Chromium / Firefox)
      // True Safari contains 'Safari' and/or vendor 'Apple Computer', without Chrome, Edg, OPR, Brave, Vivaldi, Firefox
      const hasSafariToken = /safari/i.test(ua) || /apple/i.test(lowerVendor) || (!isExplicitCheck && Boolean(win.safari));
      const isSafari =
        hasSafariToken &&
        !hasChromeToken &&
        !isEdge &&
        !isOpera &&
        !isVivaldi &&
        !isBrave &&
        !isFirefox;

      const isChromium = isChrome || isEdge || isBrave || isOpera || isVivaldi;

      let browserName = 'Unknown';
      if (isSafari) browserName = 'Safari';
      else if (isBrave) browserName = 'Brave';
      else if (isEdge) browserName = 'Edge';
      else if (isOpera) browserName = 'Opera';
      else if (isVivaldi) browserName = 'Vivaldi';
      else if (isChrome) browserName = 'Chrome';
      else if (isFirefox) browserName = 'Firefox';

      // Web Audio DSP Capability:
      // Safari on macOS uses AVFoundation/CoreAudio kernel bypass on MSE streams and restricts Web Audio createMediaElementSource
      // Chrome, Brave, Edge, Firefox fully support Web Audio GainNode/BiquadFilterNode amplification
      const supportsAudioDSP = !isSafari;

      return {
        browserName,
        isSafari,
        isChrome,
        isBrave,
        isEdge,
        isFirefox,
        isOpera,
        isVivaldi,
        isChromium,
        supportsAudioDSP
      };
    }

    /**
     * Get cached capabilities for the current environment.
     */
    getCapabilities() {
      if (this._overrideCapabilities) {
        return { ...this._overrideCapabilities };
      }
      if (!this._cachedCapabilities) {
        this._cachedCapabilities = this.detect();
      }
      return this._cachedCapabilities;
    }

    get browserName() {
      return this.getCapabilities().browserName;
    }

    get isSafari() {
      return this.getCapabilities().isSafari;
    }

    get isChrome() {
      return this.getCapabilities().isChrome;
    }

    get isBrave() {
      return this.getCapabilities().isBrave;
    }

    get isEdge() {
      return this.getCapabilities().isEdge;
    }

    get isFirefox() {
      return this.getCapabilities().isFirefox;
    }

    get isChromium() {
      return this.getCapabilities().isChromium;
    }

    get supportsAudioDSP() {
      return this.getCapabilities().supportsAudioDSP;
    }

    /**
     * Override capabilities for automated testing mock setups.
     * @param {object|null} caps
     */
    override(caps) {
      this._overrideCapabilities = caps ? { ...caps } : null;
      this._cachedCapabilities = caps ? { ...caps } : null;
    }

    /**
     * Reset cached/overridden capabilities.
     */
    reset() {
      this._overrideCapabilities = null;
      this._cachedCapabilities = null;
    }
  }

  const instance = new BrowserDetectionClass();
  if (typeof window !== 'undefined') {
    window.BrowserDetection = instance;
  }
  return instance;
});
