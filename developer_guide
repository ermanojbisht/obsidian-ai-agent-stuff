# Semantic Context Fetcher Plugin — Developer Guide

## 1. Overview

The **Semantic Context Fetcher** plugin for Obsidian enhances the note-taking workflow by providing AI-powered semantic search and contextual retrieval from a Chroma vector database. It integrates local notes with external semantic search capabilities using Python helper scripts for embeddings and database management.

The plugin allows users to:

* Fetch semantically related context from other notes.
* Reindex notes/folders to update vector embeddings.
* View progress and document statistics.
* Configure Python and ChromaDB parameters via settings.

---

## 2. System Requirements

### **Software Dependencies**

| Component  | Version / Recommendation | Purpose                                   |
| ---------- | ------------------------ | ----------------------------------------- |
| Obsidian   | v1.8.0+                  | Target app for the plugin                 |
| Node.js    | v18 or later             | Required for plugin development and build |
| TypeScript | v4.7+                    | For type-safe plugin development          |
| Python     | v3.9+                    | To run embedding and Chroma scripts       |
| ChromaDB   | Latest                   | Vector database for semantic search       |

### **Python Scripts Required**

These Python files must be present in the plugin directory:

1. `generate_embedding.py` — Converts query text into vector embeddings.
2. `chroma_query.py` — Queries ChromaDB for similar embeddings.
3. `manage_index.py` — Indexes or clears ChromaDB collections.
4. `get_doc_count.py` — Returns the total document count in Chroma.

Each script communicates via `stdout` in JSON format, emitting progress and completion data.

---

## 3. Plugin Architecture

### **Core Components**

1. **ChromaDBService**

   * Handles Python script execution and output parsing.
   * Runs queries, indexing, and embedding generation.
   * Returns structured JSON objects to the UI.

2. **ContextFetcherService**

   * Wraps ChromaDBService and simplifies communication between UI and service layer.
   * Manages app context, loading indicators, and update callbacks.

3. **ContextFetcherView**

   * Custom Obsidian `ItemView` that displays search results and progress.
   * Includes UI controls like search box, fetch buttons, and indexing tools.

4. **ContextFetcherPlugin**

   * Main plugin class registered by Obsidian.
   * Loads settings, registers commands, and manages view lifecycle.

5. **SettingsTab**

   * Manages plugin configuration inside Obsidian settings.

---

## 4. Plugin Settings

### **Configuration Parameters**

| Setting                | Default Value                                                      | Description                                     |
| ---------------------- | ------------------------------------------------------------------ | ----------------------------------------------- |
| `chromaHost`           | `localhost`                                                        | Hostname or IP of the Chroma server.            |
| `chromaPort`           | `8000`                                                             | Port number for Chroma API.                     |
| `chromaCollectionName` | `notes`                                                            | Collection name used for embeddings.            |
| `pythonPath`           | `/usr/bin/python3`                                                 | Path to Python executable.                      |
| `searchMaxResults`     | `10`                                                               | Number of top results to return for each query. |
| `foldersToIndex`       | `["learnings", "Meetings", "My Daily Notes", "my_prompts", "PWD"]` | Default folders to include in indexing.         |
| `totalDocuments`       | `0`                                                                | Stores total indexed document count.            |

### **Settings Tab Layout**

* **Chroma Host** — text input.
* **Chroma Port** — numeric input.
* **Collection Name** — text input.
* **Python Path** — text input.
* **Search Max Results** — numeric input.
* **Folders to Index** — multiline textarea (comma-separated folder names).
* **Total Documents (read-only)** — displayed automatically after indexing.

---

## 5. User Interface & Buttons

### **Indexing Controls**

| Button                 | Action                                                            | Description                                |
| ---------------------- | ----------------------------------------------------------------- | ------------------------------------------ |
| **Reindex All**        | Runs `manage_index.py clear` then indexes all configured folders. | Updates all embeddings.                    |
| **Index Current Note** | Indexes only the active note.                                     | Runs `manage_index.py index <filepath>`.   |
| **Index Folder**       | Indexes a selected folder.may be current note folder              | Runs `manage_index.py index <folderpath>`. |

Each indexing operation provides **progress feedback** via JSON messages printed by the Python script (`status: progress`).

### **Main View Buttons**

| Button               | Action                                          | Description                                            |
| -------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| **Search**           | Executes a semantic search based on input text. | Calls `searchSimilarContent()` with query text.        |
| **Clear**            | Clears search results.                          | Resets view state.                                     |
| **Use Current Note** | Fetches semantic context for the active note.   | Sends note content to Python embedding + Chroma query. |
| **Refresh**          | Reloads view and settings.                      | Refreshes UI state and document count.                 |
---

## 6. Data Flow

```mermaid
graph TD
A[User Action] --> B[ContextFetcherView]
B --> C[ContextFetcherService]
C --> D[ChromaDBService]
D --> E[Python Script]
E --> D2[stdout JSON]
D2 --> C2[Processed Results]
C2 --> B2[UI Render]
```

**Sequence Summary:**

1. User clicks a button or types a query.
2. View calls `ContextFetcherService.fetchContext()` or `searchQuery()`.
3. Wrapper invokes `ChromaDBService.runPythonScript()`.
4. Python script executes and streams progress via stdout.
5. ChromaDBService parses the progress messages and final JSON.
6. The UI updates in real-time and renders the resulting context list.

---

## 7. Developer Setup

### **Clone and Install**

```bash
git clone <repo-url>
cd context-fetcher-plugin
npm install
```

### **Project Structure**

```
context-fetcher-plugin/
├── manifest.json
├── main.js (generated build)
├── package.json
├── esbuild.config.mjs
├── main.ts
├── ContextFetcherView.ts
├── services/
│   ├── ChromaDBService.ts
│   └── ContextFetcherService.ts
├── python/
│   ├── generate_embedding.py
│   ├── chroma_query.py
│   ├── manage_index.py
│   └── get_doc_count.py
```

### **Build Command**

```bash
npm run build
```

This executes:

```bash
tsc -noEmit -skipLibCheck && node esbuild.config.mjs production
```

### **Debugging**

* Use `console.log` and `Notice()` for runtime debugging.
* Run Obsidian in Developer Mode → View → Developer Console.

---

## 8. Integration with Chroma & Python

Each Python helper script must follow this communication protocol:

* Send progress updates: `{"status": "progress", "processed": <n>, "total": <m>}`
* Send completion: `{"status": "complete", "result": { ... }}`
* Final JSON output is printed to stdout without extra logging.

Example output for `get_doc_count.py`:

```json
{"status": "progress", "processed": 0, "total": 100}
{"status": "complete", "total_documents": 245}
```

---

## 9. Plugin Commands

| Command                            | Description                                        |
| ---------------------------------- | -------------------------------------------------- |
| **Fetch Context for Current Note** | Fetches semantic results related to the open note. |
| **Open Context Fetcher View**      | Opens the plugin side panel.                       |
| **Reindex All Notes**              | Clears and rebuilds ChromaDB index.                |
| **Index Current Note**             | Indexes the note currently open in the editor.     |

---

## 10. Error Handling

* Python script failure → shows `Notice("Error: ...")`.
* JSON parse errors → logged to console.
* Network errors (Chroma connection) → user notification + safe fallback.
* Missing Python executable → prompt to update `pythonPath` in settings.

---

## 11. Future Enhancements

* Add support for **OpenAI** or **Local LLM** embedding generation.
* Batch index scheduler.
* Automatic refresh after save events.
* Support for multiple Chroma collections.

---

## 12. Summary

This plugin bridges Obsidian with semantic AI tools using a local Python–Chroma pipeline. It provides a practical, privacy-respecting alternative to cloud AI search by embedding and querying local notes.

The modular TypeScript structure (`ChromaDBService`, `ContextFetcherService`, `ContextFetcherView`) ensures easy maintainability and extension by any developer.
