#!/usr/bin/env python3
"""
Test the connection to the ChromaDB server.
"""

import requests

def main():
    """Main function."""
    try:
        response = requests.get("http://localhost:8000/api/v1/heartbeat")
        print(response.json())
    except Exception as e:
        print(e)

if __name__ == "__main__":
    main()
