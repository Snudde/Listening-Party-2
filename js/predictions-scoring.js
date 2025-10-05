// Predictions Scoring System - Advanced scoring algorithms

/**
 * Calculate detailed prediction scores with breakdowns
 */
function calculateDetailedPredictionScores(predictions, predictionResults, questions) {
    const scores = {};
    const breakdowns = {};
    
    for (const [participantId, data] of Object.entries(predictions || {})) {
        if (!data.submitted) continue;
        
        let totalScore = 0;
        let questionCount = 0;
        const questionScores = [];
        
        for (const [questionId, answer] of Object.entries(data.answers)) {
            const correctAnswer = predictionResults[questionId];
            const question = questions.find(q => q.id === questionId);
            
            if (!question) continue;
            
            let questionScore = 0;
            let details = {};
            
            if (question.type === 'yesno') {
                // Binary: 100 points for correct, 0 for wrong
                questionScore = (answer === correctAnswer) ? 100 : 0;
                details = {
                    questionId,
                    questionText: question.text,
                    type: 'yesno',
                    yourAnswer: answer ? 'Yes' : 'No',
                    correctAnswer: correctAnswer ? 'Yes' : 'No',
                    isCorrect: answer === correctAnswer,
                    score: questionScore
                };
            } else if (question.type === 'number') {
                // Proximity-based scoring with different algorithms
                const maxDiff = question.maxValue - question.minValue;
                const actualDiff = Math.abs(answer - correctAnswer);
                
                // Linear scoring: closer = better
                const accuracyPercent = Math.max(0, (1 - (actualDiff / maxDiff)) * 100);
                questionScore = accuracyPercent;
                
                details = {
                    questionId,
                    questionText: question.text,
                    type: 'number',
                    yourAnswer: answer.toFixed(2),
                    correctAnswer: correctAnswer.toFixed(2),
                    difference: actualDiff.toFixed(2),
                    percentageOff: ((actualDiff / correctAnswer) * 100).toFixed(1) + '%',
                    score: questionScore
                };
            }
            
            totalScore += questionScore;
            questionCount++;
            questionScores.push(details);
        }
        
        const averageScore = questionCount > 0 ? totalScore / questionCount : 0;
        
        scores[participantId] = averageScore;
        breakdowns[participantId] = {
            averageScore,
            totalQuestions: questionCount,
            questionScores,
            rank: 0 // Will be calculated later
        };
    }
    
    // Calculate ranks
    const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    sortedScores.forEach(([participantId], index) => {
        breakdowns[participantId].rank = index + 1;
    });
    
    return { scores, breakdowns };
}

/**
 * Alternative scoring: Weighted scoring based on difficulty
 */
function calculateWeightedPredictionScores(predictions, predictionResults, questions) {
    const scores = {};
    
    for (const [participantId, data] of Object.entries(predictions || {})) {
        if (!data.submitted) continue;
        
        let weightedTotal = 0;
        let totalWeight = 0;
        
        for (const [questionId, answer] of Object.entries(data.answers)) {
            const correctAnswer = predictionResults[questionId];
            const question = questions.find(q => q.id === questionId);
            
            if (!question) continue;
            
            // Weight: Yes/No questions are worth less than number predictions
            const weight = question.type === 'yesno' ? 1.0 : 1.5;
            
            let questionScore = 0;
            
            if (question.type === 'yesno') {
                questionScore = (answer === correctAnswer) ? 100 : 0;
            } else if (question.type === 'number') {
                const maxDiff = question.maxValue - question.minValue;
                const actualDiff = Math.abs(answer - correctAnswer);
                questionScore = Math.max(0, (1 - (actualDiff / maxDiff)) * 100);
            }
            
            weightedTotal += questionScore * weight;
            totalWeight += weight;
        }
        
        scores[participantId] = totalWeight > 0 ? weightedTotal / totalWeight : 0;
    }
    
    return scores;
}

/**
 * Gaussian scoring: More forgiving for close answers
 */
function calculateGaussianPredictionScores(predictions, predictionResults, questions) {
    const scores = {};
    
    for (const [participantId, data] of Object.entries(predictions || {})) {
        if (!data.submitted) continue;
        
        let totalScore = 0;
        let questionCount = 0;
        
        for (const [questionId, answer] of Object.entries(data.answers)) {
            const correctAnswer = predictionResults[questionId];
            const question = questions.find(q => q.id === questionId);
            
            if (!question) continue;
            
            let questionScore = 0;
            
            if (question.type === 'yesno') {
                questionScore = (answer === correctAnswer) ? 100 : 0;
            } else if (question.type === 'number') {
                // Gaussian curve: e^(-(x-μ)²/2σ²)
                const maxDiff = question.maxValue - question.minValue;
                const actualDiff = Math.abs(answer - correctAnswer);
                const sigma = maxDiff / 4; // Standard deviation
                
                const gaussianScore = Math.exp(-(actualDiff * actualDiff) / (2 * sigma * sigma));
                questionScore = gaussianScore * 100;
            }
            
            totalScore += questionScore;
            questionCount++;
        }
        
        scores[participantId] = questionCount > 0 ? totalScore / questionCount : 0;
    }
    
    return scores;
}

/**
 * Get prediction statistics for all participants
 */
function getPredictionStatistics(predictions, predictionResults, questions) {
    const stats = {
        totalParticipants: 0,
        submittedCount: 0,
        averageAccuracy: 0,
        perfectPredictions: 0,
        questionStats: {}
    };
    
    let totalAccuracy = 0;
    let submittedCount = 0;
    
    for (const [participantId, data] of Object.entries(predictions || {})) {
        stats.totalParticipants++;
        if (!data.submitted) continue;
        
        stats.submittedCount++;
        submittedCount++;
        
        let participantAccuracy = 0;
        let questionCount = 0;
        let perfectCount = 0;
        
        for (const [questionId, answer] of Object.entries(data.answers)) {
            const correctAnswer = predictionResults[questionId];
            const question = questions.find(q => q.id === questionId);
            
            if (!question) continue;
            
            // Initialize question stats
            if (!stats.questionStats[questionId]) {
                stats.questionStats[questionId] = {
                    questionText: question.text,
                    type: question.type,
                    correctAnswer,
                    answers: [],
                    correctCount: 0
                };
            }
            
            stats.questionStats[questionId].answers.push(answer);
            
            if (question.type === 'yesno') {
                const isCorrect = answer === correctAnswer;
                if (isCorrect) {
                    perfectCount++;
                    stats.questionStats[questionId].correctCount++;
                }
                participantAccuracy += isCorrect ? 100 : 0;
            } else if (question.type === 'number') {
                const maxDiff = question.maxValue - question.minValue;
                const actualDiff = Math.abs(answer - correctAnswer);
                const accuracy = Math.max(0, (1 - (actualDiff / maxDiff)) * 100);
                
                if (accuracy === 100) perfectCount++;
                participantAccuracy += accuracy;
            }
            
            questionCount++;
        }
        
        const avgAccuracy = questionCount > 0 ? participantAccuracy / questionCount : 0;
        totalAccuracy += avgAccuracy;
        
        if (perfectCount === questionCount && questionCount > 0) {
            stats.perfectPredictions++;
        }
    }
    
    stats.averageAccuracy = submittedCount > 0 ? totalAccuracy / submittedCount : 0;
    
    return stats;
}

/**
 * Format score for display with visual indicators
 */
function formatPredictionScore(score) {
    if (score >= 90) return { text: score.toFixed(1) + '%', emoji: '🔥', color: '#10b981' };
    if (score >= 75) return { text: score.toFixed(1) + '%', emoji: '🎯', color: '#3b82f6' };
    if (score >= 60) return { text: score.toFixed(1) + '%', emoji: '👍', color: '#8b5cf6' };
    if (score >= 40) return { text: score.toFixed(1) + '%', emoji: '📊', color: '#f59e0b' };
    return { text: score.toFixed(1) + '%', emoji: '🎲', color: '#ef4444' };
}

/**
 * Get leaderboard sorted by score
 */
function getPredictionLeaderboard(scores, participants) {
    const leaderboard = [];
    
    for (const [participantId, score] of Object.entries(scores)) {
        const participant = participants.find(p => p.id === participantId);
        if (participant) {
            leaderboard.push({
                participantId,
                name: participant.name,
                score,
                formatted: formatPredictionScore(score)
            });
        }
    }
    
    leaderboard.sort((a, b) => b.score - a.score);
    
    return leaderboard;
}