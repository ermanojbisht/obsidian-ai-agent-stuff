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
        if "text" not in request:
            raise Exception("Missing required field: text")
        
        # Generate embeddings
        model = SentenceTransformer('all-MiniLM-L6-v2')
        embeddings = model.encode([request["text"]])
        
        # Return success response
        response = {
            "success": True,
            "embeddings": embeddings.tolist()
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
