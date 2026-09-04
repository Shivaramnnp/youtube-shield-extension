/**
 * Gamification Engine Utility
 * Shorts Shield PUBG / Free Fire Style Rank & Progression System
 */

const GamificationEngine = {
  /**
   * Complete Registry of 22 Achievement Badges
   */
  BADGE_DEFINITIONS: [
    // Category 1: Time Milestones (8 Badges — 1,700 AP)
    { id: 'first_step', category: 'time', name: 'First Steps', desc: '15 Minutes of Learning', icon: '🐣', tier: 1, ap: 50, exp: 500 },
    { id: 'focus_rookie', category: 'time', name: 'Focus Rookie', desc: '1 Hour of Learning', icon: '🥉', tier: 1, ap: 50, exp: 500 },
    { id: 'deep_diver', category: 'time', name: 'Deep Diver', desc: '5 Hours of Learning', icon: '🎯', tier: 2, ap: 100, exp: 1000 },
    { id: 'dedicated_scholar', category: 'time', name: 'Dedicated Scholar', desc: '10 Hours of Learning', icon: '🥈', tier: 2, ap: 100, exp: 1000 },
    { id: 'mastermind', category: 'time', name: 'Mastermind', desc: '25 Hours of Learning', icon: '🥇', tier: 3, ap: 200, exp: 2000 },
    { id: 'study_warrior', category: 'time', name: 'Study Warrior', desc: '50 Hours of Learning', icon: '💎', tier: 3, ap: 200, exp: 2000 },
    { id: 'focus_legend', category: 'time', name: 'Focus Legend', desc: '100 Hours of Learning', icon: '👑', tier: 4, ap: 500, exp: 5000 },
    { id: 'grandmaster_scholar', category: 'time', name: 'Grandmaster Scholar', desc: '250 Hours of Learning', icon: '🧙‍♂️', tier: 4, ap: 500, exp: 5000 },

    // Category 2: Streaks (7 Badges — 1,200 AP)
    { id: 'streak_starter', category: 'streak', name: 'Streak Starter', desc: '2 Day Streak', icon: '🌱', tier: 1, ap: 50, exp: 500 },
    { id: 'consistency_master', category: 'streak', name: 'Consistency Master', desc: '3 Day Streak', icon: '🥈', tier: 1, ap: 50, exp: 500 },
    { id: 'week_warrior', category: 'streak', name: 'Unstoppable Week', desc: '7 Day Streak', icon: '🔥', tier: 2, ap: 100, exp: 1000 },
    { id: 'fortnight_master', category: 'streak', name: 'Fortnight Master', desc: '14 Day Streak', icon: '⚡', tier: 2, ap: 100, exp: 1000 },
    { id: 'monthly_monk', category: 'streak', name: 'Monthly Monk', desc: '30 Day Streak', icon: '🏆', tier: 3, ap: 200, exp: 2000 },
    { id: 'sixty_day_sage', category: 'streak', name: '60-Day Sage', desc: '60 Day Streak', icon: '🧘', tier: 3, ap: 200, exp: 2000 },
    { id: 'centurion_streak', category: 'streak', name: 'Centurion Legend', desc: '100 Day Streak', icon: '🌟', tier: 4, ap: 500, exp: 5000 },

    // Category 3: Shield Guard (7 Badges — 1,200 AP)
    { id: 'shorts_defender', category: 'shield', name: 'Shorts Defender', desc: 'Block 10 Shorts', icon: '🛡️', tier: 1, ap: 50, exp: 500 },
    { id: 'focus_guardian', category: 'shield', name: 'Focus Guardian', desc: '80%+ Focus Score Today', icon: '🎯', tier: 1, ap: 50, exp: 500 },
    { id: 'pure_focus', category: 'shield', name: 'Pure Focus Monk', desc: '100% Focus Score Today', icon: '💎', tier: 2, ap: 100, exp: 1000 },
    { id: 'time_commander', category: 'shield', name: 'Time Commander', desc: 'Adhere to Daily Limit', icon: '⏳', tier: 2, ap: 100, exp: 1000 },
    { id: 'distraction_slayer', category: 'shield', name: 'Distraction Slayer', desc: 'Block 100 Shorts', icon: '⚔️', tier: 3, ap: 200, exp: 2000 },
    { id: 'iron_will', category: 'shield', name: 'Iron Will', desc: '90%+ Focus Score 7 Days', icon: '🛡️', tier: 3, ap: 200, exp: 2000 },
    { id: 'shield_master', category: 'shield', name: 'Ultimate Shield Master', desc: 'Block 500 Shorts & 30-Day Streak', icon: '👑', tier: 4, ap: 500, exp: 5000 }
  ],

  /**
   * PUBG / Free Fire Rank Tier Thresholds
   */
  RANK_TIERS: [
    { id: 'bronze_focus', title: 'Bronze Focus', icon: '🥉', minAP: 0, maxAP: 200, badgeClass: 'rank-bronze', color: '#CD7F32' },
    { id: 'silver_scholar', title: 'Silver Scholar', icon: '🥈', minAP: 200, maxAP: 500, badgeClass: 'rank-silver', color: '#C0C0C0' },
    { id: 'gold_mastermind', title: 'Gold Mastermind', icon: '🥇', minAP: 500, maxAP: 1000, badgeClass: 'rank-gold', color: '#FFD700' },
    { id: 'diamond_warrior', title: 'Diamond Warrior', icon: '💎', minAP: 1000, maxAP: 2000, badgeClass: 'rank-diamond', color: '#00BFFF' },
    { id: 'heroic_monk', title: 'Heroic Monk', icon: '☯️', minAP: 2000, maxAP: 3500, badgeClass: 'rank-heroic', color: '#9370DB' },
    { id: 'grandmaster_legend', title: 'Grandmaster Legend', icon: '👑', minAP: 3500, maxAP: Infinity, badgeClass: 'rank-grandmaster', color: '#FF4500' }
  ],

  /**
   * Calculates total Achievement Points (AP) from array of unlocked badge string IDs
   * @param {string[]} unlockedBadgeIds 
   * @param {number} bonusAP
   * @returns {number}
   */
  calculateTotalAP(unlockedBadgeIds = [], bonusAP = 0) {
    const validBadges = Array.isArray(unlockedBadgeIds) ? [...new Set(unlockedBadgeIds)] : [];
    const badgeAP = validBadges.reduce((sum, badgeId) => {
      const def = this.BADGE_DEFINITIONS.find(b => b.id === badgeId);
      return sum + (def ? def.ap : 0);
    }, 0);
    const safeBonus = Math.max(0, Number(bonusAP) || 0);
    return badgeAP + safeBonus;
  },

  /**
   * Calculates total Experience Points (EXP) from badges and total learning time seconds
   * @param {string[]} unlockedBadgeIds 
   * @param {number} totalLearningTimeSeconds 
   * @returns {number}
   */
  calculateTotalEXP(unlockedBadgeIds = [], totalLearningTimeSeconds = 0) {
    const validBadges = Array.isArray(unlockedBadgeIds) ? [...new Set(unlockedBadgeIds)] : [];
    const badgeEXP = validBadges.reduce((sum, badgeId) => {
      const def = this.BADGE_DEFINITIONS.find(b => b.id === badgeId);
      return sum + (def ? def.exp : 0);
    }, 0);
    const safeTime = Math.max(0, Number(totalLearningTimeSeconds) || 0);
    const learningEXP = Math.floor(safeTime / 6);
    return badgeEXP + learningEXP;
  },

  /**
   * Calculates player Level and Level progress metrics using quadratic curve E(L) = 100L^2 + 100L - 200
   * @param {number} totalEXP 
   * @returns {object} { level, currentLevelThreshold, nextLevelThreshold, expInCurrentLevel, expNeededForNextLevel, progressPct }
   */
  calculateLevelFromEXP(totalEXP = 0) {
    const exp = Math.max(0, Number(totalEXP) || 0);
    const exactL = (-1 + Math.sqrt(9 + (exp / 25))) / 2;
    const level = Math.max(1, Math.floor(exactL));
    const currentLevelThreshold = 100 * (level * level) + 100 * level - 200;
    const nextLevelThreshold = 100 * ((level + 1) * (level + 1)) + 100 * (level + 1) - 200;
    const expNeededForNextLevel = nextLevelThreshold - currentLevelThreshold;
    const expInCurrentLevel = exp - currentLevelThreshold;
    const progressPct = Math.min(100, Math.max(0, Math.floor((expInCurrentLevel / expNeededForNextLevel) * 100)));
    
    return {
      level,
      currentLevelThreshold,
      nextLevelThreshold,
      expInCurrentLevel,
      expNeededForNextLevel,
      progressPct
    };
  },

  /**
   * Returns Rank Tier object and progression details based on total AP
   * @param {number} totalAP 
   * @returns {object} { currentRank, nextRank, tierProgressPct, apInCurrentTier, apNeededForTier, apToNextRank, isMaxRank }
   */
  getRankTierFromAP(totalAP = 0) {
    const ap = Math.max(0, Number(totalAP) || 0);
    let currentRank = this.RANK_TIERS[0];
    let nextRank = this.RANK_TIERS[1];

    for (let i = 0; i < this.RANK_TIERS.length; i++) {
      if (ap >= this.RANK_TIERS[i].minAP) {
        currentRank = this.RANK_TIERS[i];
        nextRank = this.RANK_TIERS[i + 1] || null;
      }
    }

    if (!nextRank || currentRank.maxAP === Infinity) {
      return {
        currentRank,
        nextRank: null,
        tierProgressPct: 100,
        apInCurrentTier: ap - currentRank.minAP,
        apNeededForTier: 0,
        apToNextRank: 0,
        isMaxRank: true
      };
    }

    const apInCurrentTier = ap - currentRank.minAP;
    const apNeededForTier = currentRank.maxAP - currentRank.minAP;
    const tierProgressPct = Math.min(100, Math.max(0, Math.floor((apInCurrentTier / apNeededForTier) * 100)));
    const apToNextRank = currentRank.maxAP - ap;

    return {
      currentRank,
      nextRank,
      tierProgressPct,
      apInCurrentTier,
      apNeededForTier,
      apToNextRank,
      isMaxRank: false
    };
  },

  /**
   * Alias for calculateLevelFromEXP for backwards compatibility
   */
  calculateLevel(totalEXP = 0) {
    return this.calculateLevelFromEXP(totalEXP);
  }
};

// Export to window for Chrome Extension environment & module.exports for Node/CommonJS environment
if (typeof window !== 'undefined') {
  window.GamificationEngine = GamificationEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GamificationEngine;
  GamificationEngine.GamificationEngine = GamificationEngine;
}


