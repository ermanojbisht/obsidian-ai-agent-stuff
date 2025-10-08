import sys
import json

try:
    print(json.dumps({"status": "success", "message": "Python script executed successfully!"}))
except Exception as e:
    print(json.dumps({"status": "error", "message": str(e)}))
