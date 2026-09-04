// Time Manager module for Shorts Shield
class TimeManager {
  constructor() {
    this.isActive = false;
    this.checkInterval = null;
    this.config = {
      enabled: false,
      dailyLimitMinutes: 60,
      scheduleEnabled: false,
      scheduleStart: "09:00",
      scheduleEnd: "17:00",
      snoozeUntil: 0
    };
  }

  enable(config) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.isActive = true;
    this.evaluate().catch(e => console.warn("TimeManager evaluate error:", e));

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    // Check limits every 5 seconds with safe promise rejection handling
    this.checkInterval = setInterval(() => {
      this.evaluate().catch(e => console.warn("TimeManager interval evaluate error:", e));
    }, 5000);

    console.log("TimeManager enabled", this.config);
  }

  disable() {
    this.isActive = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.removeOverlay();
    console.log("TimeManager disabled");
  }

  getLocalDateKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async evaluate() {
    if (!this.isActive || !this.config || !this.config.enabled) {
      this.removeOverlay();
      return;
    }

    // Check context validity
    if (typeof StorageUtil !== 'undefined' && typeof StorageUtil.isContextValid === 'function') {
      if (!StorageUtil.isContextValid()) {
        this.disable();
        return;
      }
    }

    // Check active emergency extension (snooze)
    if (this.config.snoozeUntil && Date.now() < this.config.snoozeUntil) {
      this.removeOverlay();
      return;
    }

    let tracking = {};
    try {
      if (typeof StorageUtil !== 'undefined' && typeof StorageUtil.getTracking === 'function') {
        tracking = (await StorageUtil.getTracking()) || {};
      }
    } catch(e) {
      console.warn("TimeManager: failed to fetch tracking:", e);
    }

    const today = this.getLocalDateKey();
    const todaySeconds = (tracking.dailyWatchTime && tracking.dailyWatchTime[today]) || 0;
    const todayMinutes = Math.floor(todaySeconds / 60);

    const limitExceeded = this.config.dailyLimitMinutes > 0 && todayMinutes >= this.config.dailyLimitMinutes;
    const scheduleBlocked = this.isScheduleBlocked();

    if (limitExceeded || scheduleBlocked) {
      this.pauseVideo();
      this.showOverlay(limitExceeded ? 'limit' : 'schedule', {
        todayMinutes,
        limitMinutes: this.config.dailyLimitMinutes,
        start: this.config.scheduleStart,
        end: this.config.scheduleEnd
      });
    } else {
      this.removeOverlay();
    }
  }

  isScheduleBlocked() {
    if (!this.config || !this.config.scheduleEnabled || !this.config.scheduleStart || !this.config.scheduleEnd) {
      return false;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const startParts = String(this.config.scheduleStart).split(':').map(Number);
    const endParts = String(this.config.scheduleEnd).split(':').map(Number);

    const startH = isNaN(startParts[0]) ? 9 : startParts[0];
    const startM = isNaN(startParts[1]) ? 0 : startParts[1];
    const endH = isNaN(endParts[0]) ? 17 : endParts[0];
    const endM = isNaN(endParts[1]) ? 0 : endParts[1];

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes === endMinutes) {
      return false;
    }

    if (startMinutes < endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Overnight schedule (e.g. 22:00 to 06:00)
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  }

  pauseVideo() {
    const video = document.querySelector('video');
    if (video && !video.paused) {
      try {
        video.pause();
      } catch (e) {}
    }
  }

  showOverlay(reason, data) {
    if (document.getElementById('ss-time-manager-overlay')) return;

    if (typeof window !== 'undefined' && window.AudioEngine && typeof window.AudioEngine.playAlarm === 'function') {
      try { window.AudioEngine.playAlarm(); } catch(e) {}
    }

    const overlay = document.createElement('div');
    overlay.id = 'ss-time-manager-overlay';
    overlay.className = 'ss-overlay-backdrop';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'ss-tm-heading');
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(15, 23, 42, 0.88)',
      color: '#f8fafc',
      zIndex: '2147483646',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      padding: '20px',
      textAlign: 'center',
      backdropFilter: 'blur(16px)',
      webkitBackdropFilter: 'blur(16px)',
      boxSizing: 'border-box'
    });

    const isLimit = reason === 'limit';
    const title = isLimit ? '⏳ Daily Time Limit Reached' : '⛔ Focus Hours Active';
    const description = isLimit
      ? `You have reached your daily YouTube limit of <strong>${data.limitMinutes} minutes</strong> today (${data.todayMinutes}m watched).`
      : `YouTube is restricted during your scheduled focus hours (<strong>${data.start} – ${data.end}</strong>).`;

    overlay.innerHTML = `
      <div class="ss-modal-card" style="background: rgba(15, 15, 26, 0.94); border: 1px solid rgba(168, 85, 247, 0.35); padding: 40px; border-radius: 20px; max-width: 480px; width: min(90vw, 480px); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(168, 85, 247, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15); animation: ssModalScaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); box-sizing: border-box;">
        <div style="font-size: 52px; margin-bottom: 16px; filter: drop-shadow(0 0 14px rgba(245, 158, 11, 0.45));">${isLimit ? '⏳' : '🛑'}</div>
        <h1 id="ss-tm-heading" style="font-size: 24px; font-weight: 800; margin: 0 0 12px 0; color: #f8fafc; letter-spacing: -0.02em;">${title}</h1>
        <p style="font-size: 15px; line-height: 1.6; color: #94a3b8; margin: 0 0 24px 0;">${description}</p>
        <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
          <button id="ss-tm-snooze" class="ss-btn-gradient-indigo" style="padding: 12px 24px; font-size: 14px; font-weight: 600; background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%); color: white; border: none; border-radius: 10px; cursor: pointer; box-shadow: 0 4px 14px rgba(99,102,241,0.4); transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
            +5 Min Emergency Extension
          </button>
        </div>
      </div>
    `;

    if (window.DOMUtils) {
      window.DOMUtils.appendChild(overlay);
    } else if (document.body) {
      document.body.appendChild(overlay);
    }

    const snoozeBtn = overlay.querySelector('#ss-tm-snooze');
    if (snoozeBtn && typeof snoozeBtn.focus === 'function') {
      try { snoozeBtn.focus(); } catch (e) {}
    }
    if (snoozeBtn) {
      snoozeBtn.addEventListener('click', async () => {
        this.removeOverlay();
        const snoozeUntil = Date.now() + 5 * 60 * 1000; // 5 minutes from now
        this.config.snoozeUntil = snoozeUntil;
        try {
          if (typeof StorageUtil !== 'undefined' && typeof StorageUtil.updateTimeManagerSetting === 'function') {
            await StorageUtil.updateTimeManagerSetting('snoozeUntil', snoozeUntil);
          }
        } catch(e) {
          console.warn("TimeManager: failed to save snooze settings:", e);
        }
      });
    }
  }

  removeOverlay() {
    const overlay = document.getElementById('ss-time-manager-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }
}

window.TimeManager = new TimeManager();
