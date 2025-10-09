# Obsidian AI Agent Integrations and Semantic Search

This repository houses a collection of projects focused on enhancing Obsidian with AI agent integrations and advanced semantic search capabilities. The goal is to provide tools and plugins that allow users to leverage AI for better knowledge management and contextual retrieval within their Obsidian vaults.

## Repository Architecture

This is a multi-project repository with the following core components:

### 1. Semantic Search System (`semantic-search/`)

This system provides a robust semantic search engine for your Obsidian vault, allowing you to find contextually relevant notes beyond simple keyword matching.

*   **ChromaDB Backend** (`semantic-search/chroma/`):
    *   A vector database powered by ChromaDB, used to store embeddings of your Obsidian notes.
    *   Enables efficient similarity searches to retrieve notes based on their meaning.
*   **Context Fetcher Plugin** (`semantic-search/context-fetcher-plugin/`):
    *   An Obsidian plugin that integrates with the ChromaDB backend.
    *   Provides a user interface within Obsidian to trigger indexing, search for contextually relevant notes, and display results.

### 2. Quizmaster (`quizmaster/`)

(Details about the Quizmaster project will be added here as it develops. Currently, it contains a basic quiz application.)

*   **Quiz App** (`quizmaster/quiz-app/`): A simple web-based quiz application.

### File Structure

```
.
├── developer_guide.md
├── GEMINI.md
├── LICENSE
├── quizmaster
│   ├── .claude
│   │   └── commands
│   │       └── generate-quiz.md
│   └── quiz-app
│       ├── index.html
│       ├── quiz-engine.js
│       ├── README.md
│       └── styles.css
├── README.md
├── reverse-engineer-slidedeck
│   └── .claude
│       └── commands
│           └── reverse-engineer-slidedeck.md
└── semantic-search
    ├── CHROMADB_GUIDE.md
    ├── chroma
    │   ├── clear-collection.py
    │   ├── docker-compose.yml
    │   ├── get_doc_count.py
    │   ├── index_vault.py
    │   ├── otel-collector-config.yaml
    │   ├── query_chroma.py
    │   ├── reindex.py
    │   ├── requirements.txt
    │   ├── test_chromadb.py
    │   └── test_connection.py
    ├── context-fetcher-plugin
    │   ├── .editorconfig
    │   ├── .eslintignore
    │   ├── .eslintrc
    │   ├── .npmrc
    │   ├── ContextFetcherView.ts
    │   ├── esbuild.config.mjs
    │   ├── LICENSE
    │   ├── main.js
    │   ├── main.ts
    │   ├── manifest.json
    │   ├── package-lock.json
    │   ├── package.json
    │   ├── python
    │   │   ├── chroma_query.py
    │   │   ├── generate_embedding.py
    │   │   ├── get_doc_count.py
    │   │   ├── manage_index.py
    │   │   └── test_python.py
    │   ├── README.md
    │   ├── services
    │   │   ├── ChromaDBService.ts
    │   │   └── ContextFetcherService.ts
    │   ├── styles.css
    │   ├── tsconfig.json
    │   ├── version-bump.mjs
    │   └── versions.json
    ├── DEPLOYMENT.md
    ├── final_plugin
    │   └── context-fetcher-plugin
    │       ├── chroma_query.py
    │       ├── data.json
    │       ├── generate_embedding.py
    │       ├── get_doc_count.py
    │       ├── main.js
    │       ├── main.zip
    │       ├── manage_index.py
    │       ├── manifest.json
    │       └── styles.css
    └── main_required_changes.md
```

## Semantic Search Implementation Plan

This section outlines the steps to set up and utilize the semantic search system for your Obsidian vault. The instructions are tailored for a vault located at `/home/manoj/learning_vault/`, but can be adapted for any vault by configuring the plugin settings.

### Step 1: Start ChromaDB Server

1.  **Navigate to the ChromaDB directory:**
    ```bash
    cd semantic-search/chroma
    ```
2.  **Start the ChromaDB server using Docker Compose:**
    ```bash
    docker compose up --build -d
    ```
    This command builds the Docker image (if not already built) and starts the ChromaDB server in the background.
3.  **Verify the server is running:**
    ```bash
    docker ps
    ```
    You should see a container named `chroma-server` or similar running.

### Step 2: Index Your Vault

The Context Fetcher Plugin handles indexing your vault. Before using the plugin, ensure its Python dependencies are installed and the plugin is built and deployed.

#### Python Dependencies for Indexing Scripts

The Python scripts used by the plugin require specific libraries. It's recommended to use a virtual environment.

1.  **Navigate to the plugin's Python directory:**
    ```bash
    cd semantic-search/context-fetcher-plugin/python
    ```
2.  **Install Python dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
    (Note: A `requirements.txt` file should be created in this directory if it doesn't exist, listing `chromadb` and `sentence-transformers`.)

#### Building and Deploying the Obsidian Plugin

1.  **Navigate to the plugin directory:**
    ```bash
    cd semantic-search/context-fetcher-plugin
    ```
2.  **Install Node.js dependencies:**
    ```bash
    npm install
    ```
3.  **Build the plugin:**
    ```bash
    npm run build
    ```
4.  **Deploy the plugin to your Obsidian vault:**
    Copy the built plugin files (`main.js`, `manifest.json`, `styles.css`, and the `python` folder) to your Obsidian vault's plugin directory.
    ```bash
    cp main.js manifest.json styles.css /home/manoj/learning_vault/.obsidian/plugins/context-fetcher-plugin/
    cp -r python /home/manoj/learning_vault/.obsidian/plugins/context-fetcher-plugin/
    ```
    Ensure the target directory exists:
    ```bash
    mkdir -p /home/manoj/learning_vault/.obsidian/plugins/context-fetcher-plugin
    ```
5.  **Enable the plugin in Obsidian:** Open Obsidian, go to `Settings -> Community plugins`, and enable "Semantic Context Fetcher".

#### Indexing via Plugin UI

Once the plugin is enabled, you can use its UI within Obsidian to:
*   **Reindex All:** Clear existing indexes and reindex all configured folders.
*   **Index Current Note:** Index the currently active note.
*   **Index Folder:** Index a specific folder.
*   **Search:** Perform semantic searches.

### Folders to Index

The plugin is configured to index the following folders by default (configurable in plugin settings):

*   `learnings`
*   `Meetings`
*   `My Daily Notes`
*   `my_prompts`
*   `PWD`

### Direct Python Script Usage (for advanced users/debugging)

The Python scripts can also be run directly from the command line. Ensure you are in the `semantic-search/context-fetcher-plugin/python` directory or provide the full path to the scripts.

*   **Index all files in the vault:**
    ```bash
    python3 manage_index.py index /home/manoj/learning_vault/ /home/manoj/learning_vault/ --host localhost --port 8000 --collection notes
    ```
*   **Index files in desired folders:**
    ```bash
    python3 manage_index.py index /home/manoj/learning_vault/ /home/manoj/learning_vault/ --host localhost --port 8000 --collection notes --folders "learnings,My Daily Notes"
    ```
*   **Index a particular file:**
    ```bash
    python3 manage_index.py index /home/manoj/learning_vault/Ampri.md /home/manoj/learning_vault/ --host localhost --port 8000 --collection notes
    ```

## Learnings

Throughout the development of this project, several key learnings emerged:

*   **Docker Configuration:** Issues with Docker file sharing can prevent the ChromaDB server from starting. It's important to either configure Docker's file sharing settings or modify the `docker-compose.yml` file to remove services that require access to local files.
*   **Python Dependencies:** Version conflicts (e.g., between `chromadb` and `pydantic`) and missing system dependencies (like `python3-dev`) can cause significant challenges. Using compatible versions of all libraries is crucial.
*   **ChromaDB Stability:** Using a stable, well-tested version of ChromaDB is important, as early versions can have bugs that cause crashes.
*   **Shell Scripting Limitations:** Using shell scripts to create large JSON payloads is unreliable and can lead to errors like "Argument list too long". More robust languages like Python are better suited for such tasks.
*   **`onnxruntime` Dependency:** `onnxruntime` can be a noisy and problematic dependency. It's better to avoid it if possible.
*   **`sentence-transformers`:** The `sentence-transformers` library is a good and easy-to-use alternative for generating embeddings, without the issues associated with `onnxruntime`.
*   **`os.fsync(sys.stdout.fileno())` Incompatibility:** Attempting to use `os.fsync(sys.stdout.fileno())` for aggressive `stdout` flushing in Python scripts resulted in an `OSError: [Errno 22] Invalid argument` when executed by the Node.js plugin. This indicates that `sys.stdout` is not connected to a valid file descriptor in the plugin's execution environment, and `os.fsync` should not be used in this context.
*   **Python Subprocess Output Handling:** We encountered `SyntaxError: Unexpected non-whitespace character after JSON` when parsing Python script output in Node.js. This was due to Python scripts printing multiple JSON objects (debug messages) to `stdout` before the final result. The solution was to ensure Python scripts print *only* the final, single JSON response to `stdout`, directing all intermediate/debug messages to `stderr`.

## Developer Guide

For more in-depth development information, refer to the `developer_guide.md` file.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
