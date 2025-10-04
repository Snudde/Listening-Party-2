// Achievement System Configuration
// achievements-config.js

const ACHIEVEMENTS = {
    // Track Rating Achievements
    tracks_1: {
        id: 'tracks_1',
        name: 'First Track',
        description: 'Rate your first track',
        type: 'tracks',
        target: 1,
        lpcReward: 5,
        icon: '🎵',
        tier: 'bronze'
    },
    tracks_10: {
        id: 'tracks_10',
        name: 'Getting Started',
        description: 'Rate 10 tracks',
        type: 'tracks',
        target: 10,
        lpcReward: 5,
        icon: '🎶',
        tier: 'bronze'
    },
    tracks_25: {
        id: 'tracks_25',
        name: 'Track Explorer',
        description: 'Rate 25 tracks',
        type: 'tracks',
        target: 25,
        lpcReward: 5,
        icon: '🎼',
        tier: 'silver'
    },
    tracks_50: {
        id: 'tracks_50',
        name: 'Music Enthusiast',
        description: 'Rate 50 tracks',
        type: 'tracks',
        target: 50,
        lpcReward: 5,
        icon: '🎹',
        tier: 'silver'
    },
    tracks_100: {
        id: 'tracks_100',
        name: 'Century Club',
        description: 'Rate 100 tracks',
        type: 'tracks',
        target: 100,
        lpcReward: 5,
        icon: '💯',
        tier: 'gold'
    },
    tracks_150: {
        id: 'tracks_150',
        name: 'Dedicated Listener',
        description: 'Rate 150 tracks',
        type: 'tracks',
        target: 150,
        lpcReward: 5,
        icon: '🎧',
        tier: 'gold'
    },
    tracks_200: {
        id: 'tracks_200',
        name: 'Track Master',
        description: 'Rate 200 tracks',
        type: 'tracks',
        target: 200,
        lpcReward: 5,
        icon: '🏆',
        tier: 'platinum'
    },
    tracks_300: {
        id: 'tracks_300',
        name: 'Music Veteran',
        description: 'Rate 300 tracks',
        type: 'tracks',
        target: 300,
        lpcReward: 5,
        icon: '⭐',
        tier: 'platinum'
    },
    tracks_400: {
        id: 'tracks_400',
        name: 'Elite Rater',
        description: 'Rate 400 tracks',
        type: 'tracks',
        target: 400,
        lpcReward: 5,
        icon: '🌟',
        tier: 'diamond'
    },
    tracks_500: {
        id: 'tracks_500',
        name: 'Legend',
        description: 'Rate 500 tracks',
        type: 'tracks',
        target: 500,
        lpcReward: 5,
        icon: '👑',
        tier: 'diamond'
    },

    // Album Rating Achievements
    albums_1: {
        id: 'albums_1',
        name: 'First Album',
        description: 'Rate your first album',
        type: 'albums',
        target: 1,
        lpcReward: 5,
        icon: '💿',
        tier: 'bronze'
    },
    albums_3: {
        id: 'albums_3',
        name: 'Album Collector',
        description: 'Rate 3 albums',
        type: 'albums',
        target: 3,
        lpcReward: 5,
        icon: '📀',
        tier: 'bronze'
    },
    albums_5: {
        id: 'albums_5',
        name: 'Album Explorer',
        description: 'Rate 5 albums',
        type: 'albums',
        target: 5,
        lpcReward: 5,
        icon: '💽',
        tier: 'silver'
    },
    albums_10: {
        id: 'albums_10',
        name: 'Album Aficionado',
        description: 'Rate 10 albums',
        type: 'albums',
        target: 10,
        lpcReward: 5,
        icon: '🎺',
        tier: 'silver'
    },
    albums_20: {
        id: 'albums_20',
        name: 'Album Master',
        description: 'Rate 20 albums',
        type: 'albums',
        target: 20,
        lpcReward: 5,
        icon: '🎸',
        tier: 'gold'
    },
    albums_50: {
        id: 'albums_50',
        name: 'Album Legend',
        description: 'Rate 50 albums',
        type: 'albums',
        target: 50,
        lpcReward: 5,
        icon: '🎻',
        tier: 'platinum'
    },

    // Perfect 10s Achievements
    perfect10s_1: {
        id: 'perfect10s_1',
        name: 'Perfection Found',
        description: 'Give your first perfect 10',
        type: 'perfect10s',
        target: 1,
        lpcReward: 5,
        icon: '🌠',
        tier: 'bronze'
    },
    perfect10s_5: {
        id: 'perfect10s_5',
        name: 'High Standards',
        description: 'Give 5 perfect 10s',
        type: 'perfect10s',
        target: 5,
        lpcReward: 5,
        icon: '✨',
        tier: 'silver'
    },
    perfect10s_10: {
        id: 'perfect10s_10',
        name: 'Perfectionist',
        description: 'Give 10 perfect 10s',
        type: 'perfect10s',
        target: 10,
        lpcReward: 5,
        icon: '💎',
        tier: 'gold'
    },
    perfect10s_15: {
        id: 'perfect10s_15',
        name: 'Flawless Taste',
        description: 'Give 15 perfect 10s',
        type: 'perfect10s',
        target: 15,
        lpcReward: 5,
        icon: '🔷',
        tier: 'platinum'
    },
    perfect10s_20: {
        id: 'perfect10s_20',
        name: 'Perfect Vision',
        description: 'Give 20 perfect 10s',
        type: 'perfect10s',
        target: 20,
        lpcReward: 5,
        icon: '💠',
        tier: 'diamond'
    },

    // Harsh Critic Achievements (ratings below 5)
    harsh_critic_1: {
        id: 'harsh_critic_1',
        name: 'Not Impressed',
        description: 'Give your first rating below 5',
        type: 'harsh',
        target: 1,
        lpcReward: 5,
        icon: '😒',
        tier: 'bronze'
    },
    harsh_critic_5: {
        id: 'harsh_critic_5',
        name: 'Harsh Critic',
        description: 'Give 5 ratings below 5',
        type: 'harsh',
        target: 5,
        lpcReward: 5,
        icon: '👎',
        tier: 'silver'
    },
    harsh_critic_10: {
        id: 'harsh_critic_10',
        name: 'Tough Judge',
        description: 'Give 10 ratings below 5',
        type: 'harsh',
        target: 10,
        lpcReward: 5,
        icon: '🔥',
        tier: 'gold'
    },
    harsh_critic_20: {
        id: 'harsh_critic_20',
        name: 'Brutally Honest',
        description: 'Give 20 ratings below 5',
        type: 'harsh',
        target: 20,
        lpcReward: 5,
        icon: '❄️',
        tier: 'platinum'
    },
    harsh_critic_50: {
        id: 'harsh_critic_50',
        name: 'Ice Cold',
        description: 'Give 50 ratings below 5',
        type: 'harsh',
        target: 50,
        lpcReward: 5,
        icon: '🧊',
        tier: 'diamond'
    },

    // Special Achievement
    rating_range: {
        id: 'rating_range',
        name: 'Full Spectrum',
        description: 'Use every rating from 0 to 10 at least once',
        type: 'special',
        target: 11, // 0-10 inclusive
        lpcReward: 10, // Extra reward for special achievement
        icon: '🌈',
        tier: 'gold'
    }
};

// Helper function to get all achievements as an array
function getAllAchievements() {
    return Object.values(ACHIEVEMENTS);
}

// Helper function to get achievements by type
function getAchievementsByType(type) {
    return Object.values(ACHIEVEMENTS).filter(a => a.type === type);
}

// Helper function to get achievement by ID
function getAchievement(id) {
    return ACHIEVEMENTS[id];
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ACHIEVEMENTS, getAllAchievements, getAchievementsByType, getAchievement };
}