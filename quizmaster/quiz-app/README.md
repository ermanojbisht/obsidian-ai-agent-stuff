# Knowledge Vault Quiz App

A web-based quiz application that replicates the interactive quizmaster experience. The app features a clean, modern interface with immediate feedback and performance assessment.

## Features

- **Interactive Quiz Experience**: Acts as a quizmaster with question-by-question feedback
- **No Server Required**: Quiz data is embedded directly in the JavaScript - just open the HTML file!
- **Responsive Design**: Works on desktop and mobile devices
- **Progress Tracking**: Visual progress bar and score tracking
- **Performance Assessment**: Detailed feedback based on quiz results
- **Modern UI**: Clean, professional interface with smooth animations

## File Structure

```
quiz-app/
├── index.html              # Main HTML structure
├── styles.css              # CSS styling
├── quiz-engine.js          # JavaScript quiz engine
├── quizzes/
│   └── knowledge-vault-quiz.json  # Quiz data
└── README.md               # This file
```

## How to Use

1. **Start the Quiz**: Simply double-click `index.html` to open in your browser (no server required!)
2. **Select a Quiz**: Choose from available quizzes (more can be added)
3. **Answer Questions**: Click on your chosen answer and submit
4. **Get Feedback**: Receive immediate feedback with explanations
5. **View Results**: See your final score and performance assessment

## Adding New Quizzes

To add a new quiz, modify the `loadQuizzes()` method in `quiz-engine.js` and add a new quiz object with this structure:

```json
{
  "title": "Your Quiz Title",
  "description": "Description of your quiz",
  "questions": [
    {
      "question": "Your question here?",
      "options": [
        "Option A",
        "Option B", 
        "Option C",
        "Option D"
      ],
      "correctAnswer": 1,
      "explanation": "Explanation of the correct answer"
    }
  ]
}
```

- `correctAnswer`: Index of the correct option (0-based)
- `explanation`: Text shown after answering to explain the correct answer

## Technical Details

- **Pure JavaScript**: No external dependencies
- **Responsive CSS**: Mobile-friendly design
- **Modular Architecture**: Easy to extend with new features
- **Embedded Data**: Quiz data is directly embedded in JavaScript for offline use

## Browser Support

Works in all modern browsers that support:
- ES6 classes
- CSS Grid and Flexbox
- No server or special setup required!

## License

This quiz app is part of the knowledge vault project and follows the same licensing terms.