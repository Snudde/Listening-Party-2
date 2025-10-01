// Stats Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
    console.log('📊 Stats page loaded');
    
    loadParticipants();
    
    document.getElementById('participantSelect').addEventListener('change', handleParticipantChange);
    
    // Tab switching
    document.getElementById('personalTab').addEventListener('click', () => switchTab('personal'));
    document.getElementById('globalTab').addEventListener('click', () => switchTab('global'));
    
    // Load global stats on page load
    loadGlobalStats();
});

// Switch between tabs
function switchTab(tab) {
    document.querySelectorAll('.stats-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.stats-tab-content').forEach(c => c.classList.remove('active'));
    
    if (tab === 'personal') {
        document.getElementById('personalTab').classList.add('active');
        document.getElementById('personalStatsTab').classList.add('active');
    } else {
        document.getElementById('globalTab').classList.add('active');
        document.getElementById('globalStatsTab').classList.add('active');
    }
}

// Load participants into dropdown
async function loadParticipants() {
    try {
        const snapshot = await db.collection('participants').orderBy('username').get();
        const select = document.getElementById('participantSelect');
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = data.username;
            select.appendChild(option);
        });
        
        console.log(`✅ Loaded ${snapshot.size} participants`);
    } catch (error) {
        console.error('❌ Error loading participants:', error);
        showNotification('Error loading participants', 'error');
    }
}

// Handle participant selection change
async function handleParticipantChange(e) {
    const participantId = e.target.value;
    
    if (!participantId) {
        document.getElementById('statsDisplay').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
        document.getElementById('noDataState').style.display = 'none';
        return;
    }
    
    await loadParticipantStats(participantId);
}

// Load and display participant stats
async function loadParticipantStats(participantId) {
    try {
        // Get all completed albums where this participant rated
        const snapshot = await db.collection('albums')
            .where('participants', 'array-contains', participantId)
            .get();
        
        if (snapshot.empty) {
            document.getElementById('statsDisplay').style.display = 'none';
            document.getElementById('emptyState').style.display = 'none';
            document.getElementById('noDataState').style.display = 'block';
            return;
        }
        
        // Collect all ratings from this participant
        const allRatings = [];
        const albumsData = [];
        let totalTracks = 0;
        
        snapshot.forEach(doc => {
            const album = doc.data();
            albumsData.push({
                id: doc.id,
                title: album.title,
                artist: album.artist,
                coverImage: album.coverImage,
                ...album
            });
            
            // Extract this participant's ratings
            if (album.ratings && album.tracks) {
                album.tracks.forEach(track => {
                    const rating = album.ratings[track.number]?.[participantId];
                    if (rating !== null && rating !== undefined) {
                        allRatings.push({
                            rating: rating,
                            track: track.title,
                            album: album.title,
                            artist: album.artist,
                            albumId: doc.id,           // ADD THIS
    albumCover: album.coverImage || ''  // ADD THIS
                        });
                        totalTracks++;
                    }
                });
            }
        });
        
        // Calculate statistics
        const stats = calculateStats(allRatings, albumsData, participantId);
        
        // Display stats
        displayStats(stats, albumsData);
        
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('noDataState').style.display = 'none';
        document.getElementById('statsDisplay').style.display = 'block';
        
        console.log('✅ Stats calculated:', stats);
        console.log('✅ Stats calculated:', stats);
console.log('🔍 ABOUT TO CALL DISPLAY FUNCTIONS');
displayDreamAndNightmareAlbums(allRatings);
console.log('🔍 CALLED displayDreamAndNightmareAlbums');
displaySocialStats(participantId, albumsData, allRatings);
console.log('🔍 CALLED displaySocialStats');
    } catch (error) {
        console.error('❌ Error loading stats:', error);
        showNotification('Error loading statistics', 'error');
    }
}

// Calculate statistics
function calculateStats(allRatings, albums, participantId) {
    if (allRatings.length === 0) {
        return {
            avgRating: 0,
            albumsRated: 0,
            tracksRated: 0,
            distribution: {},
            favoriteAlbum: null,
            highestRated: null,
            lowestRated: null,
            mostCommon: null,
            style: 'No data'
        };
    }
    
    // Average rating
    const sum = allRatings.reduce((acc, r) => acc + r.rating, 0);
    const avgRating = (sum / allRatings.length).toFixed(2);
    
    // Rating distribution
    const distribution = {};
    for (let i = 0; i <= 10; i++) {
        distribution[i] = 0;
    }
    allRatings.forEach(r => {
        distribution[r.rating]++;
    });
    
    // Favorite album (highest average rating given by this participant)
    let favoriteAlbum = null;
    let highestAvg = -1;
    
    albums.forEach(album => {
        if (album.ratings && album.tracks) {
            const participantRatings = [];
            album.tracks.forEach(track => {
                const rating = album.ratings[track.number]?.[participantId];
                if (rating !== null && rating !== undefined) {
                    participantRatings.push(rating);
                }
            });
            
            if (participantRatings.length > 0) {
                const avg = participantRatings.reduce((a, b) => a + b, 0) / participantRatings.length;
                if (avg > highestAvg) {
                    highestAvg = avg;
                    favoriteAlbum = {
                        title: album.title,
                        artist: album.artist,
                        score: avg.toFixed(2)
                    };
                }
            }
        }
    });
    
    // Highest and lowest rated tracks
    const sortedRatings = [...allRatings].sort((a, b) => b.rating - a.rating);
    const highestRated = sortedRatings[0];
    const lowestRated = sortedRatings[sortedRatings.length - 1];
    
    // Most common rating
    let mostCommon = 0;
    let maxCount = 0;
    Object.entries(distribution).forEach(([rating, count]) => {
        if (count > maxCount) {
            maxCount = count;
            mostCommon = parseInt(rating);
        }
    });
    
    // Rating style
    const stdDev = calculateStandardDeviation(allRatings.map(r => r.rating));
    let style = '';
    if (stdDev < 1.5) {
        style = 'Consistent';
    } else if (stdDev < 2.5) {
        style = 'Moderate';
    } else {
        style = 'Varied';
    }
    
    if (parseFloat(avgRating) >= 7) {
        style += ' - Generous';
    } else if (parseFloat(avgRating) <= 5) {
        style += ' - Critical';
    } else {
        style += ' - Balanced';
    }
    
    return {
        avgRating,
        albumsRated: albums.length,
        tracksRated: allRatings.length,
        distribution,
        favoriteAlbum,
        highestRated,
        lowestRated,
        mostCommon,
        style
    };
}

// Calculate standard deviation
function calculateStandardDeviation(values) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
}

// Display statistics

function displayStats(stats, albums) {
    // Overview cards
    document.getElementById('avgRating').textContent = stats.avgRating;
    document.getElementById('albumsRated').textContent = stats.albumsRated;
    document.getElementById('tracksRated').textContent = stats.tracksRated;
    
    // Favorite Album - Display as card
    if (stats.favoriteAlbum) {
        const favoriteAlbumData = albums.find(a => a.title === stats.favoriteAlbum.title);
        if (favoriteAlbumData) {
            document.getElementById('favoriteAlbumCard').innerHTML = `
                <div class="favorite-album-card" onclick="window.location.href='albums.html?id=${favoriteAlbumData.id}'">
                    <div class="favorite-album-cover">
                        ${favoriteAlbumData.coverImage 
                            ? `<img src="${favoriteAlbumData.coverImage}" alt="${favoriteAlbumData.title}">` 
                            : `<div class="favorite-album-placeholder">🎵</div>`
                        }
                    </div>
                    <div class="favorite-album-info">
                        <strong>${stats.favoriteAlbum.title}</strong>
                        <span>${stats.favoriteAlbum.artist}</span>
                        <span class="favorite-album-score ${getScoreClass(parseFloat(stats.favoriteAlbum.score))}">${stats.favoriteAlbum.score}</span>
                    </div>
                </div>
            `;
        }
    } else {
        document.getElementById('favoriteAlbumCard').innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No favorite album yet</p>';
    }
    
    // Rating distribution
    displayRatingDistribution(stats.distribution, stats.tracksRated);
    
    // Albums participated in
    displayParticipatedAlbums(albums);
    
    // Tendencies - Highest Rated Track
    if (stats.highestRated) {
        const highestAlbumData = albums.find(a => a.title === stats.highestRated.album);
        if (highestAlbumData) {
            document.getElementById('highestTrackCard').innerHTML = `
                <div class="tendency-track-card" onclick="window.location.href='albums.html?id=${highestAlbumData.id}'">
                    <div class="tendency-track-cover">
                        ${highestAlbumData.coverImage 
                            ? `<img src="${highestAlbumData.coverImage}" alt="${highestAlbumData.title}">` 
                            : `<div class="tendency-track-placeholder">🎵</div>`
                        }
                    </div>
                    <div class="tendency-track-info">
                        <strong>${stats.highestRated.track}</strong>
                        <span>${stats.highestRated.album} - ${stats.highestRated.artist}</span>
                        <span class="tendency-track-score ${getScoreClass(stats.highestRated.rating)}">${formatScore(stats.highestRated.rating)}</span>
                    </div>
                </div>
            `;
        }
    } else {
        document.getElementById('highestTrackCard').innerHTML = '<p style="text-align: center; color: var(--text-secondary);">-</p>';
    }
    
    // Tendencies - Lowest Rated Track
    if (stats.lowestRated) {
        const lowestAlbumData = albums.find(a => a.title === stats.lowestRated.album);
        if (lowestAlbumData) {
            document.getElementById('lowestTrackCard').innerHTML = `
                <div class="tendency-track-card" onclick="window.location.href='albums.html?id=${lowestAlbumData.id}'">
                    <div class="tendency-track-cover">
                        ${lowestAlbumData.coverImage 
                            ? `<img src="${lowestAlbumData.coverImage}" alt="${lowestAlbumData.title}">` 
                            : `<div class="tendency-track-placeholder">🎵</div>`
                        }
                    </div>
                    <div class="tendency-track-info">
                        <strong>${stats.lowestRated.track}</strong>
                        <span>${stats.lowestRated.album} - ${stats.lowestRated.artist}</span>
                        <span class="tendency-track-score ${getScoreClass(stats.lowestRated.rating)}">${formatScore(stats.lowestRated.rating)}</span>
                    </div>
                </div>
            `;
        }
    } else {
        document.getElementById('lowestTrackCard').innerHTML = '<p style="text-align: center; color: var(--text-secondary);">-</p>';
    }
    
    document.getElementById('mostCommon').textContent = stats.mostCommon;
    document.getElementById('ratingStyle').textContent = stats.style;
}

// Display rating distribution chart
function displayRatingDistribution(distribution, total) {
    const container = document.getElementById('ratingDistribution');
    container.innerHTML = '';
    
    for (let i = 10; i >= 0; i--) {
        const count = distribution[i] || 0;
        const percentage = total > 0 ? (count / total * 100).toFixed(1) : 0;
        
        const bar = document.createElement('div');
        bar.className = 'distribution-bar';
        bar.innerHTML = `
            <div class="distribution-label">${i}</div>
            <div class="distribution-bar-container">
                <div class="distribution-bar-fill ${getScoreClass(i)}" style="width: ${percentage}%"></div>
            </div>
            <div class="distribution-count">${count} (${percentage}%)</div>
        `;
        container.appendChild(bar);
    }
}

// Display participated albums
function displayParticipatedAlbums(albums) {
    const container = document.getElementById('participatedAlbums');
    container.innerHTML = '';
    
    if (albums.length === 0) {
        container.innerHTML = '<p>No albums yet</p>';
        return;
    }
    
    albums.forEach(album => {
        const albumCard = document.createElement('div');
        const scoreClass = album.isCompleted && album.averageScore ? getScoreClass(album.averageScore) : '';
        albumCard.className = `participated-album-card ${scoreClass}`;
        albumCard.onclick = () => window.location.href = `albums.html?id=${album.id}`;
        
        albumCard.innerHTML = `
            <div class="participated-album-cover">
                ${album.coverImage 
                    ? `<img src="${album.coverImage}" alt="${album.title}">` 
                    : `<div class="album-placeholder-small">🎵</div>`
                }
            </div>
            <div class="participated-album-info">
                <h4>${album.title}</h4>
                <p>${album.artist}</p>
                ${album.isCompleted ? `<span class="album-score-badge ${getScoreClass(album.averageScore || 0)}">${(album.averageScore || 0).toFixed(2)}</span>` : '<span class="status-badge in-progress">In Progress</span>'}
            </div>
        `;
        container.appendChild(albumCard);
    });
}

// Display dream and nightmare albums
function displayDreamAndNightmareAlbums(allRatings) {
    const dreamContainer = document.getElementById('dreamAlbum');
    const nightmareContainer = document.getElementById('nightmareAlbum');
    
    console.log('🎵 Displaying dream/nightmare albums, total ratings:', allRatings.length);
    
    if (allRatings.length === 0) {
        dreamContainer.innerHTML = '<p>No ratings yet</p>';
        nightmareContainer.innerHTML = '<p>No ratings yet</p>';
        return;
    }
    
    // Sort by rating
    const sortedRatings = [...allRatings].sort((a, b) => b.rating - a.rating);
    
    // Top 10 tracks
    const topTracks = sortedRatings.slice(0, 10);
    dreamContainer.innerHTML = '';
    console.log('✨ Dream album top tracks:', topTracks.length);
    console.log('First track data:', topTracks[0]);
    
    topTracks.forEach((track, index) => {
        const trackEl = document.createElement('div');
        trackEl.className = 'dream-track-item';
        trackEl.onclick = () => window.location.href = `albums.html?id=${track.albumId}`;
        trackEl.innerHTML = `
            <div class="dream-track-rank">${index + 1}</div>
            <div class="dream-track-cover">
                ${track.albumCover 
                    ? `<img src="${track.albumCover}" alt="${track.album}">` 
                    : `<div class="dream-track-placeholder">🎵</div>`
                }
            </div>
            <div class="dream-track-info">
                <strong>${track.track}</strong>
                <span class="dream-track-album">${track.album} - ${track.artist}</span>
            </div>
            <div class="dream-track-score ${getScoreClass(track.rating)}">${formatScore(track.rating)}</div>
        `;
        dreamContainer.appendChild(trackEl);
    });
    
    console.log('✨ Dream album rendered, container children:', dreamContainer.children.length);
    
    // Bottom 10 tracks
    const bottomTracks = sortedRatings.slice(-10).reverse();
    nightmareContainer.innerHTML = '';
    console.log('💀 Nightmare album bottom tracks:', bottomTracks.length);
    bottomTracks.forEach((track, index) => {
        const trackEl = document.createElement('div');
        trackEl.className = 'dream-track-item';
        trackEl.onclick = () => window.location.href = `albums.html?id=${track.albumId}`;
        trackEl.innerHTML = `
            <div class="dream-track-rank">${index + 1}</div>
            <div class="dream-track-cover">
                ${track.albumCover 
                    ? `<img src="${track.albumCover}" alt="${track.album}">` 
                    : `<div class="dream-track-placeholder">🎵</div>`
                }
            </div>
            <div class="dream-track-info">
                <strong>${track.track}</strong>
                <span class="dream-track-album">${track.album} - ${track.artist}</span>
            </div>
            <div class="dream-track-score ${getScoreClass(track.rating)}">${formatScore(track.rating)}</div>
        `;
        nightmareContainer.appendChild(trackEl);
    });
}

// Display social stats (taste twin, disagreements, contrarian picks)
async function displaySocialStats(participantId, albums, userRatings) {
    // Get all other participants and their ratings
    const allParticipants = new Set();
    albums.forEach(album => {
        album.participants.forEach(pId => {
            if (pId !== participantId) allParticipants.add(pId);
        });
    });
    
    if (allParticipants.size === 0) {
        document.getElementById('tasteTwin').innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No other participants</p>';
        document.getElementById('biggestDisagreement').innerHTML = '<p style="text-align: center; color: var(--text-secondary);">N/A</p>';
        document.getElementById('contrarianPick').innerHTML = '<p style="text-align: center; color: var(--text-secondary);">N/A</p>';
        return;
    }
    
    // Find taste twin (most agreement)
    let tasteTwin = null;
let tasteTwinData = null;
let lowestDiff = Infinity;

for (const otherId of allParticipants) {
    let totalDiff = 0;
    let comparisons = 0;
    
    albums.forEach(album => {
        if (album.participants.includes(participantId) && album.participants.includes(otherId)) {
            album.tracks.forEach(track => {
                const userRating = album.ratings?.[track.number]?.[participantId];
                const otherRating = album.ratings?.[track.number]?.[otherId];
                if (userRating !== null && userRating !== undefined && otherRating !== null && otherRating !== undefined) {
                    totalDiff += Math.abs(userRating - otherRating);
                    comparisons++;
                }
            });
        }
    });
    
    if (comparisons > 0) {
        const avgDiff = totalDiff / comparisons;
        if (avgDiff < lowestDiff) {
            lowestDiff = avgDiff;
            const doc = await db.collection('participants').doc(otherId).get();
            const data = doc.data();
            tasteTwinData = {
                username: data.username,
                profilePicture: data.profilePicture || ''
            };
        }
    }
}

if (tasteTwinData) {
    document.getElementById('tasteTwin').innerHTML = `
        <div class="taste-twin-display">
            <div class="taste-twin-avatar">
                ${tasteTwinData.profilePicture 
                    ? `<img src="${tasteTwinData.profilePicture}" alt="${tasteTwinData.username}">` 
                    : `<div class="avatar-placeholder">${tasteTwinData.username.charAt(0).toUpperCase()}</div>`
                }
            </div>
            <strong>${tasteTwinData.username}</strong>
        </div>
    `;
    document.getElementById('tasteTwinScore').textContent = lowestDiff !== Infinity ? `Avg diff: ${lowestDiff.toFixed(2)}` : '';
} else {
    document.getElementById('tasteTwin').innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No other participants</p>';
    document.getElementById('tasteTwinScore').textContent = '';
}
    
    // Find biggest disagreement (single track with biggest diff from average)
    let biggestDisagreement = null;
    let maxDiff = 0;
    
    albums.forEach(album => {
        album.tracks.forEach(track => {
            const userRating = album.ratings?.[track.number]?.[participantId];
            if (userRating !== null && userRating !== undefined) {
                const allRatings = Object.values(album.ratings?.[track.number] || {}).filter(r => r !== null && r !== undefined);
                if (allRatings.length > 1) {
                    const avg = allRatings.reduce((a, b) => a + b, 0) / allRatings.length;
                    const diff = Math.abs(userRating - avg);
                    if (diff > maxDiff) {
                        maxDiff = diff;
                        biggestDisagreement = {
                            track: track.title,
                            album: album.title,
                            albumId: album.id,
                            albumCover: album.coverImage || '',
                            userRating,
                            groupAvg: avg
                        };
                    }
                }
            }
        });
    });
    
    if (biggestDisagreement) {
        document.getElementById('biggestDisagreement').innerHTML = `
            <div class="social-stat-album" onclick="window.location.href='albums.html?id=${biggestDisagreement.albumId}'">
                <div class="social-stat-cover">
                    ${biggestDisagreement.albumCover 
                        ? `<img src="${biggestDisagreement.albumCover}" alt="${biggestDisagreement.album}">` 
                        : `<div class="social-stat-placeholder">🎵</div>`
                    }
                </div>
                <div class="social-stat-info">
                    <strong>${biggestDisagreement.track}</strong>
                    <span>${biggestDisagreement.album}</span>
                </div>
            </div>
        `;
        document.getElementById('disagreementDiff').textContent = `You: ${formatScore(biggestDisagreement.userRating)} / Group: ${biggestDisagreement.groupAvg.toFixed(1)}`;
    } else {
        document.getElementById('biggestDisagreement').innerHTML = '<p style="text-align: center; color: var(--text-secondary);">N/A</p>';
        document.getElementById('disagreementDiff').textContent = '';
    }
    
    // Find contrarian pick (album where user differs most from group)
    let contrarianPick = null;
    let maxAlbumDiff = 0;
    
    albums.forEach(album => {
        let userTotal = 0;
        let userCount = 0;
        let groupTotal = 0;
        let groupCount = 0;
        
        album.tracks.forEach(track => {
            const userRating = album.ratings?.[track.number]?.[participantId];
            if (userRating !== null && userRating !== undefined) {
                userTotal += userRating;
                userCount++;
            }
            
            Object.entries(album.ratings?.[track.number] || {}).forEach(([pId, rating]) => {
                if (pId !== participantId && rating !== null && rating !== undefined) {
                    groupTotal += rating;
                    groupCount++;
                }
            });
        });
        
        if (userCount > 0 && groupCount > 0) {
            const userAvg = userTotal / userCount;
            const groupAvg = groupTotal / groupCount;
            const diff = Math.abs(userAvg - groupAvg);
            
            if (diff > maxAlbumDiff) {
                maxAlbumDiff = diff;
                contrarianPick = {
                    album: album.title,
                    albumId: album.id,
                    albumCover: album.coverImage || '',
                    userAvg,
                    groupAvg
                };
            }
        }
    });
    
    if (contrarianPick) {
        document.getElementById('contrarianPick').innerHTML = `
            <div class="social-stat-album" onclick="window.location.href='albums.html?id=${contrarianPick.albumId}'">
                <div class="social-stat-cover">
                    ${contrarianPick.albumCover 
                        ? `<img src="${contrarianPick.albumCover}" alt="${contrarianPick.album}">` 
                        : `<div class="social-stat-placeholder">🎵</div>`
                    }
                </div>
                <div class="social-stat-info">
                    <strong>${contrarianPick.album}</strong>
                </div>
            </div>
        `;
        document.getElementById('contrarianDiff').textContent = `You: ${contrarianPick.userAvg.toFixed(1)} / Group: ${contrarianPick.groupAvg.toFixed(1)}`;
    } else {
        document.getElementById('contrarianPick').innerHTML = '<p style="text-align: center; color: var(--text-secondary);">N/A</p>';
        document.getElementById('contrarianDiff').textContent = '';
    }
}

// Load global stats
async function loadGlobalStats() {
    try {
        const [participantsSnapshot, albumsSnapshot] = await Promise.all([
            db.collection('participants').get(),
            db.collection('albums').where('isCompleted', '==', true).get()
        ]);
        
        if (participantsSnapshot.empty || albumsSnapshot.empty) {
            document.querySelectorAll('.leaderboard-result').forEach(el => {
                el.textContent = 'Not enough data';
            });
            return;
        }
        
        // Collect all data
        const participants = [];
        participantsSnapshot.forEach(doc => {
            participants.push({ id: doc.id, ...doc.data() });
        });
        
        const albums = [];
        albumsSnapshot.forEach(doc => {
            albums.push({ id: doc.id, ...doc.data() });
        });
        
        // Calculate participant stats
        const participantStats = {};
        
        participants.forEach(p => {
            participantStats[p.id] = {
                name: p.username,
                allRatings: [],
                albumCount: 0,
                tens: 0,
                lowRatings: 0,
                legendaryRatings: 0
            };
        });
        
        albums.forEach(album => {
            album.participants.forEach(pId => {
                if (participantStats[pId]) {
                    participantStats[pId].albumCount++;
                    
                    album.tracks.forEach(track => {
                        const rating = album.ratings?.[track.number]?.[pId];
                        if (rating !== null && rating !== undefined) {
                            participantStats[pId].allRatings.push(rating);
                            if (rating === 10) participantStats[pId].tens++;
                            if (rating <= 3) participantStats[pId].lowRatings++;
                            if (rating >= 9) participantStats[pId].legendaryRatings++;
                        }
                    });
                }
            });
        });
        
        // Calculate averages and variances
        Object.values(participantStats).forEach(stats => {
            if (stats.allRatings.length > 0) {
                stats.average = stats.allRatings.reduce((a, b) => a + b, 0) / stats.allRatings.length;
                stats.variance = calculateVariance(stats.allRatings);
            } else {
                stats.average = 0;
                stats.variance = 0;
            }
        });
        
        // Display participant leaderboards
        const statsArray = Object.values(participantStats).filter(s => s.allRatings.length > 0);

// Get full participant data with profile pictures
const participantDataMap = {};
participants.forEach(p => {
    participantDataMap[p.id] = p;
});

// Helper function to create participant display HTML
function createParticipantDisplay(participantName) {
    const participant = participants.find(p => p.username === participantName);
    if (!participant) return `<strong>${participantName}</strong>`;
    
    return `
        <div class="leaderboard-participant">
            <div class="leaderboard-avatar">
                ${participant.profilePicture 
                    ? `<img src="${participant.profilePicture}" alt="${participantName}">` 
                    : `<div class="avatar-placeholder-small">${participantName.charAt(0).toUpperCase()}</div>`
                }
            </div>
            <strong>${participantName}</strong>
        </div>
    `;
}

// Biggest Fan
const biggestFan = statsArray.reduce((max, p) => p.average > max.average ? p : max);
document.getElementById('biggestFan').innerHTML = `
    ${createParticipantDisplay(biggestFan.name)}
    <span class="leaderboard-stat">${biggestFan.average.toFixed(2)} avg</span>
`;

// Harshest Critic
const harshestCritic = statsArray.reduce((min, p) => p.average < min.average ? p : min);
document.getElementById('harshestCritic').innerHTML = `
    ${createParticipantDisplay(harshestCritic.name)}
    <span class="leaderboard-stat">${harshestCritic.average.toFixed(2)} avg</span>
`;

// Most Consistent
const mostConsistent = statsArray.reduce((min, p) => p.variance < min.variance ? p : min);
document.getElementById('mostConsistent').innerHTML = `
    ${createParticipantDisplay(mostConsistent.name)}
    <span class="leaderboard-stat">σ² = ${mostConsistent.variance.toFixed(2)}</span>
`;

// Most Diverse
const mostDiverse = statsArray.reduce((max, p) => p.variance > max.variance ? p : max);
document.getElementById('mostDiverse').innerHTML = `
    ${createParticipantDisplay(mostDiverse.name)}
    <span class="leaderboard-stat">σ² = ${mostDiverse.variance.toFixed(2)}</span>
`;

// Most Active
const mostActive = statsArray.reduce((max, p) => p.albumCount > max.albumCount ? p : max);
document.getElementById('mostActive').innerHTML = `
    ${createParticipantDisplay(mostActive.name)}
    <span class="leaderboard-stat">${mostActive.albumCount} albums</span>
`;

// Legendary Lover
const legendaryLover = statsArray.reduce((max, p) => p.legendaryRatings > max.legendaryRatings ? p : max);
document.getElementById('legendaryLover').innerHTML = `
    ${createParticipantDisplay(legendaryLover.name)}
    <span class="leaderboard-stat">${legendaryLover.legendaryRatings} ratings ≥ 9</span>
`;

// Track Executioner
const trackExecutioner = statsArray.reduce((max, p) => p.lowRatings > max.lowRatings ? p : max);
document.getElementById('trackExecutioner').innerHTML = `
    ${createParticipantDisplay(trackExecutioner.name)}
    <span class="leaderboard-stat">${trackExecutioner.lowRatings} ratings ≤ 3</span>
`;

// Perfect Score Giver
const perfectScoreGiver = statsArray.reduce((max, p) => p.tens > max.tens ? p : max);
document.getElementById('perfectScoreGiver').innerHTML = `
    ${createParticipantDisplay(perfectScoreGiver.name)}
    <span class="leaderboard-stat">${perfectScoreGiver.tens} perfect 10s</span>
`;
        
        // Album stats (with clickable albums)
        const albumStats = albums.map(album => {
            const allRatings = [];
            album.tracks.forEach(track => {
                Object.values(album.ratings?.[track.number] || {}).forEach(rating => {
                    if (rating !== null && rating !== undefined) {
                        allRatings.push(rating);
                    }
                });
            });
            
            return {
                id: album.id,
                title: album.title,
                artist: album.artist,
                coverImage: album.coverImage || '',
                variance: calculateVariance(allRatings),
                participantCount: album.participants.length,
                averageScore: album.averageScore || 0
            };
        });
        
  
// Most Divisive
        const mostDivisive = albumStats.reduce((max, a) => a.variance > max.variance ? a : max);
        document.getElementById('mostDivisive').innerHTML = `
            <div class="global-stat-album" onclick="window.location.href='albums.html?id=${mostDivisive.id}'">
                <div class="global-stat-cover">
                    ${mostDivisive.coverImage 
                        ? `<img src="${mostDivisive.coverImage}" alt="${mostDivisive.title}">` 
                        : `<div class="global-stat-placeholder">🎵</div>`
                    }
                </div>
                <div class="global-stat-info">
                    <strong>${mostDivisive.title}</strong>
                    <span>${mostDivisive.artist}</span>
                    <span class="global-stat-detail">σ² = ${mostDivisive.variance.toFixed(2)}</span>
                </div>
            </div>
        `;
        
        // Most Agreed Upon
        const mostAgreed = albumStats.reduce((min, a) => a.variance < min.variance ? a : min);
        document.getElementById('mostAgreed').innerHTML = `
            <div class="global-stat-album" onclick="window.location.href='albums.html?id=${mostAgreed.id}'">
                <div class="global-stat-cover">
                    ${mostAgreed.coverImage 
                        ? `<img src="${mostAgreed.coverImage}" alt="${mostAgreed.title}">` 
                        : `<div class="global-stat-placeholder">🎵</div>`
                    }
                </div>
                <div class="global-stat-info">
                    <strong>${mostAgreed.title}</strong>
                    <span>${mostAgreed.artist}</span>
                    <span class="global-stat-detail">σ² = ${mostAgreed.variance.toFixed(2)}</span>
                </div>
            </div>
        `;
        
        // Hidden Gem (high score, few participants)
        const hiddenGems = albumStats.filter(a => a.averageScore >= 8).sort((a, b) => a.participantCount - b.participantCount);
        if (hiddenGems.length > 0) {
            const hiddenGem = hiddenGems[0];
            document.getElementById('hiddenGem').innerHTML = `
                <div class="global-stat-album" onclick="window.location.href='albums.html?id=${hiddenGem.id}'">
                    <div class="global-stat-cover">
                        ${hiddenGem.coverImage 
                            ? `<img src="${hiddenGem.coverImage}" alt="${hiddenGem.title}">` 
                            : `<div class="global-stat-placeholder">🎵</div>`
                        }
                    </div>
                    <div class="global-stat-info">
                        <strong>${hiddenGem.title}</strong>
                        <span>${hiddenGem.artist}</span>
                        <span class="global-stat-detail">${hiddenGem.averageScore.toFixed(1)} (${hiddenGem.participantCount} participants)</span>
                    </div>
                </div>
            `;
        } else {
            document.getElementById('hiddenGem').textContent = 'No hidden gems yet';
        }
        
        // Crowd Favorite
        const crowdFavorite = albumStats.reduce((max, a) => a.participantCount > max.participantCount ? a : max);
        document.getElementById('crowdFavorite').innerHTML = `
            <div class="global-stat-album" onclick="window.location.href='albums.html?id=${crowdFavorite.id}'">
                <div class="global-stat-cover">
                    ${crowdFavorite.coverImage 
                        ? `<img src="${crowdFavorite.coverImage}" alt="${crowdFavorite.title}">` 
                        : `<div class="global-stat-placeholder">🎵</div>`
                    }
                </div>
                <div class="global-stat-info">
                    <strong>${crowdFavorite.title}</strong>
                    <span>${crowdFavorite.artist}</span>
                    <span class="global-stat-detail">${crowdFavorite.participantCount} participants</span>
                </div>
            </div>
        `;
        
        console.log('✅ Global stats calculated');
    } catch (error) {
        console.error('❌ Error loading global stats:', error);
    }
}

// Calculate variance
function calculateVariance(values) {
    if (values.length === 0) return 0;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    return squareDiffs.reduce((a, b) => a + b, 0) / values.length;
}

