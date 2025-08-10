import chromadb
import sys

def main():
    """Clear a chromadb collection by name (default: 'notes')
    
    Usage:
        python .\scripts\chroma\clear-collection.py         # clears 'notes'
        python .\scripts\chroma\clear-collection.py mycoll  # clears 'mycoll'
    """
    collection_name = sys.argv[1] if len(sys.argv) > 1 else "notes"
    print(f"Clearing collection: {collection_name}")
    chroma_client = chromadb.HttpClient(host='localhost', port=8000)
    collection = chroma_client.get_or_create_collection(name=collection_name)
    # Remove all documents in the collection
    # ChromaDB does not have a direct 'clear' method, so we fetch all ids and delete them
    all_ids = collection.get()['ids']
    if all_ids:
        collection.delete(ids=all_ids)
        print(f"Deleted {len(all_ids)} documents from collection '{collection_name}'")
    else:
        print(f"Collection '{collection_name}' is already empty.")
    print("Done.")

if __name__ == "__main__":
    main()
