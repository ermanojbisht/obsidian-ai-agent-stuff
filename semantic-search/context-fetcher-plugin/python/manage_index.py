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
    """Logs debug information to stderr. This is used for internal debugging and should not be parsed by the plugin."""
    try:
        # Use sys.stderr for debug output to separate it from the main JSON response.
        sys.stderr.write(json.dumps(data) + "\n")
        sys.stderr.flush()
    except Exception as e:
        # Fallback if logging to stderr fails, print to stdout as a last resort.
        print(json.dumps({"status": "error", "message": f"Failed to write to debug log: {e}", "type": "DebugLogError", "success": False}))
        sys.stdout.flush()

try:
    import chromadb
    from sentence_transformers import SentenceTransformer
    from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
except ImportError as e:
    log_debug_json({"status": "error", "message": f"ImportError: {e}. Please ensure all Python dependencies are installed.", "type": "ImportError", "success": False})
    # Print a simplified error message to stdout for the plugin to parse.
    print(json.dumps({"success": False, "error": f"ImportError: {e}. Please ensure all Python dependencies are installed." }))
    sys.stdout.flush()
    sys.exit(1)
except Exception as e:
    log_debug_json({"status": "error", "message": f"Unhandled exception during imports: {e}", "type": str(type(e).__name__), "success": False})
    # Print a simplified error message to stdout for the plugin to parse.
    print(json.dumps({"success": False, "error": f"Unhandled exception during imports: {e}" }))
    sys.stdout.flush()
    sys.exit(1)

def connect_to_chroma(host: str, port: int) -> chromadb.HttpClient:
    """Connect to ChromaDB server and return a client instance."""
    try:
        client = chromadb.HttpClient(host=host, port=port)
        client.heartbeat()  # Test connection to ensure the server is reachable.
        return client
    except Exception as e:
        log_debug_json({"status": "error", "message": f"Failed to connect to ChromaDB: {e}", "type": "ChromaConnectionError", "success": False})
        # Raise an exception to be caught by the main function for proper error reporting to the plugin.
        raise Exception(f"Failed to connect to ChromaDB at {host}:{port}: {e}")

def find_markdown_files(path: Path) -> List[Path]:
    """Recursively find all markdown files (.md) in the specified path."""
    if path.is_file():
        return [path]
    elif path.is_dir():
        return list(path.glob("**/*.md"))
    else:
        return []

def read_file_content(file_path: Path) -> Tuple[str, str]:
    """
    Read file content and return (content, status).
    Status can be: 'success', 'empty', 'encoding_error'.
    Attempts UTF-8 first, then Latin-1 for robustness.
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
            # Try with a different encoding if UTF-8 fails.
            with open(file_path, 'r', encoding='latin-1') as f:
                content = f.read().strip()
            return content, "success"
        except Exception as e:
            log_debug_json({"status": "error", "message": f"Encoding error reading {file_path}: {e}", "type": "EncodingError", "success": False})
            # Do not print to stdout here, let the main function handle the final response.
            return "", "encoding_error"
    except Exception as e:
        log_debug_json({"status": "error", "message": f"Error reading {file_path}: {e}", "type": "FileReadError", "success": False})
        # Do not print to stdout here, let the main function handle the final response.
        return "", "encoding_error"

def generate_document_id(file_path: Path, vault_path: Path) -> str:
    """Generate a unique document ID from the file path relative to the vault path."""
    relative_path = file_path.relative_to(vault_path)
    # Normalize path separators and remove .md extension for a cleaner ID.
    doc_id = str(relative_path).replace('\\', '/').replace('.md', '')
    return doc_id

def process_files_into_batches(files: List[Path], vault_path: Path) -> Tuple[List[Dict], Dict]:
    """
    Process a list of markdown files, read their content, and group them into batches
    suitable for upserting to ChromaDB. Also collects statistics on processing.
    Returns (batches, stats).
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
            
            # If the current batch reaches BATCH_SIZE, add it to the list of batches and start a new one.
            if len(current_batch["documents"]) >= BATCH_SIZE:
                batches.append(current_batch.copy())
                current_batch = {"documents": [], "ids": [], "metadatas": []}
                stats["batches_created"] += 1
    
    # Add any remaining documents as the final batch.
    if current_batch["documents"]:
        batches.append(current_batch)
        stats["batches_created"] += 1
    
    return batches, stats

def get_or_create_collection(client, collection_name: str):
    """Get an existing Chroma collection or create a new one if it doesn't exist."""
    try:
        # Use SentenceTransformerEmbeddingFunction for consistent embeddings.
        embedding_function = SentenceTransformerEmbeddingFunction(model_name=EMBEDDING_MODEL)
        collection = client.get_or_create_collection(name=collection_name, embedding_function=embedding_function)
        return collection
    except Exception as e:
        log_debug_json({"status": "error", "message": f"Error creating/accessing collection: {e}", "type": "ChromaCollectionError", "success": False})
        # Raise an exception to be caught by the main function for proper error reporting to the plugin.
        raise Exception(f"Error creating/accessing collection: {e}")

def upsert_batch_to_chroma(collection, batch: Dict) -> bool:
    """Upsert a single batch of documents to the ChromaDB collection."""
    try:
        collection.upsert(
            ids=batch["ids"],
            documents=batch["documents"],
            metadatas=batch["metadatas"]
        )
        return True
    except Exception as e:
        log_debug_json({"status": "error", "message": f"Error upserting batch: {e}", "batch_ids": batch["ids"], "success": False})
        # Do not print to stdout here, let the main function handle the final response.
        return False

def upload_all_batches(collection, batches: List[Dict]) -> Dict:
    """Upload all processed batches to ChromaDB and return upload statistics."""
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
    """Main execution function for managing the ChromaDB index (indexing or clearing)."""
    log_debug_json({"status": "debug", "message": "manage_index.py started", "success": True})
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

    try:
        client = connect_to_chroma(args.host, args.port)
        log_debug_json({"status": "debug", "message": "Connected to ChromaDB", "success": True})
        collection = get_or_create_collection(client, args.collection)
        log_debug_json({"status": "debug", "message": "Collection accessed", "success": True})

        if args.action == "clear":
            all_ids = collection.get()['ids']
            if all_ids:
                collection.delete(ids=all_ids)
            response = {"success": True, "status": "complete", "total_documents": collection.count()}
            print(json.dumps(response, ensure_ascii=False))
            sys.stdout.flush()

        elif args.action == "index":
            base_path = Path(args.path)
            log_debug_json({"status": "debug", "message": f"Finding markdown files in {base_path}", "success": True})
            all_files = find_markdown_files(base_path)
            log_debug_json({"status": "debug", "message": f"Found {len(all_files)} files", "success": True})

            files_to_index = []
            if args.folders:
                target_folders = [f.strip() for f in args.folders.split(',') if f.strip()]
                for file_path in all_files:
                    if file_path.parent.name in target_folders:
                        files_to_index.append(file_path)
                log_debug_json({"status": "debug", "message": f"Filtered to {len(files_to_index)} files based on folders: {target_folders}", "success": True})
            else:
                files_to_index = all_files
                log_debug_json({"status": "debug", "message": "No folders specified, indexing all found files.", "success": True})

            if not files_to_index:
                response = {"success": True, "status": "complete", "total_documents": collection.count(), "message": "No files to index." }
                print(json.dumps(response, ensure_ascii=False))
                sys.stdout.flush()
                return
            
            log_debug_json({"status": "debug", "message": f"Processing {len(files_to_index)} files into batches", "success": True})
            batches, processing_stats = process_files_into_batches(files_to_index, Path(args.vault_path))
            log_debug_json({"status": "debug", "message": f"Created {len(batches)} batches", "processing_stats": processing_stats, "success": True})

            if not batches:
                response = {"success": True, "status": "complete", "total_documents": collection.count(), "message": "No valid documents to process!" }
                print(json.dumps(response, ensure_ascii=False))
                sys.stdout.flush()
                return
            
            log_debug_json({"status": "debug", "message": f"Uploading {len(batches)} batches to Chroma", "success": True})
            upload_stats = upload_all_batches(collection, batches)
            log_debug_json({"status": "debug", "message": "Upload complete", "upload_stats": upload_stats, "success": True})
            
            response = {"success": True, "status": "complete", "total_documents": collection.count()}
            print(json.dumps(response, ensure_ascii=False))
            sys.stdout.flush()

    except Exception as e:
        log_debug_json({"status": "error", "message": f"Unhandled exception in manage_index.py: {e}", "type": str(type(e).__name__), "success": False})
        # Print a simplified error message to stdout for the plugin to parse.
        print(json.dumps({"success": False, "error": f"Unhandled exception in manage_index.py: {e}" }))
        sys.stdout.flush()
        sys.exit(1)


if __name__ == "__main__":
    main()
