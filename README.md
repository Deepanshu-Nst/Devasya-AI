# Devasya AI - Memory-Driven Intelligence System

A production-grade AI system that combines persistent memory, semantic search (RAG), and multi-agent reasoning to enhance thinking, decision-making, and insight generation.

## 🎯 Overview

Devasya AI is NOT a chatbot. It's an intelligent system that:
- **Stores** user-specific knowledge (notes, documents, ideas)
- **Retrieves** relevant context using semantic search
- **Reasons** through multi-agent architecture
- **Generates** structured outputs (insights, connections, actions)
- **Improves** thinking over time through memory

## 🏗️ Architecture

### Backend Stack
- **Framework**: FastAPI (async Python)
- **Database**: PostgreSQL (users, memories, interactions)
- **Vector DB**: ChromaDB (semantic search)
- **Embeddings**: Sentence Transformers
- **LLM**: OpenAI (GPT-4) or Groq
- **Agents**: LangGraph + LangChain

### Frontend Stack
- **Framework**: Next.js 16 (App Router)
- **UI**: shadcn/ui + Tailwind CSS
- **State**: Zustand
- **Data Fetching**: SWR
- **Animations**: Framer Motion

## 📁 Project Structure

```
devasya-ai/
├── backend/
│   ├── api/
│   │   ├── auth.py       # Authentication endpoints
│   │   ├── memory.py     # Memory management
│   │   └── query.py      # Query & reasoning
│   ├── services/
│   │   ├── embedding.py  # Embedding generation
│   │   ├── retrieval.py  # RAG pipeline
│   │   ├── llm.py        # LLM interaction
│   │   └── agents.py     # Multi-agent orchestration
│   ├── db/
│   │   ├── postgres.py   # Database connection
│   │   └── vector_store.py # ChromaDB integration
│   ├── models/
│   │   └── schema.py     # SQLAlchemy + Pydantic models
│   ├── config/
│   │   └── settings.py   # Configuration
│   └── main.py           # FastAPI application
├── app/
│   ├── page.tsx          # Landing page
│   ├── auth/
│   │   └── page.tsx      # Auth (login/signup)
│   └── dashboard/
│       └── page.tsx      # Main dashboard
├── components/
│   ├── query-interface.tsx    # Query input & results
│   ├── memory-input.tsx       # Memory submission
│   ├── memory-timeline.tsx    # Memory visualization
│   └── interaction-history.tsx # Query history
├── lib/
│   ├── auth-store.ts     # Zustand authentication
│   └── api-client.ts     # API client
├── .env                  # Backend configuration
├── .env.local           # Frontend configuration
└── pyproject.toml       # Python dependencies
```

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL 12+
- OpenAI API key (or Groq API key)

### 1. Install Dependencies

**Backend:**
```bash
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
uv sync
```

**Frontend:**
```bash
npm install
# or
pnpm install
```

### 2. Configure Environment

**Backend (.env):**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/devasya_db
JWT_SECRET_KEY=your-secret-key
OPENAI_API_KEY=sk-your-key
CHROMA_PATH=./data/chroma
```

**Frontend (.env.local):**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Set Up Database

```bash
# Create PostgreSQL database
createdb -U user devasya_db

# Initialize schema
python -c "from backend.db.postgres import init_db; init_db()"
```

### 4. Start Services

**Terminal 1 - Backend:**
```bash
python -m uvicorn backend.main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
npm run dev
# Open http://localhost:3000
```

## 🔄 AI Pipeline Architecture

### 1. Memory Ingestion
```
User Content → Chunking → Embedding → ChromaDB → PostgreSQL Metadata
```

### 2. Query Processing
```
User Query
  ↓
Planner Agent (analyze intent)
  ↓
Retriever Agent (get relevant memories)
  ↓
Reasoner Agent (generate insights)
  ↓
Validator Agent (check quality)
  ↓
Structured Output (insights, connections, actions)
```

### 3. Multi-Agent System

**Planner Agent**
- Analyzes user intent
- Decides if retrieval is needed
- Determines analysis type

**Retriever Agent**
- Performs semantic search
- Ranks relevant documents
- Merges context

**Reasoner Agent**
- Generates insights
- Identifies connections
- Suggests actions

**Validator Agent**
- Checks output structure
- Prevents hallucination
- Scores grounding

## 🔐 Security Features

- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: bcrypt with salt
- **User Isolation**: All data scoped to user_id
- **SQL Injection Prevention**: Parameterized queries
- **CORS Protection**: Configurable origins
- **Input Validation**: Pydantic schemas

## 📊 Database Schema

### users
- id, email, password_hash, full_name, is_active, created_at

### memories
- id, user_id, content, title, embedding_id, metadata, is_active, created_at

### interactions
- id, user_id, query, response (JSON), context_used, agent_logs, created_at

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Memory Management
- `POST /api/memory/add` - Add memory
- `GET /api/memory/list` - List memories
- `GET /api/memory/{id}` - Get specific memory
- `DELETE /api/memory/{id}` - Delete memory

### Query & Reasoning
- `POST /api/query/ask` - Execute reasoning pipeline
- `GET /api/query/history` - Get query history
- `GET /api/query/{id}` - Get specific interaction

## 🎨 UI Components

- **Auth Page**: Login/signup with validation
- **Dashboard**: Tab-based interface
- **Query Interface**: Input with structured results
- **Memory Input**: Add knowledge to system
- **Memory Timeline**: Visual memory organization
- **Interaction History**: Query results overview

## 🔧 Configuration Options

### LLM Provider
```python
# Use OpenAI (default)
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview

# Or use Groq
LLM_PROVIDER=groq
GROQ_API_KEY=...
GROQ_MODEL=mixtral-8x7b-32768
```

### Embeddings
```python
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

## 🧪 Testing

```bash
# Run tests
pytest

# With coverage
pytest --cov=backend
```

## 📈 Performance Considerations

- ChromaDB for fast semantic search (< 100ms)
- PostgreSQL connection pooling
- JWT token caching
- Redis caching (optional)
- Async/await throughout backend

## 🚀 Production Deployment

### Environment Setup
```bash
# Set DEBUG=False
# Use strong JWT_SECRET_KEY
# Configure DATABASE_URL for production DB
# Set OPENAI_API_KEY securely
```

### Deployment Options
- **Vercel**: Frontend (Next.js)
- **Railway/Render**: Backend (FastAPI)
- **AWS RDS**: PostgreSQL
- **Pinecone/Weaviate**: Hosted vector DB

## 🎓 Fine-tuning Preparation

Dataset format for custom model training:
```json
{
  "input": "User query",
  "context": "Retrieved memory",
  "output": {
    "insights": "...",
    "connections": "...",
    "actions": "..."
  }
}
```

## 🐛 Troubleshooting

### Backend won't start
- Check PostgreSQL is running
- Verify DATABASE_URL
- Check OPENAI_API_KEY

### Vector search not working
- Ensure ChromaDB directory exists
- Check CHROMA_PATH permissions
- Verify embeddings model download

### Frontend can't connect to backend
- Verify NEXT_PUBLIC_API_URL
- Check backend is running on :8000
- Review CORS_ORIGINS in settings

## 📚 Learning Resources

- [FastAPI Docs](https://fastapi.tiangolo.com)
- [LangGraph Docs](https://github.com/langchain-ai/langgraph)
- [ChromaDB Docs](https://docs.trychroma.com)
- [Next.js Docs](https://nextjs.org/docs)

## 📝 License

Proprietary - Devasya AI

## 🙏 Support

For issues and questions:
1. Check troubleshooting section
2. Review logs in `./logs`
3. Check API responses for detailed errors

---

**Built with ❤️ for the future of AI-assisted thinking**
