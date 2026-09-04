// Logic for Clean Interface toggles
class UICleaner {
  constructor() {
    this.classes = {
      hideBell: 'ss-hide-bell',
      hideSubCount: 'ss-hide-sub-count',
      hideChat: 'ss-hide-chat',
      hideTrending: 'ss-hide-trending',
      hideExplore: 'ss-hide-explore',
      hideMiniPlayer: 'ss-hide-mini-player',
      hideAutoplay: 'ss-hide-autoplay'
    };
  }

  applySettings(uiCleanerSettings) {
    if (!uiCleanerSettings || typeof uiCleanerSettings !== 'object') return;

    for (const [key, className] of Object.entries(this.classes)) {
      this.updateSetting(key, Boolean(uiCleanerSettings[key]));
    }
  }

  // Used to quickly update a single setting without re-evaluating all
  updateSetting(key, isEnabled) {
    if (!key || !this.classes[key]) return;
    const className = this.classes[key];
    if (isEnabled) {
      if (typeof window !== 'undefined' && window.DOMUtils) {
        window.DOMUtils.addClass(className);
      } else if (typeof document !== 'undefined') {
        if (document.documentElement) document.documentElement.classList.add(className);
        if (document.body) document.body.classList.add(className);
      }
    } else {
      if (typeof window !== 'undefined' && window.DOMUtils) {
        window.DOMUtils.removeClass(className);
      } else if (typeof document !== 'undefined') {
        if (document.documentElement) document.documentElement.classList.remove(className);
        if (document.body) document.body.classList.remove(className);
      }
    }
  }

  cleanup() {
    for (const className of Object.values(this.classes)) {
      if (typeof window !== 'undefined' && window.DOMUtils) {
        window.DOMUtils.removeClass(className);
      } else if (typeof document !== 'undefined') {
        if (document.documentElement) document.documentElement.classList.remove(className);
        if (document.body) document.body.classList.remove(className);
      }
    }
  }

  disable() {
    this.cleanup();
  }
}

const uiCleanerInstance = new UICleaner();

if (typeof window !== 'undefined') {
  window.UICleaner = uiCleanerInstance;
  window.UICleanerInstance = uiCleanerInstance;
}
if (typeof globalThis !== 'undefined') {
  globalThis.UICleaner = globalThis.UICleaner || uiCleanerInstance;
  globalThis.UICleanerInstance = globalThis.UICleanerInstance || uiCleanerInstance;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = uiCleanerInstance;
}
