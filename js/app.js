// Main App JavaScript
// This file handles the home page stats and general utilities

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('📱 App loaded successfully!');
    
    // Load home page stats if we're on the home page
    if (document.getElementById('totalAlbums')) {
        loadHomeStats();
        loadRecentAlbums();
        initFloatingBackground();
    }
});

// Load statistics for home page
async function loadHomeStats() {
    try {
        // Count total albums
        const albumsSnapshot = await db.collection('albums').get();
        const totalAlbums = albumsSnapshot.size;
        document.getElementById('totalAlbums').textContent = totalAlbums;

        // Count completed parties (albums marked as completed)
        const completedAlbums = albumsSnapshot.docs.filter(doc => doc.data().isCompleted).length;
        document.getElementById('totalParties').textContent = completedAlbums;

        // Count total participants
        const participantsSnapshot = await db.collection('participants').get();
        const totalParticipants = participantsSnapshot.size;
        document.getElementById('totalParticipants').textContent = totalParticipants;

        // Count total tracks across all albums
        let totalTracks = 0;
        albumsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.tracks && Array.isArray(data.tracks)) {
                totalTracks += data.tracks.length;
            }
        });
        document.getElementById('totalTracks').textContent = totalTracks;

        console.log('✅ Stats loaded successfully!');
    } catch (error) {
        console.error('❌ Error loading stats:', error);
        showNotification('Error loading statistics', 'error');
    }
}

// Utility: Show notification/toast message
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add to body
    document.body.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Utility: Format date
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

// Utility: Calculate average from array of numbers
function calculateAverage(numbers) {
    if (!numbers || numbers.length === 0) return 0;
    const sum = numbers.reduce((acc, num) => acc + num, 0);
    return (sum / numbers.length).toFixed(2);
}

// Utility: Format score for display (removes unnecessary decimals)
function formatScore(score) {
    if (score === null || score === undefined || isNaN(score)) return '-';
    const num = parseFloat(score);
    // If it's a whole number, show without decimals, otherwise show with decimals
    return num % 1 === 0 ? num.toFixed(0) : num.toFixed(1);
}

// Utility: Get CSS class based on score (tier system)
function getScoreClass(score) {
    if (isNaN(score) || score === null || score === undefined) return '';
    const numScore = parseFloat(score);
    if (numScore >= 9) return 'legendary';
    if (numScore >= 8) return 'epic';
    if (numScore >= 7) return 'good';
    if (numScore >= 6) return 'mid';
    return 'trash';
}

// Utility: Upload image to Firebase Storage
async function uploadImage(file, path) {
    try {
        const storageRef = storage.ref().child(path);
        const snapshot = await storageRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();
        return downloadURL;
    } catch (error) {
        console.error('Error uploading image:', error);
        throw error;
    }
}

// Export utilities for other files
window.showNotification = showNotification;
window.formatDate = formatDate;
window.calculateAverage = calculateAverage;
window.getScoreClass = getScoreClass;
window.formatScore = formatScore;
window.uploadImage = uploadImage;

// Load recent albums for home page
async function loadRecentAlbums() {
    try {
        const snapshot = await db.collection('albums')
            .orderBy('createdAt', 'desc')
            .limit(6)
            .get();
        
        const recentGrid = document.getElementById('recentAlbums');
        const noAlbumsMsg = document.getElementById('noRecentAlbums');
        
        if (snapshot.empty) {
            recentGrid.style.display = 'none';
            noAlbumsMsg.style.display = 'block';
            return;
        }
        
        recentGrid.innerHTML = '';
        noAlbumsMsg.style.display = 'none';
        
        snapshot.forEach(doc => {
            const album = doc.data();
            const card = createRecentAlbumCard(doc.id, album);
            recentGrid.appendChild(card);
        });
        
        console.log('✅ Recent albums loaded');
    } catch (error) {
        console.error('❌ Error loading recent albums:', error);
    }
}

// Create recent album card
function createRecentAlbumCard(id, album) {
    const card = document.createElement('a');
    card.href = `pages/albums.html?id=${id}`;
    const scoreClass = album.isCompleted && album.averageScore ? getScoreClass(album.averageScore) : '';
    card.className = `recent-album-card ${scoreClass}`;
    
    const statusBadge = album.isCompleted 
        ? `<span class="status-badge completed">✓</span>`
        : `<span class="status-badge in-progress">...</span>`;
    
    card.innerHTML = `
        <div class="recent-album-cover">
            ${album.coverImage 
                ? `<img src="${album.coverImage}" alt="${album.title}">` 
                : `<div class="album-placeholder">🎵</div>`
            }
            ${statusBadge}
        </div>
        <div class="recent-album-info">
            <h4>${album.title}</h4>
            <p>${album.artist}</p>
            ${album.isCompleted && album.averageScore 
                ? `<span class="recent-album-score ${scoreClass}">${formatScore(album.averageScore)}</span>`
                : ''
            }
        </div>
    `;
    
    return card;
}

// Initialize floating background
async function initFloatingBackground() {
    try {
        const snapshot = await db.collection('albums').get();
        
        if (snapshot.empty) return;
        
        const albums = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.coverImage) {
                albums.push(data.coverImage);
            }
        });
        
        if (albums.length === 0) return;
        
        // Create 15 floating album covers (or fewer if not enough albums)
        const floatingBg = document.getElementById('floatingBg');
        const numCovers = Math.min(15, albums.length);
        
        for (let i = 0; i < numCovers; i++) {
            const randomAlbum = albums[Math.floor(Math.random() * albums.length)];
            createFloatingCover(floatingBg, randomAlbum, i);
        }
        
        console.log('✅ Floating background initialized');
    } catch (error) {
        console.error('❌ Error loading floating background:', error);
    }
}

// Create a single floating cover
function createFloatingCover(container, imageUrl, index) {
    const cover = document.createElement('div');
    cover.className = 'floating-cover';
    cover.style.backgroundImage = `url(${imageUrl})`;
    
    // Random starting position
    cover.style.left = Math.random() * 100 + '%';
    cover.style.top = Math.random() * 100 + '%';
    
    // Random size between 80px and 150px
    const size = Math.random() * 70 + 80;
    cover.style.width = size + 'px';
    cover.style.height = size + 'px';
    
    // Random animation duration between 20-40 seconds
    const duration = Math.random() * 20 + 20;
    cover.style.animationDuration = duration + 's';
    
    // Random delay
    cover.style.animationDelay = (index * 0.5) + 's';
    
    // Random opacity between 0.1 and 0.3
    cover.style.opacity = Math.random() * 0.2 + 0.1;
    
    container.appendChild(cover);
}

// Initialize floating background on all pages
async function initFloatingBackgroundUniversal() {
    try {
        // Check if floating background container exists
        const floatingBg = document.getElementById('floatingBg');
        if (!floatingBg) return; // Exit if container doesn't exist
        
        const snapshot = await db.collection('albums').get();
        
        if (snapshot.empty) return;
        
        const albums = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.coverImage) {
                albums.push(data.coverImage);
            }
        });
        
        if (albums.length === 0) return;
        
        // Create 15 floating album covers (or fewer if not enough albums)
        const numCovers = Math.min(15, albums.length);
        
        for (let i = 0; i < numCovers; i++) {
            const randomAlbum = albums[Math.floor(Math.random() * albums.length)];
            createFloatingCover(floatingBg, randomAlbum, i);
        }
        
        console.log('✅ Floating background initialized');
    } catch (error) {
        console.error('❌ Error loading floating background:', error);
    }
}

// Create a single floating cover
function createFloatingCover(container, imageUrl, index) {
    const cover = document.createElement('div');
    cover.className = 'floating-cover';
    cover.style.backgroundImage = `url(${imageUrl})`;
    
    // Random starting position
    cover.style.left = Math.random() * 100 + '%';
    cover.style.top = Math.random() * 100 + '%';
    
    // Random size between 80px and 150px
    const size = Math.random() * 70 + 80;
    cover.style.width = size + 'px';
    cover.style.height = size + 'px';
    
    // Random animation duration between 20-40 seconds
    const duration = Math.random() * 20 + 20;
    cover.style.animationDuration = duration + 's';
    
    // Random delay
    cover.style.animationDelay = (index * 0.5) + 's';
    
    // Random opacity between 0.1 and 0.3
    cover.style.opacity = Math.random() * 0.2 + 0.1;
    
    container.appendChild(cover);
}

// Call this on every page load
document.addEventListener('DOMContentLoaded', function() {
    initFloatingBackgroundUniversal();
});

// Export for backward compatibility with index.html
window.initFloatingBackground = initFloatingBackgroundUniversal;