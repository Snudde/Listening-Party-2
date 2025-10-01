// Top List Page JavaScript

let allAlbums = [];
let allTracks = [];

document.addEventListener('DOMContentLoaded', function() {
    console.log('🏆 Top list page loaded');
    
    // Tab switching
    document.getElementById('albumsTab').addEventListener('click', () => switchTab('albums'));
    document.getElementById('tracksTab').addEventListener('click', () => switchTab('tracks'));
    
    loadTopList();
});

// Switch between tabs
function switchTab(tab) {
    document.querySelectorAll('.stats-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.top-tab-content').forEach(c => c.classList.remove('active'));
    
    if (tab === 'albums') {
        document.getElementById('albumsTab').classList.add('active');
        document.getElementById('albumsTabContent').classList.add('active');
    } else {
        document.getElementById('tracksTab').classList.add('active');
        document.getElementById('tracksTabContent').classList.add('active');
    }
}

// Load top rated albums and tracks
async function loadTopList() {
    try {
        const snapshot = await db.collection('albums').get();
        
        const loadingState = document.getElementById('loadingState');
        const emptyState = document.getElementById('emptyState');
        
        loadingState.style.display = 'none';
        
        // Filter for completed albums and collect all tracks
        allAlbums = [];
        allTracks = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.isCompleted === true && data.averageScore) {
                allAlbums.push({
                    id: doc.id,
                    ...data
                });
                
                // Collect all tracks with their ratings
                if (data.tracks && data.ratings) {
                    data.tracks.forEach(track => {
                        if (!track.isInterlude) {  // Exclude interludes
                            const trackRatings = Object.values(data.ratings[track.number] || {}).filter(r => r !== null && r !== undefined);
                            if (trackRatings.length > 0) {
                                const avgRating = trackRatings.reduce((a, b) => a + b, 0) / trackRatings.length;
                                allTracks.push({
                                    title: track.title,
                                    trackNumber: track.number,
                                    album: data.title,
                                    artist: data.artist,
                                    albumId: doc.id,
                                    albumCover: data.coverImage || '',
                                    averageScore: avgRating,
                                    ratingCount: trackRatings.length
                                });
                            }
                        }
                    });
                }
            }
        });
        
        // Sort albums by score
        allAlbums.sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0));
        
        // Sort tracks by score
        allTracks.sort((a, b) => b.averageScore - a.averageScore);
        
        if (allAlbums.length === 0) {
            emptyState.style.display = 'block';
            document.getElementById('albumsTabContent').style.display = 'none';
            document.getElementById('tracksTabContent').style.display = 'none';
            document.getElementById('topTabs').style.display = 'none';
            return;
        }
        
        emptyState.style.display = 'none';
        document.getElementById('topTabs').style.display = 'flex';
        
        // Display albums
        if (allAlbums.length > 0) {
            displayPodium(allAlbums);
            document.getElementById('podiumSection').style.display = 'block';
        }
        displayRankings(allAlbums);
        
        // Display tracks
        displayTopTracks(allTracks);
        
        console.log(`✅ Loaded ${allAlbums.length} ranked albums and ${allTracks.length} tracks`);
    } catch (error) {
        console.error('❌ Error loading top list:', error);
        showNotification('Error loading rankings', 'error');
    }
}

// Display top 3 podium
function displayPodium(albums) {
    const positions = [
        { id: 'podium1', index: 0 },
        { id: 'podium2', index: 1 },
        { id: 'podium3', index: 2 }
    ];
    
    positions.forEach(pos => {
        const podium = document.getElementById(pos.id);
        const album = albums[pos.index];
        
        if (album) {
            const cover = podium.querySelector('.podium-album-cover');
            const title = podium.querySelector('.podium-title');
            const artist = podium.querySelector('.podium-artist');
            const score = podium.querySelector('.podium-score');
            
            if (album.coverImage) {
                cover.innerHTML = `<img src="${album.coverImage}" alt="${album.title}">`;
            } else {
                cover.innerHTML = '<div class="podium-placeholder">🎵</div>';
            }
            
            title.textContent = album.title;
            artist.textContent = album.artist;
            score.textContent = album.averageScore ? album.averageScore.toFixed(2) : 'N/A';
            score.className = 'podium-score ' + getScoreClass(album.averageScore || 0);
            
            podium.style.cursor = 'pointer';
            podium.onclick = () => goToAlbum(album.id);
        } else {
            podium.style.visibility = 'hidden';
        }
    });
}

// Display full rankings list
function displayRankings(albums) {
    const rankingsList = document.getElementById('rankingsList');
    rankingsList.innerHTML = '';
    
    albums.forEach((album, index) => {
        const rank = index + 1;
        const rankItem = createRankingItem(album, rank);
        rankingsList.appendChild(rankItem);
    });
}

// Create ranking item
function createRankingItem(album, rank) {
    const item = document.createElement('div');
    const scoreClass = getScoreClass(album.averageScore || 0);
    item.className = `ranking-item ${scoreClass}`;
    if (rank <= 3) {
        item.classList.add('top-three');
    }
    item.onclick = () => goToAlbum(album.id);
    
    const medal = rank <= 3 
        ? ['🥇', '🥈', '🥉'][rank - 1]
        : `#${rank}`;
    
    item.innerHTML = `
        <div class="ranking-number ${rank <= 3 ? 'medal' : ''}">${medal}</div>
        <div class="ranking-album-cover">
            ${album.coverImage 
                ? `<img src="${album.coverImage}" alt="${album.title}">` 
                : `<div class="ranking-placeholder">🎵</div>`
            }
        </div>
        <div class="ranking-info">
            <h3>${album.title}</h3>
            <p>${album.artist}</p>
            <div class="ranking-meta">
                <span>🎵 ${album.trackCount || album.tracks?.length || 0} tracks</span>
                <span>👥 ${album.participants?.length || 0} ratings</span>
                <span>📅 ${formatDate(album.createdAt)}</span>
            </div>
        </div>
        <div class="ranking-score ${getScoreClass(album.averageScore || 0)}">
            ${album.averageScore ? album.averageScore.toFixed(2) : 'N/A'}
        </div>
    `;
    
    return item;
}

// Display top tracks
function displayTopTracks(tracks) {
    const tracksContainer = document.getElementById('topTracksList');
    tracksContainer.innerHTML = '';
    
    if (tracks.length === 0) {
        tracksContainer.innerHTML = '<p class="empty-state">No tracks rated yet</p>';
        document.getElementById('tracksPodiumSection').style.display = 'none';
        return;
    }
    
    // Display podium if we have at least one track
    if (tracks.length > 0) {
        displayTracksPodium(tracks);
        document.getElementById('tracksPodiumSection').style.display = 'block';
    }
    
    tracks.forEach((track, index) => {
        const rank = index + 1;
        const trackItem = createTrackRankingItem(track, rank);
        tracksContainer.appendChild(trackItem);
    });
}

// Display top 3 tracks podium
function displayTracksPodium(tracks) {
    const positions = [
        { id: 'trackPodium1', index: 0 },
        { id: 'trackPodium2', index: 1 },
        { id: 'trackPodium3', index: 2 }
    ];
    
    positions.forEach(pos => {
        const podium = document.getElementById(pos.id);
        const track = tracks[pos.index];
        
        if (track) {
            const cover = podium.querySelector('.podium-album-cover');
            const title = podium.querySelector('.podium-title');
            const artist = podium.querySelector('.podium-artist');
            const score = podium.querySelector('.podium-score');
            
            if (track.albumCover) {
                cover.innerHTML = `<img src="${track.albumCover}" alt="${track.album}">`;
            } else {
                cover.innerHTML = '<div class="podium-placeholder">🎵</div>';
            }
            
            title.textContent = track.title;
            artist.textContent = `${track.album} - ${track.artist}`;
            score.textContent = track.averageScore.toFixed(2);
            score.className = 'podium-score ' + getScoreClass(track.averageScore);
            
            podium.style.cursor = 'pointer';
            podium.onclick = () => goToAlbum(track.albumId);
        } else {
            podium.style.visibility = 'hidden';
        }
    });
}

// Create track ranking item
function createTrackRankingItem(track, rank) {
    const item = document.createElement('div');
    const scoreClass = getScoreClass(track.averageScore);
    item.className = `track-ranking-item ${scoreClass}`;
    if (rank <= 3) {
        item.classList.add('top-three');
    }
    item.onclick = () => goToAlbum(track.albumId);
    
    const medal = rank <= 3 
        ? ['🥇', '🥈', '🥉'][rank - 1]
        : `#${rank}`;
    
    item.innerHTML = `
        <div class="track-ranking-number ${rank <= 3 ? 'medal' : ''}">${medal}</div>
        <div class="track-ranking-cover">
            ${track.albumCover 
                ? `<img src="${track.albumCover}" alt="${track.album}">` 
                : `<div class="track-ranking-placeholder">🎵</div>`
            }
        </div>
        <div class="track-ranking-info">
            <h3>${track.title}</h3>
            <p>${track.album} - ${track.artist}</p>
            <div class="track-ranking-meta">
                <span>👥 ${track.ratingCount} ratings</span>
            </div>
        </div>
        <div class="track-ranking-score ${scoreClass}">
            ${track.averageScore.toFixed(2)}
        </div>
    `;
    
    return item;
}

// Navigate to album page
function goToAlbum(albumId) {
    window.location.href = `albums.html?id=${albumId}`;
}