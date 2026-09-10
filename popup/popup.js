document.addEventListener('DOMContentLoaded', async () => {
  try {
    let settings = await StorageUtil.getSettings();
    let tracking = await StorageUtil.getTracking();

    // Helper to get local date key (matches time-tracker.js)
    const getLocalDateKey = () => {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const EQ_PRESETS = (typeof window !== 'undefined' && window._SS_EQ_PRESETS) || (typeof AudioEngine !== 'undefined' && AudioEngine.EQ_PRESETS) || {};

    const detectPreset = (gains) => {
      if (!Array.isArray(gains)) return 'Custom';
      for (const [name, presetGains] of Object.entries(EQ_PRESETS)) {
        if (name === 'Custom' || !presetGains) continue;
        let match = true;
        for (let i = 0; i < 10; i++) {
          if (Number(gains[i]) !== Number(presetGains[i])) {
            match = false;
            break;
          }
        }
        if (match) return name;
      }
      return 'Custom';
    };

    // Toggles
    const masterToggle = document.getElementById('toggle-master');
    const shortsToggle = document.getElementById('toggle-shorts');
    const focusToggle = document.getElementById('toggle-focus');
    const ghostShieldToggle = document.getElementById('toggle-ghost-shield');
    const studyToggle = document.getElementById('toggle-study');
    const goalToggle = document.getElementById('toggle-goal');
    const timeManagerToggle = document.getElementById('toggle-time-manager');
    const autoSkipAdsToggle = document.getElementById('toggle-auto-skip-ads');
    const audioEffectsToggle = document.getElementById('pop-audioEffects');
    const audioEffectsHeaderToggle = document.getElementById('pop-audioEffects-header');
    const popupContainer = document.querySelector('.popup-container');

    const updateAria = (el) => { if (el) el.setAttribute('aria-checked', el.checked); };

    const updateUIState = (s, t) => {
      settings = s || settings;
      tracking = t || tracking;

      // Master toggle — set state
      const extensionOn = settings.extensionEnabled !== false;
      if (masterToggle) { masterToggle.checked = extensionOn; updateAria(masterToggle); }
      if (popupContainer) {
        popupContainer.classList.toggle('extension-disabled', !extensionOn);
      }

      if (shortsToggle) { shortsToggle.checked = settings.shortsBlocker; updateAria(shortsToggle); }
      if (focusToggle)  { focusToggle.checked = settings.focusMode;      updateAria(focusToggle);  }
      if (ghostShieldToggle) { ghostShieldToggle.checked = settings.ghostShield !== false; updateAria(ghostShieldToggle); }
      if (studyToggle)  { studyToggle.checked = settings.studyMode;      updateAria(studyToggle);  }
      if (goalToggle)   { goalToggle.checked = settings.goalMode;        updateAria(goalToggle);   }
      if (timeManagerToggle) { timeManagerToggle.checked = !!(settings.timeManager && settings.timeManager.enabled); updateAria(timeManagerToggle); }
      if (autoSkipAdsToggle) { autoSkipAdsToggle.checked = settings.autoSkipAds !== false; updateAria(autoSkipAdsToggle); }
      const isAudioOn = settings.audioEffects !== false;
      if (audioEffectsToggle) { audioEffectsToggle.checked = isAudioOn; updateAria(audioEffectsToggle); }
      if (audioEffectsHeaderToggle) { audioEffectsHeaderToggle.checked = isAudioOn; updateAria(audioEffectsHeaderToggle); }

      if (typeof window !== 'undefined' && window.AudioEngine) {
        window.AudioEngine.enabled = isAudioOn;
      }

      const supportsAudioDSP = (typeof window !== 'undefined' && window.BrowserDetection)
        ? window.BrowserDetection.supportsAudioDSP
        : true;

      // Audio Enhancements & 10-Band EQ State
      const vb = settings.volumeBooster || {};
      const popVolSlider = document.getElementById('pop-vol-slider');
      const popVolValue = document.getElementById('pop-vol-value');
      const popBassSlider = document.getElementById('pop-bass-slider');
      const popBassValue = document.getElementById('pop-bass-value');

      if (popVolSlider) {
        popVolSlider.value = vb.volumeLevel != null ? vb.volumeLevel : 100;
        if (!supportsAudioDSP) {
          popVolSlider.disabled = true;
          popVolSlider.style.cursor = 'not-allowed';
        }
      }
      if (popVolValue) popVolValue.textContent = (vb.volumeLevel != null ? vb.volumeLevel : 100) + '%';
      if (popBassSlider) {
        popBassSlider.value = vb.bassLevel != null ? vb.bassLevel : 0;
        if (!supportsAudioDSP) {
          popBassSlider.disabled = true;
          popBassSlider.style.cursor = 'not-allowed';
        }
      }
      if (popBassValue) popBassValue.textContent = (vb.bassLevel != null ? vb.bassLevel : 0) + ' dB';

      const popThermalAlert = document.getElementById('pop-thermal-alert');
      const curVol = vb.volumeLevel != null ? vb.volumeLevel : 100;
      const curBass = vb.bassLevel != null ? vb.bassLevel : 0;
      if (popThermalAlert) {
        popThermalAlert.style.display = (curVol > 250 || curBass > 12) ? 'block' : 'none';
      }

      const popNoiseToggle = document.getElementById('pop-noise-remover-toggle');
      if (popNoiseToggle) {
        popNoiseToggle.checked = vb.noiseRemover !== false;
        if (!supportsAudioDSP) popNoiseToggle.disabled = true;
        updateAria(popNoiseToggle);
      }

      const popEqToggle = document.getElementById('pop-eq-toggle');
      const popEqPreset = document.getElementById('pop-eq-preset');
      const popEqRack = document.getElementById('pop-eq-rack');
      const popEqReset = document.getElementById('pop-eq-reset');

      const isEqOn = vb.eqEnabled !== false;
      if (popEqToggle) {
        popEqToggle.checked = isEqOn;
        if (!supportsAudioDSP) popEqToggle.disabled = true;
        updateAria(popEqToggle);
      }
      if (popEqRack) {
        popEqRack.classList.toggle('pop-eq-disabled', !isEqOn || !supportsAudioDSP);
      }
      if (popEqPreset) {
        const savedPreset = vb.preset || 'Flat';
        popEqPreset.value = savedPreset;
        if (!supportsAudioDSP) popEqPreset.disabled = true;
        // Highlight active chip (deferred so chips are in DOM)
        setTimeout(() => { if (typeof syncChipActive === 'function') syncChipActive(savedPreset); }, 0);
      }
      if (popEqReset && !supportsAudioDSP) {
        popEqReset.disabled = true;
        popEqReset.style.opacity = '0.5';
        popEqReset.style.cursor = 'not-allowed';
      }

      const eqGains = Array.isArray(vb.eqGains) ? vb.eqGains : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      for (let i = 0; i < 10; i++) {
        const slider = document.getElementById(`pop-eq-slider-${i}`);
        const valSpan = document.getElementById(`pop-eq-val-${i}`);
        const gain = eqGains[i] !== undefined ? eqGains[i] : 0;
        if (slider) {
          slider.value = gain;
          if (!supportsAudioDSP) {
            slider.disabled = true;
            slider.style.cursor = 'not-allowed';
          }
        }
        if (valSpan) {
          const numGain = Number(gain);
          valSpan.textContent = (numGain > 0 ? '+' : '') + numGain + 'dB';
        }
      }

      // If Safari, render clear unsupported informational notice banner
      if (!supportsAudioDSP) {
        let safariNotice = document.getElementById('pop-safari-audio-notice');
        if (!safariNotice) {
          safariNotice = document.createElement('div');
          safariNotice.id = 'pop-safari-audio-notice';
          safariNotice.style.cssText = 'margin: 8px 0 12px; padding: 8px 10px; background: rgba(234, 179, 8, 0.12); border: 1px solid rgba(234, 179, 8, 0.35); border-radius: 8px; color: #fde047; font-size: 10.5px; line-height: 1.4; display: flex; align-items: flex-start; gap: 6px;';
          safariNotice.innerHTML = '<span style="font-size: 13px; flex-shrink: 0;">⚠️</span><div><strong style="color:#fef08a;">Audio enhancement isn\'t supported in Safari.</strong><div style="color:#cbd5e1; font-size: 9.5px; margin-top:2px;">Please use Chrome, Brave, Edge, or Firefox for Volume Booster, Bass Booster, and Equalizer.</div></div>';
          const audioContainer = document.querySelector('.audio-container');
          if (audioContainer) {
            const header = audioContainer.querySelector('.audio-header');
            if (header && header.nextSibling) {
              audioContainer.insertBefore(safariNotice, header.nextSibling);
            } else {
              audioContainer.prepend(safariNotice);
            }
          }
        }
        const presetChips = document.querySelectorAll('.preset-chip');
        presetChips.forEach(chip => {
          chip.disabled = true;
          chip.style.cursor = 'not-allowed';
          chip.style.opacity = '0.5';
        });
      }

      // Goal
      const currentGoalEl = document.getElementById('current-goal');
      if (currentGoalEl) currentGoalEl.textContent = settings.learningGoal || '';

      // Watch Time & Analytics
      const today = getLocalDateKey();
      const totalSeconds = (tracking.dailyWatchTime && tracking.dailyWatchTime[today]) || 0;
      const learningSeconds = (tracking.dailyLearningTime && tracking.dailyLearningTime[today]) ? tracking.dailyLearningTime[today] : 0;
      
      const formatTime = (secs) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        return `${h}h ${m}m`;
      };

      const todayTimeEl = document.getElementById('today-time');
      if (todayTimeEl) todayTimeEl.textContent = formatTime(totalSeconds);

      const learningTimeEl = document.getElementById('learning-time');
      if (learningTimeEl) learningTimeEl.textContent = formatTime(learningSeconds);
      
      const score = totalSeconds > 0 ? Math.min(100, Math.max(0, Math.round((learningSeconds / totalSeconds) * 100))) : 0;
      const focusScoreEl = document.getElementById('focus-score');
      if (focusScoreEl) focusScoreEl.textContent = `${score}%`;

      const gamification = tracking.gamification || {};
      const rankIcon = gamification.rankIcon || '🥉';
      const rankTier = gamification.rankTier || 'Bronze Focus';
      const totalAP = gamification.totalPoints || 0;
      const rankEl = document.getElementById('popup-rank-tier');
      if (rankEl) rankEl.textContent = `${rankIcon} ${rankTier} (${totalAP} AP)`;

      // Accordion Dynamic Subtitles
      const tmDesc = document.getElementById('acc-time-desc');
      if (tmDesc) {
        if (settings.timeManager && settings.timeManager.enabled) {
          const mins = settings.timeManager.dailyLimitMinutes || 60;
          const h = (mins / 60).toFixed(mins % 60 === 0 ? 0 : 1);
          const sched = settings.timeManager.scheduleEnabled ? ` • quiet after ${settings.timeManager.scheduleEnd || '10 PM'}` : '';
          tmDesc.textContent = `${h}h daily limit${sched}`;
        } else {
          tmDesc.textContent = '2h daily limit • Inactive';
        }
      }

      const focusDesc = document.getElementById('acc-focus-desc');
      if (focusDesc) {
        let count = 0;
        if (settings.studyMode) count++;
        if (settings.goalMode) count++;
        if (settings.autoSkipAds !== false) count++;
        if (settings.ghostShield !== false) count++;
        focusDesc.textContent = `${count} control${count === 1 ? '' : 's'} active`;
      }

      const audioDesc = document.getElementById('acc-audio-desc');
      if (audioDesc) {
        const vbState = settings.volumeBooster || {};
        const vol = vbState.volumeLevel != null ? vbState.volumeLevel : 100;
        const preset = vbState.preset || 'Custom';
        audioDesc.textContent = `Booster ${vol}% • ${preset} EQ`;
      }

      // Circular Ring Progress
      const ringProg = document.getElementById('timer-ring-progress');
      if (ringProg) {
        const totalCircumference = 364.4; // 2 * PI * 58
        const sec = (tracking.dailyLearningTime && tracking.dailyLearningTime[today]) || (tracking.dailyWatchTime && tracking.dailyWatchTime[today]) || 0;
        const fraction = Math.min(1, Math.max(0, (sec % 3600) / 3600));
        const offset = totalCircumference * (1 - (fraction > 0 ? fraction : 0.08));
        ringProg.style.strokeDashoffset = String(offset);
      }
    };

    updateUIState(settings, tracking);

    // Live storage change listener for real-time UI updates
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      try {
        chrome.storage.onChanged.addListener(async () => {
          try {
            const freshSettings = await StorageUtil.getSettings();
            const freshTracking = await StorageUtil.getTracking();
            updateUIState(freshSettings, freshTracking);
          } catch(e) {}
        });
      } catch(e) {}
    }

    // Reload current YouTube tab if open
    const reloadActiveYouTubeTab = () => {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs[0] && tabs[0].id && tabs[0].url && tabs[0].url.includes('youtube.com')) {
            chrome.tabs.reload(tabs[0].id);
          }
        });
      }
    };

    // Master toggle handler
    if (masterToggle) {
      masterToggle.addEventListener('change', async () => {
        updateAria(masterToggle);
        const enabled = masterToggle.checked;
        if (popupContainer) popupContainer.classList.toggle('extension-disabled', !enabled);
        await StorageUtil.updateSetting('extensionEnabled', enabled);
        reloadActiveYouTubeTab();
      });
    }

    const handleToggle = async (key, element) => {
      try {
        updateAria(element);
        await StorageUtil.updateSetting(key, element.checked);
        reloadActiveYouTubeTab();
      } catch (e) {}
    };

    const handleTimeManagerToggle = async (element) => {
      try {
        updateAria(element);
        await StorageUtil.updateTimeManagerSetting('enabled', element.checked);
        reloadActiveYouTubeTab();
      } catch (e) {}
    };

    const handleAudioEffectsToggle = async (element) => {
      try {
        updateAria(element);
        await StorageUtil.updateSetting('audioEffects', element.checked);
        if (typeof window !== 'undefined' && window.AudioEngine) {
          window.AudioEngine.enabled = element.checked;
        }
      } catch (e) {}
    };

    if (shortsToggle)  shortsToggle.addEventListener('change', () => handleToggle('shortsBlocker', shortsToggle));
    if (focusToggle)   focusToggle.addEventListener('change', () => handleToggle('focusMode', focusToggle));
    if (ghostShieldToggle) ghostShieldToggle.addEventListener('change', () => handleToggle('ghostShield', ghostShieldToggle));
    if (studyToggle)   studyToggle.addEventListener('change', () => handleToggle('studyMode', studyToggle));
    if (goalToggle)    goalToggle.addEventListener('change', () => handleToggle('goalMode', goalToggle));
    if (timeManagerToggle) timeManagerToggle.addEventListener('change', () => handleTimeManagerToggle(timeManagerToggle));
    if (autoSkipAdsToggle) autoSkipAdsToggle.addEventListener('change', () => handleToggle('autoSkipAds', autoSkipAdsToggle));
    if (audioEffectsToggle) audioEffectsToggle.addEventListener('change', () => handleAudioEffectsToggle(audioEffectsToggle));
    if (audioEffectsHeaderToggle) audioEffectsHeaderToggle.addEventListener('change', () => handleAudioEffectsToggle(audioEffectsHeaderToggle));

    // Volume Booster & Bass Booster sliders
    const popVolSlider = document.getElementById('pop-vol-slider');
    const popVolValue = document.getElementById('pop-vol-value');
    const popBassSlider = document.getElementById('pop-bass-slider');
    const popBassValue = document.getElementById('pop-bass-value');

    // Load saved values
    const vb = settings.volumeBooster || {};
    if (popVolSlider) popVolSlider.value = vb.volumeLevel || 100;
    if (popVolValue) popVolValue.textContent = (vb.volumeLevel || 100) + '%';
    if (popBassSlider) popBassSlider.value = vb.bassLevel || 0;
    if (popBassValue) popBassValue.textContent = (vb.bassLevel || 0) + ' dB';

    const supportsAudioDSP = (typeof window !== 'undefined' && window.BrowserDetection)
      ? window.BrowserDetection.supportsAudioDSP
      : true;

    const notifyActiveTabAudio = (payload) => {
      if (!supportsAudioDSP) return;
      try {
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0] && tabs[0].id) {
              chrome.tabs.sendMessage(tabs[0].id, { action: "updateAudioSettings", ...payload }).catch(() => {});
            }
          });
        }
      } catch (e) {}
    };

    const popThermalAlert = document.getElementById('pop-thermal-alert');
    const updateThermalAlert = () => {
      const vol = parseInt(popVolSlider ? popVolSlider.value : 100, 10) || 100;
      const bass = parseInt(popBassSlider ? popBassSlider.value : 0, 10) || 0;
      if (popThermalAlert) {
        popThermalAlert.style.display = (vol > 250 || bass > 12) ? 'block' : 'none';
      }
    };

    if (popVolSlider) {
      popVolSlider.addEventListener('input', () => {
        if (popVolValue) popVolValue.textContent = popVolSlider.value + '%';
        notifyActiveTabAudio({ volumeLevel: parseInt(popVolSlider.value, 10) });
        updateThermalAlert();
      });
      popVolSlider.addEventListener('change', async () => {
        try {
          const val = parseInt(popVolSlider.value, 10);
          notifyActiveTabAudio({ volumeLevel: val });
          updateThermalAlert();
          await StorageUtil.updateVolumeBoosterSetting('volumeLevel', val);
        } catch(e) {}
      });
    }

    if (popBassSlider) {
      popBassSlider.addEventListener('input', () => {
        if (popBassValue) popBassValue.textContent = popBassSlider.value + ' dB';
        notifyActiveTabAudio({ bassLevel: parseInt(popBassSlider.value, 10) });
        updateThermalAlert();
      });
      popBassSlider.addEventListener('change', async () => {
        try {
          const val = parseInt(popBassSlider.value, 10);
          notifyActiveTabAudio({ bassLevel: val });
          updateThermalAlert();
          await StorageUtil.updateVolumeBoosterSetting('bassLevel', val);
        } catch(e) {}
      });
    }

    // Noise Remover & Clarifier Toggle
    const popNoiseToggle = document.getElementById('pop-noise-remover-toggle');
    if (popNoiseToggle) {
      popNoiseToggle.addEventListener('change', async () => {
        updateAria(popNoiseToggle);
        const enabled = popNoiseToggle.checked;
        if (typeof window !== 'undefined' && window.AudioEngine && typeof window.AudioEngine.setNoiseRemover === 'function') {
          window.AudioEngine.setNoiseRemover(enabled);
        }
        notifyActiveTabAudio({ noiseRemover: enabled });
        await StorageUtil.updateVolumeBoosterSetting('noiseRemover', enabled);
      });
    }

    // 10-Band Graphic Equalizer Controls
    const popEqToggle = document.getElementById('pop-eq-toggle');
    const popEqPreset = document.getElementById('pop-eq-preset');
    const popEqReset = document.getElementById('pop-eq-reset');
    const popEqRack = document.getElementById('pop-eq-rack');

    if (popEqToggle) {
      popEqToggle.addEventListener('change', async () => {
        updateAria(popEqToggle);
        const enabled = popEqToggle.checked;
        if (popEqRack) popEqRack.classList.toggle('pop-eq-disabled', !enabled);
        if (typeof window !== 'undefined' && window.AudioEngine && typeof window.AudioEngine.setEqEnabled === 'function') {
          window.AudioEngine.setEqEnabled(enabled);
        }
        notifyActiveTabAudio({ eqEnabled: enabled });
        await StorageUtil.updateVolumeBoosterSetting('eqEnabled', enabled);
      });
    }

    const getPopCurrentGains = () => {
      const gains = [];
      for (let i = 0; i < 10; i++) {
        const slider = document.getElementById(`pop-eq-slider-${i}`);
        const val = slider ? parseFloat(slider.value) : 0;
        gains.push(isNaN(val) ? 0 : val);
      }
      return gains;
    };

    const setPopGainsUI = (gains) => {
      for (let i = 0; i < 10; i++) {
        const slider = document.getElementById(`pop-eq-slider-${i}`);
        const valSpan = document.getElementById(`pop-eq-val-${i}`);
        const g = gains[i] !== undefined ? gains[i] : 0;
        if (slider) slider.value = g;
        if (valSpan) {
          const num = Number(g);
          valSpan.textContent = (num > 0 ? '+' : '') + num + 'dB';
        }
      }
    };

    if (popEqPreset) {
      popEqPreset.addEventListener('change', async () => {
        const presetName = popEqPreset.value;
        syncChipActive(presetName);
        if (presetName && EQ_PRESETS[presetName]) {
          const gains = EQ_PRESETS[presetName];
          setPopGainsUI(gains);
          if (typeof window !== 'undefined' && window.AudioEngine && typeof window.AudioEngine.setEqPreset === 'function') {
            window.AudioEngine.setEqPreset(presetName);
          }
          notifyActiveTabAudio({ eqPreset: presetName, eqGains: [...gains] });
          await StorageUtil.updateVolumeBoosterSetting('eqGains', [...gains]);
          await StorageUtil.updateVolumeBoosterSetting('preset', presetName);
        } else if (presetName === 'Custom') {
          await StorageUtil.updateVolumeBoosterSetting('preset', 'Custom');
        }
      });
    }

    // Sync active chip highlight
    const syncChipActive = (activePreset) => {
      const chipsContainer = document.getElementById('pop-eq-preset-chips');
      if (!chipsContainer) return;
      chipsContainer.querySelectorAll('button[data-preset]').forEach(btn => {
        const isActive = btn.dataset.preset === activePreset;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        btn.style.boxShadow = isActive ? '0 0 8px rgba(168,85,247,0.6)' : 'none';
        btn.style.transform = isActive ? 'scale(1.05)' : 'scale(1)';
        btn.style.fontWeight = isActive ? '700' : '600';
        btn.style.opacity = isActive ? '1' : '0.75';
      });
    };

    // Wire chip clicks → hidden select → trigger change
    const chipsContainer = document.getElementById('pop-eq-preset-chips');
    if (chipsContainer) {
      chipsContainer.querySelectorAll('button[data-preset]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (popEqPreset) {
            popEqPreset.value = btn.dataset.preset;
            popEqPreset.dispatchEvent(new Event('change'));
          }
        });
      });
    }

    if (popEqReset) {
      popEqReset.addEventListener('click', async () => {
        const flatGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        setPopGainsUI(flatGains);
        if (popEqPreset) { popEqPreset.value = 'Flat'; syncChipActive('Flat'); }
        if (typeof window !== 'undefined' && window.AudioEngine && typeof window.AudioEngine.resetEq === 'function') {
          window.AudioEngine.resetEq();
        }
        notifyActiveTabAudio({ eqPreset: 'Flat', eqGains: flatGains });
        await StorageUtil.updateVolumeBoosterSetting('preset', 'Flat');
        await StorageUtil.updateVolumeBoosterSetting('eqGains', flatGains);
      });
    }

    for (let i = 0; i < 10; i++) {
      const slider = document.getElementById(`pop-eq-slider-${i}`);
      const valSpan = document.getElementById(`pop-eq-val-${i}`);
      if (slider) {
        slider.addEventListener('input', () => {
          const val = parseFloat(slider.value) || 0;
          if (valSpan) valSpan.textContent = (val > 0 ? '+' : '') + val + 'dB';
          const currentGains = getPopCurrentGains();
          const detected = detectPreset(currentGains);
          if (popEqPreset) { popEqPreset.value = detected; syncChipActive(detected); }
          notifyActiveTabAudio({ eqGains: currentGains, eqPreset: detected });
          if (typeof window !== 'undefined' && window.AudioEngine && typeof window.AudioEngine.setEqBandGain === 'function') {
            window.AudioEngine.setEqBandGain(i, val);
          }
        });

        slider.addEventListener('change', async () => {
          const currentGains = getPopCurrentGains();
          const detected = detectPreset(currentGains);
          if (popEqPreset) { popEqPreset.value = detected; syncChipActive(detected); }
          notifyActiveTabAudio({ eqGains: currentGains, eqPreset: detected });
          await StorageUtil.updateVolumeBoosterSetting('eqGains', currentGains);
          await StorageUtil.updateVolumeBoosterSetting('preset', detected);
        });
      }
    }

    // Custom Blocklist in Popup with deduplication and input/blur listeners
    const popKwInput = document.getElementById('pop-blocked-keywords');
    const popChInput = document.getElementById('pop-blocked-channels');

    if (popKwInput) {
      popKwInput.value = (settings.blockedKeywords || []).join(', ');
      let kwTimeout = null;
      const saveKeywords = () => {
        if (kwTimeout) {
          clearTimeout(kwTimeout);
          kwTimeout = null;
        }
        const keywords = [...new Set(popKwInput.value.split(',').map(k => k.trim()).filter(Boolean))];
        settings.blockedKeywords = keywords;
        return StorageUtil.saveSettings(settings);
      };
      popKwInput.addEventListener('change', saveKeywords);
      popKwInput.addEventListener('blur', saveKeywords);
      popKwInput.addEventListener('input', () => {
        if (kwTimeout) clearTimeout(kwTimeout);
        kwTimeout = setTimeout(saveKeywords, 300);
      });
    }

    if (popChInput) {
      popChInput.value = (settings.blockedChannels || []).join(', ');
      let chTimeout = null;
      const saveChannels = () => {
        if (chTimeout) {
          clearTimeout(chTimeout);
          chTimeout = null;
        }
        const channels = [...new Set(popChInput.value.split(',').map(c => c.trim()).filter(Boolean))];
        settings.blockedChannels = channels;
        return StorageUtil.saveSettings(settings);
      };
      popChInput.addEventListener('change', saveChannels);
      popChInput.addEventListener('blur', saveChannels);
      popChInput.addEventListener('input', () => {
        if (chTimeout) clearTimeout(chTimeout);
        chTimeout = setTimeout(saveChannels, 300);
      });
    }

    // Study Card Goal
    const currentGoalEl = document.getElementById('current-goal');
    let currentGoal = settings.learningGoal || '';
    if (currentGoalEl) currentGoalEl.textContent = currentGoal;

    const editBtn = document.getElementById('edit-goal');
    const goalInputContainer = document.getElementById('goal-input-container');
    const goalInput = document.getElementById('goal-input');
    const saveGoalBtn = document.getElementById('save-goal');

    if (editBtn) {
      editBtn.addEventListener('click', () => {
        if (goalInputContainer) goalInputContainer.style.display = 'flex';
        if (goalInput) {
          goalInput.value = currentGoal;
          goalInput.focus();
        }
      });

      editBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') editBtn.click();
      });
    }

    const searchGoalBtn = document.getElementById('search-goal');

    const handleSaveGoal = async (shouldSearch = true) => {
      if (!goalInput) return;
      const newGoal = goalInput.value.trim();
      if (newGoal) {
        await StorageUtil.updateSetting('learningGoal', newGoal);
        currentGoal = newGoal;
        if (currentGoalEl) currentGoalEl.textContent = newGoal;
        if (goalInputContainer) goalInputContainer.style.display = 'none';

        if (shouldSearch) {
          const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(newGoal)}`;

          // Redirect YouTube active tab to search for the new goal keyword
          if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs && tabs[0] && tabs[0].id) {
                chrome.tabs.update(tabs[0].id, { url: searchUrl });
              }
            });
          }
        }
      }
    };

    if (saveGoalBtn) {
      saveGoalBtn.addEventListener('click', () => handleSaveGoal(false));
    }
    if (searchGoalBtn) {
      searchGoalBtn.addEventListener('click', () => handleSaveGoal(true));
    }

    if (goalInput) {
      goalInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSaveGoal(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          if (goalInputContainer) goalInputContainer.style.display = 'none';
        }
      });
    }

    // Settings Link
    const openSettings = document.getElementById('open-settings');
    if (openSettings) {
      const openOptions = () => {
        let sent = false;
        try {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ action: "openOptionsPage" }, (res) => {
              if (chrome.runtime.lastError || !res || res.success === false) {
                fallbackOpenOptions();
              }
            });
            sent = true;
          }
        } catch(e) {}

        if (!sent) {
          fallbackOpenOptions();
        }
      };

      const fallbackOpenOptions = () => {
        try {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
          } else if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
            chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
          } else {
            window.open(chrome.runtime.getURL('options/options.html'));
          }
        } catch(err) {}
      };

      openSettings.addEventListener('click', openOptions);
      openSettings.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') openOptions();
      });

      const openDashboardBtn = document.getElementById('open-dashboard-btn');
      if (openDashboardBtn) {
        openDashboardBtn.addEventListener('click', openOptions);
      }
    }

    // Accordion Toggle Handlers for Manage Section
    document.querySelectorAll('.accordion-header').forEach(header => {
      header.addEventListener('click', () => {
        const parent = header.closest('.accordion-item');
        if (!parent) return;
        const isExpanded = parent.classList.toggle('active');
        header.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      });
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          header.click();
        }
      });
    });

    // Session Timer simulation for UI
    let sessionTime = 0;
    const sessionTimerId = setInterval(() => {
      if (studyToggle && studyToggle.checked) {
        sessionTime++;
        const h = Math.floor(sessionTime / 3600);
        const m = Math.floor((sessionTime % 3600) / 60);
        const s = sessionTime % 60;
        const timerEl = document.getElementById('session-time');
        if (timerEl) {
          timerEl.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
      }
    }, 1000);

    // Initialize Spectrum Canvas Visualizer
    const popCanvas = document.getElementById('pop-spectrum-canvas') || document.getElementById('eq-spectrum-canvas');
    let popSpectrumData = new Uint8Array(64);
    let popSpectrumPort = null;
    let popVisualizer = null;

    if (popCanvas) {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
        try {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0] && tabs[0].id && tabs[0].url && tabs[0].url.includes('youtube.com')) {
              try {
                if (chrome.tabs.connect) {
                  popSpectrumPort = chrome.tabs.connect(tabs[0].id, { name: "ss-spectrum-stream" });
                } else if (chrome.runtime.connect) {
                  popSpectrumPort = chrome.runtime.connect({ name: "ss-spectrum-stream" });
                }
                if (popSpectrumPort) {
                  popSpectrumPort.onMessage.addListener((msg) => {
                    if (msg && (msg.data || msg.frequencyData)) {
                      popSpectrumData = new Uint8Array(msg.data || msg.frequencyData);
                    }
                  });
                  popSpectrumPort.onDisconnect.addListener(() => {
                    popSpectrumPort = null;
                  });
                }
              } catch (e) {}
            }
          });
        } catch (e) {}
      }

      popVisualizer = renderSpectrum(popCanvas, () => {
        if (typeof window !== 'undefined' && window.AudioEngine && typeof window.AudioEngine.getFrequencyData === 'function') {
          const direct = window.AudioEngine.getFrequencyData();
          if (direct && direct.some && direct.some(v => v > 0)) return direct;
        }
        return popSpectrumData;
      });
    }

    // Clear the timer & stop visualizer when the popup window is closed/unloaded/hidden
    const cleanupPopup = () => {
      clearInterval(sessionTimerId);
      if (popVisualizer && typeof popVisualizer.stop === 'function') {
        popVisualizer.stop();
      }
      if (popSpectrumPort) {
        try { popSpectrumPort.disconnect(); } catch (e) {}
        popSpectrumPort = null;
      }
    };
    window.addEventListener('unload', cleanupPopup, { once: true });
    window.addEventListener('pagehide', cleanupPopup, { once: true });
  } catch (err) {
    console.error("Error initializing YouTube Shield Popup:", err);
  }
});

/**
 * High-performance HTML5 Canvas Spectrum Visualizer Rendering Engine
 * Renders glowing gradient bars with peak-hold indicator caps at 60 FPS.
 */
function renderSpectrum(canvas, getByteDataFn) {
  if (!canvas || typeof canvas.getContext !== 'function') {
    return { stop: () => {} };
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return { stop: () => {} };

  const numBars = 24;
  const peakHoldDelay = 12;
  const peakDecayRate = 2.2;

  const smoothedHeights = new Float32Array(numBars);
  const peakHeights = new Float32Array(numBars);
  const peakHoldCounters = new Float32Array(numBars);

  let animFrameId = null;
  let isRunning = true;

  function renderFrame() {
    if (!isRunning) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    let rawData;
    try {
      rawData = getByteDataFn() || new Uint8Array(64);
    } catch (e) {
      rawData = new Uint8Array(64);
    }

    const bufLen = rawData.length || 64;
    const barValues = new Float32Array(numBars);

    for (let i = 0; i < numBars; i++) {
      // Logarithmic perceptual frequency mapping with linear bin interpolation
      const norm = i / (numBars - 1);
      const binPos = Math.pow(norm, 1.4) * (bufLen - 2);
      const idx0 = Math.floor(binPos);
      const idx1 = Math.min(bufLen - 1, idx0 + 1);
      const frac = binPos - idx0;

      const rawVal = (rawData[idx0] || 0) * (1 - frac) + (rawData[idx1] || 0) * frac;
      const boost = 1.0 + (norm * 0.7);
      barValues[i] = Math.min(255, rawVal * boost);
    }

    const gap = 3;
    const totalGaps = (numBars - 1) * gap;
    const usableWidth = width - 8;
    const barWidth = Math.max(2, (usableWidth - totalGaps) / numBars);
    const startX = 4;
    const maxBarHeight = height - 6;

    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, '#2563eb');
    gradient.addColorStop(0.35, '#7c3aed');
    gradient.addColorStop(0.7, '#a855f7');
    gradient.addColorStop(1, '#ec4899');

    for (let i = 0; i < numBars; i++) {
      const x = startX + i * (barWidth + gap);
      const targetHeight = (barValues[i] / 255) * maxBarHeight;

      // Studio Ballistics: Fast Attack & Smooth Exponential Decay
      if (targetHeight > smoothedHeights[i]) {
        smoothedHeights[i] += (targetHeight - smoothedHeights[i]) * 0.55;
      } else {
        smoothedHeights[i] += (targetHeight - smoothedHeights[i]) * 0.14;
      }

      const barH = smoothedHeights[i];

      if (barH >= peakHeights[i]) {
        peakHeights[i] = barH;
        peakHoldCounters[i] = peakHoldDelay;
      } else {
        if (peakHoldCounters[i] > 0) {
          peakHoldCounters[i]--;
        } else {
          peakHeights[i] = Math.max(0, peakHeights[i] - peakDecayRate);
        }
      }

      if (barH > 0.5) {
        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(168,85,247,0.5)';
        ctx.fillStyle = gradient;
        const y = height - barH;
        if (typeof ctx.roundRect === 'function' && barH > 3) {
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barH, [2, 2, 0, 0]);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, barWidth, barH);
        }
        ctx.restore();
      }

      if (peakHeights[i] > 1) {
        ctx.fillStyle = '#f8fafc';
        const peakY = Math.max(1, height - peakHeights[i] - 2);
        ctx.fillRect(x, peakY, barWidth, 1.5);
      }
    }

    if (typeof requestAnimationFrame !== 'undefined') {
      animFrameId = requestAnimationFrame(renderFrame);
    }
  }

  if (typeof requestAnimationFrame !== 'undefined') {
    animFrameId = requestAnimationFrame(renderFrame);
  }

  const stop = () => {
    isRunning = false;
    if (animFrameId && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    try {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } catch (e) {}
  };

  return { stop };
}

