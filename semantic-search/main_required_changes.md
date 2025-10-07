# main.ts Required Changes

This document outlines the required changes to the `main.ts` file to implement the new features.

## Phase 1: Input Box Search

1.  **Add `fetchContextForQuery` function:** Add a new function to the `ChromaContextPlugin` class that takes a query string as input and fetches the context for that query.
2.  **Update `ContextView`:**
    *   Add an input box, a "Search" button, a "Clear" button, and a "Use Current Note" button to the view.
    *   Add event listeners for the new buttons.

## Phase 2: In-Plugin Indexing

1.  **Add new settings:**
    *   Add a `foldersToIndex` array to the `ChromaPluginSettings` interface.
    *   Add a `totalDocuments` number to the `ChromaPluginSettings` interface.
    *   Update the `DEFAULT_SETTINGS` object with the new settings.
2.  **Add new functions to `ChromaContextPlugin`:**
    *   `reindexAll`: Clears the index and then re-indexes all the notes in the folders specified in the settings.
    *   `indexCurrentNote`: Indexes the currently open note.
    *   `indexFolder`: Indexes all the notes in a specified folder.
    *   `updateDocCount`: Gets the total number of documents in the index and updates the settings.
3.  **Update `ContextView`:**
    *   Add an "Indexing" section with buttons for "Re-index All", "Index Current Note", and "Index Folder".
    *   Add an "Index Status" section to display the total number of indexed documents and the last indexing date.
    *   Add a `updateProgress` function to display the progress of the indexing process.
4.  **Update `ChromaSettingTab`:**
    *   Add a text area for the `foldersToIndex` setting.
    *   Add a read-only text field for the `totalDocuments` setting.

## Phase 3: Code Cleanup

1.  **Remove unused code:** Remove any unused code from the `main.ts` file.
2.  **Add comments:** Add comments to the code to explain what it does.