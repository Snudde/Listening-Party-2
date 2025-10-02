// State management
let partyData = {
    albumTitle: '',
    artistName: '',
    trackCount: 0,
    albumCover: '',
    tracks: [],
    participants: [],
    ratings: {},
    albumId: null,
    isCompleted: false,
    spotifyId: null // New: Store Spotify ID for reference
};

let currentStep = 1;
let searchTimeout = null;
let useSpotify = false; // Toggle between manual and Spotify

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎵 Party creation page loaded');
    
    // Set up form handlers
    document.getElementById('albumInfoForm').addEventListener('submit', handleAlbumInfo);
    document.getElementById('tracksForm').addEventListener('submit', handleTracks);
    document.getElementById('participantsForm').addEventListener('submit', handleParticipants);
    document.getElementById('albumCover').addEventListener('change', handleCoverPreview);
    document.getElementById('calculateResultsBtn').addEventListener('click', calculateResults);
    
    // Spotify integration handlers
    const manualEntry = document.getElementById('manualEntry');
    const spotifyEntry = document.getElementById('spotifyEntry');
    
    manualEntry.addEventListener('change', handleEntryMethodToggle);
    spotifyEntry.addEventListener('change', handleEntryMethodToggle);
    
    document.getElementById('spotifySearch').addEventListener('input', handleSpotifySearch);
    
    // Load participants for step 3
    loadParticipantsForSelection();
});

// Handle toggle between manual and Spotify entry
function handleEntryMethodToggle(e) {
    useSpotify = e.target.value === 'spotify';
    
    const manualFields = document.getElementById('manualFields');
    const spotifyFields = document.getElementById('spotifyFields');
    
    if (useSpotify) {
        manualFields.style.display = 'none';
        spotifyFields.style.display = 'block';
        // Clear manual fields
        document.getElementById('albumTitle').value = '';
        document.getElementById('artistName').value = '';
        document.getElementById('trackCount').value = '';
    } else {
        manualFields.style.display = 'block';
        spotifyFields.style.display = 'none';
        // Clear Spotify search
        document.getElementById('spotifySearch').value = '';
        document.getElementById('spotifyResults').innerHTML = '';
    }
}

// Handle Spotify search with debouncing
function handleSpotifySearch(e) {
    const query = e.target.value.trim();
    
    // Clear previous timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    // Show loading indicator
    const resultsDiv = document.getElementById('spotifyResults');
    
    if (query.length < 2) {
        resultsDiv.innerHTML = '';
        return;
    }
    
    resultsDiv.innerHTML = '<div class="search-loading">Searching Spotify...</div>';
    
    // Debounce search by 500ms
    searchTimeout = setTimeout(async () => {
        try {
            const results = await window.spotifyAPI.searchAlbums(query);
            displaySpotifyResults(results);
        } catch (error) {
            console.error('Search error:', error);
            resultsDiv.innerHTML = '<div class="search-error">⚠️ Error searching Spotify. Check your API credentials.</div>';
        }
    }, 500);
}

// Display Spotify search results
function displaySpotifyResults(albums) {
    const resultsDiv = document.getElementById('spotifyResults');
    
    if (albums.length === 0) {
        resultsDiv.innerHTML = '<div class="search-empty">No albums found. Try a different search.</div>';
        return;
    }
    
    resultsDiv.innerHTML = '';
    
    albums.forEach(album => {
        const resultCard = document.createElement('div');
        resultCard.className = 'spotify-result-card';
        resultCard.onclick = () => selectSpotifyAlbum(album.id);
        
        resultCard.innerHTML = `
            <div class="spotify-result-cover">
                ${album.coverImageMedium 
                    ? `<img src="${album.coverImageMedium}" alt="${album.title}">` 
                    : '<div class="placeholder-cover">🎵</div>'
                }
            </div>
            <div class="spotify-result-info">
                <h4>${album.title}</h4>
                <p>${album.artist}</p>
                <span class="track-count">${album.totalTracks} tracks • ${album.releaseDate.split('-')[0]}</span>
            </div>
            <div class="select-indicator">Select →</div>
        `;
        
        resultsDiv.appendChild(resultCard);
    });
}

// Handle album selection from Spotify
async function selectSpotifyAlbum(spotifyId) {
    try {
        // Show loading state
        showNotification('Loading album details...', 'info');
        
        const albumDetails = await window.spotifyAPI.getAlbumDetails(spotifyId);
        
        // Populate party data
        partyData.albumTitle = albumDetails.title;
        partyData.artistName = albumDetails.artist;
        partyData.trackCount = albumDetails.totalTracks;
        partyData.tracks = albumDetails.tracks;
        partyData.spotifyId = albumDetails.id;
        
        // Download and set cover image
        if (albumDetails.coverImage) {
            try {
                const coverFile = await window.spotifyAPI.downloadCoverImage(albumDetails.coverImage);
                const coverPath = `albums/${Date.now()}_${coverFile.name}`;
                partyData.albumCover = await uploadImage(coverFile, coverPath);
            } catch (error) {
                console.error('Error downloading cover:', error);
                // Continue anyway, just without the cover
            }
        }
        
        showNotification('✅ Album loaded from Spotify!', 'success');
        
        // Display preview
        displaySpotifyPreview(albumDetails);
        
        // Show continue button
        document.getElementById('spotifyContinueBtn').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading album:', error);
        showNotification('Error loading album details', 'error');
    }
}

// Display preview of selected Spotify album
function displaySpotifyPreview(album) {
    const previewDiv = document.getElementById('spotifyPreview');
    previewDiv.style.display = 'block';
    
    previewDiv.innerHTML = `
        <div class="spotify-preview-header">
            <h3>✅ Album Selected</h3>
            <button type="button" class="btn-icon" onclick="clearSpotifySelection()">✕</button>
        </div>
        <div class="spotify-preview-content">
            <div class="preview-cover">
                ${album.coverImage 
                    ? `<img src="${album.coverImage}" alt="${album.title}">` 
                    : '<div class="placeholder-cover-large">🎵</div>'
                }
            </div>
            <div class="preview-info">
                <h2>${album.title}</h2>
                <p class="preview-artist">${album.artist}</p>
                <div class="preview-meta">
                    <span>🎵 ${album.totalTracks} tracks</span>
                    <span>📅 ${album.releaseDate}</span>
                </div>
                <div class="preview-tracks">
                    <h4>Tracks:</h4>
                    <ol class="preview-track-list">
                        ${album.tracks.slice(0, 5).map(track => `
                            <li>${track.title} ${track.isInterlude ? '<span class="mini-badge">Interlude</span>' : ''}</li>
                        `).join('')}
                        ${album.tracks.length > 5 ? `<li class="more-tracks">...and ${album.tracks.length - 5} more</li>` : ''}
                    </ol>
                </div>
            </div>
        </div>
    `;
}

// Clear Spotify selection
function clearSpotifySelection() {
    document.getElementById('spotifyPreview').style.display = 'none';
    document.getElementById('spotifyContinueBtn').style.display = 'none';
    document.getElementById('spotifySearch').value = '';
    document.getElementById('spotifyResults').innerHTML = '';
    
    // Clear party data
    partyData = {
        albumTitle: '',
        artistName: '',
        trackCount: 0,
        albumCover: '',
        tracks: [],
        participants: [],
        ratings: {},
        albumId: null,
        isCompleted: false,
        spotifyId: null
    };
}

// Continue to step 2 with Spotify data
function continueWithSpotify() {
    if (!partyData.albumTitle || !partyData.tracks.length) {
        showNotification('Please select an album first', 'error');
        return;
    }
    
    // Skip track entry step since we have tracks from Spotify
    // Initialize ratings
    initializeRatings();
    
    goToStep(3); // Go directly to participant selection
}

// Initialize ratings for tracks
function initializeRatings() {
    partyData.ratings = {};
    partyData.tracks.forEach(track => {
        partyData.ratings[track.number] = {};
    });
}

// Generate rating options with half points
function generateRatingOptions(currentRating) {
    const options = [];
    for (let i = 0; i <= 10; i += 0.5) {
        const value = i;
        const display = i % 1 === 0 ? i.toFixed(0) : i.toFixed(1);
        const selected = currentRating === value ? 'selected' : '';
        options.push(`<option value="${value}" ${selected}>${display}</option>`);
    }
    return options.join('');
}

// Navigate between steps
function goToStep(step) {
    document.querySelectorAll('.party-step').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.progress-step').forEach(s => s.classList.remove('active'));
    
    document.getElementById(`step${step}`).classList.add('active');
    document.querySelectorAll(`.progress-step[data-step="${step}"]`).forEach(s => s.classList.add('active'));
    
    currentStep = step;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Step 1: Handle Album Info (Manual entry)
async function handleAlbumInfo(e) {
    e.preventDefault();
    
    if (useSpotify) {
        // Spotify flow
        continueWithSpotify();
        return;
    }
    
    // Manual entry flow
    partyData.albumTitle = document.getElementById('albumTitle').value.trim();
    partyData.artistName = document.getElementById('artistName').value.trim();
    partyData.trackCount = parseInt(document.getElementById('trackCount').value);
    
    const coverFile = document.getElementById('albumCover').files[0];
    if (coverFile) {
        try {
            const coverPath = `albums/${Date.now()}_${coverFile.name}`;
            partyData.albumCover = await uploadImage(coverFile, coverPath);
        } catch (error) {
            console.error('Error uploading cover:', error);
            showNotification('Error uploading album cover', 'error');
            return;
        }
    }
    
    generateTrackInputs();
    goToStep(2);
}

// Generate track title inputs (for manual entry)
function generateTrackInputs() {
    const tracksList = document.getElementById('tracksList');
    tracksList.innerHTML = '';
    
    for (let i = 1; i <= partyData.trackCount; i++) {
        const trackInput = document.createElement('div');
        trackInput.className = 'track-input-group';
        trackInput.innerHTML = `
            <label for="track${i}">Track ${i}</label>
            <input type="text" id="track${i}" placeholder="Track title" required>
        `;
        tracksList.appendChild(trackInput);
    }
}

// Step 2: Handle Tracks (Manual entry only)
function handleTracks(e) {
    e.preventDefault();
    
    partyData.tracks = [];
    for (let i = 1; i <= partyData.trackCount; i++) {
        const title = document.getElementById(`track${i}`).value.trim();
        partyData.tracks.push({
            number: i,
            title: title,
            isInterlude: false
        });
    }
    
    goToStep(3);
}

// Load participants for selection
async function loadParticipantsForSelection() {
    try {
        const snapshot = await db.collection('participants').orderBy('username').get();
        const grid = document.getElementById('participantsGrid');
        const noParticipants = document.getElementById('noParticipants');
        
        if (snapshot.empty) {
            noParticipants.style.display = 'block';
            grid.style.display = 'none';
            return;
        }
        
        grid.innerHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const card = document.createElement('div');
            card.className = 'participant-select-card';
            card.innerHTML = `
                <input type="checkbox" id="participant_${doc.id}" value="${doc.id}" name="participants">
                <label for="participant_${doc.id}">
                    <div class="participant-select-avatar">
                        ${data.profilePicture 
                            ? `<img src="${data.profilePicture}" alt="${data.username}">` 
                            : `<div class="avatar-placeholder">${data.username.charAt(0).toUpperCase()}</div>`
                        }
                    </div>
                    <span>${data.username}</span>
                </label>
            `;
            grid.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading participants:', error);
        showNotification('Error loading participants', 'error');
    }
}

// Step 3: Handle Participants Selection
async function handleParticipants(e) {
    e.preventDefault();
    
    const selected = Array.from(document.querySelectorAll('input[name="participants"]:checked'));
    
    if (selected.length === 0) {
        showNotification('Please select at least one participant', 'error');
        return;
    }
    
    partyData.participants = [];
    
    for (const checkbox of selected) {
        const participantId = checkbox.value;
        const doc = await db.collection('participants').doc(participantId).get();
        partyData.participants.push({
            id: participantId,
            username: doc.data().username,
            profilePicture: doc.data().profilePicture || ''
        });
    }
    
    // Initialize ratings object
    partyData.ratings = {};
    partyData.tracks.forEach(track => {
        partyData.ratings[track.number] = {};
        partyData.participants.forEach(p => {
            partyData.ratings[track.number][p.id] = null;
        });
    });
    
    // Save party to Firestore
    await savePartyToFirestore();
    
    // Generate rating interface
    generateRatingInterface();
    goToStep(4);
}

// Save party to Firestore
async function savePartyToFirestore() {
    try {
        if (!partyData.albumId) {
            const docRef = await db.collection('albums').add({
                title: partyData.albumTitle,
                artist: partyData.artistName,
                coverImage: partyData.albumCover,
                trackCount: partyData.trackCount,
                tracks: partyData.tracks,
                participants: partyData.participants.map(p => p.id),
                ratings: partyData.ratings,
                averageScore: 0,
                isCompleted: false,
                spotifyId: partyData.spotifyId || null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            partyData.albumId = docRef.id;
            console.log('✅ Party created:', docRef.id);
        } else {
            await db.collection('albums').doc(partyData.albumId).update({
                ratings: partyData.ratings,
                tracks: partyData.tracks
            });
            console.log('✅ Party updated');
        }
    } catch (error) {
        console.error('❌ Error saving party:', error);
        throw error;
    }
}

// Generate rating interface
function generateRatingInterface() {
    document.getElementById('albumTitleDisplay').textContent = partyData.albumTitle;
    document.getElementById('artistNameDisplay').textContent = partyData.artistName;
    if (partyData.albumCover) {
        document.getElementById('albumCoverDisplay').innerHTML = `<img src="${partyData.albumCover}" alt="Album Cover">`;
    }
    
    const matrix = document.getElementById('ratingMatrix');
    matrix.innerHTML = '';
    
    // Create header row
    const headerRow = document.createElement('div');
    headerRow.className = 'rating-row rating-header-row';
    headerRow.innerHTML = '<div class="rating-cell track-cell"><strong>Track</strong></div>';
    
    partyData.participants.forEach(p => {
        headerRow.innerHTML += `
            <div class="rating-cell participant-cell">
                <div class="participant-header">
                    ${p.profilePicture 
                        ? `<img src="${p.profilePicture}" alt="${p.username}">` 
                        : `<div class="avatar-mini">${p.username.charAt(0).toUpperCase()}</div>`
                    }
                    <span>${p.username}</span>
                </div>
            </div>
        `;
    });
    
    headerRow.innerHTML += '<div class="rating-cell interlude-cell"><strong>Interlude</strong></div>';
    headerRow.innerHTML += '<div class="rating-cell average-cell"><strong>Avg</strong></div>';
    
    matrix.appendChild(headerRow);
    
    // Create track rows
    partyData.tracks.forEach(track => {
        const row = document.createElement('div');
        row.className = 'rating-row';
        row.innerHTML = `<div class="rating-cell track-cell"><strong>${track.number}.</strong> ${track.title}</div>`;
        
        partyData.participants.forEach(p => {
            const currentRating = partyData.ratings[track.number][p.id];
            row.innerHTML += `
                <div class="rating-cell">
                    <select class="rating-select" data-track="${track.number}" data-participant="${p.id}">
                        <option value="">-</option>
                        ${generateRatingOptions(currentRating)}
                    </select>
                </div>
            `;
        });
        
        row.innerHTML += `
            <div class="rating-cell interlude-cell">
                <input type="checkbox" class="interlude-checkbox" data-track="${track.number}" 
                    ${track.isInterlude ? 'checked' : ''}>
            </div>
            <div class="rating-cell average-cell">
                <span class="track-average" data-track="${track.number}">-</span>
            </div>
        `;
        
        matrix.appendChild(row);
    });
    
    // Add event listeners
    document.querySelectorAll('.rating-select').forEach(select => {
        select.addEventListener('change', handleRatingChange);
    });
    
    document.querySelectorAll('.interlude-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleInterludeChange);
    });
    
    updateAllAverages();
}

// Handle rating change
async function handleRatingChange(e) {
    const trackNum = parseInt(e.target.dataset.track);
    const participantId = e.target.dataset.participant;
    const value = e.target.value === '' ? null : parseFloat(e.target.value);
    
    partyData.ratings[trackNum][participantId] = value;
    
    await savePartyToFirestore();
    updateAllAverages();
    
    showNotification('Rating saved', 'success');
}

// Handle interlude checkbox
async function handleInterludeChange(e) {
    const trackNum = parseInt(e.target.dataset.track);
    const isInterlude = e.target.checked;
    
    const trackIndex = partyData.tracks.findIndex(t => t.number === trackNum);
    if (trackIndex !== -1) {
        partyData.tracks[trackIndex].isInterlude = isInterlude;
    }
    
    await savePartyToFirestore();
    updateAllAverages();
}

// Update all track averages
function updateAllAverages() {
    partyData.tracks.forEach(track => {
        const ratings = Object.values(partyData.ratings[track.number]).filter(r => r !== null);
        const avg = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2) : '-';
        
        const avgCell = document.querySelector(`.track-average[data-track="${track.number}"]`);
        if (avgCell) {
            avgCell.textContent = avg;
            avgCell.className = 'track-average ' + getScoreClass(parseFloat(avg));
        }
    });
}

// Calculate final results
async function calculateResults() {
    let allComplete = true;
    for (const track of partyData.tracks) {
        for (const participant of partyData.participants) {
            if (partyData.ratings[track.number][participant.id] === null) {
                allComplete = false;
                break;
            }
        }
        if (!allComplete) break;
    }
    
    if (!allComplete) {
        const confirm = window.confirm('Not all ratings are complete. Continue anyway?');
        if (!confirm) return;
    }
    
    showCountdownOverlay();
}

// Display results
function displayResults(albumAverage) {
    document.getElementById('resultAlbumTitle').textContent = partyData.albumTitle;
    document.getElementById('resultArtistName').textContent = partyData.artistName;
    document.getElementById('albumAverageScore').textContent = albumAverage;
    document.getElementById('albumAverageScore').className = 'score-value ' + getScoreClass(parseFloat(albumAverage));
    
    if (partyData.albumCover) {
        document.getElementById('resultAlbumCover').innerHTML = `<img src="${partyData.albumCover}" alt="Album Cover">`;
    }
    
    const trackList = document.getElementById('trackRatingsList');
    trackList.innerHTML = '';
    
    partyData.tracks.forEach(track => {
        const ratings = Object.values(partyData.ratings[track.number]).filter(r => r !== null);
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
    
    const matrixDisplay = document.getElementById('ratingMatrixDisplay');
    matrixDisplay.innerHTML = '';
    
    const table = document.createElement('table');
    table.className = 'results-table';
    
    let headerHTML = '<thead><tr><th>Track</th>';
    partyData.participants.forEach(p => {
        headerHTML += `<th>${p.username}</th>`;
    });
    headerHTML += '<th>Average</th></tr></thead>';
    table.innerHTML = headerHTML;
    
    let bodyHTML = '<tbody>';
    partyData.tracks.forEach(track => {
        bodyHTML += `<tr><td><strong>${track.number}.</strong> ${track.title}</td>`;
        partyData.participants.forEach(p => {
            const rating = partyData.ratings[track.number][p.id];
            bodyHTML += `<td>${rating !== null && rating !== undefined ? formatScore(rating) : '-'}</td>`;
        });
        
        const ratings = Object.values(partyData.ratings[track.number]).filter(r => r !== null);
        const avg = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2) : '-';
        bodyHTML += `<td class="${getScoreClass(parseFloat(avg))}"><strong>${avg}</strong></td>`;
        bodyHTML += '</tr>';
    });
    bodyHTML += '</tbody>';
    table.innerHTML += bodyHTML;
    
    matrixDisplay.appendChild(table);
}

// Handle cover preview
function handleCoverPreview(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            document.getElementById('coverPreviewImg').src = event.target.result;
            document.getElementById('coverPreview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

// Countdown and reveal functions
function showCountdownOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'countdownOverlay';
    overlay.className = 'countdown-overlay';
    overlay.innerHTML = `
        <div class="countdown-content">
            <h2>🎵 Calculating Results...</h2>
            <div class="countdown-number" id="countdownNumber">3</div>
            <p class="countdown-text">Get ready for the reveal!</p>
        </div>
    `;
    document.body.appendChild(overlay);
    
    let count = 3;
    const countdownEl = document.getElementById('countdownNumber');
    
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
            showResultsReveal();
        }
    }, 1000);
}

async function showResultsReveal() {
    const overlay = document.getElementById('countdownOverlay');
    const content = overlay.querySelector('.countdown-content');
    
    const nonInterludeTracks = partyData.tracks.filter(t => !t.isInterlude);
    let albumTotal = 0;
    let albumCount = 0;
    
    nonInterludeTracks.forEach(track => {
        const ratings = Object.values(partyData.ratings[track.number]).filter(r => r !== null);
        if (ratings.length > 0) {
            const trackAvg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
            albumTotal += trackAvg;
            albumCount++;
        }
    });
    
    const albumAverage = albumCount > 0 ? (albumTotal / albumCount).toFixed(2) : 0;
    const scoreClass = getScoreClass(parseFloat(albumAverage));
    
    const tierNames = {
        'trash': '🗑️ TRASH',
        'mid': '🟢 MID',
        'good': '🔵 GOOD',
        'epic': '🟣 EPIC',
        'legendary': '🟠 LEGENDARY'
    };
    const tierName = tierNames[scoreClass] || 'RATED';
    
    content.innerHTML = `
        <h2>🎉 The Score Is...</h2>
        <div class="score-reveal ${scoreClass}" id="scoreReveal">
            <div class="score-reveal-number">${albumAverage}</div>
            <div class="score-reveal-tier">${tierName}</div>
        </div>
        <p class="score-reveal-album">${partyData.albumTitle}</p>
    `;
    
    setTimeout(() => {
        createConfetti(scoreClass);
        const scoreReveal = document.getElementById('scoreReveal');
        scoreReveal.style.animation = 'scoreRevealAnimation 1s ease-out';
    }, 100);
    
    partyData.isCompleted = true;
    await db.collection('albums').doc(partyData.albumId).update({
        isCompleted: true,
        averageScore: parseFloat(albumAverage)
    });
    
    setTimeout(() => {
        overlay.style.animation = 'fadeOut 0.5s ease-out';
        setTimeout(() => {
            overlay.remove();
            displayResults(albumAverage);
            goToStep(5);
        }, 500);
    }, 4000);
}

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
            document.getElementById('countdownOverlay').appendChild(confetti);
            
            setTimeout(() => confetti.remove(), 4000);
        }, i * 10);
    }
}

// Make functions available globally
window.goToStep = goToStep;
window.clearSpotifySelection = clearSpotifySelection;
window.continueWithSpotify = continueWithSpotify;

// Enhanced Calculate Results with Awards Ceremony
async function calculateResults() {
    let allComplete = true;
    for (const track of partyData.tracks) {
        for (const participant of partyData.participants) {
            if (partyData.ratings[track.number][participant.id] === null) {
                allComplete = false;
                break;
            }
        }
        if (!allComplete) break;
    }
    
    if (!allComplete) {
        const confirm = window.confirm('Not all ratings are complete. Continue anyway?');
        if (!confirm) return;
    }
    
    // Start the awards ceremony!
    showAwardsCeremony();
}

// Awards Ceremony with Countdown
function showAwardsCeremony() {
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
            revealResults();
        }
    }, 1000);
}

// Reveal Results with Big Score
async function revealResults() {
    const overlay = document.getElementById('awardsCeremonyOverlay');
    const content = overlay.querySelector('.awards-content');
    
    // Calculate scores
    const nonInterludeTracks = partyData.tracks.filter(t => !t.isInterlude);
    let albumTotal = 0;
    let albumCount = 0;
    
    const trackScores = [];
    
    nonInterludeTracks.forEach(track => {
        const ratings = Object.values(partyData.ratings[track.number]).filter(r => r !== null);
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
    
    const albumAverage = albumCount > 0 ? (albumTotal / albumCount).toFixed(2) : 0;
    const scoreClass = getScoreClass(parseFloat(albumAverage));
    
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
                <strong>${partyData.albumTitle}</strong> by ${partyData.artistName}
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
    
    // Update album as completed
    partyData.isCompleted = true;
    await db.collection('albums').doc(partyData.albumId).update({
        isCompleted: true,
        averageScore: parseFloat(albumAverage)
    });
}

// Close awards and show full results
function closeAwardsAndShowResults() {
    const overlay = document.getElementById('awardsCeremonyOverlay');
    overlay.style.animation = 'fadeOut 0.5s ease-out';
    setTimeout(() => {
        overlay.remove();
        displayEnhancedResults();
        goToStep(5);
    }, 500);
}

// Enhanced Results Display with Memory Upload
function displayEnhancedResults() {
    // Calculate scores
    const nonInterludeTracks = partyData.tracks.filter(t => !t.isInterlude);
    let albumTotal = 0;
    let albumCount = 0;
    
    nonInterludeTracks.forEach(track => {
        const ratings = Object.values(partyData.ratings[track.number]).filter(r => r !== null);
        if (ratings.length > 0) {
            const trackAvg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
            albumTotal += trackAvg;
            albumCount++;
        }
    });
    
    const albumAverage = albumCount > 0 ? (albumTotal / albumCount).toFixed(2) : 0;
    
    document.getElementById('resultAlbumTitle').textContent = partyData.albumTitle;
    document.getElementById('resultArtistName').textContent = partyData.artistName;
    document.getElementById('albumAverageScore').textContent = albumAverage;
    document.getElementById('albumAverageScore').className = 'score-value ' + getScoreClass(parseFloat(albumAverage));
    
    if (partyData.albumCover) {
        document.getElementById('resultAlbumCover').innerHTML = `<img src="${partyData.albumCover}" alt="Album Cover">`;
    }
    
    // Track Summary Section
    const trackList = document.getElementById('trackRatingsList');
    trackList.innerHTML = '<h3>Track Breakdown</h3>';
    
    const trackScores = [];
    partyData.tracks.forEach(track => {
        const ratings = Object.values(partyData.ratings[track.number]).filter(r => r !== null);
        const avg = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2) : 'N/A';
        trackScores.push({ track, avg: parseFloat(avg) || 0 });
    });
    
    // Sort by score
    trackScores.sort((a, b) => b.avg - a.avg);
    
    trackScores.forEach(({track, avg}) => {
        const trackItem = document.createElement('div');
        trackItem.className = 'track-result-item';
        trackItem.innerHTML = `
            <div class="track-result-info">
                <strong>${track.number}. ${track.title}</strong>
                ${track.isInterlude ? '<span class="interlude-badge">Interlude</span>' : ''}
            </div>
            <div class="track-result-score ${getScoreClass(avg)}">${avg === 'N/A' ? 'N/A' : avg.toFixed(2)}</div>
        `;
        trackList.appendChild(trackItem);
    });
    
    // Rating Matrix
    const matrixDisplay = document.getElementById('ratingMatrixDisplay');
    matrixDisplay.innerHTML = '<h3>Full Rating Matrix</h3>';
    
    const table = document.createElement('table');
    table.className = 'results-table';
    
    let headerHTML = '<thead><tr><th>Track</th>';
    partyData.participants.forEach(p => {
        headerHTML += `<th>${p.username}</th>`;
    });
    headerHTML += '<th>Average</th></tr></thead>';
    table.innerHTML = headerHTML;
    
    let bodyHTML = '<tbody>';
    partyData.tracks.forEach(track => {
        bodyHTML += `<tr><td><strong>${track.number}.</strong> ${track.title}</td>`;
        partyData.participants.forEach(p => {
            const rating = partyData.ratings[track.number][p.id];
            bodyHTML += `<td>${rating !== null && rating !== undefined ? formatScore(rating) : '-'}</td>`;
        });
        
        const ratings = Object.values(partyData.ratings[track.number]).filter(r => r !== null);
        const avg = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2) : '-';
        bodyHTML += `<td class="${getScoreClass(parseFloat(avg))}"><strong>${avg}</strong></td>`;
        bodyHTML += '</tr>';
    });
    bodyHTML += '</tbody>';
    table.innerHTML += bodyHTML;
    
    matrixDisplay.appendChild(table);
    
    // Memory Section - Photo & Review
    const memorySection = document.getElementById('memorySection');
    memorySection.innerHTML = `
        <h3>📸 Capture the Memory</h3>
        <p class="memory-subtitle">Add photos and a review to remember this listening party</p>
        
        <div class="memory-upload-section">
            <div class="memory-photos-upload">
                <label for="memoryPhotos" class="memory-upload-label">
                    <div class="memory-upload-box" id="memoryPhotosBox">
                        <span class="upload-icon">📷</span>
                        <span class="upload-text">Upload Photos</span>
                        <span class="upload-hint">Click to add up to 5 photos from the night</span>
                    </div>
                </label>
                <input type="file" id="memoryPhotos" accept="image/*" multiple style="display: none;" onchange="handleMemoryPhotosUpload(event)">
                
                <div id="photoPreviewGrid" class="photo-preview-grid" style="display: none;">
                    <!-- Photo thumbnails will appear here -->
                </div>
                <p class="photo-count-text" id="photoCountText" style="display: none;">
                    <span id="photoCount">0</span>/5 photos selected
                </p>
            </div>
            
            <div class="memory-review-section">
                <label for="memoryReview" class="memory-label">
                    <span>✍️ Write a Review</span>
                    <span class="optional-tag">Optional</span>
                </label>
                <textarea 
                    id="memoryReview" 
                    class="memory-review-textarea"
                    placeholder="How was the listening experience? Any memorable moments, discussions, or thoughts about the album?"
                    rows="6"
                ></textarea>
                <div class="character-count">
                    <span id="reviewCharCount">0</span>/500 characters
                </div>
            </div>
        </div>
        
        <button class="btn btn-success" onclick="saveMemory()">
            💾 Save Memory
        </button>
    `;
    
    // Add character counter
    const textarea = document.getElementById('memoryReview');
    textarea.addEventListener('input', () => {
        const count = textarea.value.length;
        document.getElementById('reviewCharCount').textContent = count;
        if (count > 500) {
            textarea.value = textarea.value.substring(0, 500);
            document.getElementById('reviewCharCount').textContent = 500;
        }
    });
    
    // Initialize photo storage
    partyData.memoryPhotoFiles = [];
}

// Handle multiple memory photos upload with preview
function handleMemoryPhotosUpload(event) {
    const files = Array.from(event.target.files);
    const maxPhotos = 5;
    
    // Check if adding these would exceed limit
    if (partyData.memoryPhotoFiles.length + files.length > maxPhotos) {
        showNotification(`Maximum ${maxPhotos} photos allowed`, 'error');
        const remaining = maxPhotos - partyData.memoryPhotoFiles.length;
        if (remaining > 0) {
            // Only add what fits
            files.splice(remaining);
        } else {
            return;
        }
    }
    
    // Add new files
    files.forEach(file => {
        partyData.memoryPhotoFiles.push(file);
    });
    
    updatePhotoPreview();
}

// Update photo preview grid
function updatePhotoPreview() {
    const uploadBox = document.getElementById('memoryPhotosBox');
    const previewGrid = document.getElementById('photoPreviewGrid');
    const countText = document.getElementById('photoCountText');
    const photoCount = document.getElementById('photoCount');
    
    if (partyData.memoryPhotoFiles.length > 0) {
        uploadBox.style.display = 'none';
        previewGrid.style.display = 'grid';
        countText.style.display = 'block';
        photoCount.textContent = partyData.memoryPhotoFiles.length;
        
        previewGrid.innerHTML = '';
        
        partyData.memoryPhotoFiles.forEach((file, index) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const photoCard = document.createElement('div');
                photoCard.className = 'photo-preview-card';
                photoCard.innerHTML = `
                    <img src="${e.target.result}" alt="Memory Photo ${index + 1}">
                    <button class="remove-photo-btn" onclick="removeMemoryPhoto(${index})">✕</button>
                    <div class="photo-number">${index + 1}</div>
                `;
                previewGrid.appendChild(photoCard);
            };
            
            reader.readAsDataURL(file);
        });
        
        // Add "Add More" button if under limit
        if (partyData.memoryPhotoFiles.length < 5) {
            const addMoreCard = document.createElement('div');
            addMoreCard.className = 'photo-preview-card add-more-card';
            addMoreCard.onclick = () => document.getElementById('memoryPhotos').click();
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

// Remove specific memory photo
function removeMemoryPhoto(index) {
    partyData.memoryPhotoFiles.splice(index, 1);
    updatePhotoPreview();
    
    // Reset file input
    document.getElementById('memoryPhotos').value = '';
    
    if (partyData.memoryPhotoFiles.length === 0) {
        showNotification('All photos removed', 'info');
    }
}

// Save memory (multiple photos + review) to Firebase
async function saveMemory() {
    try {
        showNotification('Saving memory...', 'info');
        
        const review = document.getElementById('memoryReview').value.trim();
        const memoryPhotoUrls = [];
        
        // Upload all photos if provided
        if (partyData.memoryPhotoFiles && partyData.memoryPhotoFiles.length > 0) {
            for (let i = 0; i < partyData.memoryPhotoFiles.length; i++) {
                const file = partyData.memoryPhotoFiles[i];
                const photoPath = `memories/${partyData.albumId}_${Date.now()}_${i}_${file.name}`;
                const photoUrl = await uploadImage(file, photoPath);
                memoryPhotoUrls.push(photoUrl);
                
                // Show progress
                showNotification(`Uploading photo ${i + 1}/${partyData.memoryPhotoFiles.length}...`, 'info');
            }
        }
        
        // Update album document with memory
        await db.collection('albums').doc(partyData.albumId).update({
            memoryPhotos: memoryPhotoUrls,  // Array of URLs
            memoryReview: review,
            memoryAddedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showNotification(`✅ Memory saved with ${memoryPhotoUrls.length} photo(s)!`, 'success');
        
        // Update UI to show saved state
        document.getElementById('memorySection').innerHTML = `
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

// Make functions globally available
window.closeAwardsAndShowResults = closeAwardsAndShowResults;
window.handleMemoryPhotosUpload = handleMemoryPhotosUpload;
window.removeMemoryPhoto = removeMemoryPhoto;
window.saveMemory = saveMemory;