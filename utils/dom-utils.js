/**
 * Utility functions for safe DOM operations during document_start execution and runtime context.
 */

const DOMUtils = {
  // Track active observers for clean memory lifecycle
  _activeObservers: new Set(),

  addClass: (className) => {
    if (typeof document === 'undefined' || !className || typeof className !== 'string') return;
    const trimmed = className.trim();
    if (!trimmed) return;

    if (document.documentElement && document.documentElement.classList) {
      document.documentElement.classList.add(trimmed);
    }
    if (document.body && document.body.classList) {
      document.body.classList.add(trimmed);
    } else if (document.addEventListener) {
      document.addEventListener('DOMContentLoaded', () => {
        if (document.body && document.body.classList) document.body.classList.add(trimmed);
      }, { once: true });
    }
  },

  removeClass: (className) => {
    if (typeof document === 'undefined' || !className || typeof className !== 'string') return;
    const trimmed = className.trim();
    if (!trimmed) return;

    if (document.documentElement && document.documentElement.classList) {
      document.documentElement.classList.remove(trimmed);
    }
    if (document.body && document.body.classList) {
      document.body.classList.remove(trimmed);
    } else if (document.addEventListener) {
      document.addEventListener('DOMContentLoaded', () => {
        if (document.body && document.body.classList) document.body.classList.remove(trimmed);
      }, { once: true });
    }
  },

  hasClass: (element, className) => {
    if (!element || !element.classList || !className || typeof className !== 'string') return false;
    return element.classList.contains(className.trim());
  },

  appendChild: (element, parent = null) => {
    if (typeof document === 'undefined' || !element) return;
    const targetParent = parent || document.body || document.documentElement;
    if (targetParent && typeof targetParent.appendChild === 'function') {
      targetParent.appendChild(element);
    } else if (document.addEventListener) {
      document.addEventListener('DOMContentLoaded', () => {
        const bodyOrDoc = document.body || document.documentElement;
        if (bodyOrDoc && typeof bodyOrDoc.appendChild === 'function') {
          bodyOrDoc.appendChild(element);
        }
      }, { once: true });
    }
  },

  removeElement: (element) => {
    if (!element) return;
    try {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      } else if (typeof element.remove === 'function') {
        element.remove();
      }
    } catch (e) {}
  },

  createElement: (tag, attributes = {}, children = []) => {
    if (typeof document === 'undefined' || !tag || typeof tag !== 'string') return null;
    try {
      const el = document.createElement(tag);
      if (attributes && typeof attributes === 'object') {
        for (const [key, value] of Object.entries(attributes)) {
          if (key === 'className' || key === 'class') {
            el.className = String(value);
          } else if (key === 'style' && typeof value === 'object') {
            Object.assign(el.style, value);
          } else if (key === 'textContent' || key === 'innerText') {
            el.textContent = String(value);
          } else if (key === 'innerHTML') {
            el.innerHTML = String(value);
          } else if (key.startsWith('on') && typeof value === 'function') {
            const eventName = key.slice(2).toLowerCase();
            el.addEventListener(eventName, value);
          } else {
            el.setAttribute(key, String(value));
          }
        }
      }
      if (Array.isArray(children)) {
        children.forEach(child => {
          if (child && typeof child === 'object' && child.nodeType) {
            el.appendChild(child);
          } else if (child !== null && child !== undefined) {
            el.appendChild(document.createTextNode(String(child)));
          }
        });
      }
      return el;
    } catch (e) {
      return null;
    }
  },

  querySelector: (selector, parent = null) => {
    if (typeof document === 'undefined' || !selector || typeof selector !== 'string') return null;
    try {
      const target = parent || document;
      return target.querySelector ? target.querySelector(selector) : null;
    } catch (e) {
      return null;
    }
  },

  querySelectorAll: (selector, parent = null) => {
    if (typeof document === 'undefined' || !selector || typeof selector !== 'string') return [];
    try {
      const target = parent || document;
      const nodes = target.querySelectorAll ? target.querySelectorAll(selector) : [];
      return Array.from(nodes);
    } catch (e) {
      return [];
    }
  },

  // Safe MutationObserver factory with automatic tracking and clean disconnect lifecycle
  createObserver: (target, callback, config = { childList: true, subtree: true }) => {
    if (typeof window === 'undefined' || typeof MutationObserver === 'undefined' || !target || typeof callback !== 'function') {
      return { disconnect: () => {} };
    }
    try {
      const observer = new MutationObserver(callback);
      observer.observe(target, config);
      DOMUtils._activeObservers.add(observer);

      return {
        observer,
        disconnect: () => {
          try {
            observer.disconnect();
            DOMUtils._activeObservers.delete(observer);
          } catch (e) {}
        }
      };
    } catch (e) {
      return { disconnect: () => {} };
    }
  },

  // Disconnect all tracked active observers
  clearAllObservers: () => {
    DOMUtils._activeObservers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (e) {}
    });
    DOMUtils._activeObservers.clear();
  }
};

if (typeof window !== 'undefined') {
  window.DOMUtils = DOMUtils;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DOMUtils;
  DOMUtils.DOMUtils = DOMUtils;
}


