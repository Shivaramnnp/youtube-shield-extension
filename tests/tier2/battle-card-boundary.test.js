/**
 * Tier 2: Feature 3 Battle Card UI Boundary & Corner Cases Suite
 */

require('../harness/mock-extension-env.js');
const { test, describe, assert, createMockStorage, resetDOM } = require('../harness/test-helpers');
const GamificationEngine = require('../../utils/gamification-engine');

describe('Feature 3 Boundaries: Battle Card UI', () => {

  test('Battle Card: Empty badge list rendering handled cleanly without throwing', async () => {
    await createMockStorage({
      tracking: {
        gamification: {
          badges: [],
          totalAP: 0,
          rankTier: 'Bronze Focus'
        }
      }
    });

    const unlockedBadgeIds = [];
    const totalAP = GamificationEngine.calculateTotalAP(unlockedBadgeIds);
    assert.equal(totalAP, 0);

    const rankInfo = GamificationEngine.getRankTierFromAP(totalAP);
    assert.equal(rankInfo.currentRank.title, 'Bronze Focus');

    // Simulate rendering battle card with zero badges
    resetDOM();
    const badgesContainer = global.document.createElement('div');
    badgesContainer.id = 'badges-container';
    global.document.body.appendChild(badgesContainer);

    GamificationEngine.BADGE_DEFINITIONS.forEach(badge => {
      const isEarned = unlockedBadgeIds.includes(badge.id);
      const card = global.document.createElement('div');
      card.className = `badge-item ${isEarned ? 'earned' : ''}`;
      badgesContainer.appendChild(card);
    });

    assert.equal(badgesContainer.children.length, 22);
    const earnedCards = badgesContainer.querySelectorAll('.earned');
    assert.equal(earnedCards.length, 0);
  });

  test('Battle Card: Missing badge catalog IDs ignored gracefully during calculation and rendering', async () => {
    const invalidBadges = ['unknown_badge_1', 'legacy_removed_id', 'invalid_abc'];
    const totalAP = GamificationEngine.calculateTotalAP(invalidBadges);
    assert.equal(totalAP, 0);

    const totalEXP = GamificationEngine.calculateTotalEXP(invalidBadges, 0);
    assert.equal(totalEXP, 0);

    resetDOM();
    const badgesContainer = global.document.createElement('div');
    badgesContainer.id = 'badges-container';
    global.document.body.appendChild(badgesContainer);

    // Only catalog badges matching BADGE_DEFINITIONS render
    GamificationEngine.BADGE_DEFINITIONS.forEach(badge => {
      const isEarned = invalidBadges.includes(badge.id);
      assert.equal(isEarned, false);
    });
  });

  test('Battle Card: Category filter switching with zero unlocked badges', async () => {
    const categories = ['time', 'streak', 'shield'];
    const unlockedBadges = [];

    categories.forEach(cat => {
      const categoryBadges = GamificationEngine.BADGE_DEFINITIONS.filter(b => b.category === cat);
      assert.ok(categoryBadges.length > 0, `Category ${cat} should contain catalog badges`);

      const unlockedInCat = categoryBadges.filter(b => unlockedBadges.includes(b.id));
      assert.equal(unlockedInCat.length, 0, `Expected 0 unlocked badges in category ${cat}`);
    });
  });

  test('Battle Card: Special characters in badge titles, names, and descriptions handled safely', async () => {
    // Check that badge catalog items with special characters (e.g. 60-Day Sage, UI/UX, C++) format cleanly
    const specialBadges = GamificationEngine.BADGE_DEFINITIONS.filter(b => 
      b.name.includes('-') || b.desc.includes('&') || b.desc.includes('/') || b.desc.includes('+')
    );

    assert.ok(specialBadges.length > 0, 'Catalog should contain badges with special characters');

    resetDOM();
    const testDiv = global.document.createElement('div');
    global.document.body.appendChild(testDiv);

    specialBadges.forEach(badge => {
      const el = global.document.createElement('span');
      // Assign textContent to prevent HTML injection vulnerability
      el.textContent = `${badge.name}: ${badge.desc}`;
      testDiv.appendChild(el);
      assert.ok(el.textContent.includes(badge.name));
    });
  });

  test('Battle Card: Unlocked vs locked status styling and point award display', async () => {
    const unlockedBadges = ['first_step', 'shorts_defender'];

    resetDOM();
    const container = global.document.createElement('div');
    global.document.body.appendChild(container);

    GamificationEngine.BADGE_DEFINITIONS.forEach(badge => {
      const isEarned = unlockedBadges.includes(badge.id);
      const card = global.document.createElement('div');
      card.className = `badge-item ${isEarned ? 'earned' : ''}`;
      card.innerHTML = `<span class="ap-award">+${badge.ap} AP</span>`;
      container.appendChild(card);
    });

    const earnedItems = container.querySelectorAll('.earned');
    assert.equal(earnedItems.length, 2);

    const firstStepDef = GamificationEngine.BADGE_DEFINITIONS.find(b => b.id === 'first_step');
    assert.equal(firstStepDef.ap, 50);
  });

  test('Battle Card: Catalog integrity of all 22 badges across 3 categories', async () => {
    const definitions = GamificationEngine.BADGE_DEFINITIONS;
    assert.equal(definitions.length, 22, 'Expected total 22 achievement badges in catalog');

    const timeBadges = definitions.filter(b => b.category === 'time');
    const streakBadges = definitions.filter(b => b.category === 'streak');
    const shieldBadges = definitions.filter(b => b.category === 'shield');

    assert.equal(timeBadges.length, 8, 'Expected 8 Time Milestones badges');
    assert.equal(streakBadges.length, 7, 'Expected 7 Streak badges');
    assert.equal(shieldBadges.length, 7, 'Expected 7 Shield Guard badges');

    // Total maximum learnable AP from base catalog
    const maxAP = definitions.reduce((sum, b) => sum + b.ap, 0);
    assert.equal(maxAP, 4100, `Expected total catalog AP to equal 4100, got ${maxAP}`);
  });

});
