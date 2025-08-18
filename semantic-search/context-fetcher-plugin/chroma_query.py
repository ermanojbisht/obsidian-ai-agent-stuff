#!/usr/bin/env python3
"""
ChromaDB Query Script for Obsidian Context Fetcher Plugin

This script accepts JSON input via stdin and returns JSON output via stdout.
It connects to ChromaDB and performs queries based on the input parameters.

Input JSON format:
{
    "action": "query",
    "host": "localhost",
    "port": 8000,
    "collection_name": "notes",
    "query_text": "search text",
    "n_results": 5
}

Output JSON format:
{
    "success": true,
    "results": [
        {
            "id": "doc_id",
            "document": "document content",
            "metadata": {...},
            "distance": 0.5
        }
    ]
}

Or on error:
{
    "success": false,
    "error": "error message"
}
"""

import sys
import json
import chromadb
from typing import Dict, Any, List
import io

# Ensure both stdin and stdout use UTF-8 encoding to handle Unicode characters properly
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')


def connect_to_chroma(host: str, port: int) -> chromadb.HttpClient:
    """Connect to ChromaDB server."""
    try:
        client = chromadb.HttpClient(host=host, port=port)
        client.heartbeat()  # Test connection
        return client
    except Exception as e:
        raise Exception(f"Failed to connect to ChromaDB at {host}:{port}: {e}")


def query_collection(client: chromadb.HttpClient, collection_name: str, query_text: str, n_results: int) -> List[Dict[str, Any]]:
    """Query the ChromaDB collection."""
    try:
        collection = client.get_collection(name=collection_name)
        
        results = collection.query(
            query_texts=[query_text],
            n_results=n_results,
            include=["documents", "metadatas", "distances"]
        )
        
        # Transform results into a more convenient format
        formatted_results = []
        if results['ids'] and len(results['ids']) > 0:
            for i in range(len(results['ids'][0])):
                formatted_results.append({
                    "id": results['ids'][0][i],
                    "document": results['documents'][0][i] if results['documents'] else "",
                    "metadata": results['metadatas'][0][i] if results['metadatas'] else {},
                    "distance": results['distances'][0][i] if results['distances'] else 0.0
                })
        
        return formatted_results
        
    except Exception as e:
        raise Exception(f"Query failed: {e}")


def main():
    """Main function that handles stdin/stdout communication."""
    try:
        # Read input from stdin
        input_data = sys.stdin.read().strip()
        if not input_data:
            raise Exception("No input provided")
        
        # Parse JSON input
        try:
            request = json.loads(input_data)
        except json.JSONDecodeError as e:
            raise Exception(f"Invalid JSON input: {e}")
        
        # Validate required fields
        required_fields = ["action", "host", "port", "collection_name", "query_text", "n_results"]
        for field in required_fields:
            if field not in request:
                raise Exception(f"Missing required field: {field}")
        
        if request["action"] != "query":
            raise Exception(f"Unsupported action: {request['action']}")
        
        # Connect to ChromaDB
        client = connect_to_chroma(request["host"], request["port"])
        
        # Perform query
        results = query_collection(
            client,
            request["collection_name"],
            request["query_text"],
            request["n_results"]
        )
        
        # Return success response
        response = {
            "success": True,
            "results": results
        }
        
    except Exception as e:
        # Return error response
        response = {
            "success": False,
            "error": str(e)
        }
    
    # Output JSON response to stdout
    print(json.dumps(response, ensure_ascii=False))


if __name__ == "__main__":
    main()