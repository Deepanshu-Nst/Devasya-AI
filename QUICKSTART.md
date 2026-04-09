# Devasya AI - Quick Start Guide

Get Devasya AI up and running in 15 minutes!

## Prerequisites Check

```bash
# Python 3.10+
python3 --version

# Node.js 18+
node --version

# PostgreSQL 12+ (running locally or accessible)
psql --version
```

## 1. Backend Setup (5 minutes)

### Install Python Dependencies

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate
# On Windows: venv\Scripts\activate

# Install packages
pip install -r requirements.txt
```

### Setup Database

```bash
# Create database (if not exists)
psql -U postgres -c "CREATE DATABASE devasya_db;"

# Update .env with your database
# Example:
# DATABASE_URL=postgresql://postgres:password@localhost:5432/devasya_db

# Initialize database schema
python -c "from backend.db.postgres import init_db; init_db()"
```

### Configure API Keys

Edit `.env` file:
```env
# Required
OPENAI_API_KEY=sk-your-api-key-here
# Or use Groq:
# GROQ_API_KEY=your-groq-key
# LLM_PROVIDER=groq

# Update these for security
JWT_SECRET_KEY=change-this-to-a-random-string
```

### Start Backend

```bash
python -m uvicorn backend.main:app --reload --port 8000
```

✅ Backend running at `http://localhost:8000`
- Docs: `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`

## 2. Frontend Setup (3 minutes)

### Install Dependencies

```bash
npm install
# or
pnpm install
```

### Update Frontend Config

Edit `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Start Frontend

```bash
npm run dev
```

✅ Frontend running at `http://localhost:3000`

## 3. Test the System (2 minutes)

### Using the UI

1. Open `http://localhost:3000` in your browser
2. Click "Get Started" or "Sign up"
3. Create an account
4. Add a memory (e.g., "I learned about AI today")
5. Ask a question about what you learned
6. View the structured insights

### Using the API

```bash
# Test the API
python scripts/test-api.py
```

This will:
- ✅ Register a test user
- ✅ Add sample memories
- ✅ Query with multi-agent reasoning
- ✅ Show results

## 4. Explore Features

### Add Memories
- Store notes, ideas, documents
- Titles and metadata for organization
- Automatically embedded for semantic search

### Ask Questions
- Leverage your memories for context
- Get structured outputs:
  - **Insights**: Key findings
  - **Connections**: Related ideas
  - **Actions**: Recommendations

### View History
- See all your past queries
- Track your thinking evolution
- Review agent reasoning logs

## 5. Next Steps

### Explore the Code
- **Backend**: `/backend` - FastAPI, agents, RAG
- **Frontend**: `/app`, `/components` - Next.js, UI
- **Database**: Models in `/backend/models/schema.py`

### Customize
- Modify agents in `/backend/services/agents.py`
- Change UI in `/components`
- Adjust settings in `/backend/config/settings.py`

### Deploy
- See `DEPLOYMENT.md` for production setup
- Frontend to Vercel
- Backend to Railway/Render
- Database to AWS RDS

## Troubleshooting

### "Connection refused" on backend startup
```bash
# Make sure PostgreSQL is running
psql -U postgres -c "SELECT 1"

# Check DATABASE_URL in .env
```

### "Cannot find module" errors
```bash
# Backend
source venv/bin/activate
pip install -r requirements.txt

# Frontend
npm install
```

### Vector store errors
```bash
# Ensure directory exists
mkdir -p data/chroma

# Clear old data if needed
rm -rf data/chroma/*
```

### API returns 500 error
```bash
# Check backend logs
# Look for missing env variables
# Ensure OpenAI/Groq API key is set
```

## Project Structure Overview

```
devasya-ai/
├── backend/                    # FastAPI backend
│   ├── api/                   # API endpoints
│   ├── services/              # Business logic & agents
│   ├── db/                    # Database handlers
│   └── main.py               # Application entry
├── app/                       # Next.js pages
│   ├── page.tsx              # Landing page
│   ├── auth/                 # Authentication
│   └── dashboard/            # Main interface
├── components/                # React components
├── lib/                       # Utilities & stores
├── .env                       # Backend config
├── .env.local                 # Frontend config
└── README.md                  # Full documentation
```

## Common Commands

```bash
# Backend development
python -m uvicorn backend.main:app --reload

# Frontend development
npm run dev

# Test API
python scripts/test-api.py

# Database access
psql postgresql://user:password@localhost:5432/devasya_db

# View logs
tail -f logs/app.log
```

## API Examples

### Register
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secure-password",
    "full_name": "Your Name"
  }'
```

### Login
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=user@example.com&password=secure-password"
```

### Add Memory
```bash
curl -X POST http://localhost:8000/api/memory/add \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Important information to remember",
    "title": "My Note"
  }'
```

### Query
```bash
curl -X POST http://localhost:8000/api/query/ask \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What should I do?",
    "use_memory": true
  }'
```

## Performance Tips

- **First run**: Initial embedding model download may take time
- **Vector search**: ChromaDB is fast (~100ms per query)
- **LLM calls**: Groq is faster than OpenAI
- **Database**: Ensure PostgreSQL is well-resourced

## Getting Help

1. Check `README.md` for detailed docs
2. See `DEPLOYMENT.md` for production info
3. Check API docs: `http://localhost:8000/docs`
4. Review logs for errors
5. Test API: `python scripts/test-api.py`

## What's Next?

✅ **System is running** - You're all set!

Explore:
- Add meaningful memories
- Ask complex questions
- Experiment with different query types
- Review the agent logs to understand reasoning
- Customize the agents in `/backend/services/agents.py`

---

**Happy building! 🚀**
