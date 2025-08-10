#!/usr/bin/env python3
"""
Reindex script for Chroma collection.
Processes all markdown files in notes/ and projects/ directories and uploads them to Chroma in batches.

HOW TO RUN:
-----------

Prerequisites:
- ChromaDB server running on localhost:8000 (docker run -d -v ./chroma-data:/data -p 8000:8000 chromadb/chroma)
- Python 3.6+ installed
- chromadb package installed (pip install chromadb)

Usage:
1. Start ChromaDB server:
   docker run -d -v ./chroma-data:/data -p 8000:8000 chromadb/chroma

2. Navigate to the vault root directory:
   cd C:\\Users\\Jo.VanEyck\\stack\\personal\\knowledge\\vault\\jovaneyck

3. Run the script:
   python scripts\\chroma\\reindex.py

   Or from the scripts/chroma directory:
   cd scripts\\chroma
   python reindex.py

What it does:
- Finds all .md files in notes/ and projects/ directories
- Filters out empty files, TODO-only files, and files with encoding issues
- Processes files in batches of 50 documents
- Upserts documents into the "notes" Chroma collection (creates if not exists)
- Uses ChromaDB's native upsert functionality for efficient updates
- Provides detailed progress and success statistics

Output:
- Progress messages during processing
- Detailed final report with statistics
"""

import os
import json
from pathlib import Path
from typing import List, Dict, Tuple
import chromadb
import sys

# Configuration
BATCH_SIZE = 50  # Increased batch size for direct API calls
COLLECTION_NAME = "notes"
VAULT_ROOT = Path(__file__).parent.parent.parent
CHROMA_HOST = "localhost"
CHROMA_PORT = 8000

def connect_to_chroma():
    """Connect to ChromaDB server."""
    try:
        client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
        # Test connection
        client.heartbeat()
        print(f"Connected to ChromaDB at {CHROMA_HOST}:{CHROMA_PORT}")
        return client
    except Exception as e:
        print(f"Failed to connect to ChromaDB: {e}")
        print(f"Make sure ChromaDB server is running:")
        print(f"  docker run -d -v ./chroma-data:/data -p {CHROMA_PORT}:{CHROMA_PORT} chromadb/chroma")
        return None

def find_markdown_files() -> List[Path]:
    """Find all markdown files in notes/ and projects/ directories."""
    directories = ["notes", "projects"]
    
    files = []
    for directory in directories:
        dir_path = VAULT_ROOT / directory
        if dir_path.exists():
            files.extend(dir_path.glob("**/*.md"))
    
    print(f"Found {len(files)} markdown files")
    return files

def read_file_content(file_path: Path) -> Tuple[str, str]:
    """
    Read file content and return (content, status).
    Status can be: 'success', 'empty', 'todo_only', 'encoding_error'
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read().strip()
        
        if not content:
            return "", "empty"
        elif content == "#TODO":
            return content, "todo_only"
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

def generate_document_id(file_path: Path) -> str:
    """Generate a document ID from the file path."""
    # Use the relative path from vault root as ID, replacing separators
    relative_path = file_path.relative_to(VAULT_ROOT)
    doc_id = str(relative_path).replace('\\', '/').replace('.md', '')
    return doc_id

def process_files_into_batches(files: List[Path]) -> Tuple[List[Dict], Dict]:
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
        "todo_only": 0,
        "encoding_error": 0,
        "success": 0,
        "batches_created": 0
    }
    
    for file_path in files:
        content, status = read_file_content(file_path)
        stats[status] += 1
        
        if status == "success":
            doc_id = generate_document_id(file_path)
            metadata = {
                "file_path": str(file_path),
                "relative_path": str(file_path.relative_to(VAULT_ROOT)),
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

def get_or_create_collection(client):
    """Get or create the Chroma collection."""
    try:
        collection = client.get_or_create_collection(name=COLLECTION_NAME)
        print(f"Collection '{COLLECTION_NAME}' ready")
        return collection
    except Exception as e:
        print(f"Error creating/accessing collection: {e}")
        return None

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
    print(f"  TODO-only files: {processing_stats['todo_only']}")
    print(f"  Encoding errors: {processing_stats['encoding_error']}")
    print(f"  Batches created: {processing_stats['batches_created']}")
    
    print("\nUpload Statistics:")
    print(f"  Total batches: {upload_stats['total_batches']}")
    print(f"  Successful uploads: {upload_stats['successful_uploads']}")
    print(f"  Failed uploads: {upload_stats['failed_uploads']}")
    print(f"  Total documents uploaded: {upload_stats['total_documents']}")
    
    success_rate = (processing_stats['processed'] / processing_stats['total_files']) * 100
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
    print("Starting Chroma reindexing process...")
    print(f"Vault root: {VAULT_ROOT}")
    
    # Connect to ChromaDB
    client = connect_to_chroma()
    if not client:
        return
    
    # Get or create collection
    collection = get_or_create_collection(client)
    if not collection:
        return
    
    # Find and process files
    markdown_files = find_markdown_files()
    if not markdown_files:
        print("No markdown files found!")
        return
    
    # Process files into batches
    print("Processing files into batches...")
    batches, processing_stats = process_files_into_batches(markdown_files)
    
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