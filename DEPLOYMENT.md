# Devasya AI - Deployment Guide

## Local Development Setup

### Step 1: Prerequisites
```bash
# Verify you have:
python3 --version  # Should be 3.10+
node --version     # Should be 18+
npm --version      # Or use pnpm/yarn
psql --version     # PostgreSQL 12+
```

### Step 2: Clone & Setup
```bash
# Create project directory
mkdir devasya-ai && cd devasya-ai

# Backend setup
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Frontend setup
npm install
```

### Step 3: Database Setup
```bash
# Create PostgreSQL database
psql -U postgres
CREATE DATABASE devasya_db;
\q

# Update .env with your database connection
DATABASE_URL=postgresql://postgres:password@localhost:5432/devasya_db

# Initialize schema
python -c "from backend.db.postgres import init_db; init_db()"
```

### Step 4: Configure API Keys
```bash
# Edit .env file
OPENAI_API_KEY=sk-your-key-here
# Or
GROQ_API_KEY=your-groq-key-here
```

### Step 5: Run Services

**Terminal 1 - Backend:**
```bash
source venv/bin/activate
python -m uvicorn backend.main:app --reload --port 8000
```

Backend will be available at `http://localhost:8000`
- API docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

**Terminal 2 - Frontend:**
```bash
npm run dev
```

Frontend will be available at `http://localhost:3000`

## Docker Deployment

### Using Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: devasya_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: .
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/devasya_db
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    depends_on:
      - postgres
    volumes:
      - ./data:/app/data

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000

volumes:
  postgres_data:
```

Build and run:
```bash
docker-compose up -d
```

## Production Deployment

### Vercel (Frontend)
```bash
# Push to GitHub
git push origin main

# Connect to Vercel
vercel --prod

# Set environment variables in Vercel dashboard
NEXT_PUBLIC_API_URL=https://api.devasya.com
```

### Railway/Render (Backend)
```bash
# Create Railway account
# Connect GitHub repository
# Set environment variables:
DATABASE_URL=postgresql://...
OPENAI_API_KEY=...
JWT_SECRET_KEY=... (use strong random key)

# Deploy
git push origin main
```

### Production Checklist

- [ ] Set `DEBUG=False`
- [ ] Use strong `JWT_SECRET_KEY`
- [ ] Configure database backups
- [ ] Set up SSL/TLS certificates
- [ ] Enable CORS only for your domain
- [ ] Set up API rate limiting
- [ ] Configure monitoring/logging
- [ ] Set up email for notifications
- [ ] Test all endpoints
- [ ] Set up database connection pooling

## Environment Variables

### Backend (.env)
```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/devasya_db

# JWT
JWT_SECRET_KEY=use-a-very-strong-random-key-here
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24

# Vector Database
CHROMA_PATH=./data/chroma
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2

# LLM
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview

# API
API_PORT=8000
API_HOST=0.0.0.0
DEBUG=False

# CORS
CORS_ORIGINS=["http://localhost:3000", "https://yourdomain.com"]
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Monitoring & Logs

### Backend Logs
```bash
# View real-time logs
tail -f logs/app.log

# Check specific endpoint
curl http://localhost:8000/health
```

### Database Monitoring
```bash
# Connect to database
psql postgresql://user:password@localhost:5432/devasya_db

# Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
FROM pg_tables WHERE schemaname != 'pg_catalog' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Backup & Recovery

### Database Backup
```bash
# Full backup
pg_dump -U user -h localhost devasya_db > backup.sql

# Restore
psql -U user -h localhost devasya_db < backup.sql
```

### Vector Store Backup
```bash
# Backup ChromaDB
cp -r ./data/chroma ./data/chroma.backup
```

## Performance Optimization

### Database
```sql
-- Add indexes
CREATE INDEX idx_memories_user_id ON memories(user_id);
CREATE INDEX idx_memories_created_at ON memories(created_at);
CREATE INDEX idx_interactions_user_id ON interactions(user_id);
```

### Caching
```bash
# Enable Redis (optional)
REDIS_URL=redis://localhost:6379
```

### Vector Search Optimization
```python
# In settings.py
CHROMA_BATCH_SIZE=100  # Batch embeddings for faster processing
```

## Troubleshooting

### Connection Issues
```bash
# Test database connection
psql postgresql://user:password@localhost:5432/devasya_db -c "SELECT 1"

# Test backend availability
curl http://localhost:8000/health
```

### Out of Memory
```bash
# Increase available RAM
# Or reduce embedding batch size in settings
EMBEDDING_BATCH_SIZE=32
```

### Vector Search Slow
```bash
# Rebuild indexes
# Delete and recreate ChromaDB collection
rm -rf ./data/chroma
python -c "from backend.db.vector_store import VectorStore; VectorStore()"
```

## Scaling Considerations

### Horizontal Scaling
- Use load balancer (Nginx/HAProxy)
- Multiple backend instances
- Connection pooling for database
- Dedicated vector DB service

### Database Optimization
- Partition memories by user_id
- Archive old interactions
- Implement data retention policies

### Vector Search Scaling
- Use managed service (Pinecone, Weaviate)
- Implement caching layer (Redis)
- Regular index maintenance

## Security Hardening

### API Security
```python
# Rate limiting
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address)

@app.post("/api/query/ask")
@limiter.limit("10/minute")
def ask_query(query_request: QueryRequest):
    pass
```

### Database Security
```bash
# Use connection pooling
SQLALCHEMY_POOL_SIZE=20
SQLALCHEMY_MAX_OVERFLOW=40

# Enable SSL
postgres://user:password@host:5432/devasya_db?sslmode=require
```

## Support & Maintenance

- Monitor error logs regularly
- Update dependencies monthly
- Run security audits
- Backup data daily
- Test disaster recovery procedures

---

For questions or issues, refer to README.md or check API documentation at `/docs`
