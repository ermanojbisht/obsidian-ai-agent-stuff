# Reverse Engineer Slide Deck

Convert a folder of PNG slide images into a comprehensive text document following Jo Van Eyck's writing style.

## Command Parameters

**Slide Folder**: {{slide_folder}} (required - absolute path to folder containing PNG slide images)

**Output Document**: {{output_document}} (required - path to output document in vault, e.g., "projects/my-presentation.md")

## Instructions

### 1. Slide Discovery and Validation
- List all PNG files in the specified folder
- Sort slides numerically (Slide1.PNG, Slide2.PNG, etc.) to ensure proper order
- Validate that slides exist and are readable
- Report total number of slides found

### 2. Systematic Slide Processing
**CRITICAL**: Process EVERY slide individually and systematically in **batches of 10 slides**:
- Read each slide image one by one in numerical order
- Extract all text content, concepts, code examples, and visual information
- Identify slide type (title, section header, content, code example, diagram, etc.)
- Note any visual elements that provide context (charts, diagrams, images)
- **MANDATORY**: If a slide contains no parsable text or meaningful content, add the marker: `<SLIDE X WAS NOT PROCESSED AUTOMATICALLY>` where X is the slide number
- **BATCH PROCESSING**: Process slides in batches of 10, writing accumulated content to output file after each batch to prevent context loss and enable resumption if interrupted

### 3. Content Analysis and Structure
For each slide, analyze:
- **Main topic or concept** being presented
- **Key points** or bullet items
- **Code examples** with proper syntax highlighting
- **Quotes** or references to experts/sources
- **Visual information** (diagrams, charts, images) and their meaning
- **Progression** from previous slides and connection to next slides

### 4. Text Generation Following Specific Writing Style
Read and utilize the style found in writing-style.md.

### 5. Document Structure
Create a comprehensive document with:
- **Title and metadata** (based on first slide or inferred from content)
- **Table of contents** or overview section
- **Major sections** corresponding to slide groups/topics
- **Subsections** for detailed concepts
- **Code examples** properly formatted
- **Conclusion** synthesizing key takeaways
- **References** to sources mentioned in slides

### 6. Error Handling and Quality Assurance
- **Mandatory markers** for unparsable slides: `<SLIDE X WAS NOT PROCESSED AUTOMATICALLY>`
- **Verification** that all slides are accounted for in final text
- **Cross-references** between related concepts across slides
- **Consistency checks** for terminology and style
- **Completeness validation** ensuring no slide content is missed

### 7. Output Generation
- Write content to the specified output path **after each batch of 10 slides**
- Ensure proper markdown formatting
- Include metadata about source slides and processing date
- Verify the document is readable and well-structured
- **INCREMENTAL WRITING**: Append each batch's content to the output file to prevent data loss and enable resumption

## Example Usage

```
/reverse-engineer-slidedeck slide_folder:c:/tmp/slides output_document:projects/reverse-engineered-text.md
```

## Important Notes

- **Completeness is critical**: Every slide must be processed or marked as unparsable
- **Preserve slide order**: Maintain the logical flow from slide progression  
- **Extract ALL content**: Don't summarize - capture the full richness of each slide
- **Use Jo's style**: Conversational, practical, with concrete examples and linked concepts
- **Handle errors gracefully**: Mark unparsable slides clearly for manual review
- **Verify totals**: Ensure slide count matches between source and processed content

## Processing Workflow

1. **Discover slides**: List and count all PNG files
2. **Process in batches**: Read slides 1-10, 11-20, 21-30, etc. in batches of 10
3. **Extract content**: Pull text, code, concepts, and visual information for each batch
4. **Transform style**: Convert to Jo's writing style with proper structure
5. **Link concepts**: Add [[concept]] links for interconnected ideas
6. **Mark errors**: Add markers for unparsable slides
7. **Write batch output**: Append each batch's content to output file immediately
8. **Resume capability**: If interrupted, can resume from next batch
9. **Validate completeness**: Verify all slides are accounted for in final document

## Success Criteria

- All slides processed (either converted to text or marked as unparsable)
- Content flows logically following slide progression
- Defined writing style consistently applied
- Proper markdown formatting with headings, code blocks, and links
- Complete document written to specified output path
- Any processing errors clearly marked for manual review

The goal is to create a comprehensive, well-structured document that captures the full content and learning journey of the original slide deck while making it accessible as flowing prose in the provided distinctive writing style.