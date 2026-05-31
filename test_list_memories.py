import asyncio
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

# We need an auth override for testing, or we just call the function directly
from backend.api.memory import list_memories
from backend.db.postgres import get_db
from backend.models.schema import Profile, Workspace
import uuid

def run_test():
    db = next(get_db())
    try:
        # Get any profile
        profile = db.query(Profile).first()
        if not profile:
            print("No profiles found")
            return
            
        print(f"Testing for user {profile.id}")
        
        # Call the endpoint
        app.dependency_overrides[backend.api.auth.get_current_user] = lambda: profile
        response = client.get("/api/memory/list?skip=0&limit=100")
        print(response.status_code)
        print(response.json())
    finally:
        db.close()

if __name__ == "__main__":
    run_test()
