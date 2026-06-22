import sys
import os

# Add root, backend, and src directories to Python path so Vercel can resolve imports
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, root_dir)
sys.path.insert(0, os.path.join(root_dir, "backend"))
sys.path.insert(0, os.path.join(root_dir, "src"))

from backend.app.main import app
