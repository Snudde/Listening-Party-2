// Achievement System Core Logic
// achievement-system.js

/**
 * Calculate user statistics and check for achievement unlocks
 * @param {string} participantId - The participant's ID
 * @param {Array} allRatings - Array of all ratings by this participant
 * @param {Array} albums - Array of all albums the participant has rated
 * @returns {Object} Statistics and newly unlocked achievements
 */
async function checkAndAwardAchievements(participantId, allRatings, albums) {
    try {
        // Get participant data
        const participantDoc = await db.collection('participants').doc(participantId).get();
        if (!participantDoc.exists) {
            console.error('Participant not found');
            return { newAchievements: [], lpcAwarded: 0 };
        }

        const participantData = participantDoc.data();
        const currentAchievements = participantData.achievements || {};
        const currentLPC = participantData.lpc || 0;

        // Calculate current stats
        const stats = calculateUserStats(allRatings, albums, participantId);

        // Check all achievements
        const newlyUnlocked = [];
        let lpcToAward = 0;

        // Check each achievement type
        for (const achievement of getAllAchievements()) {
            const achievementId = achievement.id;
            
            // Skip if already unlocked
            if (currentAchievements[achievementId]?.unlocked) {
                continue;
            }

            let isUnlocked = false;

            // Check based on achievement type
            switch (achievement.type) {
                case 'tracks':
                    isUnlocked = stats.tracksRated >= achievement.target;
                    break;

                case 'albums':
                    isUnlocked = stats.albumsRated >= achievement.target;
                    break;

                case 'perfect10s':
                    isUnlocked = stats.perfect10Count >= achievement.target;
                    break;

                case 'harsh':
                    isUnlocked = stats.harshRatingsCount >= achievement.target;
                    break;

                case 'special':
                    if (achievementId === 'rating_range') {
                        isUnlocked = stats.ratingsUsed.size >= achievement.target;
                    }
                    break;
            }

            // Award achievement if unlocked
            if (isUnlocked) {
                currentAchievements[achievementId] = {
                    unlocked: true,
                    unlockedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                newlyUnlocked.push(achievement);
                lpcToAward += achievement.lpcReward;
            }
        }

        // Update Firestore if there are new achievements
        if (newlyUnlocked.length > 0) {
            await db.collection('participants').doc(participantId).update({
                achievements: currentAchievements,
                lpc: currentLPC + lpcToAward
            });

            console.log(`✅ Awarded ${newlyUnlocked.length} achievements, ${lpcToAward} LPC to ${participantData.name}`);
            
            // Show notifications for new achievements
            showAchievementNotifications(newlyUnlocked, lpcToAward);
        }

        return {
            newAchievements: newlyUnlocked,
            lpcAwarded: lpcToAward,
            stats: stats
        };

    } catch (error) {
        console.error('Error checking achievements:', error);
        return { newAchievements: [], lpcAwarded: 0 };
    }
}

/**
 * Calculate comprehensive user statistics
 */
function calculateUserStats(allRatings, albums, participantId) {
    const tracksRated = allRatings.length;
    const albumsRated = albums.filter(album => {
        // Check if participant has rated at least one track in this album
        return album.participants && album.participants.includes(participantId);
    }).length;

    // Count perfect 10s
    const perfect10Count = allRatings.filter(r => r.rating === 10).length;

    // Count harsh ratings (below 5)
    const harshRatingsCount = allRatings.filter(r => r.rating < 5).length;

    // Track which ratings have been used (for rating_range achievement)
    const ratingsUsed = new Set();
    allRatings.forEach(r => {
        ratingsUsed.add(r.rating);
    });

    return {
        tracksRated,
        albumsRated,
        perfect10Count,
        harshRatingsCount,
        ratingsUsed
    };
}

/**
 * Show achievement unlock notifications
 */
function showAchievementNotifications(achievements, totalLPC) {
    achievements.forEach((achievement, index) => {
        setTimeout(() => {
            const notification = document.createElement('div');
            notification.className = 'achievement-notification';
            notification.innerHTML = `
                <div class="achievement-notification-content">
                    <div class="achievement-icon">${achievement.icon}</div>
                    <div class="achievement-info">
                        <div class="achievement-title">Achievement Unlocked!</div>
                        <div class="achievement-name">${achievement.name}</div>
                        <div class="achievement-reward">+${achievement.lpcReward} LPC</div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(notification);
            
            // Trigger animation
            setTimeout(() => notification.classList.add('show'), 100);
            
            // Remove after 4 seconds
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 500);
            }, 4000);
        }, index * 1000); // Stagger notifications
    });

    // Show total LPC earned if multiple achievements
    if (achievements.length > 1) {
        setTimeout(() => {
            showNotification(`🎉 Earned ${totalLPC} LPC total!`, 'success');
        }, achievements.length * 1000 + 500);
    }
}

/**
 * Get achievement progress for a participant
 */
async function getAchievementProgress(participantId, allRatings, albums) {
    const participantDoc = await db.collection('participants').doc(participantId).get();
    const participantData = participantDoc.data();
    const achievements = participantData.achievements || {};
    const stats = calculateUserStats(allRatings, albums, participantId);

    const progress = {};

    for (const achievement of getAllAchievements()) {
        const achievementId = achievement.id;
        const isUnlocked = achievements[achievementId]?.unlocked || false;
        
        let current = 0;

        // Get current progress based on type
        switch (achievement.type) {
            case 'tracks':
                current = stats.tracksRated;
                break;
            case 'albums':
                current = stats.albumsRated;
                break;
            case 'perfect10s':
                current = stats.perfect10Count;
                break;
            case 'harsh':
                current = stats.harshRatingsCount;
                break;
            case 'special':
                if (achievementId === 'rating_range') {
                    current = stats.ratingsUsed.size;
                }
                break;
        }

        progress[achievementId] = {
            achievement: achievement,
            current: current,
            target: achievement.target,
            unlocked: isUnlocked,
            unlockedAt: achievements[achievementId]?.unlockedAt || null,
            percentage: Math.min(100, Math.round((current / achievement.target) * 100))
        };
    }

    return progress;
}

/**
 * Get total LPC for a participant
 */
async function getParticipantLPC(participantId) {
    const doc = await db.collection('participants').doc(participantId).get();
    return doc.exists ? (doc.data().lpc || 0) : 0;
}