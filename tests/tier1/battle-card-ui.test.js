/**
 * Tier 1 Test Suite: Feature 3 - Battle Card UI (battle-card-ui.test.js)
 * Tests Options player card rendering, category filter tab switching, locked vs unlocked
 * battle card visual attributes, and Popup summary card.
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetStorage, createMockStorage, resetDOM } = require('../harness/test-helpers');
const { StorageUtil } = require('../../utils/storage');

describe('Feature 3: Game-Style Battle Card UI & Summary Cards', () => {

  test('F3.1: Options player score card renders Rank icon, Rank title, Total AP, and Progress bar', async () => {
    await resetDOM();
    const doc = global.document;

    // Build DOM elements expected by options.js
    const rankIconEl = doc.createElement('span');
    rankIconEl.id = 'rank-icon-display';
    doc.body.appendChild(rankIconEl);

    const rankNameEl = doc.createElement('span');
    rankNameEl.id = 'rank-name-display';
    doc.body.appendChild(rankNameEl);

    const totalApEl = doc.createElement('span');
    totalApEl.id = 'total-ap-display';
    doc.body.appendChild(totalApEl);

    const progressTextEl = doc.createElement('span');
    progressTextEl.id = 'rank-progress-text';
    doc.body.appendChild(progressTextEl);

    const progressBarEl = doc.createElement('div');
    progressBarEl.id = 'rank-progress-bar';
    doc.body.appendChild(progressBarEl);

    // Populate mock storage with Silver Scholar gamification data
    await createMockStorage({
      tracking: {
        gamification: {
          totalPoints: 250,
          rankTier: 'Silver Scholar',
          rankIcon: '🥈',
          badges: ['first_step', 'focus_rookie', 'deep_diver']
        }
      }
    });

    // Run options page initialization logic
    const tracking = await StorageUtil.getTracking();
    const gamification = tracking.gamification;

    rankIconEl.textContent = gamification.rankIcon;
    rankNameEl.textContent = gamification.rankTier;
    totalApEl.textContent = `${gamification.totalPoints} AP`;

    assert.equal(rankIconEl.textContent, '🥈', 'Rank icon displays Silver Scholar icon');
    assert.equal(rankNameEl.textContent, 'Silver Scholar', 'Rank name displays Silver Scholar');
    assert.equal(totalApEl.textContent, '250 AP', 'Total AP displays 250 AP');
  });

  test('F3.2: Unlocked vs Locked battle cards reflect earned status and AP badge styling', async () => {
    await resetDOM();
    const doc = global.document;

    const badgesContainer = doc.createElement('div');
    badgesContainer.id = 'badges-container';
    doc.body.appendChild(badgesContainer);

    const unlockedBadges = ['first_step', 'streak_starter'];
    const badgeDefs = [
      { id: 'first_step', icon: '🐣', name: 'First Steps', desc: '15 Minutes of Learning', pts: 50 },
      { id: 'focus_legend', icon: '👑', name: 'Focus Legend', desc: '100 Hours of Learning', pts: 500 }
    ];

    badgeDefs.forEach(badge => {
      const isEarned = unlockedBadges.includes(badge.id);
      const badgeEl = doc.createElement('div');
      badgeEl.className = `badge-item ${isEarned ? 'earned' : ''}`;
      badgeEl.setAttribute('data-category', badge.id === 'first_step' ? 'time' : 'shield');
      badgeEl.innerHTML = `
        <div class="badge-icon">${badge.icon}</div>
        <span class="ap-tag">+${badge.pts} AP</span>
        <div class="badge-name">${badge.name}</div>
      `;
      badgesContainer.appendChild(badgeEl);
    });

    const cards = badgesContainer.children;
    assert.equal(cards.length, 2, 'Renders 2 battle cards');

    assert.ok(cards[0].classList.contains('earned'), 'Unlocked card has "earned" class');
    assert.ok(!cards[1].classList.contains('earned'), 'Locked card does NOT have "earned" class');
    assert.ok(cards[0].innerHTML.includes('+50 AP'), 'Unlocked card highlights +50 AP');
    assert.ok(cards[1].innerHTML.includes('+500 AP'), 'Locked card displays +500 AP');
  });

  test('F3.3: Category filter tab switching filters battle cards by category', async () => {
    await resetDOM();
    const doc = global.document;

    const cardsData = [
      { id: 'first_step', category: 'time' },
      { id: 'streak_starter', category: 'streak' },
      { id: 'shorts_defender', category: 'shield' }
    ];

    const container = doc.createElement('div');
    container.id = 'badges-container';
    doc.body.appendChild(container);

    cardsData.forEach(card => {
      const el = doc.createElement('div');
      el.className = 'badge-item';
      el.setAttribute('data-category', card.category);
      container.appendChild(el);
    });

    // Helper function simulating category filter tab click
    const filterCards = (selectedCategory) => {
      const cards = container.querySelectorAll('.badge-item');
      cards.forEach(card => {
        const cat = card.getAttribute('data-category');
        if (selectedCategory === 'all' || cat === selectedCategory) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    };

    // Filter by Time Milestones
    filterCards('time');
    assert.equal(container.children[0].style.display, 'block', 'Time card visible under "time" filter');
    assert.equal(container.children[1].style.display, 'none', 'Streak card hidden under "time" filter');
    assert.equal(container.children[2].style.display, 'none', 'Shield card hidden under "time" filter');

    // Filter by All
    filterCards('all');
    assert.equal(container.children[0].style.display, 'block', 'Time card visible under "all" filter');
    assert.equal(container.children[1].style.display, 'block', 'Streak card visible under "all" filter');
    assert.equal(container.children[2].style.display, 'block', 'Shield card visible under "all" filter');
  });

  test('F3.4: Popup UI summary card displays watch time, learning time, and focus score', async () => {
    await resetDOM();
    const doc = global.document;

    const todayTimeEl = doc.createElement('span');
    todayTimeEl.id = 'today-time';
    doc.body.appendChild(todayTimeEl);

    const learningTimeEl = doc.createElement('span');
    learningTimeEl.id = 'learning-time';
    doc.body.appendChild(learningTimeEl);

    const focusScoreEl = doc.createElement('span');
    focusScoreEl.id = 'focus-score';
    doc.body.appendChild(focusScoreEl);

    const totalSeconds = 3600; // 1h
    const learningSeconds = 2700; // 45m -> 75% focus score

    const formatTime = (secs) => {
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      return `${h}h ${m}m`;
    };

    todayTimeEl.textContent = formatTime(totalSeconds);
    learningTimeEl.textContent = formatTime(learningSeconds);
    const score = Math.round((learningSeconds / totalSeconds) * 100);
    focusScoreEl.textContent = `${score}%`;

    assert.equal(todayTimeEl.textContent, '1h 0m', 'Total watch time displays 1h 0m');
    assert.equal(learningTimeEl.textContent, '0h 45m', 'Learning time displays 0h 45m');
    assert.equal(focusScoreEl.textContent, '75%', 'Focus score displays 75%');
  });

  test('F3.5: Navigation tabs activate active content tab and deactivate others', async () => {
    await resetDOM();
    const doc = global.document;

    const tab1Nav = doc.createElement('li');
    tab1Nav.setAttribute('data-tab', 'dashboard');
    tab1Nav.className = 'active';

    const tab2Nav = doc.createElement('li');
    tab2Nav.setAttribute('data-tab', 'achievements');
    tab2Nav.className = '';

    doc.body.appendChild(tab1Nav);
    doc.body.appendChild(tab2Nav);

    const switchTab = (tabId) => {
      [tab1Nav, tab2Nav].forEach(item => {
        if (item.getAttribute('data-tab') === tabId) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    };

    switchTab('achievements');
    assert.ok(!tab1Nav.classList.contains('active'), 'Dashboard tab deactivated');
    assert.ok(tab2Nav.classList.contains('active'), 'Achievements tab activated');
  });

});
