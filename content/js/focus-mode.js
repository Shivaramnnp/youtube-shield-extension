// Logic for Focus Mode
class FocusMode {
  constructor() {
    this.isActive = false;
  }

  enable() {
    if (this.isActive) return;
    this.isActive = true;

    if (typeof window !== 'undefined' && window.DOMUtils) {
      window.DOMUtils.addClass('shorts-shield-focus-mode');
      window.DOMUtils.addClass('shorts-shield-minimal-mode');
    } else if (typeof document !== 'undefined') {
      if (document.documentElement) {
        document.documentElement.classList.add('shorts-shield-focus-mode');
        document.documentElement.classList.add('shorts-shield-minimal-mode');
      }
      if (document.body) {
        document.body.classList.add('shorts-shield-focus-mode');
        document.body.classList.add('shorts-shield-minimal-mode');
      }
    }
    
    // Additional DOM manipulations that CSS can't handle cleanly
    this.centerVideoPlayer();

    console.log("FocusMode enabled");
  }

  disable() {
    if (!this.isActive) return;
    this.isActive = false;

    if (typeof window !== 'undefined' && window.DOMUtils) {
      window.DOMUtils.removeClass('shorts-shield-focus-mode');
      window.DOMUtils.removeClass('shorts-shield-minimal-mode');
    } else if (typeof document !== 'undefined') {
      if (document.documentElement) {
        document.documentElement.classList.remove('shorts-shield-focus-mode');
        document.documentElement.classList.remove('shorts-shield-minimal-mode');
      }
      if (document.body) {
        document.body.classList.remove('shorts-shield-focus-mode');
        document.body.classList.remove('shorts-shield-minimal-mode');
      }
    }
    
    this.resetVideoPlayer();

    console.log("FocusMode disabled");
  }

  centerVideoPlayer() {
    // CSS variables and layout flexy rules handle centering cleanly without JS hacks
  }

  resetVideoPlayer() {
    // CSS variable removal handles reset cleanly
  }
}

const focusModeInstance = new FocusMode();

if (typeof window !== 'undefined') {
  window.FocusMode = focusModeInstance;
}
if (typeof globalThis !== 'undefined') {
  globalThis.FocusMode = globalThis.FocusMode || focusModeInstance;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = focusModeInstance;
}
