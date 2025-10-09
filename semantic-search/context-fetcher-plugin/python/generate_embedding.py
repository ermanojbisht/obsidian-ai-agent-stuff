#!/usr/bin/env python3
"""
Generate embeddings for a given text.
"""

import sys
import json
from sentence_transformers import SentenceTransformer

def main():
    """Main function that handles stdin/stdout communication."""
    try:
        # Read the entire input from stdin, which is expected to be a JSON string.
        input_data = sys.stdin.read().strip()
        if not input_data:
            raise Exception("No input provided")
        
        # Attempt to parse the input string as JSON.
        try:
            request = json.loads(input_data)
        except json.JSONDecodeError as e:
            raise Exception(f"Invalid JSON input: {e}")
        
        # Ensure the 'text' field is present in the JSON request.
        if "text" not in request:
            raise Exception("Missing required field: text")
        
        # Initialize the SentenceTransformer model for embedding generation.
        model = SentenceTransformer('all-MiniLM-L6-v2')
        # Encode the provided text into vector embeddings.
        embeddings = model.encode([request["text"]])
        
        # Construct a success response with the generated embeddings.
        response = {
            "success": True,
            "embeddings": embeddings.tolist() # Convert numpy array to a list for JSON serialization.
        }
        
    except Exception as e:
        # If any error occurs, construct an error response.
        response = {
            "success": False,
            "error": str(e)
        }
    
    # Output the JSON response to stdout. This is the only output to stdout.
    print(json.dumps(response, ensure_ascii=False))

if __name__ == "__main__":
    main()
