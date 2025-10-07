# λ docker compose up --build -d
import chromadb

def main():
    """chromadb hello world"""
    print("Main started")
    chroma_client = chromadb.HttpClient(host='localhost', port=8000)

    collection = chroma_client.get_or_create_collection(name="notes")

    collection.add(
        ids=["id1", "id2"],
        documents=[
            "This is a document about pineapple",
            "This is a document about oranges"
        ]
    )

    results = collection.query(
        query_texts=["This is a query document about hawaii"], # Chroma will embed this for you
        n_results=2 # how many results to return
    )
    print(results)


    print("Main ended")

if __name__ == "__main__":
    main()