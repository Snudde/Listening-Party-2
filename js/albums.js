// Albums Page JavaScript

let allAlbums = [];
let currentAlbumId = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('💿 Albums page loaded');
    
    loadAlbums();
    
    // Set up filter/sort listeners
    document.getElementById('sortBy').addEventListener('change', applyFiltersAndSort);
    document.getElementById('filterStatus').addEventListener('change', applyFiltersAndSort);
    
    // Set up modal listeners
    document.getElementById('closeAlbumModal').addEventListener('click', closeAlbumModal);
    document.getElementById('closeModalBtn').addEventListener('click', closeAlbumModal);
    document.getElementById('editAlbumBtn').addEventListener('click', openEditAlbumModal);
    document.getElementById('deleteAlbumBtn').addEventListener('click', openDeleteConfirmModal);
    
    // Delete confirmation modal
    document.getElementById('closeDeleteConfirmModal').addEventListener('click', closeDeleteConfirmModal);
    document.getElementById('cancelDeleteAlbum').addEventListener('click', closeDeleteConfirmModal);
    document.getElementById('confirmDeleteAlbum').addEventListener('click', confirmDeleteAlbum);
    
    // Edit album modal
    document.getElementById('closeEditModal').addEventListener('click', closeEditAlbumModal);
    document.getElementById('cancelEditAlbum').addEventListener('click', closeEditAlbumModal);
    document.getElementById('editAlbumForm').addEventListener('submit', saveAlbumEdits);
    document.getElementById('editAlbumCover').addEventListener('change', handleEditCoverPreview);
    
    // Check if there's an album ID in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const albumId = urlParams.get('id');
    if (albumId) {
        // Wait a bit for albums to load, then open modal
        setTimeout(() => openAlbumModal(albumId), 500);
    }
});

// Load all albums
async function loadAlbums() {
    try {
        const snapshot = await db.collection('albums').get();
        const loadingState = document.getElementById('loadingState');
        const emptyState = document.getElementById('emptyState');
        const albumsGrid = document.getElementById('albumsGrid');
        
        loadingState.style.display = 'none';
        
        if (snapshot.empty) {
            emptyState.style.display = 'block';
            albumsGrid.style.display = 'none';
            document.getElementById('albumCount').textContent = '0';
            return;
        }
        
        emptyState.style.display = 'none';
        albumsGrid.style.display = 'grid';
        
        allAlbums = [];
        snapshot.forEach(doc => {
            allAlbums.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        applyFiltersAndSort();
        
        console.log(`✅ Loaded ${allAlbums.length} albums`);
    } catch (error) {
        console.error('❌ Error loading albums:', error);
        showNotification('Error loading albums', 'error');
    }
}

// Apply filters and sorting
function applyFiltersAndSort() {
    const sortBy = document.getElementById('sortBy').value;
    const filterStatus = document.getElementById('filterStatus').value;
    
    // Filter albums
    let filtered = [...allAlbums];
    
    if (filterStatus === 'completed') {
        filtered = filtered.filter(a => a.isCompleted === true);
    } else if (filterStatus === 'in-progress') {
        filtered = filtered.filter(a => a.isCompleted !== true);
    }
    
    // Sort albums
    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'date-desc':
                return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
            case 'date-asc':
                return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
            case 'score-desc':
                return (b.averageScore || 0) - (a.averageScore || 0);
            case 'score-asc':
                return (a.averageScore || 0) - (b.averageScore || 0);
            case 'title':
                return (a.title || '').localeCompare(b.title || '');
            case 'artist':
                return (a.artist || '').localeCompare(b.artist || '');
            default:
                return 0;
        }
    });
    
    displayAlbums(filtered);
}

// Display albums in grid
function displayAlbums(albums) {
    const grid = document.getElementById('albumsGrid');
    const countEl = document.getElementById('albumCount');
    
    grid.innerHTML = '';
    countEl.textContent = albums.length;
    
    albums.forEach(album => {
        const card = createAlbumCard(album);
        grid.appendChild(card);
    });
}

// Create album card
function createAlbumCard(album) {
    const card = document.createElement('div');
    card.className = 'album-card';
    card.onclick = () => openAlbumModal(album.id);
    
    const statusBadge = album.isCompleted 
        ? '<span class="status-badge completed">Completed</span>'
        : '<span class="status-badge in-progress">In Progress</span>';
    
    const score = album.isCompleted && album.averageScore
        ? `<div class="album-card-score ${getScoreClass(album.averageScore)}">${album.averageScore.toFixed(2)}</div>`
        : '<div class="album-card-score no-score">-</div>';
    
    card.innerHTML = `
        <div class="album-card-cover">
            ${album.coverImage 
                ? `<img src="${album.coverImage}" alt="${album.title}">` 
                : `<div class="album-placeholder">🎵</div>`
            }
            ${statusBadge}
        </div>
        <div class="album-card-info">
            <h3 class="album-card-title">${album.title}</h3>
            <p class="album-card-artist">${album.artist}</p>
            <div class="album-card-meta">
                <span>🎵 ${album.trackCount || album.tracks?.length || 0} tracks</span>
                <span>👥 ${album.participants?.length || 0} ratings</span>
            </div>
        </div>
        ${score}
    `;
    
    return card;
}

// Open album details modal
async function openAlbumModal(albumId) {
    currentAlbumId = albumId;
    
    try {
        const doc = await db.collection('albums').doc(albumId).get();
        if (!doc.exists) {
            showNotification('Album not found', 'error');
            return;
        }
        
        const album = doc.data();
        
        // Set header info
        document.getElementById('modalAlbumTitle').textContent = album.title;
        document.getElementById('modalArtist').textContent = album.artist;
        document.getElementById('modalScore').textContent = album.averageScore ? album.averageScore.toFixed(2) : 'N/A';
        document.getElementById('modalScore').className = 'score-value ' + getScoreClass(album.averageScore || 0);
        document.getElementById('modalDate').textContent = formatDate(album.createdAt);
        document.getElementById('modalTrackCount').textContent = album.trackCount || album.tracks?.length || 0;
        
        // Load participant names
        const participantNames = await getParticipantNames(album.participants || []);
        document.getElementById('modalParticipants').textContent = participantNames.join(', ');
        
        // Set cover
        if (album.coverImage) {
            document.getElementById('modalAlbumCover').innerHTML = `<img src="${album.coverImage}" alt="${album.title}">`;
        } else {
            document.getElementById('modalAlbumCover').innerHTML = '<div class="album-placeholder-large">🎵</div>';
        }
        
        // Display tracks
        displayModalTracks(album);
        
        // Display rating matrix
        displayModalMatrix(album, participantNames);
        
        document.getElementById('albumModal').style.display = 'flex';
    } catch (error) {
        console.error('Error loading album details:', error);
        showNotification('Error loading album details', 'error');
    }
}

// Get participant names
async function getParticipantNames(participantIds) {
    const names = [];
    for (const id of participantIds) {
        try {
            const doc = await db.collection('participants').doc(id).get();
            if (doc.exists) {
                names.push(doc.data().username);
            }
        } catch (error) {
            console.error('Error loading participant:', error);
        }
    }
    return names;
}

// Display tracks in modal
function displayModalTracks(album) {
    const tracksList = document.getElementById('modalTracksList');
    tracksList.innerHTML = '';
    
    if (!album.tracks || album.tracks.length === 0) {
        tracksList.innerHTML = '<p>No tracks found</p>';
        return;
    }
    
    album.tracks.forEach(track => {
        const ratings = album.ratings?.[track.number] || {};
        const ratingValues = Object.values(ratings).filter(r => r !== null && r !== undefined);
        const avg = ratingValues.length > 0 
            ? (ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length).toFixed(2)
            : 'N/A';
        
        const trackItem = document.createElement('div');
        trackItem.className = 'modal-track-item';
        trackItem.innerHTML = `
            <div class="modal-track-info">
                <strong>${track.number}. ${track.title}</strong>
                ${track.isInterlude ? '<span class="interlude-badge">Interlude</span>' : ''}
            </div>
            <div class="modal-track-score ${getScoreClass(parseFloat(avg))}">${avg}</div>
        `;
        tracksList.appendChild(trackItem);
    });
}

// Display rating matrix in modal
function displayModalMatrix(album, participantNames) {
    const matrixDiv = document.getElementById('modalRatingMatrix');
    matrixDiv.innerHTML = '';
    
    if (!album.tracks || !album.ratings) {
        matrixDiv.innerHTML = '<p>No ratings available</p>';
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'results-table';
    
    // Header
    let headerHTML = '<thead><tr><th>Track</th>';
    participantNames.forEach(name => {
        headerHTML += `<th>${name}</th>`;
    });
    headerHTML += '<th>Average</th></tr></thead>';
    table.innerHTML = headerHTML;
    
    // Body
    let bodyHTML = '<tbody>';
    album.tracks.forEach(track => {
        bodyHTML += `<tr><td><strong>${track.number}.</strong> ${track.title}</td>`;
        
        const ratings = album.ratings?.[track.number] || {};
        album.participants.forEach(pId => {
            const rating = ratings[pId];
            bodyHTML += `<td>${rating !== null && rating !== undefined ? formatScore(rating) : '-'}</td>`;
        });
        
        const ratingValues = Object.values(ratings).filter(r => r !== null && r !== undefined);
        const avg = ratingValues.length > 0 
            ? (ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length).toFixed(2)
            : '-';
        bodyHTML += `<td class="${getScoreClass(parseFloat(avg))}"><strong>${avg}</strong></td>`;
        bodyHTML += '</tr>';
    });
    bodyHTML += '</tbody>';
    table.innerHTML += bodyHTML;
    
    matrixDiv.appendChild(table);
}

// Close album modal
function closeAlbumModal() {
    document.getElementById('albumModal').style.display = 'none';
    currentAlbumId = null;
}

// Open delete confirmation
function openDeleteConfirmModal() {
    if (!currentAlbumId) return;
    
    const album = allAlbums.find(a => a.id === currentAlbumId);
    if (album) {
        document.getElementById('deleteAlbumName').textContent = album.title;
        document.getElementById('deleteConfirmModal').style.display = 'flex';
    }
}

// Close delete confirmation
function closeDeleteConfirmModal() {
    document.getElementById('deleteConfirmModal').style.display = 'none';
}

// Confirm delete album
async function confirmDeleteAlbum() {
    if (!currentAlbumId) return;
    
    try {
        await db.collection('albums').doc(currentAlbumId).delete();
        
        showNotification('✅ Album deleted successfully', 'success');
        closeDeleteConfirmModal();
        closeAlbumModal();
        
        // Reload albums
        loadAlbums();
    } catch (error) {
        console.error('❌ Error deleting album:', error);
        showNotification('Error deleting album', 'error');
    }
}

// Open edit album modal
async function openEditAlbumModal() {
    if (!currentAlbumId) return;
    
    try {
        const doc = await db.collection('albums').doc(currentAlbumId).get();
        if (!doc.exists) {
            showNotification('Album not found', 'error');
            return;
        }
        
        const album = doc.data();
        
        // Populate form fields
        document.getElementById('editAlbumId').value = currentAlbumId;
        document.getElementById('editAlbumTitle').value = album.title;
        document.getElementById('editArtistName').value = album.artist;
        
        // Set date (convert Firestore timestamp to date input format)
        if (album.createdAt) {
            const date = album.createdAt.toDate();
            const dateString = date.toISOString().split('T')[0];
            document.getElementById('editCreatedDate').value = dateString;
        }
        
        // Show current cover if exists
        if (album.coverImage) {
            document.getElementById('editCoverPreviewImg').src = album.coverImage;
            document.getElementById('editCoverPreview').style.display = 'block';
        }
        
        // Generate track inputs
        const tracksList = document.getElementById('editTracksList');
        tracksList.innerHTML = '';
        album.tracks.forEach((track, index) => {
            const trackInput = document.createElement('div');
            trackInput.className = 'edit-track-item';
            trackInput.innerHTML = `
                <label>${track.number}.</label>
                <input type="text" class="edit-track-title" data-track="${track.number}" value="${track.title}" required>
                <label class="interlude-label">
                    <input type="checkbox" class="edit-track-interlude" data-track="${track.number}" ${track.isInterlude ? 'checked' : ''}>
                    Interlude
                </label>
            `;
            tracksList.appendChild(trackInput);
        });
        
        // Generate ratings matrix
        await generateEditRatingsMatrix(album);
        
        // Close view modal and open edit modal
        closeAlbumModal();
        document.getElementById('editAlbumModal').style.display = 'flex';
        
    } catch (error) {
        console.error('Error loading album for editing:', error);
        showNotification('Error loading album', 'error');
    }
}

// Generate editable ratings matrix
async function generateEditRatingsMatrix(album) {
    const container = document.getElementById('editRatingsMatrix');
    container.innerHTML = '';
    
    // Get participant names
    const participantNames = await getParticipantNames(album.participants || []);
    
    // Create header
    const header = document.createElement('div');
    header.className = 'edit-rating-header';
    header.innerHTML = '<div class="edit-rating-cell"><strong>Track</strong></div>';
    participantNames.forEach(name => {
        header.innerHTML += `<div class="edit-rating-cell"><strong>${name}</strong></div>`;
    });
    container.appendChild(header);
    
    // Create rows for each track
    album.tracks.forEach(track => {
        const row = document.createElement('div');
        row.className = 'edit-rating-row';
        row.innerHTML = `<div class="edit-rating-cell">${track.number}. ${track.title}</div>`;
        
        album.participants.forEach(pId => {
            const rating = album.ratings?.[track.number]?.[pId];
            row.innerHTML += `
                <div class="edit-rating-cell">
                    <select class="edit-rating-select" data-track="${track.number}" data-participant="${pId}">
                        <option value="">-</option>
                        ${generateRatingOptions(rating)}
                    </select>
                </div>
            `;
        });
        
        container.appendChild(row);
    });
}

// Generate rating options for edit form
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

// Handle edit cover preview
function handleEditCoverPreview(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            document.getElementById('editCoverPreviewImg').src = event.target.result;
            document.getElementById('editCoverPreview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

// Close edit modal
function closeEditAlbumModal() {
    document.getElementById('editAlbumModal').style.display = 'none';
    document.getElementById('editAlbumForm').reset();
    document.getElementById('editCoverPreview').style.display = 'none';
}

// Save album edits
async function saveAlbumEdits(e) {
    e.preventDefault();
    
    const albumId = document.getElementById('editAlbumId').value;
    if (!albumId) return;
    
    try {
        // Collect updated data
        const title = document.getElementById('editAlbumTitle').value.trim();
        const artist = document.getElementById('editArtistName').value.trim();
        const dateValue = document.getElementById('editCreatedDate').value;
        
        // Convert date string to Firestore timestamp
        const date = new Date(dateValue);
        const timestamp = firebase.firestore.Timestamp.fromDate(date);
        
        // Collect updated tracks
        const tracks = [];
        document.querySelectorAll('.edit-track-title').forEach(input => {
            const trackNum = parseInt(input.dataset.track);
            const title = input.value.trim();
            const isInterlude = document.querySelector(`.edit-track-interlude[data-track="${trackNum}"]`).checked;
            tracks.push({
                number: trackNum,
                title: title,
                isInterlude: isInterlude
            });
        });
        
        // Collect updated ratings
        const ratings = {};
        document.querySelectorAll('.edit-rating-select').forEach(select => {
            const trackNum = parseInt(select.dataset.track);
            const participantId = select.dataset.participant;
            const value = select.value === '' ? null : parseFloat(select.value);
            
            if (!ratings[trackNum]) {
                ratings[trackNum] = {};
            }
            ratings[trackNum][participantId] = value;
        });
        
        // Recalculate album average
        const nonInterludeTracks = tracks.filter(t => !t.isInterlude);
        let albumTotal = 0;
        let albumCount = 0;
        
        nonInterludeTracks.forEach(track => {
            const trackRatings = Object.values(ratings[track.number] || {}).filter(r => r !== null);
            if (trackRatings.length > 0) {
                const trackAvg = trackRatings.reduce((a, b) => a + b, 0) / trackRatings.length;
                albumTotal += trackAvg;
                albumCount++;
            }
        });
        
        const albumAverage = albumCount > 0 ? parseFloat((albumTotal / albumCount).toFixed(2)) : 0;
        
        // Prepare update object
        const updateData = {
            title: title,
            artist: artist,
            tracks: tracks,
            ratings: ratings,
            averageScore: albumAverage,
            createdAt: timestamp
        };
        
        // Handle new cover image if uploaded
        const newCoverFile = document.getElementById('editAlbumCover').files[0];
        if (newCoverFile) {
            const coverPath = `albums/${Date.now()}_${newCoverFile.name}`;
            const coverURL = await uploadImage(newCoverFile, coverPath);
            updateData.coverImage = coverURL;
        }
        
        // Update in Firestore
        await db.collection('albums').doc(albumId).update(updateData);
        
        showNotification('✅ Album updated successfully!', 'success');
        closeEditAlbumModal();
        
        // Reload albums
        loadAlbums();
        
    } catch (error) {
        console.error('❌ Error updating album:', error);
        showNotification('Error updating album', 'error');
    }
}