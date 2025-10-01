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
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
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
                
                // Update based on current phase
                if (partySession.phase === 'lobby') {
                    updateLobbyDisplay();
                } else if (partySession.phase === 'active') {
                    // Only update live ratings, don't rebuild the whole display
                    updateLiveRatingsOnly();
                }
            }
        });
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
        
        // Update session to active phase
        await db.collection('party-sessions').doc(partySession.roomCode).update({
            phase: 'active',
            currentTrackIndex: 0
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

// Finish party and save to albums
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
        
        // Calculate album average (excluding interludes)
        const nonInterludeTracks = partySession.tracks.filter(t => !t.isInterlude);
        let albumTotal = 0;
        let albumCount = 0;
        
        nonInterludeTracks.forEach(track => {
            const ratings = Object.values(partySession.ratings[track.number] || {}).filter(r => r !== null);
            if (ratings.length > 0) {
                const trackAvg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
                albumTotal += trackAvg;
                albumCount++;
            }
        });
        
        const albumAverage = albumCount > 0 ? parseFloat((albumTotal / albumCount).toFixed(2)) : 0;
        
        // Get participant IDs (only real participants, not guest IDs)
        const participantIds = partySession.participants
            .filter(p => p.participantId) // Only those linked to profiles
            .map(p => p.participantId);
        
        // Remap ratings to use participant IDs instead of guest IDs
        const remappedRatings = {};
        Object.keys(partySession.ratings).forEach(trackNum => {
            remappedRatings[trackNum] = {};
            
            partySession.participants.forEach(participant => {
                const rating = partySession.ratings[trackNum][participant.id];
                
                // If they have a participant ID, use that; otherwise use guest ID
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
        
        // Update session to results phase
        await db.collection('party-sessions').doc(partySession.roomCode).update({
            phase: 'results',
            albumId: albumDoc.id,
            albumAverage: albumAverage
        });
        
        partySession.phase = 'results';
        
        showResults(albumAverage);
        
        console.log('✅ Party finished and saved to albums');
        
    } catch (error) {
        console.error('❌ Error finishing party:', error);
        showNotification('Error finishing party', 'error');
    }
}

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

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (unsubscribe) {
        unsubscribe();
    }
});