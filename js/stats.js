// Stats Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
    console.log('📊 Stats page loaded');
    
    loadParticipants();
    
    document.getElementById('participantSelect').addEventListener('change', handleParticipantChange);
});

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
                            artist: album.artist
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
    
    if (stats.favoriteAlbum) {
        document.getElementById('favoriteAlbum').textContent = stats.favoriteAlbum.title;
        document.getElementById('favoriteScore').textContent = `${stats.favoriteAlbum.artist} - Avg: ${stats.favoriteAlbum.score}`;
    } else {
        document.getElementById('favoriteAlbum').textContent = '-';
        document.getElementById('favoriteScore').textContent = '-';
    }
    
    // Rating distribution
    displayRatingDistribution(stats.distribution, stats.tracksRated);
    
    // Albums participated in
    displayParticipatedAlbums(albums);
    
    // Tendencies
    if (stats.highestRated) {
        document.getElementById('highestTrack').textContent = `${stats.highestRated.track} (${stats.highestRated.album})`;
        document.getElementById('highestScore').textContent = stats.highestRated.rating;
    }
    
    if (stats.lowestRated) {
        document.getElementById('lowestTrack').textContent = `${stats.lowestRated.track} (${stats.lowestRated.album})`;
        document.getElementById('lowestScore').textContent = stats.lowestRated.rating;
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