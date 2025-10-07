#!/usr/bin/env python3
"""
Query the ChromaDB collection.
"""

import chromadb
from sentence_transformers import SentenceTransformer

def main():
    """Query the ChromaDB collection."""
    print("Main started")
    client = chromadb.HttpClient(host="localhost", port=8000)
    collection = client.get_collection(name="notes")

    model = SentenceTransformer('all-MiniLM-L6-v2')
    query_embeddings = model.encode(["pooja"])

    results = collection.query(
        #query_texts=["pooja"],
        query_embeddings=query_embeddings.tolist(),
        n_results=1
    )

    print(results)

    print("Main ended")

if __name__ == "__main__":
    main()
