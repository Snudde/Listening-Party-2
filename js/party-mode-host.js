// Party Mode Host JavaScript

let partySession = {
    roomCode: null,
    albumTitle: '',
    artistName: '',
    albumCover: '',
    trackCount: 0,
    tracks: [],
    participants: [],
    currentTrackIndex: 0,
    ratings: {},
    albumId: null,
    phase: 'setup', // setup, lobby, active, results
    spotifyData: null, // Store Spotify album data
    lastShownRatings: {} // Track which ratings we've already shown splashes for
};

let unsubscribe = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎉 Party Mode Host loaded');
    
    // Setup form
    document.getElementById('partySetupForm').addEventListener('submit', handleSetup);
    loadBingoContainersForSetup();
    document.getElementById('partyAlbumCover').addEventListener('change', handleCoverPreview);
    
    // Spotify search
    document.getElementById('searchSpotifyBtn').addEventListener('click', searchSpotify);
    document.getElementById('spotifySearch').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchSpotify();
        }
    });
    
    // Control buttons
    document.getElementById('startPartyBtn').addEventListener('click', startParty);
    document.getElementById('nextTrackBtn').addEventListener('click', nextTrack);
    document.getElementById('finishPartyBtn').addEventListener('click', finishParty);
    document.getElementById('newPartyBtn').addEventListener('click', () => window.location.reload());
});

// Generate 6-digit room code
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Spotify credentials - REPLACE THESE WITH YOUR OWN
const SPOTIFY_CLIENT_ID = '46ad42c1aa7d48a7ba8965c390f104e3';
const SPOTIFY_CLIENT_SECRET = 'f54078fce4264ab68761afb3b75aad90';

let spotifyAccessToken = null;
let spotifyTokenExpiry = null;

// Get Spotify access token (with caching)
async function getSpotifyToken() {
    // Return cached token if still valid
    if (spotifyAccessToken && spotifyTokenExpiry && Date.now() < spotifyTokenExpiry) {
        return spotifyAccessToken;
    }
    
    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)
            },
            body: 'grant_type=client_credentials'
        });
        
        if (!response.ok) {
            throw new Error('Failed to get Spotify token. Check your credentials.');
        }
        
        const data = await response.json();
        spotifyAccessToken = data.access_token;
        // Token expires in 1 hour, cache for 55 minutes to be safe
        spotifyTokenExpiry = Date.now() + (55 * 60 * 1000);
        
        return spotifyAccessToken;
        
    } catch (error) {
        console.error('Token error:', error);
        throw error;
    }
}

// Spotify Integration
async function searchSpotify() {
    const query = document.getElementById('spotifySearch').value.trim();
    
    if (!query) {
        showNotification('Please enter a search term', 'error');
        return;
    }
    
    const resultsDiv = document.getElementById('spotifyResults');
    const resultsList = document.getElementById('spotifyResultsList');
    
    resultsDiv.style.display = 'block';
    resultsList.innerHTML = '<div class="spotify-loading">Searching Spotify...</div>';
    
    try {
        const accessToken = await getSpotifyToken();
        
        // Search for albums
        const searchResponse = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=10`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );
        
        if (!searchResponse.ok) {
            throw new Error('Spotify search failed');
        }
        
        const searchData = await searchResponse.json();
        displaySpotifyResults(searchData.albums.items);
        
    } catch (error) {
        console.error('❌ Spotify search error:', error);
        resultsList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--danger-color);">
                <p>⚠️ Spotify search failed</p>
                <p style="font-size: 0.9rem; margin-top: 10px;">
                    ${error.message || 'Please add your Spotify API credentials in the code, or enter album details manually.'}
                </p>
            </div>
        `;
    }
}

// Display Spotify search results
function displaySpotifyResults(albums) {
    const resultsList = document.getElementById('spotifyResultsList');
    
    if (albums.length === 0) {
        resultsList.innerHTML = '<div class="spotify-loading">No results found</div>';
        return;
    }
    
    resultsList.innerHTML = '';
    
    albums.forEach(album => {
        const item = document.createElement('div');
        item.className = 'spotify-result-item';
        item.onclick = () => selectSpotifyAlbum(album);
        
        const coverUrl = album.images[0]?.url || '';
        const artistNames = album.artists.map(a => a.name).join(', ');
        const releaseYear = album.release_date.split('-')[0];
        
        item.innerHTML = `
            <div class="spotify-album-cover">
                ${coverUrl ? `<img src="${coverUrl}" alt="${album.name}">` : '<div style="width: 100%; height: 100%; background: var(--surface); display: flex; align-items: center; justify-content: center;">🎵</div>'}
            </div>
            <div class="spotify-album-info">
                <div class="spotify-album-title">${album.name}</div>
                <div class="spotify-album-artist">${artistNames}</div>
                <div class="spotify-album-meta">${album.total_tracks} tracks • ${releaseYear}</div>
            </div>
        `;
        
        resultsList.appendChild(item);
    });
}

// Select a Spotify album and fetch full details
async function selectSpotifyAlbum(album) {
    try {
        showNotification('Loading album details...', 'info');
        
        const accessToken = await getSpotifyToken();
        
        // Fetch full album details including tracks
        const albumResponse = await fetch(
            `https://api.spotify.com/v1/albums/${album.id}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );
        
        if (!albumResponse.ok) {
            const errorText = await albumResponse.text();
            console.error('Album fetch error:', errorText);
            throw new Error('Failed to load album details');
        }
        
        const albumData = await albumResponse.json();
        
        console.log('Album data received:', albumData);
        
        // Fill in form fields
        document.getElementById('partyAlbumTitle').value = albumData.name;
        document.getElementById('partyArtistName').value = albumData.artists.map(a => a.name).join(', ');
        document.getElementById('partyTrackCount').value = albumData.tracks.items.length;
        
        // Show album cover
        if (albumData.images && albumData.images[0]?.url) {
            document.getElementById('partyCoverPreviewImg').src = albumData.images[0].url;
            document.getElementById('partyCoverPreview').style.display = 'block';
        }
        
        // Store Spotify data for track names
        partySession.spotifyData = {
            coverUrl: albumData.images && albumData.images[0]?.url,
            tracks: albumData.tracks.items.map((track, index) => ({
                number: index + 1,
                title: track.name,
                duration: track.duration_ms,
                isInterlude: false
            }))
        };
        
        // Hide search results
        document.getElementById('spotifyResults').style.display = 'none';
        document.getElementById('spotifySearch').value = '';
        
        showNotification('✅ Album loaded from Spotify!', 'success');
        
    } catch (error) {
        console.error('❌ Error loading album details:', error);
        showNotification('Error loading album details: ' + error.message, 'error');
    }
}

// Handle setup form submission
async function handleSetup(e) {
    e.preventDefault();
    
    try {
        partySession.albumTitle = document.getElementById('partyAlbumTitle').value.trim();
        partySession.artistName = document.getElementById('partyArtistName').value.trim();
        partySession.trackCount = parseInt(document.getElementById('partyTrackCount').value);

        // NEW: Get selected bingo container
        const selectedBingo = document.querySelector('input[name="bingoContainer"]:checked');
        partySession.bingoContainerId = selectedBingo ? selectedBingo.value : null;
        console.log('🎲 Bingo container:', partySession.bingoContainerId || 'None');
        // END NEW
        
        // Upload cover if provided, otherwise use Spotify cover
        const coverFile = document.getElementById('partyAlbumCover').files[0];
        if (coverFile) {
            const coverPath = `albums/${Date.now()}_${coverFile.name}`;
            partySession.albumCover = await uploadImage(coverFile, coverPath);
        } else if (partySession.spotifyData?.coverUrl) {
            partySession.albumCover = partySession.spotifyData.coverUrl;
        }
        
        // Generate tracks - use Spotify track names if available
        partySession.tracks = [];
        if (partySession.spotifyData?.tracks) {
            // Use Spotify track names
            partySession.tracks = partySession.spotifyData.tracks.slice(0, partySession.trackCount);
        } else {
            // Generate default track names
            for (let i = 1; i <= partySession.trackCount; i++) {
                partySession.tracks.push({
                    number: i,
                    title: `Track ${i}`,
                    isInterlude: false
                });
            }
        }

        // Initialize ratings
        partySession.ratings = {};
        partySession.tracks.forEach(track => {
            partySession.ratings[track.number] = {};
        });
        
        // Generate room code
        partySession.roomCode = generateRoomCode();
        
        // Create party session in Firestore
        await db.collection('party-sessions').doc(partySession.roomCode).set({
            albumTitle: partySession.albumTitle,
            artistName: partySession.artistName,
            albumCover: partySession.albumCover,
            trackCount: partySession.trackCount,
            tracks: partySession.tracks,
            participants: [],
            currentTrackIndex: 0,
            ratings: partySession.ratings,
            phase: 'lobby',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            bingoContainerId: partySession.bingoContainerId || null,
    bingoBoards: null  // Will be populated when party starts
        });
        
        console.log('✅ Party session created:', partySession.roomCode);
        
        // Move to lobby
        showLobby();
        
    } catch (error) {
        console.error('❌ Error creating party:', error);
        showNotification('Error creating party session', 'error');
    }
}

// Show lobby phase
function showLobby() {
    document.getElementById('setupPhase').style.display = 'none';
    document.getElementById('lobbyPhase').style.display = 'block';
    document.getElementById('roomCodeDisplay').textContent = partySession.roomCode;
    
    partySession.phase = 'lobby';
    
    // Listen for participants joining
    unsubscribe = db.collection('party-sessions').doc(partySession.roomCode)
    .onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();
            partySession.participants = data.participants || [];
            partySession.ratings = data.ratings || {};
            
            // NEW: Check for bingo updates
            if (data.bingoBoards && partySession.bingoBoards) {
                checkForNewBingos(data.bingoBoards);
            }
            
            // Update based on current phase
            if (partySession.phase === 'lobby') {
                updateLobbyDisplay();
            } else if (partySession.phase === 'active') {
                updateLiveRatingsOnly();
            }
        }
    });
    
    // Listen for chat messages
    listenForChatMessages();
}

// Track which bingos we've already announced
let announcedBingos = {};

// Check for new bingos and announce them
function checkForNewBingos(newBingoBoards) {
    partySession.participants.forEach(participant => {
        const newBoard = newBingoBoards[participant.id];
        const oldBoard = partySession.bingoBoards[participant.id];
        
        if (newBoard && oldBoard) {
            // Check if participant has new bingo
            const oldBingoCount = oldBoard.completedRows.length + 
                                 oldBoard.completedCols.length + 
                                 oldBoard.completedDiagonals.length;
            const newBingoCount = newBoard.completedRows.length + 
                                 newBoard.completedCols.length + 
                                 newBoard.completedDiagonals.length;
            
            // New bingo detected!
            if (newBingoCount > oldBingoCount && !announcedBingos[participant.id]) {
                showNotification(`🎉 ${participant.name} got BINGO! +${BINGO_LPC_REWARD} LPC`, 'success');
                announcedBingos[participant.id] = true;
            }
        }
    });
    
    // Update local bingo boards
    partySession.bingoBoards = newBingoBoards;
}

// Update ONLY the rating values, not the entire display
async function updateLiveRatingsOnly() {
    const trackNum = partySession.currentTrackIndex + 1;
    const trackRatings = partySession.ratings[trackNum] || {};
    
    // Initialize tracking for this track if needed
    if (!partySession.lastShownRatings[trackNum]) {
        partySession.lastShownRatings[trackNum] = {};
    }
    
    for (const participant of partySession.participants) {
        const rating = trackRatings[participant.id];
        const hasRating = rating !== null && rating !== undefined;
        const lastShownRating = partySession.lastShownRatings[trackNum][participant.id];
        
        // Check if this is a NEW rating we haven't shown yet
        const isNewRating = hasRating && lastShownRating === undefined;
        
        // Mark this rating as shown
        if (hasRating) {
            partySession.lastShownRatings[trackNum][participant.id] = rating;
        }
        
        // Show splash animation ONLY for new ratings!
        if (isNewRating) {
            console.log(`🎉 NEW rating from ${participant.name}: ${rating}`);
            showRatingSplash(participant.name, rating);
            
            // Rebuild the display to show the new rating
            updateLiveRatings();
            break; // Exit after rebuilding once
        }
    }
}

// Update lobby display
async function updateLobbyDisplay() {
    const grid = document.getElementById('lobbyGrid');
    const count = document.getElementById('participantCount');
    
    count.textContent = partySession.participants.length;
    grid.innerHTML = '';
    
    for (const participant of partySession.participants) {
        const card = document.createElement('div');
        card.className = 'lobby-participant';
        
        // Get profile picture if they have a participantId
        let avatarHTML = `<div class="lobby-participant-avatar">${participant.name.charAt(0).toUpperCase()}</div>`;
        
        if (participant.participantId) {
            try {
                const participantDoc = await db.collection('participants').doc(participant.participantId).get();
                if (participantDoc.exists) {
                    const data = participantDoc.data();
                    if (data.profilePicture) {
                        avatarHTML = `
                            <div class="lobby-participant-avatar">
                                <img src="${data.profilePicture}" alt="${participant.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
                            </div>
                        `;
                    }
                }
            } catch (error) {
                console.error('Error loading profile pic:', error);
            }
        }
        
        card.innerHTML = `
            ${avatarHTML}
            <strong>${participant.name}</strong>
        `;
        grid.appendChild(card);
    }
}

// Start the party
async function startParty() {
    try {
        if (partySession.participants.length === 0) {
            showNotification('Wait for at least one participant to join!', 'error');
            return;
        }

        // NEW: Generate bingo boards if container selected
        if (partySession.bingoContainerId) {
            console.log('🎲 Generating bingo boards...');
            partySession.bingoBoards = await generateBingoBoards(
                partySession.bingoContainerId, 
                partySession.participants
            );
        }
        
       
        
 // Update session to active phase
await db.collection('party-sessions').doc(partySession.roomCode).update({
    phase: 'active',
    currentTrackIndex: 0,
    bingoBoards: partySession.bingoBoards || null  // ADD THIS LINE
});
        
        partySession.phase = 'active';
        partySession.currentTrackIndex = 0;
        
        showActivePhase();
        
    } catch (error) {
        console.error('❌ Error starting party:', error);
        showNotification('Error starting party', 'error');
    }
}

// Show active rating phase
function showActivePhase() {
    document.getElementById('lobbyPhase').style.display = 'none';
    document.getElementById('activePhase').style.display = 'block';
    
    document.getElementById('totalTracks').textContent = partySession.trackCount;
    
    displayCurrentTrack();
}

// Display current track
function displayCurrentTrack() {
    const trackNum = partySession.currentTrackIndex + 1;
    const track = partySession.tracks[partySession.currentTrackIndex];
    
    document.getElementById('currentTrackNum').textContent = trackNum;
    document.getElementById('activeTrackNum').textContent = trackNum;
    document.getElementById('activeTrackTitle').textContent = track.title;
    
    // Update progress
    const progress = ((partySession.currentTrackIndex + 1) / partySession.trackCount) * 100;
    document.getElementById('trackProgress').style.width = progress + '%';
    document.getElementById('trackProgress').textContent = Math.round(progress) + '%';
    
    // Show/hide finish button
    if (partySession.currentTrackIndex === partySession.trackCount - 1) {
        document.getElementById('nextTrackBtn').style.display = 'none';
        document.getElementById('finishPartyBtn').style.display = 'inline-block';
    } else {
        document.getElementById('nextTrackBtn').style.display = 'inline-block';
        document.getElementById('finishPartyBtn').style.display = 'none';
    }
    
    // IMPORTANT: Clear the shown ratings for this track
    // This prevents duplicate splashes when moving to a new track
    partySession.lastShownRatings[trackNum] = {};
    
    updateLiveRatings();
}

// Update live ratings display (rebuilds entire display)
async function updateLiveRatings() {
    const container = document.getElementById('liveRatings');
    
    // IMPORTANT: Clear the container first to prevent duplicates
    container.innerHTML = '';
    
    const trackNum = partySession.currentTrackIndex + 1;
    const trackRatings = partySession.ratings[trackNum] || {};
    
    // Initialize tracking for this track if needed
    if (!partySession.lastShownRatings[trackNum]) {
        partySession.lastShownRatings[trackNum] = {};
    }
    
    for (const participant of partySession.participants) {
        const rating = trackRatings[participant.id];
        const hasRating = rating !== null && rating !== undefined;
        
        const card = document.createElement('div');
        card.className = `rating-card ${hasRating ? 'has-rating' : ''}`;
        card.dataset.participantId = participant.id; // Add unique identifier
        
        // Get profile picture if they have a participantId
        let avatarHTML = `<div class="rating-card-avatar">${participant.name.charAt(0).toUpperCase()}</div>`;
        
        if (participant.participantId) {
            try {
                const participantDoc = await db.collection('participants').doc(participant.participantId).get();
                if (participantDoc.exists) {
                    const data = participantDoc.data();
                    if (data.profilePicture) {
                        avatarHTML = `
                            <div class="rating-card-avatar">
                                <img src="${data.profilePicture}" alt="${participant.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
                            </div>
                        `;
                    }
                }
            } catch (error) {
                console.error('Error loading profile pic:', error);
            }
        }
        
        card.innerHTML = `
            ${avatarHTML}
            <div class="rating-card-name">${participant.name}</div>
            ${hasRating 
                ? `<div class="rating-card-score ${getScoreClass(rating)}">${formatScore(rating)}</div>`
                : `<div class="rating-card-waiting">⏳</div>`
            }
        `;
        container.appendChild(card);
    }
    
    console.log(`✅ Updated live ratings display - ${partySession.participants.length} participants`);
}

// Next track
async function nextTrack() {
    try {
        // Check if all participants have rated
        const trackNum = partySession.currentTrackIndex + 1;
        const trackRatings = partySession.ratings[trackNum] || {};
        const allRated = partySession.participants.every(p => 
            trackRatings[p.id] !== null && trackRatings[p.id] !== undefined
        );
        
        if (!allRated) {
            const confirm = window.confirm('Not everyone has rated yet. Continue anyway?');
            if (!confirm) return;
        }
        
        // Move to next track
        partySession.currentTrackIndex++;
        
        await db.collection('party-sessions').doc(partySession.roomCode).update({
            currentTrackIndex: partySession.currentTrackIndex
        });
        
        displayCurrentTrack();
        
    } catch (error) {
        console.error('❌ Error moving to next track:', error);
        showNotification('Error moving to next track', 'error');
    }
}

// Party Mode Awards Ceremony Enhancement
// Add these functions to party-mode-host.js

// Replace the existing finishParty function with this enhanced version
async function finishParty() {
    try {
        // Check if last track is rated
        const trackNum = partySession.currentTrackIndex + 1;
        const trackRatings = partySession.ratings[trackNum] || {};
        const allRated = partySession.participants.every(p => 
            trackRatings[p.id] !== null && trackRatings[p.id] !== undefined
        );
        
        if (!allRated) {
            const confirm = window.confirm('Not everyone has rated the last track. Finish anyway?');
            if (!confirm) return;
        }
        
        // Calculate album average and track scores
        const nonInterludeTracks = partySession.tracks.filter(t => !t.isInterlude);
        let albumTotal = 0;
        let albumCount = 0;
        const trackScores = [];
        
        nonInterludeTracks.forEach(track => {
            const ratings = Object.values(partySession.ratings[track.number] || {}).filter(r => r !== null);
            if (ratings.length > 0) {
                const trackAvg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
                albumTotal += trackAvg;
                albumCount++;
                trackScores.push({
                    track: track,
                    average: trackAvg
                });
            }
        });
        
        const albumAverage = albumCount > 0 ? parseFloat((albumTotal / albumCount).toFixed(2)) : 0;
        
        // Get participant IDs
        const participantIds = partySession.participants
            .filter(p => p.participantId)
            .map(p => p.participantId);
        
        // Remap ratings
        const remappedRatings = {};
        Object.keys(partySession.ratings).forEach(trackNum => {
            remappedRatings[trackNum] = {};
            
            partySession.participants.forEach(participant => {
                const rating = partySession.ratings[trackNum][participant.id];
                const idToUse = participant.participantId || participant.id;
                
                if (rating !== null && rating !== undefined) {
                    remappedRatings[trackNum][idToUse] = rating;
                }
            });
        });
        
        // Save to albums collection
        const albumDoc = await db.collection('albums').add({
            title: partySession.albumTitle,
            artist: partySession.artistName,
            coverImage: partySession.albumCover,
            trackCount: partySession.trackCount,
            tracks: partySession.tracks,
            participants: participantIds,
            ratings: remappedRatings,
            averageScore: albumAverage,
            isCompleted: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            partyMode: true
        });
        
        partySession.albumId = albumDoc.id;
        
        // Update session
        await db.collection('party-sessions').doc(partySession.roomCode).update({
            phase: 'results',
            albumId: albumDoc.id,
            albumAverage: albumAverage
        });
        
        partySession.phase = 'results';
        partySession.albumAverage = albumAverage;  // ADD THIS LINE
        
        
        // START AWARDS CEREMONY
        showAwardsCeremony(albumAverage, trackScores);
        
        console.log('✅ Party finished and saved to albums');
        
    } catch (error) {
        console.error('❌ Error finishing party:', error);
        showNotification('Error finishing party', 'error');
    }
}




// Awards Ceremony with Countdown
function showAwardsCeremony(albumAverage, trackScores) {
    const overlay = document.createElement('div');
    overlay.id = 'awardsCeremonyOverlay';
    overlay.className = 'awards-overlay';
    overlay.innerHTML = `
        <div class="awards-content">
            <h2 class="awards-title">🎬 Awards Ceremony</h2>
            <p class="awards-subtitle">Calculating the results...</p>
            <div class="awards-countdown" id="awardsCountdown">3</div>
            <div class="awards-loading">
                <div class="loading-bar"></div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    let count = 3;
    const countdownEl = document.getElementById('awardsCountdown');
    
    const countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownEl.textContent = count;
            countdownEl.style.animation = 'none';
            setTimeout(() => {
                countdownEl.style.animation = 'countdownPulse 1s ease-out';
            }, 10);
        } else {
            clearInterval(countdownInterval);
            revealResults(albumAverage, trackScores);
        }
    }, 1000);
}

// Reveal Results with Big Score
function revealResults(albumAverage, trackScores) {
    const overlay = document.getElementById('awardsCeremonyOverlay');
    const content = overlay.querySelector('.awards-content');
    
    const scoreClass = getScoreClass(albumAverage);
    
    // Find best and worst tracks
    trackScores.sort((a, b) => b.average - a.average);
    const bestTrack = trackScores[0];
    const worstTrack = trackScores[trackScores.length - 1];
    
    const tierNames = {
        'trash': '🗑️ TRASH TIER',
        'mid': '🟢 MID TIER',
        'good': '🔵 GOOD TIER',
        'epic': '🟣 EPIC TIER',
        'legendary': '🟠 LEGENDARY TIER'
    };
    const tierName = tierNames[scoreClass] || 'RATED';
    
    content.innerHTML = `
        <div class="results-reveal">
            <h2 class="reveal-title">🎉 And the score is...</h2>
            <div class="score-reveal-box ${scoreClass}">
                <div class="score-reveal-number">${albumAverage}</div>
                <div class="score-reveal-tier">${tierName}</div>
            </div>
            <div class="score-reveal-album">
                <strong>${partySession.albumTitle}</strong> by ${partySession.artistName}
            </div>
            ${bestTrack ? `
                <div class="awards-highlights">
                    <div class="award-badge">
                        <span class="award-icon">🏆</span>
                        <div class="award-info">
                            <div class="award-label">Best Track</div>
                            <div class="award-value">${bestTrack.track.title}</div>
                            <div class="award-score">${bestTrack.average.toFixed(2)}</div>
                        </div>
                    </div>
                    ${worstTrack && worstTrack !== bestTrack ? `
                        <div class="award-badge">
                            <span class="award-icon">💔</span>
                            <div class="award-info">
                                <div class="award-label">Lowest Rated</div>
                                <div class="award-value">${worstTrack.track.title}</div>
                                <div class="award-score">${worstTrack.average.toFixed(2)}</div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            ` : ''}
            <button class="btn btn-primary continue-btn" onclick="closeAwardsAndShowResults()">
                Continue to Full Results
            </button>
        </div>
    `;
    
    setTimeout(() => {
        createConfetti(scoreClass);
        const scoreBox = content.querySelector('.score-reveal-box');
        scoreBox.style.animation = 'scoreRevealAnimation 1s ease-out';
    }, 100);
}

// Close awards and show full results with memory upload
function closeAwardsAndShowResults() {
    const overlay = document.getElementById('awardsCeremonyOverlay');
    overlay.style.animation = 'fadeOut 0.5s ease-out';
    setTimeout(() => {
        overlay.remove();
        showResultsWithMemory();
    }, 500);
}

// Enhanced showResults with memory upload section
function showResultsWithMemory() {
    document.getElementById('activePhase').style.display = 'none';
    document.getElementById('resultsPhase').style.display = 'block';
    
    const albumAverage = partySession.albumAverage || 0;
    
    // Display album info
    document.getElementById('finalAlbumTitle').textContent = partySession.albumTitle;
    document.getElementById('finalArtistName').textContent = partySession.artistName;
    document.getElementById('finalAlbumScore').textContent = albumAverage;
    document.getElementById('finalAlbumScore').className = 'score-value ' + getScoreClass(albumAverage);
    
    if (partySession.albumCover) {
        document.getElementById('finalAlbumCover').innerHTML = `<img src="${partySession.albumCover}" alt="Album Cover">`;
    }
    
    // Display track ratings with better formatting
    const trackList = document.getElementById('finalTrackRatings');
    trackList.innerHTML = '<h3>Track Breakdown</h3>';
    
    partySession.tracks.forEach(track => {
        const ratings = Object.values(partySession.ratings[track.number] || {}).filter(r => r !== null);
        const avg = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2) : 'N/A';
        
        const trackItem = document.createElement('div');
        trackItem.className = 'track-result-item';
        trackItem.innerHTML = `
            <div class="track-result-info">
                <strong>${track.number}. ${track.title}</strong>
                ${track.isInterlude ? '<span class="interlude-badge">Interlude</span>' : ''}
            </div>
            <div class="track-result-score ${getScoreClass(parseFloat(avg))}">${avg}</div>
        `;
        trackList.appendChild(trackItem);
    });
    
    // Add rating matrix after track list
    const resultsContainer = document.querySelector('#resultsPhase .results-container');
    
    // Check if matrix already exists
    let matrixSection = document.getElementById('partyRatingMatrix');
    if (!matrixSection) {
        matrixSection = document.createElement('div');
        matrixSection.id = 'partyRatingMatrix';
        matrixSection.style.marginTop = '40px';
        trackList.parentNode.insertBefore(matrixSection, trackList.nextSibling);
    }
    
    matrixSection.innerHTML = '<h3>Full Rating Matrix</h3>';
    
    const table = document.createElement('table');
    table.className = 'results-table';
    
    // Header
    let headerHTML = '<thead><tr><th>Track</th>';
    partySession.participants.forEach(p => {
        headerHTML += `<th>${p.name}</th>`;
    });
    headerHTML += '<th>Average</th></tr></thead>';
    table.innerHTML = headerHTML;
    
    // Body
    let bodyHTML = '<tbody>';
    partySession.tracks.forEach(track => {
        bodyHTML += `<tr><td><strong>${track.number}.</strong> ${track.title}</td>`;
        
        partySession.participants.forEach(p => {
            const rating = partySession.ratings[track.number][p.id];
            bodyHTML += `<td>${rating !== null && rating !== undefined ? formatScore(rating) : '-'}</td>`;
        });
        
        const ratings = Object.values(partySession.ratings[track.number] || {}).filter(r => r !== null);
        const avg = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2) : '-';
        bodyHTML += `<td class="${getScoreClass(parseFloat(avg))}"><strong>${avg}</strong></td>`;
        bodyHTML += '</tr>';
    });
    bodyHTML += '</tbody>';
    table.innerHTML += bodyHTML;
    
    matrixSection.appendChild(table);
    
    // Add memory upload section
    addMemorySection();

    if (partySession.bingoBoards) {
        console.log('🎲 Rendering bingo results...');
        renderBingoResults();
    }
}

// Add memory upload section to results
function addMemorySection() {
    const resultsContainer = document.querySelector('#resultsPhase .results-container');
    
    // Check if memory section already exists
    if (document.getElementById('partyMemorySection')) {
        return;
    }
    
    const memorySection = document.createElement('div');
    memorySection.id = 'partyMemorySection';
    memorySection.className = 'memory-section';
    memorySection.innerHTML = `
        <h3>📸 Capture the Memory</h3>
        <p class="memory-subtitle">Add photos and a review to remember this listening party</p>
        
        <div class="memory-upload-section">
            <div class="memory-photos-upload">
                <label for="partyMemoryPhotos" class="memory-upload-label">
                    <div class="memory-upload-box" id="partyMemoryPhotosBox">
                        <span class="upload-icon">📷</span>
                        <span class="upload-text">Upload Photos</span>
                        <span class="upload-hint">Click to add up to 5 photos from the party</span>
                    </div>
                </label>
                <input type="file" id="partyMemoryPhotos" accept="image/*" multiple style="display: none;">
                
                <div id="partyPhotoPreviewGrid" class="photo-preview-grid" style="display: none;">
                    <!-- Photo thumbnails will appear here -->
                </div>
                <p class="photo-count-text" id="partyPhotoCountText" style="display: none;">
                    <span id="partyPhotoCount">0</span>/5 photos selected
                </p>
            </div>
            
            <div class="memory-review-section">
                <label for="partyMemoryReview" class="memory-label">
                    <span>✍️ Write a Review</span>
                    <span class="optional-tag">Optional</span>
                </label>
                <textarea 
                    id="partyMemoryReview" 
                    class="memory-review-textarea"
                    placeholder="How was the listening experience? Any memorable moments, discussions, or thoughts about the album?"
                    rows="6"
                ></textarea>
                <div class="character-count">
                    <span id="partyReviewCharCount">0</span>/500 characters
                </div>
            </div>
        </div>
        
        <button class="btn btn-success" id="savePartyMemoryBtn">
            💾 Save Memory
        </button>
    `;
    
    // Insert before results-actions
    const actionsDiv = resultsContainer.querySelector('.results-actions');
    resultsContainer.insertBefore(memorySection, actionsDiv);
    
    // Add event listeners
    document.getElementById('partyMemoryPhotos').addEventListener('change', handlePartyMemoryPhotosUpload);
    document.getElementById('savePartyMemoryBtn').addEventListener('click', savePartyMemory);
    
    const textarea = document.getElementById('partyMemoryReview');
    textarea.addEventListener('input', () => {
        const count = textarea.value.length;
        document.getElementById('partyReviewCharCount').textContent = count;
        if (count > 500) {
            textarea.value = textarea.value.substring(0, 500);
            document.getElementById('partyReviewCharCount').textContent = 500;
        }
    });
    
    // Initialize photo storage
    partySession.memoryPhotoFiles = [];
}

// Handle memory photos upload
function handlePartyMemoryPhotosUpload(event) {
    const files = Array.from(event.target.files);
    const maxPhotos = 5;
    
    if (partySession.memoryPhotoFiles.length + files.length > maxPhotos) {
        showNotification(`Maximum ${maxPhotos} photos allowed`, 'error');
        const remaining = maxPhotos - partySession.memoryPhotoFiles.length;
        if (remaining > 0) {
            files.splice(remaining);
        } else {
            return;
        }
    }
    
    files.forEach(file => {
        partySession.memoryPhotoFiles.push(file);
    });
    
    updatePartyPhotoPreview();
}

// Update photo preview
function updatePartyPhotoPreview() {
    const uploadBox = document.getElementById('partyMemoryPhotosBox');
    const previewGrid = document.getElementById('partyPhotoPreviewGrid');
    const countText = document.getElementById('partyPhotoCountText');
    const photoCount = document.getElementById('partyPhotoCount');
    
    if (partySession.memoryPhotoFiles.length > 0) {
        uploadBox.style.display = 'none';
        previewGrid.style.display = 'grid';
        countText.style.display = 'block';
        photoCount.textContent = partySession.memoryPhotoFiles.length;
        
        previewGrid.innerHTML = '';
        
        partySession.memoryPhotoFiles.forEach((file, index) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const photoCard = document.createElement('div');
                photoCard.className = 'photo-preview-card';
                photoCard.innerHTML = `
                    <img src="${e.target.result}" alt="Memory Photo ${index + 1}">
                    <button class="remove-photo-btn" onclick="removePartyMemoryPhoto(${index})">✕</button>
                    <div class="photo-number">${index + 1}</div>
                `;
                previewGrid.appendChild(photoCard);
            };
            
            reader.readAsDataURL(file);
        });
        
        if (partySession.memoryPhotoFiles.length < 5) {
            const addMoreCard = document.createElement('div');
            addMoreCard.className = 'photo-preview-card add-more-card';
            addMoreCard.onclick = () => document.getElementById('partyMemoryPhotos').click();
            addMoreCard.innerHTML = `
                <span class="add-more-icon">➕</span>
                <span class="add-more-text">Add More</span>
            `;
            previewGrid.appendChild(addMoreCard);
        }
    } else {
        uploadBox.style.display = 'flex';
        previewGrid.style.display = 'none';
        countText.style.display = 'none';
    }
}

// Remove specific photo
function removePartyMemoryPhoto(index) {
    partySession.memoryPhotoFiles.splice(index, 1);
    updatePartyPhotoPreview();
    document.getElementById('partyMemoryPhotos').value = '';
    
    if (partySession.memoryPhotoFiles.length === 0) {
        showNotification('All photos removed', 'info');
    }
}

// Save party memory
async function savePartyMemory() {
    try {
        showNotification('Saving memory...', 'info');
        
        const review = document.getElementById('partyMemoryReview').value.trim();
        const memoryPhotoUrls = [];
        
        if (partySession.memoryPhotoFiles && partySession.memoryPhotoFiles.length > 0) {
            for (let i = 0; i < partySession.memoryPhotoFiles.length; i++) {
                const file = partySession.memoryPhotoFiles[i];
                const photoPath = `memories/${partySession.albumId}_${Date.now()}_${i}_${file.name}`;
                const photoUrl = await uploadImage(file, photoPath);
                memoryPhotoUrls.push(photoUrl);
                
                showNotification(`Uploading photo ${i + 1}/${partySession.memoryPhotoFiles.length}...`, 'info');
            }
        }
        
        await db.collection('albums').doc(partySession.albumId).update({
            memoryPhotos: memoryPhotoUrls,
            memoryReview: review,
            memoryAddedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showNotification(`✅ Memory saved with ${memoryPhotoUrls.length} photo(s)!`, 'success');
        
        document.getElementById('partyMemorySection').innerHTML = `
            <div class="memory-saved">
                <span class="success-icon">✅</span>
                <h3>Memory Saved!</h3>
                <p>Your ${memoryPhotoUrls.length} photo${memoryPhotoUrls.length !== 1 ? 's' : ''} and review have been added to this album</p>
            </div>
        `;
        
    } catch (error) {
        console.error('Error saving memory:', error);
        showNotification('Error saving memory', 'error');
    }
}

// Confetti function
function createConfetti(scoreClass) {
    const colors = {
        'trash': ['#6b7280', '#9ca3af'],
        'mid': ['#22c55e', '#4ade80'],
        'good': ['#3b82f6', '#60a5fa'],
        'epic': ['#a855f7', '#c084fc'],
        'legendary': ['#f97316', '#fb923c']
    };
    
    const confettiColors = colors[scoreClass] || ['#6366f1', '#8b5cf6', '#ec4899'];
    
    for (let i = 0; i < 100; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.backgroundColor = confettiColors[Math.floor(Math.random() * confettiColors.length)];
            confetti.style.animationDelay = Math.random() * 0.5 + 's';
            confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
            confetti.style.position = 'fixed';
            confetti.style.top = '-10px';
            confetti.style.width = '10px';
            confetti.style.height = '10px';
            confetti.style.zIndex = '10001';
            confetti.style.pointerEvents = 'none';
            document.getElementById('awardsCeremonyOverlay').appendChild(confetti);
            
            setTimeout(() => confetti.remove(), 4000);
        }, i * 10);
    }
}

// Make functions globally available
window.closeAwardsAndShowResults = closeAwardsAndShowResults;
window.removePartyMemoryPhoto = removePartyMemoryPhoto;

// Show results
function showResults(albumAverage) {
    document.getElementById('activePhase').style.display = 'none';
    document.getElementById('resultsPhase').style.display = 'block';
    
    // Display album info
    document.getElementById('finalAlbumTitle').textContent = partySession.albumTitle;
    document.getElementById('finalArtistName').textContent = partySession.artistName;
    document.getElementById('finalAlbumScore').textContent = albumAverage;
    document.getElementById('finalAlbumScore').className = 'score-value ' + getScoreClass(albumAverage);
    
    if (partySession.albumCover) {
        document.getElementById('finalAlbumCover').innerHTML = `<img src="${partySession.albumCover}" alt="Album Cover">`;
    } else {
        document.getElementById('finalAlbumCover').innerHTML = '<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); font-size: 4rem;">🎵</div>';
    }
    
    // Display track ratings
    const trackList = document.getElementById('finalTrackRatings');
    trackList.innerHTML = '';
    
    partySession.tracks.forEach(track => {
        const ratings = Object.values(partySession.ratings[track.number] || {}).filter(r => r !== null);
        const avg = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2) : 'N/A';
        
        const trackItem = document.createElement('div');
        trackItem.className = 'track-result-item';
        trackItem.innerHTML = `
            <div class="track-result-info">
                <strong>${track.number}. ${track.title}</strong>
                ${track.isInterlude ? '<span class="interlude-badge">Interlude</span>' : ''}
            </div>
            <div class="track-result-score ${getScoreClass(parseFloat(avg))}">${avg}</div>
        `;
        trackList.appendChild(trackItem);
    });
}

// Handle cover preview
function handleCoverPreview(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            document.getElementById('partyCoverPreviewImg').src = event.target.result;
            document.getElementById('partyCoverPreview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

// Show rating splash animation
function showRatingSplash(participantName, rating) {
    const scoreClass = getScoreClass(rating);
    const tierNames = {
        'trash': '🗑️ TRASH',
        'mid': '🟢 MID',
        'good': '🔵 GOOD',
        'epic': '🟣 EPIC',
        'legendary': '🟠 LEGENDARY'
    };
    const tierName = tierNames[scoreClass] || 'RATED';
    
    // Create splash overlay
    const splash = document.createElement('div');
    splash.className = 'rating-splash';
    splash.innerHTML = `
        <div class="rating-splash-content ${scoreClass}">
            <div class="rating-splash-name">${participantName} thinks this track is</div>
            <div class="rating-splash-tier">${tierName}</div>
            <div class="rating-splash-score">${formatScore(rating)}</div>
        </div>
    `;
    
    document.body.appendChild(splash);
    
    // Trigger animation
    setTimeout(() => splash.classList.add('show'), 10);
    
    // Remove after animation
    setTimeout(() => {
        splash.classList.remove('show');
        setTimeout(() => splash.remove(), 500);
    }, 2000);
    
    // Play sound effect (optional)
    playRatingSound(scoreClass);
}

// Play sound effect based on rating tier (optional - can be disabled)
function playRatingSound(scoreClass) {
    // You can add sound effects here if you want!
    // For now, just console log
    console.log(`🔊 ${scoreClass.toUpperCase()} rating received!`);
}

// Listen for chat messages
function listenForChatMessages() {
    db.collection('party-sessions').doc(partySession.roomCode).collection('messages')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const message = change.doc.data();
                    showChatBubble(message);
                }
            });
        });
}

// Show chat bubble above participant's rating card
function showChatBubble(messageData) {
    const participantId = messageData.participantId;
    const message = messageData.message;
    const participantName = messageData.participantName;
    
    // Find the rating card for this participant
    const ratingCard = document.querySelector(`[data-participant-id="${participantId}"]`);
    
    if (!ratingCard) {
        console.log('Rating card not found for:', participantId);
        return;
    }
    
    // Remove any existing chat bubble
    const existingBubble = ratingCard.querySelector('.chat-bubble');
    if (existingBubble) {
        existingBubble.remove();
    }
    
    // Create chat bubble
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.innerHTML = `
        <div class="chat-bubble-message">${message}</div>
        <div class="chat-bubble-tail"></div>
    `;
    
    // Add to rating card
    ratingCard.style.position = 'relative';
    ratingCard.appendChild(bubble);
    
    // Trigger animation
    setTimeout(() => bubble.classList.add('show'), 10);
    
    console.log(`💬 Chat from ${participantName}: ${message}`);
    
    // Remove after 8 seconds
    setTimeout(() => {
        bubble.classList.remove('show');
        setTimeout(() => bubble.remove(), 500);
    }, 8000);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (unsubscribe) {
        unsubscribe();
    }
});

