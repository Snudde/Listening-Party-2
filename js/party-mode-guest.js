// Party Mode Guest JavaScript

let guestSession = {
    roomCode: null,
    guestName: null,
    guestId: null,
    participantId: null, // Link to existing participant
    isGuest: false, // True if joining as guest (not linked profile)
    currentTrackIndex: 0,
    selectedRating: null
};

let sessionData = null;

let unsubscribe = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎵 Party Mode Guest loaded');
    
    // Room code form
    document.getElementById('roomCodeForm').addEventListener('submit', handleRoomCode);
    
    // Guest name form
    document.getElementById('guestNameForm').addEventListener('submit', handleGuestName);
    
    // Join as guest button
    document.getElementById('joinAsGuestBtn').addEventListener('click', showGuestNameInput);
    
    // Room code input - auto uppercase
    document.getElementById('roomCode').addEventListener('input', function(e) {
        e.target.value = e.target.value.toUpperCase();
    });
    
    // Submit rating button
    document.getElementById('submitRatingBtn').addEventListener('click', submitRating);
    
    // Chat functionality
    document.getElementById('chatButton').addEventListener('click', openChatModal);
    document.getElementById('closeChatModal').addEventListener('click', closeChatModal);
    document.getElementById('cancelChat').addEventListener('click', closeChatModal);
    document.getElementById('chatForm').addEventListener('submit', sendChatMessage);
    
    // Character counter
    document.getElementById('chatMessage').addEventListener('input', function(e) {
        const count = e.target.value.length;
        document.getElementById('charCount').textContent = `${count}/100`;
    });
    
    // Generate rating buttons
    generateRatingButtons();
});

// Handle room code submission
async function handleRoomCode(e) {
    e.preventDefault();
    
    const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();
    
    if (!roomCode) {
        showError('Please enter a room code');
        return;
    }
    
    try {
        // Check if room exists
        const sessionDoc = await db.collection('party-sessions').doc(roomCode).get();
        
        if (!sessionDoc.exists) {
            showError('Room code not found. Please check and try again.');
            return;
        }
        
        sessionData = sessionDoc.data();
        
        if (sessionData.phase === 'results') {
            showError('This party has already ended.');
            return;
        }
        
        guestSession.roomCode = roomCode;
        
        // Load participant profiles
        await loadParticipantProfiles();
        
        // Show profile selection
        document.getElementById('joinPhase').style.display = 'none';
        document.getElementById('profilePhase').style.display = 'block';
        
    } catch (error) {
        console.error('❌ Error checking room:', error);
        showError('Error connecting to party. Please try again.');
    }
}

// Load participant profiles
async function loadParticipantProfiles() {
    try {
        // Get current party participants to filter out already-used profiles
        const sessionDoc = await db.collection('party-sessions').doc(guestSession.roomCode).get();
        const currentParticipants = sessionDoc.data().participants || [];
        const usedParticipantIds = currentParticipants
            .filter(p => p.participantId) // Only real participants, not guests
            .map(p => p.participantId);
        
        const snapshot = await db.collection('participants').orderBy('username').get();
        const container = document.getElementById('participantProfiles');
        container.innerHTML = '';
        
        if (snapshot.empty) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); grid-column: 1 / -1;">No profiles found</p>';
            return;
        }
        
        let availableCount = 0;
        
        snapshot.forEach(doc => {
            const participant = doc.data();
            
            // Skip if this profile is already in use
            if (usedParticipantIds.includes(doc.id)) {
                return;
            }
            
            availableCount++;
            
            const card = document.createElement('div');
            card.className = 'profile-card';
            card.onclick = () => selectProfile(doc.id, participant.username, participant.profilePicture);
            
            card.innerHTML = `
                <div class="profile-avatar">
                    ${participant.profilePicture 
                        ? `<img src="${participant.profilePicture}" alt="${participant.username}">` 
                        : `<div class="profile-avatar-placeholder">${participant.username.charAt(0).toUpperCase()}</div>`
                    }
                </div>
                <div class="profile-name">${participant.username}</div>
            `;
            
            container.appendChild(card);
        });
        
        if (availableCount === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); grid-column: 1 / -1;">All profiles are in use. Please join as guest!</p>';
        }
        
    } catch (error) {
        console.error('❌ Error loading profiles:', error);
        showError('Error loading profiles', 'errorMessage2');
    }
}

// Select existing profile
async function selectProfile(participantId, username, profilePicture) {
    guestSession.participantId = participantId;
    guestSession.guestName = username;
    guestSession.guestId = participantId; // Use participant ID as guest ID
    guestSession.isGuest = false;
    
    await joinParty();
}

// Show guest name input
function showGuestNameInput() {
    document.getElementById('profilePhase').style.display = 'none';
    document.getElementById('guestNamePhase').style.display = 'block';
}

// Handle guest name submission
async function handleGuestName(e) {
    e.preventDefault();
    
    const guestName = document.getElementById('guestName').value.trim();
    
    if (!guestName) {
        showError('Please enter your name');
        return;
    }
    
    guestSession.guestName = guestName;
    guestSession.guestId = 'guest_' + Date.now().toString() + '_' + Math.random().toString(36).substring(7);
    guestSession.isGuest = true;
    guestSession.participantId = null;
    
    await joinParty();
}

// Join the party
async function joinParty() {
    try {
        // Check if this participant ID is already in the party
        const sessionDoc = await db.collection('party-sessions').doc(guestSession.roomCode).get();
        const currentParticipants = sessionDoc.data().participants || [];
        
        // Check if someone already picked this profile
        if (guestSession.participantId && !guestSession.isGuest) {
            const alreadyJoined = currentParticipants.some(p => p.participantId === guestSession.participantId);
            if (alreadyJoined) {
                showError('This profile is already in use! Please select another one or join as guest.', 'errorMessage2');
                return;
            }
        }
        
        // Add to participants list
        await db.collection('party-sessions').doc(guestSession.roomCode).update({
            participants: firebase.firestore.FieldValue.arrayUnion({
                id: guestSession.guestId,
                name: guestSession.guestName,
                participantId: guestSession.participantId,
                isGuest: guestSession.isGuest,
                joinedAt: Date.now()
            })
        });
        
        console.log('✅ Joined party:', guestSession.roomCode);
        
        // Hide all join phases
        document.getElementById('joinPhase').style.display = 'none';
        document.getElementById('profilePhase').style.display = 'none';
        document.getElementById('guestNamePhase').style.display = 'none';
        
        // Show waiting room
        showWaitingRoom(sessionData);
        
        // Listen for session updates
        subscribeToSession();
        
    } catch (error) {
        console.error('❌ Error joining party:', error);
        showError('Error joining party. Please try again.');
    }
}

// Back navigation functions
function backToRoomCode() {
    document.getElementById('profilePhase').style.display = 'none';
    document.getElementById('joinPhase').style.display = 'block';
}

function backToProfiles() {
    document.getElementById('guestNamePhase').style.display = 'none';
    document.getElementById('profilePhase').style.display = 'block';
}

// Make functions available globally
window.backToRoomCode = backToRoomCode;
window.backToProfiles = backToProfiles;

// Generate rating buttons (0-10)
function generateRatingButtons() {
    const container = document.getElementById('ratingButtons');
    container.innerHTML = '';
    
    for (let i = 0; i <= 10; i += 0.5) {
        const btn = document.createElement('button');
        btn.className = 'rating-btn';
        btn.textContent = i % 1 === 0 ? i.toFixed(0) : i.toFixed(1);
        btn.dataset.rating = i;
        btn.addEventListener('click', () => selectRating(i, btn));
        container.appendChild(btn);
    }
}

// Select rating
function selectRating(rating, btnElement) {
    guestSession.selectedRating = rating;
    
    // Update button states
    document.querySelectorAll('.rating-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    btnElement.classList.add('selected');
    
    // Enable submit button
    document.getElementById('submitRatingBtn').disabled = false;
}

// Handle join
async function handleJoin(e) {
    e.preventDefault();
    
    const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();
    const guestName = document.getElementById('guestName').value.trim();
    
    if (!roomCode || !guestName) {
        showError('Please enter both room code and your name');
        return;
    }
    
    try {
        // Check if room exists
        const sessionDoc = await db.collection('party-sessions').doc(roomCode).get();
        
        if (!sessionDoc.exists) {
            showError('Room code not found. Please check and try again.');
            return;
        }
        
        const sessionData = sessionDoc.data();
        
        if (sessionData.phase === 'results') {
            showError('This party has already ended.');
            return;
        }
        
        // Generate guest ID
        guestSession.roomCode = roomCode;
        guestSession.guestName = guestName;
        guestSession.guestId = Date.now().toString() + '_' + Math.random().toString(36).substring(7);
        
        // Add guest to participants
        await db.collection('party-sessions').doc(roomCode).update({
            participants: firebase.firestore.FieldValue.arrayUnion({
                id: guestSession.guestId,
                name: guestName,
                joinedAt: Date.now()
            })
        });
        
        console.log('✅ Joined party:', roomCode);
        
        // Show waiting room
        showWaitingRoom(sessionData);
        
        // Listen for session updates
        subscribeToSession();
        
    } catch (error) {
        console.error('❌ Error joining party:', error);
        showError('Error joining party. Please try again.');
    }
}

// Show waiting room
function showWaitingRoom(sessionData) {
    document.getElementById('joinPhase').style.display = 'none';
    document.getElementById('waitingRoom').classList.add('active');
    
    document.getElementById('waitingAlbumTitle').textContent = sessionData.albumTitle;
    document.getElementById('waitingArtistName').textContent = sessionData.artistName;
    
    if (sessionData.albumCover) {
        document.getElementById('waitingAlbumCover').innerHTML = `<img src="${sessionData.albumCover}" alt="Album Cover">`;
    }
    
    updateParticipantCount(sessionData.participants.length);
}

// Update participant count
function updateParticipantCount(count) {
    document.getElementById('waitingParticipantCount').textContent = count;
}

// Subscribe to session updates
function subscribeToSession() {
    unsubscribe = db.collection('party-sessions').doc(guestSession.roomCode)
        .onSnapshot(doc => {
            if (!doc.exists) {
                showError('Party session ended');
                return;
            }
            
            const data = doc.data();
            sessionData = data;  // <-- IMPORTANT: Set sessionData

            

            // NEW: Store bingo boards reference
            if (data.bingoBoards) {
                if (!window.partySession) {
                    window.partySession = {};
                }
                window.partySession.bingoBoards = data.bingoBoards;
                window.partySession.bingoContainerId = data.bingoContainerId;
                window.partySession.participants = data.participants;
                window.partySession.roomCode = guestSession.roomCode;
            }
            // END NEW
            
            // Update participant count
            updateParticipantCount(data.participants.length);
            
            

            // Check phase
            if (data.phase === 'predictions') {  // ADD THIS BLOCK
                showPredictionsSubmission(data);
            } else if (data.phase === 'active') {
                guestSession.currentTrackIndex = data.currentTrackIndex;
                
                // Store predictions data if enabled
                if (data.predictionsContainerId) {
                    if (!window.partySession) window.partySession = {};
                    window.partySession.predictionsContainerId = data.predictionsContainerId;
                    window.partySession.predictions = data.predictions;
                }
                
                showRatingPhase(data);
            } else if (data.phase === 'results') {
                showPartyEnded(data);
            }
        });
}

// Show rating phase
function showRatingPhase(sessionData) {
    // Hide all other phases
    document.getElementById('joinPhase').style.display = 'none';
    document.getElementById('profilePhase').style.display = 'none';
    document.getElementById('guestNamePhase').style.display = 'none';
    document.getElementById('waitingRoom').classList.remove('active');

    const predictionsContainer = document.getElementById('predictionsContainer');
    if (predictionsContainer) predictionsContainer.style.display = 'none';
    
    // Show rating phase
    document.getElementById('ratingPhase').classList.add('active');
    
    const trackNum = sessionData.currentTrackIndex + 1;
    const track = sessionData.tracks[sessionData.currentTrackIndex];
    
    document.getElementById('ratingTrackNum').textContent = trackNum;
    document.getElementById('ratingTrackTitle').textContent = track.title;
    
    // Check if already rated this track
    const trackRatings = sessionData.ratings[trackNum] || {};
    const existingRating = trackRatings[guestSession.guestId];
    
    if (existingRating !== null && existingRating !== undefined) {
        // Already rated, show submitted state
        showRatingSubmitted(existingRating);
    } else {
        // Show rating interface
        document.getElementById('ratingInterface').style.display = 'block';
        document.getElementById('ratingSubmitted').style.display = 'none';
        
        // Reset selection
        guestSession.selectedRating = null;
        document.querySelectorAll('.rating-btn').forEach(btn => btn.classList.remove('selected'));
        document.getElementById('submitRatingBtn').disabled = true;
    }

     // NEW: Show bingo UI if enabled
    if (sessionData.bingoBoards && guestSession.guestId) {
        renderBingoUI(guestSession.guestId);
    }

    // ADD THIS: Add predictions view button
    if (sessionData.predictionsContainerId) {
        addPredictionsViewButton(guestSession.participantId);
    }
}

// Submit rating
async function submitRating() {
    if (guestSession.selectedRating === null) return;
    
    try {
        const trackNum = guestSession.currentTrackIndex + 1;
        
        // Update rating in Firestore
        await db.collection('party-sessions').doc(guestSession.roomCode).update({
            [`ratings.${trackNum}.${guestSession.guestId}`]: guestSession.selectedRating
        });
        
        console.log('✅ Rating submitted:', guestSession.selectedRating);
        
        showRatingSubmitted(guestSession.selectedRating);
        
    } catch (error) {
        console.error('❌ Error submitting rating:', error);
        showError('Error submitting rating. Please try again.');
    }
}

// Show rating submitted state
function showRatingSubmitted(rating) {
    document.getElementById('ratingInterface').style.display = 'none';
    document.getElementById('ratingSubmitted').style.display = 'block';
    document.getElementById('submittedScore').textContent = formatScore(rating);
    document.getElementById('submittedScore').className = 'submitted-score ' + getScoreClass(rating);
}

// Chat functionality
function openChatModal() {
    document.getElementById('chatModal').style.display = 'flex';
    
    // iOS fix: Use setTimeout and explicit focus
    setTimeout(() => {
        const input = document.getElementById('chatMessage');
        input.focus();
        
        // iOS additional fix: trigger click to show keyboard
        input.click();
    }, 100);
}

function closeChatModal() {
    document.getElementById('chatModal').style.display = 'none';
    document.getElementById('chatMessage').value = '';
    
    // iOS fix: Blur to ensure keyboard closes
    document.getElementById('chatMessage').blur();
}

async function sendChatMessage(e) {
    e.preventDefault();
    
    const message = document.getElementById('chatMessage').value.trim();
    
    if (!message) return;
    
    try {
        // Add message to Firestore
        await db.collection('party-sessions').doc(guestSession.roomCode).collection('messages').add({
            participantId: guestSession.guestId,
            participantName: guestSession.guestName,
            message: message,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: Date.now()
        });
        
        console.log('✅ Message sent:', message);
        closeChatModal();
        
    } catch (error) {
        console.error('❌ Error sending message:', error);
        showError('Error sending message');
    }
}

// Show party ended
function showPartyEnded(sessionData) {
    // Hide all other phases
    document.getElementById('joinPhase').style.display = 'none';
    document.getElementById('profilePhase').style.display = 'none';
    document.getElementById('guestNamePhase').style.display = 'none';
    document.getElementById('waitingRoom').classList.remove('active');
    document.getElementById('ratingPhase').classList.remove('active');
    
    // Show party ended
    document.getElementById('partyEnded').classList.add('active');
    
    const albumAvg = sessionData.albumAverage || 0;
    document.getElementById('finalScoreDisplay').innerHTML = `
        <h3>${sessionData.albumTitle}</h3>
        <p>${sessionData.artistName}</p>
        <div class="${getScoreClass(albumAvg)}" style="padding: 20px; border-radius: 12px; margin-top: 20px;">
            ${albumAvg.toFixed(2)}
        </div>
    `;
}

// Show error message
function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = message;
    errorEl.classList.add('show');
    
    setTimeout(() => {
        errorEl.classList.remove('show');
    }, 5000);
}

// Helper functions (same as in app.js)
function formatScore(score) {
    if (score === null || score === undefined || isNaN(score)) return '-';
    const num = parseFloat(score);
    return num % 1 === 0 ? num.toFixed(0) : num.toFixed(1);
}

function getScoreClass(score) {
    if (isNaN(score) || score === null || score === undefined) return '';
    const numScore = parseFloat(score);
    if (numScore >= 9) return 'legendary';
    if (numScore >= 8) return 'epic';
    if (numScore >= 7) return 'good';
    if (numScore >= 6) return 'mid';
    return 'trash';
}

// Utility: Show notification/toast message (for bingo)
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6366f1'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-weight: 600;
        transform: translateX(400px);
        transition: transform 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.style.transform = 'translateX(0)', 10);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}


// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (unsubscribe) {
        unsubscribe();
    }
});