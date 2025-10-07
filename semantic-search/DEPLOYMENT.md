# Deployment Steps

This document outlines the steps to deploy the semantic search solution on a new system.

## 1. Install Docker

Docker is required to run the ChromaDB server. You can download and install Docker from the official website: [https://www.docker.com/get-started](https://www.docker.com/get-started)

## 2. Start the ChromaDB Server

1.  Copy the `semantic-search/chroma` directory to the new system.
2.  Open a terminal and navigate to the `semantic-search/chroma` directory.
3.  Run the following command to start the ChromaDB server:

    ```bash
    docker compose up --build -d
    ```

## 3. Install Python and Dependencies

1.  Install Python 3 on the new system. You can download it from the official website: [https://www.python.org/downloads/](https://www.python.org/downloads/)
2.  Open a terminal and navigate to the `semantic-search/chroma` directory.
3.  Run the following command to install the required Python dependencies:

    ```bash
    pip install -r requirements.txt
    ```

## 4. Index Your Vault

1.  Open a terminal and navigate to the `semantic-search/chroma` directory.
2.  Run the `index_vault.py` script with the path to your vault and the folders you want to index. For example:

    ```bash
    python3 index_vault.py /path/to/your/vault learnings Meetings "My Daily Notes" my_prompts PWD
    ```

## 5. Install and Configure the Obsidian Plugin

1.  Copy the `context-fetcher-plugin` directory to the plugins directory of your Obsidian vault on the new system. The plugins directory is usually located at `YourVault/.obsidian/plugins/`.
2.  Restart Obsidian.
3.  Go to **Settings > Community plugins** and enable the "LLM-based Context Fetcher Plugin".
4.  Go to the plugin settings and set the "Python Path" to the path of your Python 3 executable.
