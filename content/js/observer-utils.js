// Utility functions for MutationObservers

class ObserverUtils {
  constructor() {
    this.observers = new Map();
    // FIX #5: Debounce timers per named observer to batch rapid mutations
    this._debounceTimers = new Map();
    // FIX #5: Accumulate matched elements per observer between debounce flushes
    this._pendingElements = new Map();
    // R3-11 FIX: Track whether initial scan has already run for each named observer
    this._initialScanDone = new Map();
  }

  // Observe element additions/modifications and run callback when matched
  // debounceMs: batch mutations that arrive within this window (default 80ms)
  observe(selector, callback, name = 'default', options = { childList: true, subtree: true }, debounceMs = 80) {
    if (!selector || typeof callback !== 'function') return null;

    // Disconnect existing observer with same name
    if (this.observers.has(name)) {
      try { this.observers.get(name).disconnect(); } catch(e) {}
    }

    // Clear any pending debounce state for this name
    if (this._debounceTimers.has(name)) {
      clearTimeout(this._debounceTimers.get(name));
      this._debounceTimers.delete(name);
    }
    this._pendingElements.set(name, []);
    // R3-11 FIX: Reset initial scan flag when observer is re-registered
    this._initialScanDone.delete(name);

    const flushCallback = () => {
      const elements = this._pendingElements.get(name) || [];
      this._pendingElements.set(name, []);
      this._debounceTimers.delete(name);
      if (elements.length > 0) {
        // FIX #5: Deduplicate matched elements before firing callback
        const unique = [...new Set(elements)];
        try { callback(unique); } catch(e) {}
      }
    };

    const observer = new MutationObserver((mutations) => {
      if (!mutations) return;
      // FIX #5: Accumulate matched elements, do NOT call callback synchronously
      const pending = this._pendingElements.get(name) || [];

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (let i = 0; i < mutation.addedNodes.length; i++) {
            const node = mutation.addedNodes[i];
            if (node && node.nodeType === 1) {
              // Check the node itself
              if (node.matches && node.matches(selector)) {
                pending.push(node);
              }
              // Only search descendants if node is a container with children
              if (node.childElementCount > 0 && typeof node.matches === 'function' && !node.matches('a, span, yt-icon, img, yt-formatted-string, tp-yt-paper-button, tp-yt-iron-icon')) {
                try {
                  const descendants = node.querySelectorAll(selector);
                  for (let j = 0; j < descendants.length; j++) pending.push(descendants[j]);
                } catch (e) {}
              }
            }
          }
        }
      }

      this._pendingElements.set(name, pending);

      // FIX #5: Debounce — reset timer on each mutation burst
      if (this._debounceTimers.has(name)) {
        clearTimeout(this._debounceTimers.get(name));
      }
      this._debounceTimers.set(name, setTimeout(flushCallback, debounceMs));
    });

    const targetNode = document.body || document.documentElement || document;
    if (targetNode) {
      observer.observe(targetNode, options);
      this.observers.set(name, observer);
    }

    // Initial check — run synchronously once per observer name (no debounce for initial scan)
    // R3-11 FIX: Guard with _initialScanDone so re-registration on yt-navigate-finish
    // doesn't re-fire on elements that were already processed.
    if (!this._initialScanDone.get(name)) {
      this._initialScanDone.set(name, true);
      try {
        const initialElements = document.querySelectorAll(selector);
        if (initialElements.length > 0) {
          callback(Array.from(initialElements));
        } else if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => {
            try {
              const els = document.querySelectorAll(selector);
              if (els.length > 0) callback(Array.from(els));
            } catch (e) {}
          }, { once: true });
        }
      } catch (e) {}
    }

    return observer;
  }

  // Disconnect specific observer
  disconnect(name) {
    if (this.observers.has(name)) {
      try { this.observers.get(name).disconnect(); } catch(e) {}
      this.observers.delete(name);
    }
    if (this._debounceTimers.has(name)) {
      clearTimeout(this._debounceTimers.get(name));
      this._debounceTimers.delete(name);
    }
    this._pendingElements.delete(name);
    // R3-11 FIX: Clear initial scan flag on disconnect so next observe() re-scans
    this._initialScanDone.delete(name);
  }

  // Disconnect all observers and reset internal state
  disconnectAll() {
    for (const observer of this.observers.values()) {
      try { observer.disconnect(); } catch(e) {}
    }
    this.observers.clear();
    for (const timer of this._debounceTimers.values()) {
      clearTimeout(timer);
    }
    this._debounceTimers.clear();
    this._pendingElements.clear();
    this._initialScanDone.clear();
  }

  // Complete memory lifecycle teardown helper
  clearAll() {
    this.disconnectAll();
  }
}

const observerUtilsInstance = new ObserverUtils();

if (typeof window !== 'undefined') {
  window.ObserverUtils = observerUtilsInstance;
}
if (typeof globalThis !== 'undefined') {
  globalThis.ObserverUtils = globalThis.ObserverUtils || observerUtilsInstance;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = observerUtilsInstance;
}

