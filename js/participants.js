// Participants Management JavaScript

let currentEditId = null;
let currentDeleteId = null;

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('👥 Participants page loaded');
    
    // Load all participants
    loadParticipants();
    
    // Set up form submission
    document.getElementById('addParticipantForm').addEventListener('submit', handleAddParticipant);
    
    // Set up image preview
    document.getElementById('profilePicture').addEventListener('change', handleImagePreview);
    document.getElementById('removeImage').addEventListener('click', removeImagePreview);
    
    // Set up edit modal
    document.getElementById('closeModal').addEventListener('click', closeEditModal);
    document.getElementById('cancelEdit').addEventListener('click', closeEditModal);
    document.getElementById('editParticipantForm').addEventListener('submit', handleEditParticipant);
    document.getElementById('editProfilePicture').addEventListener('change', handleEditImagePreview);
    
    // Set up delete modal
    document.getElementById('closeDeleteModal').addEventListener('click', closeDeleteModal);
    document.getElementById('cancelDelete').addEventListener('click', closeDeleteModal);
    document.getElementById('confirmDelete').addEventListener('click', handleDeleteParticipant);

    document.getElementById('closeLPCModal').addEventListener('click', closeLPCAdjustModal);
    document.getElementById('cancelLPCAdjust').addEventListener('click', closeLPCAdjustModal);
    document.getElementById('lpcAdjustForm').addEventListener('submit', handleLPCAdjust);
});

// Load all participants from Firestore
async function loadParticipants() {
    try {
        const snapshot = await db.collection('participants').orderBy('createdAt', 'desc').get();
        const participantsGrid = document.getElementById('participantsList');
        const emptyState = document.getElementById('emptyState');
        const countBadge = document.getElementById('participantCount');
        
        participantsGrid.innerHTML = '';
        
        if (snapshot.empty) {
            emptyState.style.display = 'block';
            countBadge.textContent = '0';
            return;
        }
        
        emptyState.style.display = 'none';
        countBadge.textContent = snapshot.size;
        
        snapshot.forEach(doc => {
            const participant = doc.data();
            const card = createParticipantCard(doc.id, participant);
            participantsGrid.appendChild(card);
        });
        
        console.log(`✅ Loaded ${snapshot.size} participants`);
    } catch (error) {
        console.error('❌ Error loading participants:', error);
        showNotification('Error loading participants', 'error');
    }
}

// Create participant card element
function createParticipantCard(id, data) {
    const card = document.createElement('div');
    card.className = 'participant-card';
    card.innerHTML = `
        <div class="participant-avatar">
            ${data.profilePicture 
                ? `<img src="${data.profilePicture}" alt="${data.username}">`
                : `<div class="avatar-placeholder">${data.username.charAt(0).toUpperCase()}</div>`
            }
        </div>
        <div class="participant-info">
            <h3>${data.username}</h3>
            <p class="participant-meta">
                <span class="lpc-badge">💎 ${data.lpc || 0} LPC</span>
                <span>Joined: ${data.createdAt ? formatDate(data.createdAt) : 'Unknown'}</span>
            </p>
        </div>
        <div class="participant-actions">
            <button class="btn btn-secondary btn-sm" onclick="openLPCAdjustModal('${id}', '${data.username}', ${data.lpc || 0})">⚖️ Adjust LPC</button>
            <button class="btn btn-secondary btn-sm" onclick="openEditModal('${id}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="openDeleteModal('${id}', '${data.username}')">Delete</button>
        </div>
    `;
    return card;
}

// Handle add participant form submission
async function handleAddParticipant(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const btnLoader = document.getElementById('btnLoader');
    
    // Disable form during submission
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline';
    
    try {
        const username = document.getElementById('username').value.trim();
        const profilePictureFile = document.getElementById('profilePicture').files[0];
        
        let profilePictureURL = '';
        
        // Upload image if provided
        if (profilePictureFile) {
            const imagePath = `participants/${Date.now()}_${profilePictureFile.name}`;
            profilePictureURL = await uploadImage(profilePictureFile, imagePath);
        }
        
        // Add to Firestore
        await db.collection('participants').add({
            username: username,
            profilePicture: profilePictureURL,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showNotification('✅ Participant added successfully!', 'success');
        
        // Reset form
        document.getElementById('addParticipantForm').reset();
        removeImagePreview();
        
        // Reload participants
        loadParticipants();
        
    } catch (error) {
        console.error('❌ Error adding participant:', error);
        showNotification('Error adding participant', 'error');
    } finally {
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
    }
}

// Handle image preview
function handleImagePreview(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            document.getElementById('previewImg').src = event.target.result;
            document.getElementById('imagePreview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

// Remove image preview
function removeImagePreview() {
    document.getElementById('profilePicture').value = '';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('previewImg').src = '';
}

// Handle edit image preview
function handleEditImagePreview(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            document.getElementById('editPreviewImg').src = event.target.result;
            document.getElementById('editImagePreview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

// Open edit modal
async function openEditModal(participantId) {
    currentEditId = participantId;
    
    try {
        const doc = await db.collection('participants').doc(participantId).get();
        const data = doc.data();
        
        document.getElementById('editParticipantId').value = participantId;
        document.getElementById('editUsername').value = data.username;
        
        if (data.profilePicture) {
            document.getElementById('editPreviewImg').src = data.profilePicture;
            document.getElementById('editImagePreview').style.display = 'block';
        }
        
        document.getElementById('editModal').style.display = 'flex';
    } catch (error) {
        console.error('Error loading participant:', error);
        showNotification('Error loading participant data', 'error');
    }
}

// Close edit modal
function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    document.getElementById('editParticipantForm').reset();
    document.getElementById('editImagePreview').style.display = 'none';
    currentEditId = null;
}

// Handle edit participant
async function handleEditParticipant(e) {
    e.preventDefault();
    
    if (!currentEditId) return;
    
    try {
        const username = document.getElementById('editUsername').value.trim();
        const newImageFile = document.getElementById('editProfilePicture').files[0];
        
        const updateData = {
            username: username
        };
        
        // Upload new image if provided
        if (newImageFile) {
            const imagePath = `participants/${Date.now()}_${newImageFile.name}`;
            const newImageURL = await uploadImage(newImageFile, imagePath);
            updateData.profilePicture = newImageURL;
        }
        
        // Update in Firestore
        await db.collection('participants').doc(currentEditId).update(updateData);
        
        showNotification('✅ Participant updated successfully!', 'success');
        closeEditModal();
        loadParticipants();
        
    } catch (error) {
        console.error('❌ Error updating participant:', error);
        showNotification('Error updating participant', 'error');
    }
}

// Open delete modal
function openDeleteModal(participantId, username) {
    currentDeleteId = participantId;
    document.getElementById('deleteParticipantName').textContent = username;
    document.getElementById('deleteModal').style.display = 'flex';
}

// Close delete modal
function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
    currentDeleteId = null;
}

// Handle delete participant
async function handleDeleteParticipant() {
    if (!currentDeleteId) return;
    
    try {
        await db.collection('participants').doc(currentDeleteId).delete();
        
        showNotification('✅ Participant deleted successfully', 'success');
        closeDeleteModal();
        loadParticipants();
        
    } catch (error) {
        console.error('❌ Error deleting participant:', error);
        showNotification('Error deleting participant', 'error');
    }
}

// Make functions available globally
window.openEditModal = openEditModal;
window.openDeleteModal = openDeleteModal;

// LPC Adjustment Modal
let currentLPCParticipantId = null;

function openLPCAdjustModal(participantId, username, currentLPC) {
    currentLPCParticipantId = participantId;
    document.getElementById('lpcParticipantId').value = participantId;
    document.getElementById('lpcParticipantName').textContent = username;
    document.getElementById('lpcCurrentBalance').textContent = currentLPC;
    document.getElementById('lpcAdjustModal').style.display = 'flex';
}

function closeLPCAdjustModal() {
    document.getElementById('lpcAdjustModal').style.display = 'none';
    document.getElementById('lpcAdjustForm').reset();
    currentLPCParticipantId = null;
}

async function handleLPCAdjust(e) {
    e.preventDefault();
    
    if (!currentLPCParticipantId) return;
    
    try {
        const type = document.getElementById('lpcAdjustType').value;
        const amount = parseInt(document.getElementById('lpcAdjustAmount').value);
        const reason = document.getElementById('lpcAdjustReason').value.trim();
        
        // Get current LPC
        const participantDoc = await db.collection('participants').doc(currentLPCParticipantId).get();
        const currentLPC = participantDoc.data().lpc || 0;
        
        // Calculate new LPC
        let newLPC;
        if (type === 'add') {
            newLPC = currentLPC + amount;
        } else {
            newLPC = Math.max(0, currentLPC - amount);
        }
        
        // Update in Firestore
        await db.collection('participants').doc(currentLPCParticipantId).update({
            lpc: newLPC
        });
        
        // Log the adjustment (optional - for audit trail)
        console.log(`LPC Adjustment: ${type} ${amount} LPC. Reason: ${reason || 'No reason provided'}`);
        
        const action = type === 'add' ? 'added to' : 'deducted from';
        showNotification(`✅ ${amount} LPC ${action} participant!`, 'success');
        
        closeLPCAdjustModal();
        loadParticipants();
        
    } catch (error) {
        console.error('❌ Error adjusting LPC:', error);
        showNotification('Error adjusting LPC', 'error');
    }
}

// Make function available globally
window.openLPCAdjustModal = openLPCAdjustModal;