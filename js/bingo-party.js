// Bingo System for Party Mode
// bingo-party.js

const BINGO_LPC_REWARD = 10; // LPC reward for completing a bingo

/**
 * Load available bingo containers and add selection to setup form
 */
async function loadBingoContainersForSetup() {
    try {
        const snapshot = await db.collection('bingo-containers').orderBy('name').get();
        
        if (snapshot.empty) {
            console.log('No bingo containers available');
            return;
        }
        
        // Create bingo selection section
        const form = document.getElementById('partySetupForm');
        const bingoSection = document.createElement('div');
        bingoSection.className = 'bingo-selection-section';
        bingoSection.innerHTML = `
            <h3>🎲 Bingo Game (Optional)</h3>
            <p style="color: var(--text-secondary); margin-bottom: 10px;">
                Add a fun bingo game during rating! Participants can mark tiles and win LPC.
            </p>
            <div class="bingo-container-select" id="bingoContainerSelect">
                <div class="bingo-container-option">
                    <input type="radio" name="bingoContainer" value="" id="bingo_none" checked>
                    <label for="bingo_none">
                        <div class="bingo-container-name">No Bingo</div>
                        <div class="bingo-container-tiles-count">Skip bingo game</div>
                    </label>
                </div>
            </div>
        `;
        
        // Insert before submit button
        const submitBtn = form.querySelector('button[type="submit"]');
        form.insertBefore(bingoSection, submitBtn);
        
        // Add container options
        const select = document.getElementById('bingoContainerSelect');
        
        snapshot.forEach(doc => {
            const container = doc.data();
            const option = document.createElement('div');
            option.className = 'bingo-container-option';
            option.innerHTML = `
                <input type="radio" name="bingoContainer" value="${doc.id}" id="bingo_${doc.id}">
                <label for="bingo_${doc.id}">
                    <div class="bingo-container-name">${container.name}</div>
                    <div class="bingo-container-tiles-count">${container.tileIds.length} tiles available</div>
                </label>
            `;
            
            // Toggle selection styling
            const radio = option.querySelector('input');
            radio.addEventListener('change', function() {
                document.querySelectorAll('.bingo-container-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                if (this.checked) {
                    option.classList.add('selected');
                }
            });
            
            select.appendChild(option);
        });
        
        console.log('✅ Bingo containers loaded for setup');
    } catch (error) {
        console.error('Error loading bingo containers:', error);
    }
}

/**
 * Generate random bingo boards for all participants
 * Returns object with participantId as key and board data as value
 */
async function generateBingoBoards(containerId, participants) {
    if (!containerId) return null;
    
    try {
        // Get container and tiles
        const containerDoc = await db.collection('bingo-containers').doc(containerId).get();
        if (!containerDoc.exists) return null;
        
        const container = containerDoc.data();
        const tileIds = container.tileIds;
        
        // Get all tiles
        const tilesSnapshot = await Promise.all(
            tileIds.map(id => db.collection('bingo-tiles').doc(id).get())
        );
        
        const tiles = tilesSnapshot
            .filter(doc => doc.exists)
            .map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (tiles.length < 16) {
            console.error('Not enough tiles to generate bingo boards');
            return null;
        }
        
        // Generate board for each participant
        const boards = {};
        
        participants.forEach(participant => {
            // Shuffle tiles and take 16
            const shuffled = [...tiles].sort(() => Math.random() - 0.5);
            const selected = shuffled.slice(0, 16);
            
            // Store as FLAT array (Firestore doesn't support nested arrays)
            boards[participant.id] = {
                tiles: selected, // Flat array of 16 tiles
                marked: Array(16).fill(false), // Track which tiles are marked
                completedRows: [],
                completedCols: [],
                completedDiagonals: [],
                hasBingo: false,
                lpcAwarded: false
            };
        });
        
        console.log('✅ Generated bingo boards for', participants.length, 'participants');
        return boards;
    } catch (error) {
        console.error('Error generating bingo boards:', error);
        return null;
    }
}

/**
 * Toggle a tile mark for a participant
 */
function toggleBingoTile(participantId, tileIndex) {
    if (!partySession.bingoBoards || !partySession.bingoBoards[participantId]) return;
    
    const board = partySession.bingoBoards[participantId];
    board.marked[tileIndex] = !board.marked[tileIndex];
    
    // Check for bingo
    checkBingo(participantId);
    
    // Update Firestore
    updateBingoBoardInFirestore(participantId);
}

/**
 * Check if participant has achieved bingo (row, column, or diagonal)
 */
function checkBingo(participantId) {
    const board = partySession.bingoBoards[participantId];
    const marked = board.marked;
    
    let newBingo = false;
    
    // Check rows
    for (let row = 0; row < 4; row++) {
        const start = row * 4;
        const rowComplete = marked[start] && marked[start + 1] && marked[start + 2] && marked[start + 3];
        
        if (rowComplete && !board.completedRows.includes(row)) {
            board.completedRows.push(row);
            newBingo = true;
        }
    }
    
    // Check columns
    for (let col = 0; col < 4; col++) {
        const colComplete = marked[col] && marked[col + 4] && marked[col + 8] && marked[col + 12];
        
        if (colComplete && !board.completedCols.includes(col)) {
            board.completedCols.push(col);
            newBingo = true;
        }
    }
    
    // Check diagonals
    const diag1 = marked[0] && marked[5] && marked[10] && marked[15];
    const diag2 = marked[3] && marked[6] && marked[9] && marked[12];
    
    if (diag1 && !board.completedDiagonals.includes('main')) {
        board.completedDiagonals.push('main');
        newBingo = true;
    }
    
    if (diag2 && !board.completedDiagonals.includes('anti')) {
        board.completedDiagonals.push('anti');
        newBingo = true;
    }
    
    // Update bingo status
    const hadBingo = board.hasBingo;
    board.hasBingo = board.completedRows.length > 0 || 
                     board.completedCols.length > 0 || 
                     board.completedDiagonals.length > 0;
    
    // Show celebration if new bingo
    if (newBingo && !hadBingo) {
        showBingoCelebration();
        awardBingoLPC(participantId);
    }
    
    return board.hasBingo;
}

/**
 * Show bingo celebration animation
 */
function showBingoCelebration() {
    const celebration = document.createElement('div');
    celebration.className = 'bingo-celebration show';
    celebration.innerHTML = `
        <h2>🎉 BINGO! 🎉</h2>
        <p>+${BINGO_LPC_REWARD} LPC</p>
    `;
    
    document.body.appendChild(celebration);
    
    setTimeout(() => {
        celebration.classList.remove('show');
        setTimeout(() => celebration.remove(), 500);
    }, 3000);
}

/**
 * Award LPC for bingo completion
 */
async function awardBingoLPC(participantId) {
    const board = partySession.bingoBoards[participantId];
    
    // Only award once per participant
    if (board.lpcAwarded) return;
    
    // Find participant info
    const participant = partySession.participants.find(p => p.id === participantId);
    if (!participant || !participant.participantId) {
        console.log('Cannot award LPC - guest user');
        return;
    }
    
    try {
        // Award LPC
        await db.collection('participants').doc(participant.participantId).update({
            lpc: firebase.firestore.FieldValue.increment(BINGO_LPC_REWARD)
        });
        
        board.lpcAwarded = true;
        
        console.log(`✅ Awarded ${BINGO_LPC_REWARD} LPC to ${participant.name} for bingo!`);
        showNotification(`🎉 ${participant.name} earned ${BINGO_LPC_REWARD} LPC for BINGO!`, 'success');
    } catch (error) {
        console.error('Error awarding bingo LPC:', error);
    }
}

/**
 * Update bingo board in Firestore
 */
async function updateBingoBoardInFirestore(participantId) {
    try {
        const bingoData = {};
        bingoData[`bingoBoards.${participantId}`] = partySession.bingoBoards[participantId];
        
        await db.collection('party-sessions').doc(partySession.roomCode).update(bingoData);
    } catch (error) {
        console.error('Error updating bingo board:', error);
    }
}

/**
 * Render bingo UI for guest/participant
 */
function renderBingoUI(participantId) {
    const board = partySession.bingoBoards?.[participantId];
    if (!board) return;
    
    // Add bingo button if not exists
    if (!document.getElementById('bingoButton')) {
        const button = document.createElement('button');
        button.id = 'bingoButton';
        button.className = 'bingo-button';
        button.innerHTML = '🎲';
        button.addEventListener('click', () => openBingoModal(participantId));
        document.body.appendChild(button);
    }
    
    // Update button if participant has bingo
    const button = document.getElementById('bingoButton');
    if (board.hasBingo) {
        button.classList.add('has-bingo');
    }
}

/**
 * Open bingo modal to show and interact with board
 */
function openBingoModal(participantId) {
    const board = partySession.bingoBoards?.[participantId];
    if (!board) return;
    
    // Create modal if not exists
    let modal = document.getElementById('bingoModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'bingoModal';
        modal.className = 'bingo-modal';
        document.body.appendChild(modal);
    }
    
    // Build grid HTML (tiles is a flat array of 16)
    let gridHTML = '<div class="bingo-grid">';
    board.tiles.forEach((tile, index) => {
        const isMarked = board.marked[index];
        gridHTML += `
            <div class="bingo-tile ${isMarked ? 'marked' : ''}" data-index="${index}">
                ${tile.emoji ? `<div class="bingo-tile-emoji">${tile.emoji}</div>` : ''}
                <div class="bingo-tile-text">${tile.text}</div>
            </div>
        `;
    });
    gridHTML += '</div>';
    
    // Build progress HTML
    const totalBingos = board.completedRows.length + board.completedCols.length + board.completedDiagonals.length;
    const progressHTML = `
        <div class="bingo-progress">
            <div class="bingo-progress-item">
                <span class="bingo-progress-label">Rows</span>
                <span class="bingo-progress-status ${board.completedRows.length > 0 ? 'complete' : ''}">
                    ${board.completedRows.length}/4 ${board.completedRows.length > 0 ? '<span class="bingo-checkmark">✓</span>' : ''}
                </span>
            </div>
            <div class="bingo-progress-item">
                <span class="bingo-progress-label">Columns</span>
                <span class="bingo-progress-status ${board.completedCols.length > 0 ? 'complete' : ''}">
                    ${board.completedCols.length}/4 ${board.completedCols.length > 0 ? '<span class="bingo-checkmark">✓</span>' : ''}
                </span>
            </div>
            <div class="bingo-progress-item">
                <span class="bingo-progress-label">Diagonals</span>
                <span class="bingo-progress-status ${board.completedDiagonals.length > 0 ? 'complete' : ''}">
                    ${board.completedDiagonals.length}/2 ${board.completedDiagonals.length > 0 ? '<span class="bingo-checkmark">✓</span>' : ''}
                </span>
            </div>
            <div class="bingo-progress-item" style="border-top: 2px solid var(--border-color); padding-top: 15px; margin-top: 10px;">
                <span class="bingo-progress-label" style="font-size: 18px;">Total Bingos</span>
                <span class="bingo-progress-status ${totalBingos > 0 ? 'complete' : ''}" style="font-size: 24px;">
                    ${totalBingos}
                </span>
            </div>
        </div>
    `;
    
    modal.innerHTML = `
        <div class="bingo-modal-content">
            <div class="bingo-modal-header">
                <h2>🎲 Bingo Card</h2>
                <button class="close-bingo-btn">×</button>
            </div>
            ${gridHTML}
            ${progressHTML}
        </div>
    `;
    
    // Add event listeners
    modal.querySelector('.close-bingo-btn').addEventListener('click', closeBingoModal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) closeBingoModal();
    });
    
    // Add tile click handlers
    modal.querySelectorAll('.bingo-tile').forEach(tile => {
        tile.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            toggleBingoTile(participantId, index);
            openBingoModal(participantId); // Refresh
        });
    });
    
    modal.classList.add('show');
}

/**
 * Close bingo modal
 */
function closeBingoModal() {
    const modal = document.getElementById('bingoModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

/**
 * Render bingo results in results phase
 */
function renderBingoResults() {
    if (!partySession.bingoBoards) return;
    
    const resultsContainer = document.querySelector('#resultsPhase .results-container');
    if (!resultsContainer) return;
    
    // Create bingo results section
    const section = document.createElement('div');
    section.className = 'bingo-results-section';
    section.innerHTML = '<h3>🎲 Bingo Results</h3><div class="bingo-results-grid" id="bingoResultsGrid"></div>';
    
    resultsContainer.appendChild(section);
    
    const grid = document.getElementById('bingoResultsGrid');
    
    // Render each participant's board
    partySession.participants.forEach(participant => {
        const board = partySession.bingoBoards[participant.id];
        if (!board) return;
        
        const markedCount = board.marked.filter(m => m).length;
        const totalBingos = board.completedRows.length + board.completedCols.length + board.completedDiagonals.length;
        
        const card = document.createElement('div');
        card.className = 'bingo-result-card';
        
        // Mini grid (tiles is a flat array)
        let miniGridHTML = '<div class="bingo-result-mini-grid">';
        board.tiles.forEach((tile, index) => {
            miniGridHTML += `
                <div class="bingo-mini-tile ${board.marked[index] ? 'marked' : ''}">
                    ${tile.emoji || ''}
                </div>
            `;
        });
        miniGridHTML += '</div>';
        
        card.innerHTML = `
            <div class="bingo-result-header">
                <div class="bingo-result-avatar">
                    ${participant.name.charAt(0).toUpperCase()}
                </div>
                <div class="bingo-result-name">${participant.name}</div>
                ${totalBingos > 0 ? '<div class="bingo-winner-badge">🏆 Bingo!</div>' : ''}
            </div>
            ${miniGridHTML}
            <div class="bingo-result-stats">
                <div class="bingo-result-stat">
                    <div class="bingo-result-stat-value">${markedCount}</div>
                    <div class="bingo-result-stat-label">Marked</div>
                </div>
                <div class="bingo-result-stat">
                    <div class="bingo-result-stat-value">${totalBingos}</div>
                    <div class="bingo-result-stat-label">Bingos</div>
                </div>
                ${board.lpcAwarded ? `
                    <div class="bingo-result-stat">
                        <div class="bingo-result-stat-value">+${BINGO_LPC_REWARD}</div>
                        <div class="bingo-result-stat-label">LPC</div>
                    </div>
                ` : ''}
            </div>
        `;
        
        grid.appendChild(card);
    });
}