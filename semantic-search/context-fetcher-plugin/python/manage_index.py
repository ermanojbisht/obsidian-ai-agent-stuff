import os
import sys
import argparse
import json
from pathlib import Path
from typing import List, Dict, Tuple

# Configuration
BATCH_SIZE = 50
COLLECTION_NAME = "notes"
EMBEDDING_MODEL = "all-MiniLM-L6-v2" # Define the embedding model to use
DEBUG_FILE_PATH = "/tmp/manage_index_debug.log" # Temporary debug file

def log_debug_json(data):
    """Logs debug information to a file."""
    try:
        with open(DEBUG_FILE_PATH, "a") as f:
            f.write(json.dumps(data) + "\n")
            f.flush()
    except Exception as e:
        # Fallback if logging to file fails
        print(json.dumps({"status": "error", "message": f"Failed to write to debug log: {e}", "type": "DebugLogError", "success": False}))
        sys.stdout.flush()

try:
    import chromadb
    from sentence_transformers import SentenceTransformer
    from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
except ImportError as e:
    log_debug_json({"status": "error", "message": f"ImportError: {e}. Please ensure all Python dependencies are installed.", "type": "ImportError", "success": False})
    print(json.dumps({"status": "error", "message": f"ImportError: {e}. Please ensure all Python dependencies are installed.", "type": "ImportError", "success": False}))
    sys.stdout.flush()
    sys.exit(1)
except Exception as e:
    log_debug_json({"status": "error", "message": f"Unhandled exception during imports: {e}", "type": str(type(e).__name__), "success": False})
    print(json.dumps({"status": "error", "message": f"Unhandled exception during imports: {e}", "type": str(type(e).__name__), "success": False }))
    sys.stdout.flush()
    sys.exit(1)

def connect_to_chroma(host: str, port: int) -> chromadb.HttpClient:
    """Connect to ChromaDB server."""
    try:
        client = chromadb.HttpClient(host=host, port=port)
        client.heartbeat()  # Test connection
        return client
    except Exception as e:
        log_debug_json({"status": "error", "message": f"Failed to connect to ChromaDB: {e}", "type": "ChromaConnectionError", "success": False})
        print(json.dumps({"status": "error", "message": f"Failed to connect to ChromaDB: {e}", "type": "ChromaConnectionError", "success": False}))
        sys.stdout.flush()
        sys.exit(1)

def find_markdown_files(path: Path) -> List[Path]:
    """Find all markdown files in the specified path."""
    if path.is_file():
        return [path]
    elif path.is_dir():
        return list(path.glob("**/*.md"))
    else:
        return []

def read_file_content(file_path: Path) -> Tuple[str, str]:
    """
    Read file content and return (content, status).
    Status can be: 'success', 'empty', 'encoding_error'
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read().strip()
        
        if not content:
            return "", "empty"
        else:
            return content, "success"
    
    except UnicodeDecodeError:
        try:
            # Try with different encoding
            with open(file_path, 'r', encoding='latin-1') as f:
                content = f.read().strip()
            return content, "success"
        except Exception as e:
            log_debug_json({"status": "error", "message": f"Encoding error reading {file_path}: {e}", "type": "EncodingError", "success": False})
            print(f"Encoding error reading {file_path}: {e}") # Keep original print for now
            sys.stdout.flush() # Ensure this is flushed
            return "", "encoding_error"
    except Exception as e:
        log_debug_json({"status": "error", "message": f"Error reading {file_path}: {e}", "type": "FileReadError", "success": False})
        print(f"Error reading {file_path}: {e}") # Keep original print for now
        sys.stdout.flush() # Ensure this is flushed
        return "", "encoding_error"

def generate_document_id(file_path: Path, vault_path: Path) -> str:
    """Generate a document ID from the file path."""
    relative_path = file_path.relative_to(vault_path)
    doc_id = str(relative_path).replace('\\', '/').replace('.md', '')
    return doc_id

def process_files_into_batches(files: List[Path], vault_path: Path) -> Tuple[List[Dict], Dict]:
    """
    Process files and create batch data.
    Returns (batches, stats)
    """
    batches = []
    current_batch = {"documents": [], "ids": [], "metadatas": []}
    stats = {
        "total_files": len(files),
        "processed": 0,
        "empty": 0,
        "encoding_error": 0,
        "success": 0,
        "batches_created": 0
    }
    
    for file_path in files:
        content, status = read_file_content(file_path)
        stats[status] += 1
        
        if status == "success":
            doc_id = generate_document_id(file_path, vault_path)
            metadata = {
                "file_path": str(file_path),
                "relative_path": str(file_path.relative_to(vault_path)),
                "folder": file_path.parent.name,
                "filename": file_path.name
            }
            
            current_batch["documents"].append(content)
            current_batch["ids"].append(doc_id)
            current_batch["metadatas"].append(metadata)
            stats["processed"] += 1
            
            # Check if batch is full
            if len(current_batch["documents"]) >= BATCH_SIZE:
                batches.append(current_batch.copy())
                current_batch = {"documents": [], "ids": [], "metadatas": []}
                stats["batches_created"] += 1
    
    # Add remaining documents as final batch
    if current_batch["documents"]:
        batches.append(current_batch)
        stats["batches_created"] += 1
    
    return batches, stats

def get_or_create_collection(client, collection_name: str):
    """Get or create the Chroma collection."""
    try:
        embedding_function = SentenceTransformerEmbeddingFunction(model_name=EMBEDDING_MODEL)
        collection = client.get_or_create_collection(name=collection_name, embedding_function=embedding_function)
        return collection
    except Exception as e:
        log_debug_json({"status": "error", "message": f"Error creating/accessing collection: {e}", "type": "ChromaCollectionError", "success": False})
        print(json.dumps({"status": "error", "message": f"Error creating/accessing collection: {e}", "type": "ChromaCollectionError", "success": False}))
        sys.stdout.flush()
        sys.exit(1)

def upsert_batch_to_chroma(collection, batch: Dict) -> bool:
    """Upsert a single batch directly to Chroma."""
    try:
        collection.upsert(
            ids=batch["ids"],
            documents=batch["documents"],
            metadatas=batch["metadatas"]
        )
        return True
    except Exception as e:
        log_debug_json({"status": "error", "message": f"Error upserting batch: {e}", "batch_ids": batch["ids"], "success": False})
        print(json.dumps({"status": "error", "message": f"Error upserting batch: {e}", "batch_ids": batch["ids"], "success": False}))
        sys.stdout.flush()
        return False

def upload_all_batches(collection, batches: List[Dict]) -> Dict:
    """Upload all batches directly to Chroma."""
    upload_stats = {
        "total_batches": len(batches),
        "successful_uploads": 0,
        "failed_uploads": 0,
        "total_documents": 0
    }
    
    for i, batch in enumerate(batches, 1):
        # log_debug_json({"status": "progress", "processed": i, "total": len(batches)}) # This is for progress, keep it
        if upsert_batch_to_chroma(collection, batch):
            upload_stats["successful_uploads"] += 1
            upload_stats["total_documents"] += len(batch['documents'])
        else:
            upload_stats["failed_uploads"] += 1
    
    return upload_stats

def main():
    """Main execution function."""
    log_debug_json({"status": "debug", "message": "manage_index.py started", "success": True})
    print(json.dumps({"status": "debug", "message": "manage_index.py started", "success": True}))
    sys.stdout.flush()
    parser = argparse.ArgumentParser(description="Manage the ChromaDB index.")
    parser.add_argument("action", type=str, choices=["index", "clear"], help="The action to perform.")
    parser.add_argument("path", type=str, help="The path to the file or folder to index.")
    parser.add_argument("vault_path", type=str, help="The absolute path to the vault.")
    parser.add_argument("--host", type=str, default="localhost", help="The ChromaDB host.")
    parser.add_argument("--port", type=int, default=8000, help="The ChromaDB port.")
    parser.add_argument("--collection", type=str, default=COLLECTION_NAME, help="The ChromaDB collection name.")
    parser.add_argument("--folders", type=str, help="Comma-separated list of folders to index within the path.")
    args = parser.parse_args()
    log_debug_json({"status": "debug", "message": "Arguments parsed", "args": str(args), "success": True})
    print(json.dumps({"status": "debug", "message": "Arguments parsed", "args": str(args), "success": True}))
    sys.stdout.flush()

    client = connect_to_chroma(args.host, args.port)
    log_debug_json({"status": "debug", "message": "Connected to ChromaDB", "success": True})
    print(json.dumps({"status": "debug", "message": "Connected to ChromaDB", "success": True}))
    sys.stdout.flush()
    collection = get_or_create_collection(client, args.collection)
    log_debug_json({"status": "debug", "message": "Collection accessed", "success": True})
    print(json.dumps({"status": "debug", "message": "Collection accessed", "success": True}))
    sys.stdout.flush()

    if args.action == "clear":
        all_ids = collection.get()['ids']
        if all_ids:
            collection.delete(ids=all_ids)
        log_debug_json({"status": "complete", "total_documents": collection.count(), "success": True})
        print(json.dumps({"status": "complete", "total_documents": collection.count(), "success": True}))
        sys.stdout.flush()

    elif args.action == "index":
        base_path = Path(args.path)
        log_debug_json({"status": "debug", "message": f"Finding markdown files in {base_path}", "success": True})
        print(json.dumps({"status": "debug", "message": f"Finding markdown files in {base_path}", "success": True}))
        sys.stdout.flush()
        all_files = find_markdown_files(base_path)
        log_debug_json({"status": "debug", "message": f"Found {len(all_files)} files", "success": True})
        print(json.dumps({"status": "debug", "message": f"Found {len(all_files)} files", "success": True}))
        sys.stdout.flush()

        files_to_index = []
        if args.folders:
            target_folders = [f.strip() for f in args.folders.split(',') if f.strip()]
            for file_path in all_files:
                if file_path.parent.name in target_folders:
                    files_to_index.append(file_path)
            log_debug_json({"status": "debug", "message": f"Filtered to {len(files_to_index)} files based on folders: {target_folders}", "success": True})
            print(json.dumps({"status": "debug", "message": f"Filtered to {len(files_to_index)} files based on folders: {target_folders}", "success": True}))
            sys.stdout.flush()
        else:
            files_to_index = all_files
            log_debug_json({"status": "debug", "message": "No folders specified, indexing all found files.", "success": True})
            print(json.dumps({"status": "debug", "message": "No folders specified, indexing all found files.", "success": True}))
            sys.stdout.flush()

        if not files_to_index:
            log_debug_json({"status": "complete", "total_documents": collection.count(), "message": "No files to index.", "success": True })
            print(json.dumps({"status": "complete", "total_documents": collection.count(), "message": "No files to index.", "success": True }))
            sys.stdout.flush()
            return
        
        log_debug_json({"status": "debug", "message": f"Processing {len(files_to_index)} files into batches", "success": True})
        print(json.dumps({"status": "debug", "message": f"Processing {len(files_to_index)} files into batches", "success": True}))
        sys.stdout.flush()
        batches, processing_stats = process_files_into_batches(files_to_index, Path(args.vault_path))
        log_debug_json({"status": "debug", "message": f"Created {len(batches)} batches", "processing_stats": processing_stats, "success": True})
        print(json.dumps({"status": "debug", "message": f"Created {len(batches)} batches", "processing_stats": processing_stats, "success": True}))
        sys.stdout.flush()

        if not batches:
            log_debug_json({"status": "complete", "total_documents": collection.count(), "message": "No valid documents to process!", "success": True })
            print(json.dumps({"status": "complete", "total_documents": collection.count(), "message": "No valid documents to process!", "success": True }))
            sys.stdout.flush()
            return
        
        log_debug_json({"status": "debug", "message": f"Uploading {len(batches)} batches to Chroma", "success": True})
        print(json.dumps({"status": "debug", "message": f"Uploading {len(batches)} batches to Chroma", "success": True}))
        sys.stdout.flush()
        upload_stats = upload_all_batches(collection, batches)
        log_debug_json({"status": "debug", "message": "Upload complete", "upload_stats": upload_stats, "success": True})
        print(json.dumps({"status": "debug", "message": "Upload complete", "upload_stats": upload_stats, "success": True}))
        sys.stdout.flush()
        
        log_debug_json({"status": "complete", "total_documents": collection.count(), "success": True})
        print(json.dumps({"status": "complete", "total_documents": collection.count(), "success": True}))
        sys.stdout.flush()


# Original main execution block
if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log_debug_json({"status": "error", "message": f"Unhandled exception in manage_index.py: {e}", "type": str(type(e).__name__), "success": False})
        print(json.dumps({"status": "error", "message": f"Unhandled exception in manage_index.py: {e}", "type": str(type(e).__name__), "success": False }))
        sys.stdout.flush()
        sys.exit(1)
