// Predictions Admin Panel JavaScript

let currentDeleteTarget = null;

// ============= INITIALIZATION =============

document.addEventListener('DOMContentLoaded', function() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            switchTab(tab);
        });
    });
    
    // Question modal
    document.getElementById('addQuestionBtn').addEventListener('click', () => openQuestionModal());
    document.getElementById('cancelQuestionBtn').addEventListener('click', closeQuestionModal);
    document.getElementById('questionForm').addEventListener('submit', saveQuestion);
    
    // Container modal
    document.getElementById('addContainerBtn').addEventListener('click', () => openContainerModal());
    document.getElementById('cancelContainerBtn').addEventListener('click', closeContainerModal);
    document.getElementById('containerForm').addEventListener('submit', saveContainer);
    
    // Delete modal
    document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);
    document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);
    
    // Question type conditional fields
    document.getElementById('questionType').addEventListener('change', function() {
        const numberFields = document.getElementById('numberFields');
        if (this.value === 'number') {
            numberFields.classList.remove('hidden');
        } else {
            numberFields.classList.add('hidden');
        }
    });
    
    // Load initial data
    loadQuestions();
    loadContainers();
});

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`${tab}Tab`).classList.add('active');
}

// ============= QUESTIONS MANAGEMENT =============

async function loadQuestions() {
    try {
        const snapshot = await db.collection('prediction-questions').orderBy('createdAt', 'desc').get();
        const questionsGrid = document.getElementById('questionsGrid');
        
        if (snapshot.empty) {
            questionsGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🎯</div>
                    <h3>No Prediction Questions Yet</h3>
                    <p>Create your first prediction question to get started!</p>
                </div>
            `;
            return;
        }
        
        questionsGrid.innerHTML = '';
        
        snapshot.forEach(doc => {
            const question = { id: doc.id, ...doc.data() };
            const card = createQuestionCard(question);
            questionsGrid.appendChild(card);
        });
        
        console.log('✅ Loaded', snapshot.size, 'prediction questions');
    } catch (error) {
        console.error('Error loading questions:', error);
        showNotification('Error loading questions', 'error');
    }
}

function createQuestionCard(question) {
    const card = document.createElement('div');
    card.className = 'question-card';
    
    const typeLabel = question.type === 'number' ? 'Number' : 'Yes/No';
    const rangeInfo = question.type === 'number' 
        ? `Range: ${question.minValue} - ${question.maxValue} (step: ${question.step})`
        : 'Binary choice';
    
    card.innerHTML = `
        ${question.emoji ? `<div class="question-emoji">${question.emoji}</div>` : ''}
        <div class="question-text">${question.text}</div>
        <span class="question-type ${question.type}">${typeLabel}</span>
        <div class="question-range">${rangeInfo}</div>
        <span class="question-category" data-category="${question.category}">${formatCategory(question.category)}</span>
        <div class="question-actions">
            <button class="btn btn-secondary btn-sm" onclick="editQuestion('${question.id}')">✏️ Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteQuestion('${question.id}')">🗑️ Delete</button>
        </div>
    `;
    
    return card;
}

function formatCategory(category) {
    const categories = {
        'scores': 'Scores',
        'ratings': 'Ratings',
        'participants': 'Participants',
        'tracks': 'Tracks',
        'general': 'General'
    };
    return categories[category] || category;
}

function openQuestionModal(question = null) {
    const modal = document.getElementById('questionModal');
    const form = document.getElementById('questionForm');
    const title = document.getElementById('questionModalTitle');
    
    form.reset();
    
    if (question) {
        title.textContent = 'Edit Prediction Question';
        document.getElementById('questionId').value = question.id;
        document.getElementById('questionText').value = question.text;
        document.getElementById('questionEmoji').value = question.emoji || '';
        document.getElementById('questionType').value = question.type;
        document.getElementById('questionCategory').value = question.category;
        
        if (question.type === 'number') {
            document.getElementById('questionMin').value = question.minValue;
            document.getElementById('questionMax').value = question.maxValue;
            document.getElementById('questionStep').value = question.step;
            document.getElementById('numberFields').classList.remove('hidden');
        } else {
            document.getElementById('numberFields').classList.add('hidden');
        }
    } else {
        title.textContent = 'Add Prediction Question';
        document.getElementById('questionType').value = 'number';
        document.getElementById('numberFields').classList.remove('hidden');
    }
    
    modal.style.display = 'flex';
}

function closeQuestionModal() {
    document.getElementById('questionModal').style.display = 'none';
}

async function saveQuestion(e) {
    e.preventDefault();
    
    const questionId = document.getElementById('questionId').value;
    const type = document.getElementById('questionType').value;
    
    const data = {
        text: document.getElementById('questionText').value,
        emoji: document.getElementById('questionEmoji').value || null,
        type: type,
        category: document.getElementById('questionCategory').value
    };
    
    if (type === 'number') {
        data.minValue = parseFloat(document.getElementById('questionMin').value);
        data.maxValue = parseFloat(document.getElementById('questionMax').value);
        data.step = parseFloat(document.getElementById('questionStep').value);
    }
    
    try {
        if (questionId) {
            await db.collection('prediction-questions').doc(questionId).update(data);
            showNotification('✅ Question updated!', 'success');
        } else {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('prediction-questions').add(data);
            showNotification('✅ Question created!', 'success');
        }
        
        closeQuestionModal();
        loadQuestions();
    } catch (error) {
        console.error('Error saving question:', error);
        showNotification('Error saving question', 'error');
    }
}

async function editQuestion(questionId) {
    try {
        const doc = await db.collection('prediction-questions').doc(questionId).get();
        if (doc.exists) {
            const question = { id: doc.id, ...doc.data() };
            openQuestionModal(question);
        }
    } catch (error) {
        console.error('Error loading question:', error);
    }
}

function deleteQuestion(questionId) {
    currentDeleteTarget = { type: 'question', id: questionId };
    document.getElementById('deleteMessage').textContent = 'Are you sure you want to delete this prediction question?';
    document.getElementById('deleteModal').style.display = 'flex';
}

// ============= CONTAINERS MANAGEMENT =============

async function loadContainers() {
    try {
        const snapshot = await db.collection('prediction-containers').orderBy('createdAt', 'desc').get();
        const containersGrid = document.getElementById('containersGrid');
        
        if (snapshot.empty) {
            containersGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <h3>No Prediction Containers Yet</h3>
                    <p>Create a container to group prediction questions together!</p>
                </div>
            `;
            return;
        }
        
        containersGrid.innerHTML = '';
        
        for (const doc of snapshot.docs) {
            const container = { id: doc.id, ...doc.data() };
            const card = await createContainerCard(container);
            containersGrid.appendChild(card);
        }
        
        console.log('✅ Loaded', snapshot.size, 'prediction containers');
    } catch (error) {
        console.error('Error loading containers:', error);
        showNotification('Error loading containers', 'error');
    }
}

async function createContainerCard(container) {
    const card = document.createElement('div');
    card.className = 'container-card';
    
    const questionIds = container.questionIds || [];
    
    // Load question details for preview
    let questionPreviews = '';
    let numberCount = 0;
    let yesnoCount = 0;
    
    if (questionIds.length > 0) {
        const questionsSnapshot = await Promise.all(
            questionIds.slice(0, 5).map(id => db.collection('prediction-questions').doc(id).get())
        );
        
        questionsSnapshot.forEach(doc => {
            if (doc.exists) {
                const q = doc.data();
                if (q.type === 'number') numberCount++;
                if (q.type === 'yesno') yesnoCount++;
                
                questionPreviews += `
                    <div class="preview-question">
                        ${q.emoji || '🎯'} ${q.text}
                    </div>
                `;
            }
        });
        
        if (questionIds.length > 5) {
            questionPreviews += `<div class="preview-question">...and ${questionIds.length - 5} more</div>`;
        }
    }
    
    card.innerHTML = `
        <div class="container-name">${container.name}</div>
        <div class="container-stats">
            <div class="container-stat">
                <div class="container-stat-value">${questionIds.length}</div>
                <div class="container-stat-label">Questions</div>
            </div>
            <div class="container-stat">
                <div class="container-stat-value">${numberCount}</div>
                <div class="container-stat-label">Number</div>
            </div>
            <div class="container-stat">
                <div class="container-stat-value">${yesnoCount}</div>
                <div class="container-stat-label">Yes/No</div>
            </div>
        </div>
        ${questionPreviews ? `
            <div class="container-questions-preview">
                <h4>Preview:</h4>
                ${questionPreviews}
            </div>
        ` : ''}
        <div class="container-actions">
            <button class="btn btn-secondary" onclick="editContainer('${container.id}')">✏️ Edit</button>
            <button class="btn btn-danger" onclick="deleteContainer('${container.id}')">🗑️ Delete</button>
        </div>
    `;
    
    return card;
}

async function openContainerModal(container = null) {
    const modal = document.getElementById('containerModal');
    const form = document.getElementById('containerForm');
    const title = document.getElementById('containerModalTitle');
    
    form.reset();
    
    // Load all questions for selection
    const questionsSnapshot = await db.collection('prediction-questions').orderBy('createdAt', 'desc').get();
    const grid = document.getElementById('questionSelectionGrid');
    grid.innerHTML = '';
    
    if (questionsSnapshot.empty) {
        grid.innerHTML = '<p class="help-text">No questions available. Create some questions first!</p>';
    } else {
        questionsSnapshot.forEach(doc => {
            const question = { id: doc.id, ...doc.data() };
            const isSelected = container && container.questionIds && container.questionIds.includes(question.id);
            
            const item = document.createElement('div');
            item.className = `question-select-item ${isSelected ? 'selected' : ''}`;
            item.innerHTML = `
                <input type="checkbox" 
                       id="q_${question.id}" 
                       value="${question.id}" 
                       ${isSelected ? 'checked' : ''}>
                <div class="question-select-text">
                    <strong>${question.emoji || '🎯'} ${question.text}</strong>
                    <small>${question.type === 'number' ? 'Number-based' : 'Yes/No'} • ${formatCategory(question.category)}</small>
                </div>
            `;
            
            item.addEventListener('click', function(e) {
                if (e.target.tagName !== 'INPUT') {
                    const checkbox = this.querySelector('input');
                    checkbox.checked = !checkbox.checked;
                }
                this.classList.toggle('selected', this.querySelector('input').checked);
            });
            
            grid.appendChild(item);
        });
    }
    
    if (container) {
        title.textContent = 'Edit Prediction Container';
        document.getElementById('containerId').value = container.id;
        document.getElementById('containerName').value = container.name;
    } else {
        title.textContent = 'Create Prediction Container';
    }
    
    modal.style.display = 'flex';
}

function closeContainerModal() {
    document.getElementById('containerModal').style.display = 'none';
}

async function saveContainer(e) {
    e.preventDefault();
    
    const containerId = document.getElementById('containerId').value;
    
    const selectedQuestions = Array.from(document.querySelectorAll('#questionSelectionGrid input:checked'))
        .map(input => input.value);
    
    if (selectedQuestions.length === 0) {
        showNotification('Please select at least one question', 'error');
        return;
    }
    
    const data = {
        name: document.getElementById('containerName').value,
        questionIds: selectedQuestions
    };
    
    try {
        if (containerId) {
            await db.collection('prediction-containers').doc(containerId).update(data);
            showNotification('✅ Container updated!', 'success');
        } else {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('prediction-containers').add(data);
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
        const doc = await db.collection('prediction-containers').doc(containerId).get();
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
    document.getElementById('deleteMessage').textContent = 'Are you sure you want to delete this prediction container?';
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
        if (currentDeleteTarget.type === 'question') {
            await db.collection('prediction-questions').doc(currentDeleteTarget.id).delete();
            showNotification('✅ Question deleted', 'success');
            loadQuestions();
        } else if (currentDeleteTarget.type === 'container') {
            await db.collection('prediction-containers').doc(currentDeleteTarget.id).delete();
            showNotification('✅ Container deleted', 'success');
            loadContainers();
        }
        
        closeDeleteModal();
    } catch (error) {
        console.error('Error deleting:', error);
        showNotification('Error deleting item', 'error');
    }
}