import sys
import os

# Add the existing OMR engine (src/) to the Python path
_SRC_DIR = os.path.join(os.path.dirname(__file__), "..", "src")
if os.path.isdir(_SRC_DIR):
    sys.path.insert(0, os.path.abspath(_SRC_DIR))

# Import FastAPI app from main
from app.main import app
