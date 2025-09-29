// Top List Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
    console.log('🏆 Top list page loaded');
    loadTopList();
});

// Load top rated albums
async function loadTopList() {
    try {
        // Get only completed albums with scores
        const snapshot = await db.collection('albums')
            .where('isCompleted', '==', true)
            .orderBy('averageScore', 'desc')
            .get();
        
        const loadingState = document.getElementById('loadingState');
        const emptyState = document.getElementById('emptyState');
        const rankingsList = document.getElementById('rankingsList');
        const podiumSection = document.getElementById('podiumSection');
        
        loadingState.style.display = 'none';
        
        if (snapshot.empty) {
            emptyState.style.display = 'block';
            rankingsList.style.display = 'none';
            podiumSection.style.display = 'none';
            return;
        }
        
        emptyState.style.display = 'none';
        rankingsList.style.display = 'block';
        
        const albums = [];
        snapshot.forEach(doc => {
            albums.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Show podium if we have at least one album
        if (albums.length > 0) {
            displayPodium(albums);
            podiumSection.style.display = 'block';
        }
        
        // Display full rankings
        displayRankings(albums);
        
        console.log(`✅ Loaded ${albums.length} ranked albums`);
    } catch (error) {
        console.error('❌ Error loading top list:', error);
        showNotification('Error loading rankings', 'error');
    }
}

// Display top 3 podium
function displayPodium(albums) {
    const positions = [
        { id: 'podium1', index: 0 }, // 1st place
        { id: 'podium2', index: 1 }, // 2nd place
        { id: 'podium3', index: 2 }  // 3rd place
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
            
            // Make clickable
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
    item.className = 'ranking-item';
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

// Navigate to album page
function goToAlbum(albumId) {
    window.location.href = `albums.html?id=${albumId}`;
}