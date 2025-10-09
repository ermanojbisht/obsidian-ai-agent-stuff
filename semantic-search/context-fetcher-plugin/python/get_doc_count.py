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
    # Create an argument parser to handle command-line arguments.
    parser = argparse.ArgumentParser(description="Get the number of documents in a ChromaDB collection.")
    parser.add_argument("--host", type=str, default="localhost", help="The ChromaDB host.")
    parser.add_argument("--port", type=int, default=8000, help="The ChromaDB port.")
    parser.add_argument("--collection", type=str, default="notes", help="The ChromaDB collection name.")
    args = parser.parse_args()

    # Log the arguments to stderr for debugging purposes.
    sys.stderr.write(f"Arguments: {args}\n")

    try:
        # Connect to the ChromaDB server using the provided host and port.
        client = chromadb.HttpClient(host=args.host, port=args.port)
        # Get the specified collection.
        collection = client.get_collection(name=args.collection)
        
        # Get the total number of documents in the collection.
        total_documents = collection.count()

        # Log the total number of documents to stderr.
        sys.stderr.write(f"Total documents: {total_documents}\n")
        
        # Construct a success response with the total document count.
        response = {
            "success": True,
            "total_documents": total_documents
        }
        
    except Exception as e:
        # Log any errors to stderr.
        sys.stderr.write(f"Error: {e}\n")
        
        # Construct an error response.
        response = {
            "success": False,
            "error": str(e)
        }
    
    # Output the JSON response to stdout. This is the only output to stdout.
    print(json.dumps(response, ensure_ascii=False))

if __name__ == "__main__":
    main()
