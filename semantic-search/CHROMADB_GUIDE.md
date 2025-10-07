# ChromaDB Docker Guide

This guide provides instructions on how to run and troubleshoot the ChromaDB Docker container.

## Starting the ChromaDB Server

1.  Open a terminal and navigate to the `semantic-search/chroma` directory.
2.  Run the following command to start the ChromaDB server in the background:

    ```bash
    docker compose up --build -d
    ```

## Checking the Server Status

To check if the server is running, you can use the following commands:

*   **`docker ps`**: This command lists all the running Docker containers. You should see a container with a name similar to `chroma-server-1` in the output.
*   **`docker compose logs`**: This command shows the logs for the ChromaDB server. This is useful for checking if the server has started correctly and for debugging any issues.

## Stopping the Server

To stop the ChromaDB server, run the following command in the `semantic-search/chroma` directory:

```bash
docker compose down
```

## Checking if ChromaDB has Data

To quickly check if your ChromaDB collection has data, you can use the `query_chroma.py` script we created earlier. You can run it from your terminal like this:

```bash
python3 /media/manoj/datadisk_linux/obsidian-ai-agent-stuff/semantic-search/chroma/query_chroma.py
```

This will query the database for the word "the" and print the results. If the command returns a list of documents, then the collection has data.


curl -X POST -H "Content-Type: application/json" -d '{"query_texts": ["the"], "n_results": 1}' http://localhost:8000/api/v1/collections/notes/query 