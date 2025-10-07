# CLAUDE.md

## Repository Architecture

This is a multi-project repository focused on Obsidian AI agent integrations and semantic search capabilities. 

### Core Projects

 **Semantic Search System** (`semantic-search/`)
   - **ChromaDB Backend** (`chroma/`): Vector database for semantic search using ChromaDB
   - **Context Fetcher Plugin** (`context-fetcher-plugin/`): Obsidian plugin for retrieving contextually relevant notes

# Semantic Search Implementation Plan

This plan outlines the steps to implement the semantic search project for the Obsidian vault at `/home/manoj/learning_vault/`.

- [x] **Step 1: Start ChromaDB Server**
  - [x] Navigate to the `semantic-search/chroma` directory.
  - [x] Run `docker compose up --build -d` to start the ChromaDB server in the background.
  - [x] Verify that the server is running by checking `docker ps`.

- [x] **Step 2: Index Your Vault**
  - [x] Modify the `reindex.py` script to point to your vault's location.
  - [x] Install the required Python dependencies.
  - [x] Run the `reindex.py` script to index your notes.

## Phase 1: Input Box Search (Done)

- [x] **Update the Plugin View:** Add an input box, a "Search" button, and a "Clear" button to the `ContextFetcherView`.
- [x] **Update the Plugin Logic:** Implement the logic to perform a search based on the user's query.
- [x] **Update the Plugin Settings:** Add a new setting to configure the number of search results to return.

## Phase 2: In-Plugin Indexing (Up Next)

- [x] **Create a New Python Script:** Create a new Python script named `manage_index.py` that can index a single file, index all files in a folder, and clear the entire collection.
- [x] **Update the Plugin View:** Add a new "Indexing" section to the `ContextFetcherView` with buttons for "Re-index All", "Index Current Note", and "Index Folder".
- [x] **Update the Plugin Logic:** Implement the logic to call the `manage_index.py` script with the appropriate arguments.
- [x] **Update the Plugin Settings:** Add a new section to the plugin settings page for configuring the indexing settings.

## Folders to Index

The following folders in the vault will be indexed:

- `learnings`
- `Meetings`
- `My Daily Notes`
- `my_prompts`
- `PWD`

## Learnings

- **Docker Configuration:** We encountered issues with Docker file sharing, which prevented the ChromaDB server from starting. We learned that it's important to either configure Docker's file sharing settings or to modify the `docker-compose.yml` file to remove services that require access to local files.
- **Python Dependencies:** We faced significant challenges with Python dependencies, including version conflicts between `chromadb` and `pydantic`, and missing system dependencies like `python3-dev`. We learned that it's crucial to use compatible versions of all libraries.
- **ChromaDB Stability:** We discovered a bug in the version of ChromaDB we were using, which caused the server to crash. We learned that it's important to use a stable, well-tested version of the database.
- **Shell Scripting:** We found that using shell scripts to create large JSON payloads is not reliable and can lead to errors like "Argument list too long". We learned that using a more robust language like Python is better for this kind of task.
- **`onnxruntime` is a problematic dependency.** It's very noisy and difficult to suppress its warnings. It's better to avoid it if possible.
- **The `sentence-transformers` library is a good alternative for generating embeddings.** It's easy to use and doesn't have the same issues as `onnxruntime`.
- **It's important to be careful with Python indentation.** A single misplaced space can cause a `SyntaxError`.
- **It's important to import all the necessary modules.** A missing `import` statement can cause a `NameError`.

## Features

*   **Input Box Search:** Added an input box and a "Search" button to the "Semantic Context Fetcher" view to allow for free-text searching.
*   **"Use Current Note" Button:** Added a button to use the currently open note as the context for a search.
*   **"Clear" Button:** Added a button to clear the search results.
*   **In-Plugin Indexing:** Added buttons to the "Semantic Context Fetcher" view to allow for in-plugin indexing.
    *   **"Re-index All":** Clears the index and re-indexes all the notes in the folders specified in the settings.
    *   **"Index Current Note":** Indexes the currently open note.
    *   **"Index Folder":** Indexes all the notes in a specified folder.
*   **Index Status:** Added a section to the "Semantic Context Fetcher" view to display the total number of indexed documents and the last indexing date.
*   **"Refresh" Button:** Added a button to the "Index Status" section to manually update the document count.

## Bug Fixes

*   Fixed an issue where the "Clear" button was fetching the context for the current note instead of clearing the search results.
*   Fixed an issue where the `totalDocuments` variable was not being updated correctly.
*   Fixed a number of syntax errors and other bugs in the `main.ts` and Python scripts.