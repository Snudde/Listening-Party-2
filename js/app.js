// Main App JavaScript
// This file handles the home page stats and general utilities

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('📱 App loaded successfully!');
    
    // Load home page stats if we're on the home page
    if (document.getElementById('totalAlbums')) {
        loadHomeStats();
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