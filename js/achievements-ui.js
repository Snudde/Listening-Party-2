// Achievement UI Display Functions
// achievements-ui.js

/**
 * Render achievements section on stats page
 */
async function renderAchievementsSection(participantId, allRatings, albums) {
    try {
        // Get achievement progress
        const progress = await getAchievementProgress(participantId, allRatings, albums);
        
        // Get participant LPC
        const lpc = await getParticipantLPC(participantId);
        
        // Create container if it doesn't exist
        let achievementsContainer = document.getElementById('achievementsSection');
        if (!achievementsContainer) {
            achievementsContainer = document.createElement('div');
            achievementsContainer.id = 'achievementsSection';
            achievementsContainer.className = 'achievements-section';
            
            // Insert after personal stats section
            const personalStats = document.getElementById('personalStats');
            if (personalStats) {
                personalStats.parentNode.insertBefore(achievementsContainer, personalStats.nextSibling);
            } else {
                document.querySelector('.stats-display').appendChild(achievementsContainer);
            }
        }
        
        // Build achievements HTML
        let html = `
            <div class="achievements-header">
                <h2>🏆 Achievements</h2>
                <div class="lpc-display">
                    <span class="lpc-icon">🪙</span>
                    <span>${lpc.toLocaleString()} LPC</span>
                </div>
            </div>
        `;
        
        // Group achievements by category
        const categories = {
            tracks: { name: 'Track Ratings', icon: '🎵', achievements: [] },
            albums: { name: 'Album Ratings', icon: '💿', achievements: [] },
            perfect10s: { name: 'Perfect 10s', icon: '⭐', achievements: [] },
            harsh: { name: 'Harsh Critic', icon: '🔥', achievements: [] },
            special: { name: 'Special', icon: '🌟', achievements: [] }
        };
        
        // Sort achievements into categories
        Object.values(progress).forEach(item => {
            const type = item.achievement.type;
            if (categories[type]) {
                categories[type].achievements.push(item);
            }
        });
        
        // Render each category
        Object.entries(categories).forEach(([key, category]) => {
            if (category.achievements.length === 0) return;
            
            const unlocked = category.achievements.filter(a => a.unlocked).length;
            const total = category.achievements.length;
            
            html += `
                <div class="achievement-category">
                    <div class="achievement-category-header">
                        <span class="category-icon">${category.icon}</span>
                        <span>${category.name}</span>
                        <span class="category-progress">${unlocked}/${total}</span>
                    </div>
                    <div class="achievements-grid">
            `;
            
            // Sort achievements by target (ascending)
            category.achievements.sort((a, b) => a.target - b.target);
            
            // Render each achievement
            category.achievements.forEach(item => {
                html += renderAchievementCard(item);
            });
            
            html += `
                    </div>
                </div>
            `;
        });
        
        achievementsContainer.innerHTML = html;
        
        console.log('✅ Achievements section rendered');
        
    } catch (error) {
        console.error('Error rendering achievements:', error);
    }
}

/**
 * Render individual achievement card
 */
function renderAchievementCard(item) {
    const { achievement, current, target, unlocked, unlockedAt, percentage } = item;
    const lockedClass = unlocked ? 'unlocked' : 'locked';
    
    let unlockedDate = '';
    if (unlocked && unlockedAt) {
        const date = unlockedAt.toDate ? unlockedAt.toDate() : new Date(unlockedAt);
        unlockedDate = `<div class="achievement-unlocked-date">Unlocked ${formatDate(date)}</div>`;
    }
    
    return `
        <div class="achievement-card ${lockedClass}">
            ${unlocked ? '<div class="achievement-unlocked-badge">✓ Unlocked</div>' : ''}
            <div class="achievement-tier tier-${achievement.tier}">${achievement.tier}</div>
            
            <div class="achievement-header-content">
                <div class="achievement-card-icon">${achievement.icon}</div>
                <div class="achievement-text">
                    <div class="achievement-card-name">${achievement.name}</div>
                    <div class="achievement-card-description">${achievement.description}</div>
                </div>
            </div>
            
            <div class="achievement-progress">
                <div class="achievement-progress-bar">
                    <div class="achievement-progress-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="achievement-progress-text">
                    <span>${current} / ${target}</span>
                    <span>${percentage}%</span>
                </div>
            </div>
            
            ${unlockedDate}
        </div>
    `;
}

/**
 * Format date for achievement unlock
 */
function formatAchievementDate(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
    });
}

/**
 * Update LPC display with animation
 */
function updateLPCDisplay(newLPC) {
    const lpcDisplay = document.querySelector('.lpc-display');
    if (lpcDisplay) {
        const lpcText = lpcDisplay.querySelector('span:last-child');
        if (lpcText) {
            lpcText.textContent = `${newLPC.toLocaleString()} LPC`;
            lpcDisplay.classList.add('updated');
            setTimeout(() => lpcDisplay.classList.remove('updated'), 600);
        }
    }
}

/**
 * Show achievement summary stats
 */
async function getAchievementSummary(participantId, allRatings, albums) {
    const progress = await getAchievementProgress(participantId, allRatings, albums);
    const lpc = await getParticipantLPC(participantId);
    
    const allAchievements = Object.values(progress);
    const unlockedCount = allAchievements.filter(a => a.unlocked).length;
    const totalCount = allAchievements.length;
    const completionPercentage = Math.round((unlockedCount / totalCount) * 100);
    
    return {
        lpc,
        unlockedCount,
        totalCount,
        completionPercentage
    };
}