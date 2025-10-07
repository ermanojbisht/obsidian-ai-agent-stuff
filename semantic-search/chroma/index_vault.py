#!/usr/bin/env python3
"""
Index the vault into ChromaDB.
"""

import os
import sys
import argparse
from pathlib import Path
from typing import List, Dict, Tuple
import chromadb

# Configuration
BATCH_SIZE = 50
COLLECTION_NAME = "notes"

def connect_to_chroma(host: str, port: int) -> chromadb.HttpClient:
    """Connect to ChromaDB server."""
    try:
        client = chromadb.HttpClient(host=host, port=port)
        client.heartbeat()  # Test connection
        print(f"Connected to ChromaDB at {host}:{port}")
        return client
    except Exception as e:
        print(f"Failed to connect to ChromaDB: {e}")
        sys.exit(1)

def find_markdown_files(vault_path: Path, folders: List[str]) -> List[Path]:
    """Find all markdown files in the specified directories."""
    files = []
    for folder in folders:
        dir_path = vault_path / folder
        if dir_path.exists():
            files.extend(dir_path.glob("**/*.md"))
    
    print(f"Found {len(files)} markdown files")
    return files

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
        print(f"Collection '{collection_name}' ready")
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
        print(f"[OK] Successfully upserted batch with {len(batch['documents'])} documents")
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
        print(f"Processing batch {i}/{len(batches)} ({len(batch['documents'])} documents)...")
        if upsert_batch_to_chroma(collection, batch):
            upload_stats["successful_uploads"] += 1
            upload_stats["total_documents"] += len(batch['documents'])
        else:
            upload_stats["failed_uploads"] += 1
    
    return upload_stats

def print_final_report(processing_stats: Dict, upload_stats: Dict):
    """Print final processing and upload report."""
    print("\n" + "="*60)
    print("REINDEXING COMPLETE")
    print("="*60)
    
    print("\nFile Processing Statistics:")
    print(f"  Total files found: {processing_stats['total_files']}")
    print(f"  Successfully processed: {processing_stats['processed']}")
    print(f"  Empty files: {processing_stats['empty']}")
    print(f"  Encoding errors: {processing_stats['encoding_error']}")
    print(f"  Batches created: {processing_stats['batches_created']}")
    
    print("\nUpload Statistics:")
    print(f"  Total batches: {upload_stats['total_batches']}")
    print(f"  Successful uploads: {upload_stats['successful_uploads']}")
    print(f"  Failed uploads: {upload_stats['failed_uploads']}")
    print(f"  Total documents uploaded: {upload_stats['total_documents']}")
    
    success_rate = (processing_stats['processed'] / processing_stats['total_files']) * 100 if processing_stats['total_files'] > 0 else 0
    upload_rate = (upload_stats['successful_uploads'] / upload_stats['total_batches']) * 100 if upload_stats['total_batches'] > 0 else 0
    
    print(f"\nSuccess Rates:")
    print(f"  File processing: {success_rate:.1f}%")
    print(f"  Batch upload: {upload_rate:.1f}%")
    
    if upload_stats['failed_uploads'] > 0:
        print(f"\n[WARNING] {upload_stats['failed_uploads']} batches failed to upload.")
    else:
        print(f"\n[SUCCESS] All {upload_stats['total_documents']} documents successfully upserted in Chroma collection '{COLLECTION_NAME}'")

def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(description="Index the vault into ChromaDB.")
    parser.add_argument("vault_path", type=str, help="The absolute path to the vault.")
    parser.add_argument("folders", type=str, nargs='+', help="A list of folders to index.")
    parser.add_argument("--host", type=str, default="localhost", help="The ChromaDB host.")
    parser.add_argument("--port", type=int, default=8000, help="The ChromaDB port.")
    parser.add_argument("--collection", type=str, default=COLLECTION_NAME, help="The ChromaDB collection name.")
    args = parser.parse_args()

    print("Starting Chroma reindexing process...")
    print(f"Vault root: {args.vault_path}")
    
    # Connect to ChromaDB
    client = connect_to_chroma(args.host, args.port)
    
    # Get or create collection
    collection = get_or_create_collection(client, args.collection)
    
    # Find and process files
    markdown_files = find_markdown_files(Path(args.vault_path), args.folders)
    if not markdown_files:
        print("No markdown files found!")
        return
    
    # Process files into batches
    print("Processing files into batches...")
    batches, processing_stats = process_files_into_batches(markdown_files, Path(args.vault_path))
    
    if not batches:
        print("No valid documents to process!")
        return
    
    print(f"Created {len(batches)} batches from {processing_stats['processed']} valid documents")
    
    # Upload all batches directly to Chroma
    print("Upserting batches to Chroma...")
    upload_stats = upload_all_batches(collection, batches)
    
    # Final report
    print_final_report(processing_stats, upload_stats)

if __name__ == "__main__":
    main()
