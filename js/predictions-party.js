// Predictions System for Party Mode

/**
 * Load predictions containers for party setup
 * This creates the predictions selection section dynamically (like bingo does)
 */
async function loadPredictionsContainersForSetup() {
    try {
        const snapshot = await db.collection('prediction-containers').orderBy('createdAt', 'desc').get();
        
        if (snapshot.empty) {
            console.log('No prediction containers available');
            return;
        }
        
        // Create predictions selection section
        const form = document.getElementById('partySetupForm');
        const predictionsSection = document.createElement('div');
        predictionsSection.className = 'predictions-selection-section';
        predictionsSection.id = 'predictionsSelectionSection';
        predictionsSection.innerHTML = `
            <h3>🎯 Predictions Mode (Optional)</h3>
            <p style="color: var(--text-secondary); margin-bottom: 10px;">
                Add predictions! Participants predict outcomes before rating begins.
            </p>
            <div class="predictions-container-select" id="predictionsContainerSelect">
                <div class="predictions-container-option">
                    <input type="radio" name="predictionsContainer" value="" id="noPredictions" checked>
                    <label for="noPredictions">
                        <div class="predictions-container-name">No Predictions</div>
                        <div class="predictions-container-count">Skip predictions</div>
                    </label>
                </div>
            </div>
        `;
        
        // Insert before submit button (after bingo section if it exists)
        const submitBtn = form.querySelector('button[type="submit"]');
        form.insertBefore(predictionsSection, submitBtn);
        
        // Add container options
        const select = document.getElementById('predictionsContainerSelect');
        
        snapshot.forEach(doc => {
            const container = { id: doc.id, ...doc.data() };
            const option = document.createElement('div');
            option.className = 'predictions-container-option';
            option.innerHTML = `
                <input type="radio" name="predictionsContainer" value="${container.id}" id="pred_${container.id}">
                <label for="pred_${container.id}">
                    <div class="predictions-container-name">${container.name}</div>
                    <div class="predictions-container-count">${container.questionIds.length} questions</div>
                </label>
            `;
            
            // Add selection styling
            const radio = option.querySelector('input');
            radio.addEventListener('change', function() {
                document.querySelectorAll('.predictions-container-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                if (this.checked) {
                    option.classList.add('selected');
                }
            });
            
            select.appendChild(option);
        });
        
        console.log('✅ Predictions containers loaded for setup');
    } catch (error) {
        console.error('Error loading predictions containers:', error);
    }
}

/**
 * Load prediction questions from a container
 */
async function loadPredictionQuestions(containerId) {
    if (!containerId) return [];
    
    try {
        const containerDoc = await db.collection('prediction-containers').doc(containerId).get();
        if (!containerDoc.exists) return [];
        
        const container = containerDoc.data();
        const questionIds = container.questionIds;
        
        const questionsSnapshot = await Promise.all(
            questionIds.map(id => db.collection('prediction-questions').doc(id).get())
        );
        
        const questions = questionsSnapshot
            .filter(doc => doc.exists)
            .map(doc => ({ id: doc.id, ...doc.data() }));
        
        return questions;
    } catch (error) {
        console.error('Error loading prediction questions:', error);
        return [];
    }
}

/**
 * GUEST: Show predictions submission form
 */
async function showPredictionsSubmission(sessionData) {
    const questions = await loadPredictionQuestions(sessionData.predictionsContainerId);
    
    if (questions.length === 0) {
        console.error('No questions found for predictions');
        return;
    }
    
    // Hide all other phases
    document.getElementById('joinPhase').style.display = 'none';
    document.getElementById('profilePhase').style.display = 'none';
    document.getElementById('guestNamePhase').style.display = 'none';
    document.getElementById('waitingRoom').classList.remove('active');

    
    document.getElementById('ratingPhase').classList.remove('active');
    
    // Find or create predictions container INSIDE join-container
    let predictionsContainer = document.getElementById('predictionsContainer');
    if (!predictionsContainer) {
        predictionsContainer = document.createElement('div');
        predictionsContainer.id = 'predictionsContainer';
        predictionsContainer.className = 'predictions-container';
        
        // Insert into join-container (same parent as other phases)
        const joinContainer = document.querySelector('.join-container');
        if (joinContainer) {
            joinContainer.appendChild(predictionsContainer);
        } else {
            // Fallback if join-container doesn't exist
            document.body.appendChild(predictionsContainer);
        }
    }
    
    predictionsContainer.style.display = 'block';
    predictionsContainer.innerHTML = `
        <div class="predictions-submission-container">
            <div class="predictions-submission-header">
                <h2>🎯 Make Your Predictions</h2>
                <p>Answer these questions about the upcoming album</p>
            </div>
            
            <form id="predictionsForm">
                <div id="predictionQuestions"></div>
                
                <div class="predictions-submit-section">
                    <p>Ready to lock in your predictions?</p>
                    <button type="submit" class="btn btn-primary">Submit Predictions ✨</button>
                </div>
            </form>
        </div>
    `;
    
    predictionsContainer.style.display = 'block';
    
    // Render each question
    const questionsContainer = document.getElementById('predictionQuestions');
    questions.forEach(question => {
        const questionCard = createPredictionQuestionCard(question);
        questionsContainer.appendChild(questionCard);
    });
    
    // Handle form submission
    document.getElementById('predictionsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitPredictions(questions);
    });
}

/**
 * Create a prediction question card for guest submission
 */
function createPredictionQuestionCard(question) {
    const card = document.createElement('div');
    card.className = 'prediction-question-card';
    card.dataset.questionId = question.id;
    
    let inputHTML = '';
    
    if (question.type === 'number') {
        const mid = (question.minValue + question.maxValue) / 2;
        inputHTML = `
            <div class="prediction-number-input">
                <label>Your prediction:</label>
                <div class="number-input-wrapper">
                    <input type="number" 
                           class="prediction-input" 
                           min="${question.minValue}" 
                           max="${question.maxValue}" 
                           step="${question.step}" 
                           value="${mid}"
                           required>
                </div>
                <div class="number-input-range">
                    <input type="range" 
                           class="prediction-range" 
                           min="${question.minValue}" 
                           max="${question.maxValue}" 
                           step="${question.step}" 
                           value="${mid}">
                    <div class="number-input-hint">${question.minValue} - ${question.maxValue}</div>
                </div>
            </div>
        `;
    } else if (question.type === 'yesno') {
        inputHTML = `
            <div class="prediction-yesno-input">
                <div class="yesno-buttons">
                    <button type="button" class="yesno-button yes" data-value="true">
                        <span class="yesno-icon">✅</span>
                        <span>Yes</span>
                    </button>
                    <button type="button" class="yesno-button no" data-value="false">
                        <span class="yesno-icon">❌</span>
                        <span>No</span>
                    </button>
                </div>
            </div>
        `;
    }
    
    card.innerHTML = `
        <div class="prediction-question-header">
            <div class="prediction-question-emoji">${question.emoji || '🎯'}</div>
            <div class="prediction-question-text">${question.text}</div>
        </div>
        ${inputHTML}
    `;
    
    // Sync number input with range slider
    if (question.type === 'number') {
        const numberInput = card.querySelector('.prediction-input');
        const rangeInput = card.querySelector('.prediction-range');
        
        numberInput.addEventListener('input', function() {
            rangeInput.value = this.value;
        });
        
        rangeInput.addEventListener('input', function() {
            numberInput.value = this.value;
        });
    }
    
    // Handle yes/no button clicks
    if (question.type === 'yesno') {
        const buttons = card.querySelectorAll('.yesno-button');
        buttons.forEach(btn => {
            btn.addEventListener('click', function() {
                buttons.forEach(b => b.classList.remove('selected'));
                this.classList.add('selected');
            });
        });
    }
    
    return card;
}

/**
 * Submit predictions for the guest
 */
async function submitPredictions(questions) {
    try {
        const answers = {};
        let allAnswered = true;
        
        questions.forEach(question => {
            const card = document.querySelector(`[data-question-id="${question.id}"]`);
            
            if (question.type === 'number') {
                const input = card.querySelector('.prediction-input');
                answers[question.id] = parseFloat(input.value);
            } else if (question.type === 'yesno') {
                const selectedBtn = card.querySelector('.yesno-button.selected');
                if (!selectedBtn) {
                    allAnswered = false;
                    return;
                }
                answers[question.id] = selectedBtn.dataset.value === 'true';
            }
        });
        
        if (!allAnswered) {
            showNotification('Please answer all questions', 'error');
            return;
        }
        
        // FIX: Use guestSession.guestId (the participant's session ID)
        const participantId = guestSession.guestId;
        
        console.log('Submitting predictions for:', participantId);
        console.log('Answers:', answers);
        
        // Submit to Firestore
        await db.collection('party-sessions').doc(guestSession.roomCode).update({
            [`predictions.${participantId}.answers`]: answers,
            [`predictions.${participantId}.submitted`]: true,
            [`predictions.${participantId}.submittedAt`]: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('✅ Predictions submitted successfully');
        showNotification('✅ Predictions submitted!', 'success');
        
        // Hide form, show waiting message
        document.getElementById('predictionsContainer').innerHTML = `
            <div class="predictions-submission-container" style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 20px;">✅</div>
                <h2>Predictions Submitted!</h2>
                <p style="font-size: 1.2rem; color: var(--text-secondary); margin-top: 15px;">
                    Waiting for others to finish...
                </p>
            </div>
        `;
        
    } catch (error) {
        console.error('Error submitting predictions:', error);
        showNotification('Error submitting predictions', 'error');
    }
}

/**
 * HOST: Show predictions phase with participant status
 */
function showPredictionsPhase() {
    document.getElementById('lobbyPhase').style.display = 'none';
    
    let predictionsPhase = document.getElementById('predictionsPhase');
    if (!predictionsPhase) {
        predictionsPhase = document.createElement('div');
        predictionsPhase.id = 'predictionsPhase';
        document.querySelector('main').appendChild(predictionsPhase);
    }
    
    predictionsPhase.innerHTML = `
        <div class="predictions-waiting">
            <h2>🎯 Waiting for Predictions</h2>
            <p>Participants are submitting their predictions...</p>
            
            <div class="predictions-status" id="predictionsStatus">
                <!-- Status cards will be added here -->
            </div>
            
            <button class="btn btn-primary btn-large" id="startRatingBtn" disabled>
                Start Rating Session ➡️
            </button>
            <p class="help-text">Button will enable when all participants have submitted</p>
        </div>
    `;
    
    predictionsPhase.style.display = 'block';
    
    // Add event listener for start button
    document.getElementById('startRatingBtn').addEventListener('click', startRatingFromPredictions);
    
    updatePredictionsStatus();
}

/**
 * HOST: Update predictions submission status
 */
function updatePredictionsStatus() {
    const statusContainer = document.getElementById('predictionsStatus');
    const startBtn = document.getElementById('startRatingBtn');
    
    if (!statusContainer || !startBtn) return;
    
    statusContainer.innerHTML = '';
    
    let allSubmitted = true;
    
    partySession.participants.forEach(participant => {
        const hasSubmitted = partySession.predictions?.[participant.id]?.submitted || false;
        
        const statusCard = document.createElement('div');
        statusCard.className = `participant-status ${hasSubmitted ? 'submitted' : 'waiting'}`;
        statusCard.innerHTML = `
            <span class="status-icon">${hasSubmitted ? '✅' : '⏳'}</span>
            <span class="participant-name">${participant.name}</span>
        `;
        statusContainer.appendChild(statusCard);
        
        if (!hasSubmitted) allSubmitted = false;
    });
    
    startBtn.disabled = !allSubmitted;
}

/**
 * HOST: Start rating session from predictions phase
 */
async function startRatingFromPredictions() {
    try {
        await db.collection('party-sessions').doc(partySession.roomCode).update({
            phase: 'active',
            currentTrackIndex: 0
        });
        
        partySession.phase = 'active';
        partySession.currentTrackIndex = 0;
        showActivePhase();
        
    } catch (error) {
        console.error('Error starting rating:', error);
        showNotification('Error starting rating session', 'error');
    }
}

/**
 * GUEST: Add predictions view button during rating phase
 */
function addPredictionsViewButton(participantId) {
    if (!partySession.predictionsContainerId) return;
    if (document.getElementById('predictionsButton')) return;
    
    const button = document.createElement('button');
    button.id = 'predictionsButton';
    button.className = 'predictions-button';
    button.innerHTML = '🎯';
    button.addEventListener('click', () => showPredictionsViewModal(participantId));
    document.body.appendChild(button);
}

/**
 * GUEST: Show predictions view modal (read-only during game)
 */
async function showPredictionsViewModal(participantId) {
    const predictions = partySession.predictions?.[participantId];
    if (!predictions) return;
    
    const questions = await loadPredictionQuestions(partySession.predictionsContainerId);
    
    let modal = document.getElementById('predictionsViewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'predictionsViewModal';
        modal.className = 'predictions-view-modal';
        document.body.appendChild(modal);
    }
    
    let content = `
        <div class="predictions-view-content">
            <div class="predictions-view-header">
                <h2>🎯 Your Predictions</h2>
                <button class="close-modal-btn" onclick="closePredictionsViewModal()">✕</button>
            </div>
    `;
    
    questions.forEach(question => {
        const answer = predictions.answers[question.id];
        let displayAnswer = '';
        
        if (question.type === 'number') {
            displayAnswer = answer.toFixed(2);
        } else if (question.type === 'yesno') {
            displayAnswer = answer ? '✅ Yes' : '❌ No';
        }
        
        content += `
            <div class="prediction-view-item">
                <div class="prediction-view-question">
                    ${question.emoji || '🎯'} ${question.text}
                </div>
                <div class="prediction-view-answer">${displayAnswer}</div>
            </div>
        `;
    });
    
    content += `</div>`;
    modal.innerHTML = content;
    modal.style.display = 'flex';
}

/**
 * Close predictions view modal
 */
function closePredictionsViewModal() {
    const modal = document.getElementById('predictionsViewModal');
    if (modal) modal.style.display = 'none';
}

/**
 * HOST: Show prediction results entry modal
 */
async function showPredictionResultsModal() {
    if (!partySession.predictionsContainerId) return;
    
    const questions = await loadPredictionQuestions(partySession.predictionsContainerId);
    
    let modal = document.getElementById('predictionResultsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'predictionResultsModal';
        modal.className = 'prediction-results-modal';
        document.body.appendChild(modal);
    }
    
    let content = `
        <div class="prediction-results-content">
            <div class="prediction-results-header">
                <h2>🎯 Enter Correct Answers</h2>
                <p>Set the actual results for each prediction</p>
            </div>
            <form id="predictionResultsForm">
    `;
    
    questions.forEach(question => {
        let inputHTML = '';
        
        if (question.type === 'number') {
            const mid = (question.minValue + question.maxValue) / 2;
            inputHTML = `
                <input type="number" 
                       class="prediction-input" 
                       name="${question.id}"
                       min="${question.minValue}" 
                       max="${question.maxValue}" 
                       step="${question.step}" 
                       value="${mid}"
                       style="width: 100%; padding: 12px; font-size: 18px; font-weight: bold; text-align: center; border: 2px solid var(--border-color); border-radius: 8px;"
                       required>
            `;
        } else if (question.type === 'yesno') {
            inputHTML = `
                <div class="yesno-buttons">
                    <button type="button" class="yesno-button yes result-btn" data-question="${question.id}" data-value="true">
                        <span class="yesno-icon">✅</span>
                        <span>Yes</span>
                    </button>
                    <button type="button" class="yesno-button no result-btn" data-question="${question.id}" data-value="false">
                        <span class="yesno-icon">❌</span>
                        <span>No</span>
                    </button>
                </div>
            `;
        }
        
        content += `
            <div class="prediction-answer-card" data-question-id="${question.id}">
                <div class="prediction-answer-question">
                    ${question.emoji || '🎯'} ${question.text}
                </div>
                ${inputHTML}
            </div>
        `;
    });
    
    content += `
                <div class="prediction-results-actions">
                    <button type="button" class="btn btn-secondary" onclick="closePredictionResultsModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Calculate Winners 🏆</button>
                </div>
            </form>
        </div>
    `;
    
    modal.innerHTML = content;
    modal.style.display = 'flex';
    
    // Handle yes/no button clicks
    document.querySelectorAll('.result-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const questionId = this.dataset.question;
            const card = document.querySelector(`[data-question-id="${questionId}"]`);
            card.querySelectorAll('.result-btn').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
        });
    });
    
    // Handle form submission
    document.getElementById('predictionResultsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await savePredictionResults(questions);
    });
}

/**
 * Close prediction results modal
 */
function closePredictionResultsModal() {
    const modal = document.getElementById('predictionResultsModal');
    if (modal) modal.style.display = 'none';
}

/**
 * HOST: Save prediction results and calculate scores
 */
async function savePredictionResults(questions) {
    try {
        const results = {};
        let allAnswered = true;
        
        questions.forEach(question => {
            if (question.type === 'number') {
                const input = document.querySelector(`input[name="${question.id}"]`);
                results[question.id] = parseFloat(input.value);
            } else if (question.type === 'yesno') {
                const selectedBtn = document.querySelector(`[data-question="${question.id}"].selected`);
                if (!selectedBtn) {
                    allAnswered = false;
                    return;
                }
                results[question.id] = selectedBtn.dataset.value === 'true';
            }
        });
        
        if (!allAnswered) {
            showNotification('Please answer all questions', 'error');
            return;
        }
        
        // Calculate scores
        const scores = calculatePredictionScores(partySession.predictions, results, questions);
        const winner = getPredictionWinner(scores);
        
        // Save to Firestore
        await db.collection('party-sessions').doc(partySession.roomCode).update({
            predictionResults: results,
            predictionScores: scores,
            predictionWinner: winner?.id || null
        });
        
        partySession.predictionResults = results;
        partySession.predictionScores = scores;
        partySession.predictionWinner = winner?.id || null;
        
        closePredictionResultsModal();
        showNotification('✅ Prediction results calculated!', 'success');
        
        // Continue with finishing the party
        continueFinishParty();
        
    } catch (error) {
        console.error('Error saving prediction results:', error);
        showNotification('Error saving results', 'error');
    }
}

/**
 * Calculate prediction scores for all participants
 */
function calculatePredictionScores(predictions, predictionResults, questions) {
    const scores = {};
    
    for (const [participantId, data] of Object.entries(predictions || {})) {
        if (!data.submitted) continue;
        
        let totalScore = 0;
        let questionCount = 0;
        
        for (const [questionId, answer] of Object.entries(data.answers)) {
            const correctAnswer = predictionResults[questionId];
            const question = questions.find(q => q.id === questionId);
            
            if (!question) continue;
            
            if (question.type === 'yesno') {
                // Binary: 100 points for correct, 0 for wrong
                totalScore += (answer === correctAnswer) ? 100 : 0;
            } else if (question.type === 'number') {
                // Proximity-based scoring
                const maxDiff = question.maxValue - question.minValue;
                const actualDiff = Math.abs(answer - correctAnswer);
                const accuracyPercent = Math.max(0, (1 - (actualDiff / maxDiff)) * 100);
                totalScore += accuracyPercent;
            }
            
            questionCount++;
        }
        
        scores[participantId] = questionCount > 0 ? totalScore / questionCount : 0;
    }
    
    return scores;
}

/**
 * Get the prediction winner
 */
function getPredictionWinner(scores) {
    let winner = null;
    let highestScore = -1;
    
    for (const [id, score] of Object.entries(scores)) {
        if (score > highestScore) {
            highestScore = score;
            winner = { id, score };
        }
    }
    
    return winner;
}

/**
 * Get prediction winner name for display
 */
function getPredictionsWinnerName() {
    if (!partySession.predictionWinner) return 'Unknown';
    const participant = partySession.participants.find(p => p.id === partySession.predictionWinner);
    return participant ? participant.name : 'Unknown';
}

// Make functions globally available
window.closePredictionsViewModal = closePredictionsViewModal;
window.closePredictionResultsModal = closePredictionResultsModal;