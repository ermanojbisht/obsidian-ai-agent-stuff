## Repository Architecture

This is a multi-project repository focused on Obsidian AI agent integrations and semantic search capabilities. 

### Core Projects

 **Semantic Search System** (`semantic-search/`)
   - **ChromaDB Backend** (`chroma/`): Vector database for semantic search using ChromaDB
   - **Context Fetcher Plugin** (`context-fetcher-plugin/`): Obsidian plugin for retrieving contextually relevant notes

# Semantic Search Implementation Plan

Semantic search project for the Obsidian vault at `/home/manoj/learning_vault/`. but may be applied for any vault by plugin config page

- [x] **Step 1: Start ChromaDB Server**
  - [x] Navigate to the `semantic-search/chroma` directory.
  - [x] Run `docker compose up --build -d` to start the ChromaDB server in the background.
  - [x] Verify that the server is running by checking `docker ps`.
  - [x] It has some python file for doing process a desired and checking also

- [x] **Step 2: Index Your Vault**
  - [x] Modify the `reindex.py` script to point to your vault's location.
  - [x] Install the required Python dependencies.
  - [x] Run the `reindex.py` script to index your notes.

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
- **`os.fsync(sys.stdout.fileno())` Incompatibility:** Attempting to use `os.fsync(sys.stdout.fileno())` for aggressive `stdout` flushing in the Python script resulted in an `OSError: [Errno 22] Invalid argument` when executed by the Node.js plugin. This indicates that `sys.stdout` is not connected to a valid file descriptor in the plugin's execution environment, and `os.fsync` should not be used in this context.
- **Python Subprocess Output Handling:** We encountered `SyntaxError: Unexpected non-whitespace character after JSON` when parsing Python script output in Node.js. This was due to Python scripts printing multiple JSON objects (debug messages) to `stdout` before the final result. The solution was to ensure Python scripts print *only* the final, single JSON response to `stdout`, directing all intermediate/debug messages to `stderr`.

Now need to build plugin 'context-fetcher-plugin' 
Navigate to the `context-fetcher-plugin` directory.

- [x] **Step 1: 4 pyhton files should be created to do tasks through plugin**
  - [x] `generate_embedding.py` — Converts query text into vector embeddings.
  - [x] `chroma_query.py` — Queries ChromaDB for similar embeddings.
  - [x] `manage_index.py` — Indexes or clears ChromaDB collections.
  - [x] `get_doc_count.py` — Returns the total document count in Chroma.
  
- [x] **Step 2: 2 services ChromaDBService.ts, ContextFetcherService.ts**
- [x] **Step 3: ContextFetcherView.ts **
- [x] **Step 4: main.ts  **

**Current Status: Plugin Integration Issue Resolved**
The previous issue with `SyntaxError: Unexpected end of JSON input` has been resolved by modifying the Python scripts to output only a single, final JSON object to `stdout`, with all debug information directed to `stderr`. This allows the Node.js plugin to correctly parse the Python script's output.

plz follow developer guide given at developer_guide.md.
Some Files and Code is already created but need to be checked wether it's working as intended or not . if any rectification needed then rectify it or rebuild it.


At each successfull build copy plugin files to /home/manoj/learning_vault/.obsidian/plugins/context-fetcher-plugin to test things .

do not touch other folder in repo as they are not required for current task.


if u are in folder 
/media/manoj/datadisk_linux/obsidian-ai-agent-stuff/semantic-search/context-fetcher-plugin/python

1- All Files in vault

python3 manage_index.py index /home/manoj/learning_vault/  /home/manoj/learning_vault/ --host localhost --port 8000 --collection notes 

2- Files in desired Folder

python3 manage_index.py index /home/manoj/learning_vault/  /home/manoj/learning_vault/ --host localhost --port 8000 --collection notes --folders "learnings,My Daily Notes"

3- Particular file

python3 manage_index.py index /home/manoj/learning_vault/Ampri.md /home/manoj/learning_vault/ --host localhost --port 8000 --collection notes 

otherwise use 
/media/manoj/datadisk_linux/obsidian-ai-agent-stuff/semantic-search/context-fetcher-plugin/python/manage_index.py instead of manage_index.py