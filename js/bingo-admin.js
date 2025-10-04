// Bingo Admin Panel JavaScript

let currentDeleteTarget = null;
let allTiles = [];

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎲 Bingo Admin loaded');
    
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            switchTab(tab);
        });
    });
    
    // Add buttons
    document.getElementById('addTileBtn').addEventListener('click', () => openTileModal());
    document.getElementById('addContainerBtn').addEventListener('click', () => openContainerModal());
    
    // Form submissions
    document.getElementById('tileForm').addEventListener('submit', saveTile);
    document.getElementById('containerForm').addEventListener('submit', saveContainer);
    
    // Cancel buttons
    document.getElementById('cancelTileBtn').addEventListener('click', closeTileModal);
    document.getElementById('cancelContainerBtn').addEventListener('click', closeContainerModal);
    document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);
    document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);
    
    // Load initial data
    loadTiles();
    loadContainers();
});

// Tab Switching
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`${tab}Tab`).classList.add('active');
}

// ============= TILES =============

async function loadTiles() {
    try {
        const snapshot = await db.collection('bingo-tiles').orderBy('category').orderBy('text').get();
        allTiles = [];
        
        const grid = document.getElementById('tilesGrid');
        grid.innerHTML = '';
        
        if (snapshot.empty) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-state-icon">🎲</div>
                    <h3>No Bingo Tiles Yet</h3>
                    <p>Create your first bingo tile to get started!</p>
                </div>
            `;
            return;
        }
        
        snapshot.forEach(doc => {
            const tile = { id: doc.id, ...doc.data() };
            allTiles.push(tile);
            grid.appendChild(createTileCard(tile));
        });
        
        console.log(`✅ Loaded ${allTiles.length} tiles`);
    } catch (error) {
        console.error('Error loading tiles:', error);
        showNotification('Error loading tiles', 'error');
    }
}

function createTileCard(tile) {
    const card = document.createElement('div');
    card.className = 'tile-card';
    
    card.innerHTML = `
        ${tile.emoji ? `<div class="tile-emoji">${tile.emoji}</div>` : ''}
        <div class="tile-text">${tile.text}</div>
        <div class="tile-category" data-category="${tile.category}">${tile.category}</div>
        <div class="tile-actions">
            <button class="btn btn-secondary btn-edit" data-id="${tile.id}">Edit</button>
            <button class="btn btn-danger btn-delete" data-id="${tile.id}">Delete</button>
        </div>
    `;
    
    card.querySelector('.btn-edit').addEventListener('click', () => editTile(tile.id));
    card.querySelector('.btn-delete').addEventListener('click', () => deleteTile(tile.id));
    
    return card;
}

function openTileModal(tile = null) {
    document.getElementById('tileModal').style.display = 'flex';
    document.getElementById('tileModalTitle').textContent = tile ? 'Edit Bingo Tile' : 'Add Bingo Tile';
    
    if (tile) {
        document.getElementById('tileId').value = tile.id;
        document.getElementById('tileText').value = tile.text;
        document.getElementById('tileEmoji').value = tile.emoji || '';
        document.getElementById('tileCategory').value = tile.category;
    } else {
        document.getElementById('tileForm').reset();
        document.getElementById('tileId').value = '';
    }
}

function closeTileModal() {
    document.getElementById('tileModal').style.display = 'none';
    document.getElementById('tileForm').reset();
}

async function saveTile(e) {
    e.preventDefault();
    
    const tileId = document.getElementById('tileId').value;
    const data = {
        text: document.getElementById('tileText').value.trim(),
        emoji: document.getElementById('tileEmoji').value.trim(),
        category: document.getElementById('tileCategory').value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        if (tileId) {
            // Update existing
            await db.collection('bingo-tiles').doc(tileId).update(data);
            showNotification('✅ Tile updated!', 'success');
        } else {
            // Create new
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('bingo-tiles').add(data);
            showNotification('✅ Tile created!', 'success');
        }
        
        closeTileModal();
        loadTiles();
    } catch (error) {
        console.error('Error saving tile:', error);
        showNotification('Error saving tile', 'error');
    }
}

function editTile(tileId) {
    const tile = allTiles.find(t => t.id === tileId);
    if (tile) {
        openTileModal(tile);
    }
}

function deleteTile(tileId) {
    currentDeleteTarget = { type: 'tile', id: tileId };
    document.getElementById('deleteMessage').textContent = 'Are you sure you want to delete this bingo tile?';
    document.getElementById('deleteModal').style.display = 'flex';
}

// ============= CONTAINERS =============

async function loadContainers() {
    try {
        const snapshot = await db.collection('bingo-containers').orderBy('name').get();
        
        const grid = document.getElementById('containersGrid');
        grid.innerHTML = '';
        
        if (snapshot.empty) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-state-icon">📦</div>
                    <h3>No Bingo Containers Yet</h3>
                    <p>Create a container to group bingo tiles together!</p>
                </div>
            `;
            return;
        }
        
        snapshot.forEach(doc => {
            const container = { id: doc.id, ...doc.data() };
            grid.appendChild(createContainerCard(container));
        });
        
        console.log(`✅ Loaded ${snapshot.size} containers`);
    } catch (error) {
        console.error('Error loading containers:', error);
        showNotification('Error loading containers', 'error');
    }
}

function createContainerCard(container) {
    const card = document.createElement('div');
    card.className = 'container-card';
    
    card.innerHTML = `
        <div class="container-header">
            <div>
                <div class="container-title">${container.name}</div>
                ${container.description ? `<div class="container-description">${container.description}</div>` : ''}
            </div>
        </div>
        
        <div class="container-stats">
            <div class="stat-item">
                <span class="stat-icon">🎲</span>
                <span class="stat-value">${container.tileIds.length}</span>
                <span>tiles</span>
            </div>
        </div>
        
        <div class="container-actions">
            <button class="btn btn-secondary btn-edit" data-id="${container.id}">Edit</button>
            <button class="btn btn-danger btn-delete" data-id="${container.id}">Delete</button>
        </div>
    `;
    
    card.querySelector('.btn-edit').addEventListener('click', () => editContainer(container.id));
    card.querySelector('.btn-delete').addEventListener('click', () => deleteContainer(container.id));
    
    return card;
}

async function openContainerModal(container = null) {
    // Load all available tiles first
    if (allTiles.length === 0) {
        await loadTiles();
    }
    
    document.getElementById('containerModal').style.display = 'flex';
    document.getElementById('containerModalTitle').textContent = container ? 'Edit Bingo Container' : 'Create Bingo Container';
    
    // Populate tile selection grid
    const grid = document.getElementById('tileSelectionGrid');
    grid.innerHTML = '';
    
    const selectedTileIds = container ? container.tileIds : [];
    
    allTiles.forEach(tile => {
        const isSelected = selectedTileIds.includes(tile.id);
        
        const item = document.createElement('div');
        item.className = `tile-checkbox-item ${isSelected ? 'selected' : ''}`;
        
        item.innerHTML = `
            <input type="checkbox" id="tile_${tile.id}" value="${tile.id}" ${isSelected ? 'checked' : ''}>
            <label for="tile_${tile.id}" class="tile-checkbox-label">
                ${tile.emoji ? `<span class="tile-checkbox-emoji">${tile.emoji}</span>` : ''}
                <div class="tile-checkbox-text">${tile.text}</div>
            </label>
        `;
        
        const checkbox = item.querySelector('input');
        checkbox.addEventListener('change', function() {
            item.classList.toggle('selected', this.checked);
            updateSelectedCount();
        });
        
        grid.appendChild(item);
    });
    
    if (container) {
        document.getElementById('containerId').value = container.id;
        document.getElementById('containerName').value = container.name;
        document.getElementById('containerDescription').value = container.description || '';
    } else {
        document.getElementById('containerForm').reset();
        document.getElementById('containerId').value = '';
    }
    
    updateSelectedCount();
}

function closeContainerModal() {
    document.getElementById('containerModal').style.display = 'none';
    document.getElementById('containerForm').reset();
}

function updateSelectedCount() {
    const checkboxes = document.querySelectorAll('#tileSelectionGrid input[type="checkbox"]');
    const selectedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    document.getElementById('selectedCount').textContent = selectedCount;
}

async function saveContainer(e) {
    e.preventDefault();
    
    const containerId = document.getElementById('containerId').value;
    
    // Get selected tile IDs
    const checkboxes = document.querySelectorAll('#tileSelectionGrid input[type="checkbox"]:checked');
    const tileIds = Array.from(checkboxes).map(cb => cb.value);
    
    if (tileIds.length < 16) {
        showNotification('Please select at least 16 tiles for a 4x4 board', 'error');
        return;
    }
    
    const data = {
        name: document.getElementById('containerName').value.trim(),
        description: document.getElementById('containerDescription').value.trim(),
        tileIds: tileIds,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        if (containerId) {
            // Update existing
            await db.collection('bingo-containers').doc(containerId).update(data);
            showNotification('✅ Container updated!', 'success');
        } else {
            // Create new
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('bingo-containers').add(data);
            showNotification('✅ Container created!', 'success');
        }
        
        closeContainerModal();
        loadContainers();
    } catch (error) {
        console.error('Error saving container:', error);
        showNotification('Error saving container', 'error');
    }
}

async function editContainer(containerId) {
    try {
        const doc = await db.collection('bingo-containers').doc(containerId).get();
        if (doc.exists) {
            const container = { id: doc.id, ...doc.data() };
            openContainerModal(container);
        }
    } catch (error) {
        console.error('Error loading container:', error);
    }
}

function deleteContainer(containerId) {
    currentDeleteTarget = { type: 'container', id: containerId };
    document.getElementById('deleteMessage').textContent = 'Are you sure you want to delete this bingo container?';
    document.getElementById('deleteModal').style.display = 'flex';
}

// ============= DELETE CONFIRMATION =============

function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
    currentDeleteTarget = null;
}

async function confirmDelete() {
    if (!currentDeleteTarget) return;
    
    try {
        if (currentDeleteTarget.type === 'tile') {
            await db.collection('bingo-tiles').doc(currentDeleteTarget.id).delete();
            showNotification('✅ Tile deleted', 'success');
            loadTiles();
        } else if (currentDeleteTarget.type === 'container') {
            await db.collection('bingo-containers').doc(currentDeleteTarget.id).delete();
            showNotification('✅ Container deleted', 'success');
            loadContainers();
        }
        
        closeDeleteModal();
    } catch (error) {
        console.error('Error deleting:', error);
        showNotification('Error deleting item', 'error');
    }
}