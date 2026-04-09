# Devasya AI - API Reference

Complete API documentation for Devasya AI backend.

## Base URL
```
http://localhost:8000 (development)
https://api.devasya.com (production)
```

## Authentication

All endpoints except `/api/auth/register` and `/api/auth/login` require a Bearer token.

### Header Format
```
Authorization: Bearer <access_token>
```

### Response Codes
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `409`: Conflict
- `500`: Server Error

---

## Authentication Endpoints

### Register User
**POST** `/api/auth/register`

Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "secure-password",
  "full_name": "John Doe"
}
```

**Response (200):**
```json
{
  "id": 1,
  "email": "user@example.com",
  "full_name": "John Doe",
  "is_active": true,
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Errors:**
- `409`: Email already registered

---

### Login User
**POST** `/api/auth/login`

Authenticate and get access token.

**Request Body (Form Data):**
```
email=user@example.com
password=secure-password
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "full_name": "John Doe",
    "is_active": true,
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**Errors:**
- `401`: Invalid email or password
- `403`: User account is inactive

---

### Get Current User
**GET** `/api/auth/me`

Get authenticated user profile.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "id": 1,
  "email": "user@example.com",
  "full_name": "John Doe",
  "is_active": true,
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Errors:**
- `401`: Invalid or expired token
- `404`: User not found

---

## Memory Endpoints

### Add Memory
**POST** `/api/memory/add`

Store new knowledge in user's memory.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "content": "Semantic search uses embeddings to find similar documents based on meaning rather than keywords.",
  "title": "Semantic Search Notes",
  "metadata": {
    "category": "learning",
    "importance": "high",
    "source": "Research"
  }
}
```

**Response (200):**
```json
{
  "id": 1,
  "content": "Semantic search uses embeddings...",
  "title": "Semantic Search Notes",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Errors:**
- `401`: Unauthorized
- `500`: Server error

---

### List Memories
**GET** `/api/memory/list`

Retrieve paginated list of user's memories.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `skip`: Number of records to skip (default: 0)
- `limit`: Number of records to return (default: 10)

**Example:**
```
GET /api/memory/list?skip=0&limit=10
```

**Response (200):**
```json
{
  "total": 25,
  "skip": 0,
  "limit": 10,
  "memories": [
    {
      "id": 1,
      "content": "Semantic search uses embeddings...",
      "title": "Semantic Search Notes",
      "created_at": "2024-01-15T10:30:00Z"
    },
    ...
  ]
}
```

**Errors:**
- `401`: Unauthorized

---

### Get Single Memory
**GET** `/api/memory/{id}`

Retrieve a specific memory by ID.

**Headers:**
```
Authorization: Bearer <token>
```

**Path Parameters:**
- `id`: Memory ID

**Response (200):**
```json
{
  "id": 1,
  "content": "Full content...",
  "title": "Title",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Errors:**
- `401`: Unauthorized
- `404`: Memory not found

---

### Delete Memory
**DELETE** `/api/memory/{id}`

Remove a memory from the knowledge base.

**Headers:**
```
Authorization: Bearer <token>
```

**Path Parameters:**
- `id`: Memory ID

**Response (200):**
```json
{
  "message": "Memory deleted successfully"
}
```

**Errors:**
- `401`: Unauthorized
- `404`: Memory not found

---

## Query Endpoints

### Ask Question
**POST** `/api/query/ask`

Execute multi-agent reasoning pipeline with optional memory retrieval.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "query": "Based on my memories, what should I focus on next week?",
  "use_memory": true
}
```

**Response (200):**
```json
{
  "insights": "Based on your memories about learning goals and recent projects, the key insights are...",
  "connections": "Your work on semantic search connects to vector databases and embeddings, which relates to your interest in RAG systems...",
  "actions": [
    "Deep dive into vector database optimization",
    "Implement semantic caching",
    "Review embedding model benchmarks"
  ],
  "context": [
    "Semantic search uses embeddings to find similar documents...",
    "RAG combines retrieval with generation..."
  ],
  "agent_logs": {
    "timestamp": "2024-01-15T10:30:00Z",
    "steps": [
      {
        "agent": "planner",
        "output": {
          "needs_retrieval": true,
          "analysis_type": "analysis"
        }
      },
      {
        "agent": "retriever",
        "documents_retrieved": 3
      },
      {
        "agent": "reasoner",
        "output": {...}
      },
      {
        "agent": "validator",
        "validation": {
          "is_valid": true,
          "grounding_score": 0.92
        }
      }
    ]
  },
  "validation": {
    "is_valid": true,
    "grounding_score": 0.92,
    "issues": [],
    "feedback": "Response is well-grounded in provided context"
  }
}
```

**Errors:**
- `400`: Invalid request
- `401`: Unauthorized
- `500`: Processing error

---

### Query History
**GET** `/api/query/history`

Retrieve user's past queries and responses.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `skip`: Number of records to skip (default: 0)
- `limit`: Number of records to return (default: 10)

**Response (200):**
```json
{
  "total": 15,
  "skip": 0,
  "limit": 10,
  "interactions": [
    {
      "id": 1,
      "query": "What should I focus on?",
      "response": {
        "insights": "...",
        "connections": "...",
        "actions": "..."
      },
      "context_used": [...],
      "agent_logs": {...},
      "created_at": "2024-01-15T10:30:00Z"
    },
    ...
  ]
}
```

---

### Get Specific Interaction
**GET** `/api/query/{id}`

Retrieve details of a specific past interaction.

**Headers:**
```
Authorization: Bearer <token>
```

**Path Parameters:**
- `id`: Interaction ID

**Response (200):**
```json
{
  "id": 1,
  "query": "...",
  "response": {...},
  "context_used": [...],
  "agent_logs": {...},
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

## Health & Info Endpoints

### Health Check
**GET** `/health`

Check if backend is running.

**Response (200):**
```json
{
  "status": "healthy",
  "service": "Devasya AI",
  "version": "1.0.0"
}
```

---

### API Info
**GET** `/`

Get API information and links.

**Response (200):**
```json
{
  "name": "Devasya AI",
  "version": "1.0.0",
  "description": "Memory-driven intelligence system",
  "docs": "/docs",
  "health": "/health"
}
```

---

## Rate Limiting

Rate limits (coming in v1.1):
- Authentication endpoints: 10 requests/minute per IP
- Memory endpoints: 100 requests/minute per user
- Query endpoints: 30 requests/minute per user

---

## Error Handling

### Standard Error Response
```json
{
  "detail": "Error message describing what went wrong"
}
```

### Common Errors

**401 Unauthorized**
```json
{
  "detail": "Missing or invalid authorization header"
}
```

**404 Not Found**
```json
{
  "detail": "Memory not found"
}
```

**500 Server Error**
```json
{
  "detail": "Error adding memory: database connection failed"
}
```

---

## Pagination

List endpoints support pagination:

**Query Parameters:**
- `skip`: How many records to skip (default: 0)
- `limit`: Max records to return (default: 10)

**Response Format:**
```json
{
  "total": 100,
  "skip": 20,
  "limit": 10,
  "items": [...]
}
```

---

## Data Types

### User
```json
{
  "id": 1,
  "email": "user@example.com",
  "full_name": "John Doe",
  "is_active": true,
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Memory
```json
{
  "id": 1,
  "content": "Full memory text...",
  "title": "Optional title",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Query Response
```json
{
  "insights": "Key findings...",
  "connections": "Related ideas...",
  "actions": ["Action 1", "Action 2"],
  "context": ["Source 1", "Source 2"],
  "validation": {
    "is_valid": true,
    "grounding_score": 0.95
  }
}
```

---

## Examples

### Complete Flow

**1. Register**
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secure123",
    "full_name": "John Doe"
  }'
```

**2. Login**
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=user@example.com&password=secure123"
```

Save the `access_token` from response.

**3. Add Memory**
```bash
curl -X POST http://localhost:8000/api/memory/add \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Important information to remember",
    "title": "My Note"
  }'
```

**4. Query**
```bash
curl -X POST http://localhost:8000/api/query/ask \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What should I do based on my memories?",
    "use_memory": true
  }'
```

---

## Interactive API Docs

Swagger UI: `http://localhost:8000/docs`
ReDoc: `http://localhost:8000/redoc`

---

Last Updated: January 2024
