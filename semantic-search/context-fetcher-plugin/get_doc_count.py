#!/usr/bin/env python3
"""
Get the number of documents in a ChromaDB collection.
"""

import sys
import json
import chromadb
import argparse

def main():
    """Main function that handles stdin/stdout communication."""
    parser = argparse.ArgumentParser(description="Get the number of documents in a ChromaDB collection.")
    parser.add_argument("--host", type=str, default="localhost", help="The ChromaDB host.")
    parser.add_argument("--port", type=int, default=8000, help="The ChromaDB port.")
    parser.add_argument("--collection", type=str, default="notes", help="The ChromaDB collection name.")
    args = parser.parse_args()

    # Log the arguments
    with open("/tmp/get_doc_count.log", "a") as f:
        f.write(f"Arguments: {args}\n")

    try:
        # Connect to ChromaDB
        client = chromadb.HttpClient(host=args.host, port=args.port)
        collection = client.get_collection(name=args.collection)
        
        # Get the number of documents
        total_documents = collection.count()

        # Log the total number of documents
        with open("/tmp/get_doc_count.log", "a") as f:
            f.write(f"Total documents: {total_documents}\n")
        
        # Return success response
        response = {
            "success": True,
            "total_documents": total_documents
        }
        
    except Exception as e:
        # Log the error
        with open("/tmp/get_doc_count.log", "a") as f:
            f.write(f"Error: {e}\n")
        
        # Return error response
        response = {
            "success": False,
            "error": str(e)
        }
    
    # Output JSON response to stdout
    print(json.dumps(response, ensure_ascii=False))

if __name__ == "__main__":
    main()
