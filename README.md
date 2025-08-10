# CLAUDE.md

## Repository Architecture

This is a multi-project repository focused on Obsidian AI agent integrations and semantic search capabilities. It contains three main project areas:

### Core Projects

1. **Semantic Search System** (`semantic-search/`)
   - **ChromaDB Backend** (`chroma/`): Vector database for semantic search using ChromaDB
   - **Context Fetcher Plugin** (`context-fetcher-plugin/`): Obsidian plugin for retrieving contextually relevant notes

2. **Quiz System** (`quizmaster/`)
   - **Quiz Web App** (`quiz-app/`): Standalone web application for interactive knowledge testing
   - Uses embedded quiz data directly in JavaScript (no server required)
   - System prompt that interactively generates quizzes based on user input and vault notes

3. **Presentation Tools** (`reverse-engineer-slidedeck/`)
   - Tools for reverse engineering slide deck content

## Custom Claude Code Slash Commands

The repository includes multiple specialized Claude commands in respective `.claude/commands/` folders:

- `generate-quiz.md`: Comprehensive quiz generation system using ChromaDB for content discovery
- `reverse-engineer-slidedeck.md`: Slide deck analysis and reconstruction
- `gather-relevant-context.md`: Semantic search note retrieval for Obsidian