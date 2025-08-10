# Generate Knowledge Vault Quiz

You are going to create and run an interactive quiz based on the contents of this knowledge vault using ChromaDB.

## Quiz Parameters

**Number of Questions**: {{num_questions}} (default: 10 if not specified)

**Topic Focus**: {{topic}} (if specified, focus all questions on this specific topic; if not specified, make the quiz as broad and diverse as possible across all vault content)

## Instructions

1. **Topic Discovery Using ChromaDB**:
   - Use ChromaDB MCP tools to access the "notes" collection
   - If a specific topic is provided:
     - Use `mcp__chroma__chroma_query_documents` to search for documents semantically related to the topic
     - Limit to 10-15 most relevant documents for focused quiz content
   - If no topic is specified:
     - First, get the total document count using `mcp__chroma__chroma_get_collection_count`
     - Generate random offset values dynamically using Python or command-line tools
     - Use `mcp__chroma__chroma_get_documents` with these random offsets to get diverse content
     - Aim for 15-20 diverse documents across different domains

2. **Document Retrieval and Content Analysis**:
   - After identifying relevant documents from ChromaDB, use the Read tool to access the actual markdown files
   - Extract file paths from the ChromaDB metadata and read only those specific files
   - Analyze content for key concepts, frameworks, and interconnected ideas
   - Focus on understanding, not just facts

3. **Question Generation**:
   - If a specific topic is provided, generate ALL questions about that topic only
   - If no topic is specified, create the most diverse quiz possible - pull from different domains (software craftsmanship, cognitive science, systems thinking, AI, leadership, coaching, etc.)
   - Use only content from this knowledge vault - don't inject external knowledge
   - Create multiple choice questions with 4 options each
   - Ensure questions test understanding, not just memorization. You can do this by providing out-of-order listings, paraphrasing etc.
   - **CRITICAL**: When creating multiple choice options, ensure that each option is meaningfully different and tests real understanding. Avoid creating options that are merely reordered lists of the same elements.

4. **Quiz Execution**:
   - Act as an interactive quizmaster
   - Present questions one at a time
   - Wait for user response after each question
   - Provide immediate feedback (correct/incorrect)
   - If incorrect, briefly explain the mistake and the correct answer
   - Track score throughout

5. **Quiz Completion**:
   - Show final score at the end
   - Provide constructive, positive feedback
   - Give an experience level assessment based on performance
   - **CRITICAL**: Provide context-specific next steps based on the quiz topic and user's performance:
     - For software craftsmanship topics: suggest specific practices, books, or techniques to try
     - For cognitive science topics: recommend specific exercises or areas to explore
     - For systems thinking topics: suggest frameworks or real-world applications
     - For coaching topics: recommend specific coaching techniques or situations to practice
     - Always make suggestions actionable and specific to the quiz content

## Example Usage

```
/generate-quiz num_questions:5 topic:Conway's Law
```
(Creates 5 questions focused only on Conway's Law using semantic search)

```
/generate-quiz num_questions:15
```
(Creates 15 diverse questions across all vault topics using random sampling)

```
/generate-quiz
```
(Creates 10 diverse questions across all vault topics using random sampling)

## Important Notes

- Questions should reflect the interconnected nature of concepts in the vault
- Use the same positive, constructive tone as established in previous interactions
- Ensure questions are challenging but fair
- Draw from notes, literature notes, and project content
- Reference specific files when explaining answers if relevant
- **Efficiency**: Use ChromaDB to efficiently discover relevant content without reading all files

## Random Offset Generation Strategy

For diverse content sampling, use this approach to generate smart random offsets:

1. **Calculate Safe Maximum**: `max_offset = total_documents - limit` (where limit is your per-query limit, e.g., 5)
2. **Generate Multiple Offsets**: Create 6-8 different random offsets to sample across the collection
3. **Ensure Distribution**: Aim for offsets that span the full range (early, middle, and late documents)
4. **Example Calculation**:
   - If collection has 267 documents and using limit=3
   - max_offset = 267 - 3 = 264
   - Generate offsets like: 12, 67, 145, 198, 234, 89

**Command Examples**:
```bash
# Python method (most reliable)
python -c "import random; offsets=[random.randint(0, 264) for _ in range(6)]; print(offsets)"

# PowerShell method (Windows)
$offsets = 1..6 | ForEach-Object { Get-Random -Maximum 264 }; Write-Output $offsets
```

## Quiz Mode Selection

After generating the quiz content, ALWAYS ask the user to choose between:

**A) Interactive Quiz Mode**: Run the quiz directly in the conversation (traditional Claude quizmaster experience)
**B) Add to Web App**: Add the quiz to the quiz web app in `scripts/quiz-app/quiz-engine.js`

Wait for the user's selection before proceeding with either option.

## Implementation Steps

1. Check ChromaDB collection info and document count using `mcp__chroma__chroma_get_collection_info` and `mcp__chroma__chroma_get_collection_count`
2. If topic specified: 
   - Use `mcp__chroma__chroma_query_documents` with the topic as query text
   - Limit results to 10-15 most semantically similar documents
3. If no topic specified: 
   - Generate random offset values using one of these methods:
     - Python: `python -c "import random; print(' '.join(str(random.randint(0, {max_offset})) for _ in range(6)))"`
     - Where {max_offset} = total_documents - 5 (to ensure we don't exceed bounds with limit)
   - Use `mcp__chroma__chroma_get_documents` with these random offsets to sample diverse content
   - Use small limits (3-5 docs each) to ensure we stay within collection bounds
4. Extract file paths from ChromaDB metadata and use Read tool to access actual content
5. Generate quiz questions with context-specific performance feedback for different score ranges
6. **MANDATORY**: Present the quiz mode selection to the user and wait for their choice
7. Based on user selection:
   - Option A: Run the interactive quiz as quizmaster with context-specific conclusions
   - Option B: Add the quiz to the web app including performance feedback data structure

Begin generating quiz content now, but remember to ask about quiz mode before execution.