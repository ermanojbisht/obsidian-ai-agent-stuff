class QuizEngine {
    constructor() {
        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.selectedAnswer = null;
        this.quizzes = {};

        this.initializeElements();
        this.bindEvents();
        this.loadQuizzes();
    }

    initializeElements() {
        // Screens
        this.welcomeScreen = document.getElementById('welcome-screen');
        this.questionScreen = document.getElementById('question-screen');
        this.feedbackScreen = document.getElementById('feedback-screen');
        this.resultsScreen = document.getElementById('results-screen');

        // Elements
        this.quizSelect = document.getElementById('quiz-select');
        this.startQuizBtn = document.getElementById('start-quiz');
        this.submitAnswerBtn = document.getElementById('submit-answer');
        this.nextQuestionBtn = document.getElementById('next-question');
        this.finishQuizBtn = document.getElementById('finish-quiz');
        this.restartQuizBtn = document.getElementById('restart-quiz');
        this.selectNewQuizBtn = document.getElementById('select-new-quiz');

        // Content elements
        this.questionText = document.getElementById('question-text');
        this.optionsContainer = document.getElementById('options-container');
        this.currentScoreEl = document.getElementById('current-score');
        this.totalQuestionsEl = document.getElementById('total-questions');
        this.questionNumberEl = document.getElementById('question-number');
        this.totalQuestionsCounterEl = document.getElementById('total-questions-counter');
        this.progressFill = document.getElementById('progress-fill');

        // Feedback elements
        this.feedbackIcon = document.getElementById('feedback-icon');
        this.feedbackTitle = document.getElementById('feedback-title');
        this.feedbackExplanation = document.getElementById('feedback-explanation');

        // Results elements
        this.finalScoreEl = document.getElementById('final-score');
        this.finalTotalEl = document.getElementById('final-total');
        this.scorePercentageEl = document.getElementById('score-percentage');
        this.performanceFeedbackEl = document.getElementById('performance-feedback');
    }

    bindEvents() {
        this.startQuizBtn.addEventListener('click', () => this.startQuiz());
        this.submitAnswerBtn.addEventListener('click', () => this.submitAnswer());
        this.nextQuestionBtn.addEventListener('click', () => this.nextQuestion());
        this.finishQuizBtn.addEventListener('click', () => this.showResults());
        this.restartQuizBtn.addEventListener('click', () => this.restartQuiz());
        this.selectNewQuizBtn.addEventListener('click', () => this.showWelcome());
    }

    loadQuizzes() {
        // Embedded quiz data - no need for fetch
        const knowledgeVaultQuiz = {
            "title": "Knowledge Vault Quiz",
            "description": "A comprehensive quiz covering software craftsmanship, cognitive science, systems thinking, and more from the knowledge vault",
            "questions": [
                {
                    "question": "According to Conway's Law, what is the relationship between organizational structure and system design?",
                    "options": [
                        "Organizations should design systems independently of their communication structures",
                        "Organizations are constrained to produce designs that copy their communication structures",
                        "System architecture should determine organizational structure",
                        "There is no relationship between organizational structure and system design"
                    ],
                    "correctAnswer": 1,
                    "explanation": "Conway's Law states that 'organizations which design systems are constrained to produce designs which are copies of the communication structures of the organizations.' This is why strong software architects need to be socio-technical system architects with both technical and social skills."
                }
            ],
            "performanceFeedback": {
                "expert": {
                    "level": "Knowledge Vault Master",
                    "feedback": "Exceptional! You have a deep understanding of software craftsmanship, cognitive science, and systems thinking concepts.",
                    "suggestions": "Consider applying these concepts in your daily work: implement TDD practices, use Conway's Law for team design, and leverage cognitive biases awareness in decision-making. You're ready to mentor others in these areas."
                },
                "proficient": {
                    "level": "Well-Versed Practitioner",
                    "feedback": "Strong performance! You grasp the core concepts across multiple domains.",
                    "suggestions": "Focus on deepening your understanding of the topics you missed. Practice applying the 4 Rules of Simple Design in your code, experiment with zettelkasten note-taking, and explore flow state techniques for improved productivity."
                },
                "developing": {
                    "level": "Growing Learner",
                    "feedback": "Good foundation! You're building knowledge across important areas.",
                    "suggestions": "Strengthen your understanding by: reading 'Thinking, Fast and Slow' for cognitive biases, practicing deliberate practice techniques, and exploring the linked notes in the vault for deeper context on topics you found challenging."
                },
                "beginner": {
                    "level": "Knowledge Explorer",
                    "feedback": "Great start! You've been introduced to some powerful concepts.",
                    "suggestions": "Begin with the fundamentals: start a simple zettelkasten system, practice basic TDD with one small project, and read the specific vault notes on topics you found most interesting. Take the quiz again after exploring these areas."
                }
            }
        };


        this.quizzes['default'] = knowledgeVaultQuiz;

        // Populate quiz selector
        this.populateQuizSelector();
    }

    populateQuizSelector() {
        this.quizSelect.innerHTML = '';
        Object.keys(this.quizzes).forEach(quizId => {
            const option = document.createElement('option');
            option.value = quizId;
            option.textContent = this.quizzes[quizId].title;
            this.quizSelect.appendChild(option);
        });
    }

    startQuiz() {
        const selectedQuizId = this.quizSelect.value;
        this.currentQuiz = this.quizzes[selectedQuizId];

        if (!this.currentQuiz) {
            this.showError('Quiz not found. Please select a valid quiz.');
            return;
        }

        this.currentQuestionIndex = 0;
        this.score = 0;
        this.selectedAnswer = null;

        this.updateScoreDisplay();
        this.updateProgressBar();
        this.showQuestion();
    }

    showQuestion() {
        this.showScreen('question');

        const question = this.currentQuiz.questions[this.currentQuestionIndex];
        this.questionText.textContent = question.question;

        // Update counters
        this.questionNumberEl.textContent = this.currentQuestionIndex + 1;
        this.totalQuestionsCounterEl.textContent = this.currentQuiz.questions.length;

        // Clear previous options
        this.optionsContainer.innerHTML = '';

        // Create option buttons
        question.options.forEach((option, index) => {
            const button = document.createElement('button');
            button.className = 'option';
            button.textContent = `${String.fromCharCode(65 + index)}) ${option}`;
            button.addEventListener('click', () => this.selectOption(index, button));
            this.optionsContainer.appendChild(button);
        });

        this.submitAnswerBtn.disabled = true;
        this.selectedAnswer = null;
    }

    selectOption(index, buttonElement) {
        // Remove previous selection
        document.querySelectorAll('.option').forEach(btn => btn.classList.remove('selected'));

        // Select current option
        buttonElement.classList.add('selected');
        this.selectedAnswer = index;
        this.submitAnswerBtn.disabled = false;
    }

    submitAnswer() {
        if (this.selectedAnswer === null) return;

        const question = this.currentQuiz.questions[this.currentQuestionIndex];
        const isCorrect = this.selectedAnswer === question.correctAnswer;

        if (isCorrect) {
            this.score++;
            this.updateScoreDisplay();
        }

        this.showFeedback(isCorrect, question);
    }

    showFeedback(isCorrect, question) {
        this.showScreen('feedback');

        // Update feedback icon and title
        this.feedbackIcon.className = `feedback-icon ${isCorrect ? 'correct' : 'incorrect'}`;
        this.feedbackTitle.textContent = isCorrect ? 'Correct!' : 'Incorrect.';
        this.feedbackTitle.className = isCorrect ? 'correct' : 'incorrect';

        // Show explanation
        this.feedbackExplanation.textContent = question.explanation;

        // Show appropriate button
        const isLastQuestion = this.currentQuestionIndex === this.currentQuiz.questions.length - 1;
        this.nextQuestionBtn.classList.toggle('hidden', isLastQuestion);
        this.finishQuizBtn.classList.toggle('hidden', !isLastQuestion);
    }

    nextQuestion() {
        this.currentQuestionIndex++;
        this.updateProgressBar();
        this.showQuestion();
    }

    showResults() {
        this.showScreen('results');

        const totalQuestions = this.currentQuiz.questions.length;
        const percentage = Math.round((this.score / totalQuestions) * 100);

        this.finalScoreEl.textContent = this.score;
        this.finalTotalEl.textContent = totalQuestions;
        this.scorePercentageEl.textContent = percentage;

        // Generate performance feedback
        this.generatePerformanceFeedback(percentage, totalQuestions);
    }

    generatePerformanceFeedback(percentage, totalQuestions) {
        // Use quiz-specific performance feedback if available, otherwise fall back to generic
        const performanceFeedback = this.currentQuiz.performanceFeedback || this.getGenericPerformanceFeedback();

        let level, feedback, suggestions;

        if (percentage >= 90) {
            level = performanceFeedback.expert.level;
            feedback = performanceFeedback.expert.feedback;
            suggestions = performanceFeedback.expert.suggestions;
        } else if (percentage >= 70) {
            level = performanceFeedback.proficient.level;
            feedback = performanceFeedback.proficient.feedback;
            suggestions = performanceFeedback.proficient.suggestions;
        } else if (percentage >= 50) {
            level = performanceFeedback.developing.level;
            feedback = performanceFeedback.developing.feedback;
            suggestions = performanceFeedback.developing.suggestions;
        } else {
            level = performanceFeedback.beginner.level;
            feedback = performanceFeedback.beginner.feedback;
            suggestions = performanceFeedback.beginner.suggestions;
        }

        this.performanceFeedbackEl.innerHTML = `
            <h4>${level}</h4>
            <p>${feedback}</p>
            <p><strong>Next steps:</strong> ${suggestions}</p>
        `;
    }

    getGenericPerformanceFeedback() {
        return {
            expert: {
                level: "Expert Level",
                feedback: "Outstanding! You have an excellent grasp of the concepts in this knowledge vault.",
                suggestions: "Consider teaching these concepts to others or diving deeper into related advanced topics."
            },
            proficient: {
                level: "Proficient",
                feedback: "Great work! You have a solid understanding of most concepts.",
                suggestions: "Review the questions you missed and explore the related topics to strengthen your knowledge."
            },
            developing: {
                level: "Developing",
                feedback: "Good effort! You're on the right track but there's room for improvement.",
                suggestions: "Focus on the areas where you struggled and spend more time with the source material."
            },
            beginner: {
                level: "Beginner",
                feedback: "Don't worry, everyone starts somewhere! This quiz identified areas for growth.",
                suggestions: "Consider reviewing the foundational concepts and taking the quiz again after studying."
            }
        };
    }

    restartQuiz() {
        this.startQuiz();
    }

    showWelcome() {
        this.showScreen('welcome');
        this.resetProgress();
    }

    showScreen(screenName) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });

        // Show selected screen
        document.getElementById(`${screenName}-screen`).classList.remove('hidden');
    }

    updateScoreDisplay() {
        this.currentScoreEl.textContent = this.score;
        this.totalQuestionsEl.textContent = this.currentQuiz.questions.length;
    }

    updateProgressBar() {
        const totalQuestions = this.currentQuiz.questions.length;
        const progress = ((this.currentQuestionIndex + 1) / totalQuestions) * 100;
        this.progressFill.style.width = `${progress}%`;
    }

    resetProgress() {
        this.progressFill.style.width = '0%';
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.selectedAnswer = null;
    }

    showError(message) {
        alert(message); // Simple error handling - could be enhanced with a proper modal
    }
}

// Initialize the quiz engine when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new QuizEngine();
});