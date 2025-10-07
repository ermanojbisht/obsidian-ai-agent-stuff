#!/usr/bin/env python3
"""
Manage the ChromaDB index.
"""

import os
import sys
import argparse
import json
from pathlib import Path
from typing import List, Dict, Tuple
import chromadb
from sentence_transformers import SentenceTransformer

# Configuration
BATCH_SIZE = 50
COLLECTION_NAME = "notes"

def connect_to_chroma(host: str, port: int) -> chromadb.HttpClient:
    """Connect to ChromaDB server."""
    try:
        client = chromadb.HttpClient(host=host, port=port)
        client.heartbeat()  # Test connection
        return client
    except Exception as e:
        print(f"Failed to connect to ChromaDB: {e}")
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
            print(f"Encoding error reading {file_path}: {e}")
            return "", "encoding_error"
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
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
        collection = client.get_or_create_collection(name=collection_name)
        return collection
    except Exception as e:
        print(f"Error creating/accessing collection: {e}")
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
        print(f"[ERROR] Error upserting batch: {e}")
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
        print(json.dumps({"status": "progress", "processed": i, "total": len(batches)}))
        if upsert_batch_to_chroma(collection, batch):
            upload_stats["successful_uploads"] += 1
            upload_stats["total_documents"] += len(batch['documents'])
        else:
            upload_stats["failed_uploads"] += 1
    
    return upload_stats

def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(description="Manage the ChromaDB index.")
    parser.add_argument("action", type=str, choices=["index", "clear"], help="The action to perform.")
    parser.add_argument("path", type=str, help="The path to the file or folder to index.")
    parser.add_argument("vault_path", type=str, help="The absolute path to the vault.")
    parser.add_argument("--host", type=str, default="localhost", help="The ChromaDB host.")
    parser.add_argument("--port", type=int, default=8000, help="The ChromaDB port.")
    parser.add_argument("--collection", type=str, default=COLLECTION_NAME, help="The ChromaDB collection name.")
    args = parser.parse_args()

    client = connect_to_chroma(args.host, args.port)
    collection = get_or_create_collection(client, args.collection)

    if args.action == "clear":
        all_ids = collection.get()['ids']
        if all_ids:
            collection.delete(ids=all_ids)
        print(json.dumps({"status": "complete", "total_documents": collection.count()}))

    elif args.action == "index":
        files = find_markdown_files(Path(args.path))
        if not files:
            return
        
        batches, processing_stats = process_files_into_batches(files, Path(args.vault_path))
        
        if not batches:
            print("No valid documents to process!")
            return
        
        upload_stats = upload_all_batches(collection, batches)
        
        print(json.dumps({"status": "complete", "total_documents": collection.count()}))

if __name__ == "__main__":
    main()