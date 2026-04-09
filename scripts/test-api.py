#!/usr/bin/env python3
"""
Test script for Devasya AI API endpoints.
Run after starting the backend: python scripts/test-api.py
"""

import requests
import json
import sys
from datetime import datetime

BASE_URL = "http://localhost:8000"

def test_health():
    """Test health check endpoint."""
    print("\n📋 Testing Health Check...")
    response = requests.get(f"{BASE_URL}/health")
    assert response.status_code == 200
    print(f"✅ Health check passed: {response.json()}")
    return True

def test_register():
    """Test user registration."""
    print("\n📋 Testing User Registration...")
    
    email = f"test{datetime.now().timestamp()}@example.com"
    data = {
        "email": email,
        "password": "testpassword123",
        "full_name": "Test User"
    }
    
    response = requests.post(f"{BASE_URL}/api/auth/register", json=data)
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    assert response.status_code in [200, 409], f"Expected 200 or 409, got {response.status_code}"
    
    if response.status_code == 200:
        print("✅ Registration successful")
        return data["email"], data["password"]
    elif response.status_code == 409:
        print("⚠️  User already exists, will use for login test")
        return None, None
    
    return None, None

def test_login(email: str, password: str):
    """Test user login."""
    print("\n📋 Testing User Login...")
    
    data = {
        "email": email,
        "password": password
    }
    
    response = requests.post(f"{BASE_URL}/api/auth/login", data=data)
    print(f"Status: {response.status_code}")
    
    assert response.status_code == 200, f"Login failed: {response.text}"
    
    result = response.json()
    token = result.get("access_token")
    user = result.get("user")
    
    print(f"✅ Login successful")
    print(f"   Token: {token[:20]}...")
    print(f"   User: {user.get('email')}")
    
    return token

def test_add_memory(token: str):
    """Test adding a memory."""
    print("\n📋 Testing Add Memory...")
    
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "content": "Today I learned about semantic search using embeddings. It's a powerful technique for RAG systems.",
        "title": "Semantic Search Learning",
        "metadata": {"category": "learning", "importance": "high"}
    }
    
    response = requests.post(
        f"{BASE_URL}/api/memory/add",
        json=data,
        headers=headers
    )
    
    print(f"Status: {response.status_code}")
    assert response.status_code == 200, f"Add memory failed: {response.text}"
    
    result = response.json()
    memory_id = result.get("id")
    
    print(f"✅ Memory added successfully (ID: {memory_id})")
    return memory_id

def test_list_memories(token: str):
    """Test listing memories."""
    print("\n📋 Testing List Memories...")
    
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(
        f"{BASE_URL}/api/memory/list",
        headers=headers
    )
    
    print(f"Status: {response.status_code}")
    assert response.status_code == 200, f"List memories failed: {response.text}"
    
    result = response.json()
    memories = result.get("memories", [])
    total = result.get("total", 0)
    
    print(f"✅ Retrieved {len(memories)} memories (Total: {total})")
    return memories

def test_query(token: str):
    """Test query endpoint."""
    print("\n📋 Testing Query/Reasoning...")
    
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "query": "What is semantic search and how does it improve decision making?",
        "use_memory": True
    }
    
    response = requests.post(
        f"{BASE_URL}/api/query/ask",
        json=data,
        headers=headers
    )
    
    print(f"Status: {response.status_code}")
    assert response.status_code == 200, f"Query failed: {response.text}"
    
    result = response.json()
    
    print("✅ Query processed successfully")
    print(f"\n📊 Insights: {result.get('insights', '')[:100]}...")
    print(f"\n🔗 Connections: {result.get('connections', '')[:100]}...")
    print(f"\n⚡ Actions: {result.get('actions', '')[:100]}...")
    
    return result

def test_query_history(token: str):
    """Test query history endpoint."""
    print("\n📋 Testing Query History...")
    
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(
        f"{BASE_URL}/api/query/history",
        headers=headers
    )
    
    print(f"Status: {response.status_code}")
    assert response.status_code == 200, f"History failed: {response.text}"
    
    result = response.json()
    interactions = result.get("interactions", [])
    total = result.get("total", 0)
    
    print(f"✅ Retrieved {len(interactions)} interactions (Total: {total})")
    return interactions

def main():
    """Run all tests."""
    print("=" * 60)
    print("🧪 Devasya AI API Test Suite")
    print("=" * 60)
    
    try:
        # Test health
        test_health()
        
        # Test registration and login
        email, password = test_register()
        
        if not email or not password:
            # Use a test user
            email = "test@example.com"
            password = "testpassword123"
            print(f"\n⚠️  Using test credentials: {email}")
        
        token = test_login(email, password)
        
        # Test memory operations
        test_add_memory(token)
        memories = test_list_memories(token)
        
        # Add more memories for better query results
        if len(memories) < 3:
            print("\n📋 Adding more memories for better results...")
            headers = {"Authorization": f"Bearer {token}"}
            
            sample_memories = [
                "Multi-agent systems use specialized agents for different tasks. Planner agents decide steps, retriever agents fetch context, and reasoner agents generate insights.",
                "Large language models are trained on vast amounts of text data. They learn patterns and relationships, enabling them to generate human-like text.",
                "RAG (Retrieval-Augmented Generation) combines information retrieval with generation, allowing AI to use external knowledge."
            ]
            
            for content in sample_memories:
                requests.post(
                    f"{BASE_URL}/api/memory/add",
                    json={"content": content},
                    headers=headers
                )
            
            print("✅ Added sample memories")
        
        # Test query
        test_query(token)
        
        # Test history
        test_query_history(token)
        
        print("\n" + "=" * 60)
        print("✅✅✅ All tests passed! ✅✅✅")
        print("=" * 60)
        print("\n🚀 Devasya AI API is working correctly!")
        print(f"\n📚 API Documentation: http://localhost:8000/docs")
        print(f"🏥 Health Check: http://localhost:8000/health")
        
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        sys.exit(1)
    except requests.exceptions.ConnectionError:
        print(f"\n❌ Cannot connect to API at {BASE_URL}")
        print("Make sure the backend is running: python -m uvicorn backend.main:app --reload")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
