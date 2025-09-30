// Party Creation & Rating JavaScript

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
    isCompleted: false
};

let currentStep = 1;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎵 Party creation page loaded');
    
    // Set up form handlers
    document.getElementById('albumInfoForm').addEventListener('submit', handleAlbumInfo);
    document.getElementById('tracksForm').addEventListener('submit', handleTracks);
    document.getElementById('participantsForm').addEventListener('submit', handleParticipants);
    document.getElementById('albumCover').addEventListener('change', handleCoverPreview);
    document.getElementById('calculateResultsBtn').addEventListener('click', calculateResults);
    
    // Load participants for step 3
    loadParticipantsForSelection();
});

// Generate rating options with half points
function generateRatingOptions(currentRating) {
    const options = [];
    for (let i = 0; i <= 10; i += 0.5) {
        const value = i;
        const display = i % 1 === 0 ? i.toFixed(0) : i.toFixed(1); // Show "5" or "5.5"
        const selected = currentRating === value ? 'selected' : '';
        options.push(`<option value="${value}" ${selected}>${display}</option>`);
    }
    return options.join('');
}

// Navigate between steps
function goToStep(step) {
    // Hide all steps
    document.querySelectorAll('.party-step').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.progress-step').forEach(s => s.classList.remove('active'));
    
    // Show target step
    document.getElementById(`step${step}`).classList.add('active');
    document.querySelectorAll(`.progress-step[data-step="${step}"]`).forEach(s => s.classList.add('active'));
    
    currentStep = step;
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Step 1: Handle Album Info
async function handleAlbumInfo(e) {
    e.preventDefault();
    
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
    
    // Generate track input fields
    generateTrackInputs();
    goToStep(2);
}

// Generate track title inputs
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

// Step 2: Handle Tracks
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
            // Create new album document
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
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            partyData.albumId = docRef.id;
            console.log('✅ Party created:', docRef.id);
        } else {
            // Update existing
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
    // Display album info
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
    partyData.tracks.forEach((track, index) => {
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
    
    // Calculate initial averages
    updateAllAverages();
}

// Handle rating change
async function handleRatingChange(e) {
    const trackNum = parseInt(e.target.dataset.track);
    const participantId = e.target.dataset.participant;
    const value = e.target.value === '' ? null : parseFloat(e.target.value);
    
    partyData.ratings[trackNum][participantId] = value;
    
    // Save to Firestore
    await savePartyToFirestore();
    
    // Update averages
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

// Get CSS class based on score
/*function getScoreClass(score) {
    if (isNaN(score)) return '';
    if (score >= 8) return 'score-high';
    if (score >= 6) return 'score-medium';
    if (score >= 4) return 'score-low';
    return 'score-very-low';
} */

function getScoreClass(score) {
    if (isNaN(score) || score === null || score === undefined) return '';
    const numScore = parseFloat(score);
    if (numScore >= 9) return 'legendary';
    if (numScore >= 8) return 'epic';
    if (numScore >= 7) return 'good';
    if (numScore >= 6) return 'mid';
    return 'trash';
}

// Calculate final results
async function calculateResults() {
    // Check if all ratings are complete
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
    
    // Calculate album average (excluding interludes)
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
    
    // Mark as completed and save
    partyData.isCompleted = true;
    await db.collection('albums').doc(partyData.albumId).update({
        isCompleted: true,
        averageScore: parseFloat(albumAverage)
    });
    
    // Display results
    displayResults(albumAverage);
    goToStep(5);
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
    
    // Display track ratings
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
    
    // Display full rating matrix
    const matrixDisplay = document.getElementById('ratingMatrixDisplay');
    matrixDisplay.innerHTML = '';
    
    const table = document.createElement('table');
    table.className = 'results-table';
    
    // Header
    let headerHTML = '<thead><tr><th>Track</th>';
    partyData.participants.forEach(p => {
        headerHTML += `<th>${p.username}</th>`;
    });
    headerHTML += '<th>Average</th></tr></thead>';
    table.innerHTML = headerHTML;
    
    // Body
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

// Make functions available globally
window.goToStep = goToStep;