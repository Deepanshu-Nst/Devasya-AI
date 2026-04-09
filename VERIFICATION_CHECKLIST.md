# Devasya AI - Verification Checklist

Before deployment or sharing, verify that everything is working correctly using this checklist.

## Prerequisites ✅

- [ ] Python 3.10+ installed: `python3 --version`
- [ ] Node.js 18+ installed: `node --version`
- [ ] PostgreSQL 12+ installed and running: `psql --version`
- [ ] OpenAI or Groq API key obtained
- [ ] All environment variables configured

## Setup Verification

### Backend Setup
- [ ] Virtual environment created: `python3 -m venv venv`
- [ ] Dependencies installed: `pip install -r requirements.txt`
- [ ] Database created: `createdb devasya_db`
- [ ] `.env` file created with all required variables
- [ ] Database schema initialized: `python -c "from backend.db.postgres import init_db; init_db()"`

### Frontend Setup
- [ ] Node modules installed: `npm install`
- [ ] `.env.local` file created with API URL
- [ ] No TypeScript errors: `npm run build`

## Running Services

### Backend Service
```bash
python -m uvicorn backend.main:app --reload --port 8000
```

Verify:
- [ ] Server starts without errors
- [ ] Console shows: "✓✓✓ All services initialized successfully ✓✓✓"
- [ ] Health check works: `curl http://localhost:8000/health`
- [ ] API docs available: `http://localhost:8000/docs`

### Frontend Service
```bash
npm run dev
```

Verify:
- [ ] Compilation succeeds without errors
- [ ] Frontend available at `http://localhost:3000`
- [ ] No console errors in browser

## Feature Verification

### Authentication Flow
- [ ] Landing page loads at `http://localhost:3000`
- [ ] "Get Started" button visible
- [ ] Can navigate to auth page
- [ ] Sign up form validates:
  - [ ] Email format required
  - [ ] Password required
  - [ ] Full name optional
- [ ] Can create new account
- [ ] Can log in with created account
- [ ] JWT token received and stored
- [ ] Redirects to dashboard after login
- [ ] User name displayed in header

### Memory Management
- [ ] Memory input form visible in Dashboard
- [ ] Can submit memory with content
- [ ] Optional title field works
- [ ] Success message appears after submit
- [ ] Memory appears in timeline
- [ ] Can view list of memories
- [ ] Memory timestamp is correct
- [ ] Can delete memory
- [ ] Memory removed from timeline

### Query/Reasoning
- [ ] Query input box visible
- [ ] Can type multi-line queries
- [ ] Submit button works
- [ ] "Planning..." state appears
- [ ] "Retrieving memory..." state appears
- [ ] "Generating insights..." state appears
- [ ] Response appears with three sections:
  - [ ] Insights section visible
  - [ ] Connections section visible
  - [ ] Actions section visible
- [ ] Validation badge shows grounding score
- [ ] Context/memory sources displayed
- [ ] Agent logs available for review

### History & Tracking
- [ ] Query history tab shows past queries
- [ ] Can scroll through history
- [ ] Each history item shows:
  - [ ] Query text
  - [ ] Timestamp
  - [ ] Insights preview
  - [ ] Connections preview
  - [ ] Actions preview
- [ ] Can access full details of past queries

## API Endpoint Verification

Run test script:
```bash
python scripts/test-api.py
```

Verify all endpoints return ✅:
- [ ] Health check: `GET /health`
- [ ] Register: `POST /api/auth/register`
- [ ] Login: `POST /api/auth/login`
- [ ] Get user: `GET /api/auth/me`
- [ ] Add memory: `POST /api/memory/add`
- [ ] List memories: `GET /api/memory/list`
- [ ] Get memory: `GET /api/memory/{id}`
- [ ] Delete memory: `DELETE /api/memory/{id}`
- [ ] Ask query: `POST /api/query/ask`
- [ ] Query history: `GET /api/query/history`
- [ ] Get interaction: `GET /api/query/{id}`

## Database Verification

Connect to database:
```bash
psql postgresql://user:password@localhost:5432/devasya_db
```

Verify tables exist:
```sql
\dt
```

Should show:
- [ ] users table
- [ ] memories table
- [ ] interactions table

Verify data integrity:
```sql
SELECT COUNT(*) FROM users;          -- Should be > 0
SELECT COUNT(*) FROM memories;       -- Should be > 0
SELECT COUNT(*) FROM interactions;   -- Should be > 0
```

- [ ] All counts are positive
- [ ] No NULL values in critical fields
- [ ] Timestamps are recent
- [ ] user_id references valid users

## Vector Database Verification

Check ChromaDB initialization:
- [ ] `data/chroma` directory exists
- [ ] Directory contains files
- [ ] Vector store has documents

Verify from Python:
```python
from backend.db.vector_store import get_vector_store
vs = get_vector_store()
stats = vs.get_stats()
print(stats)  # Should show document count > 0
```

- [ ] ChromaDB initialized
- [ ] Documents are embedded
- [ ] Search returns relevant results

## Security Verification

### Authentication
- [ ] Without token, protected endpoints return 401
- [ ] Invalid token returns 401
- [ ] Expired token handling works
- [ ] User cannot access other user's data
- [ ] Passwords are hashed (not plain text)

### API Security
```bash
# Test without authorization header
curl http://localhost:8000/api/memory/list
# Should return 401 Unauthorized
```

- [ ] Missing token returns error
- [ ] Test with another user's token - should fail

### CORS
```bash
# Test from different origin
curl -H "Origin: http://example.com" http://localhost:8000/health
```

- [ ] CORS headers present
- [ ] Configured origins allowed
- [ ] Other origins rejected if configured

## Performance Verification

### Response Times
- [ ] Login: < 500ms
- [ ] Memory add: < 1s
- [ ] Memory list: < 500ms
- [ ] Query: 2-5s (varies by LLM)
- [ ] Search: < 100ms

### Vector Search
- [ ] With 10+ memories, search is fast
- [ ] Results are relevant
- [ ] Top results have highest scores

### Concurrent Requests
```bash
# Test with multiple simultaneous requests
ab -n 100 -c 10 http://localhost:8000/health
```

- [ ] Handles concurrent requests
- [ ] No connection errors
- [ ] Responses are consistent

## UI/UX Verification

### Visual Design
- [ ] Colors are consistent
- [ ] Typography is readable
- [ ] Spacing is balanced
- [ ] Icons are visible and clear
- [ ] Responsive on mobile (test with DevTools)

### Animations
- [ ] Framer Motion animations play smoothly
- [ ] No janky transitions
- [ ] Animations don't slow down interactions
- [ ] Loading spinners animate

### Accessibility
- [ ] Can tab through form inputs
- [ ] Focus states visible
- [ ] Alt text on images
- [ ] Error messages are clear
- [ ] Color contrast is sufficient

## Error Handling

### Backend Errors
- [ ] Invalid email returns 400
- [ ] Duplicate email returns 409
- [ ] Invalid token returns 401
- [ ] Not found returns 404
- [ ] Server errors return 500 with message

### Frontend Errors
- [ ] Error messages display clearly
- [ ] Can retry after error
- [ ] Form errors show validation
- [ ] Network errors handled gracefully
- [ ] No console errors on error states

## Data Persistence

- [ ] Data survives browser refresh
- [ ] Memories persist in database
- [ ] User login persists with token
- [ ] Query history is saved
- [ ] Logout clears session

## Documentation Verification

- [ ] README.md is comprehensive
- [ ] QUICKSTART.md has clear steps
- [ ] API_REFERENCE.md documents all endpoints
- [ ] DEPLOYMENT.md covers production
- [ ] Code has comments on complex logic

## Browser Compatibility

Test in multiple browsers:
- [ ] Chrome/Chromium - Latest
- [ ] Firefox - Latest
- [ ] Safari - Latest
- [ ] Edge - Latest

Verify:
- [ ] No console errors
- [ ] All features work
- [ ] Responsive design works
- [ ] Animations smooth

## Mobile Responsiveness

Test on mobile (or DevTools):
- [ ] Layout doesn't break
- [ ] Touch targets are large enough
- [ ] Forms are usable
- [ ] Navigation works
- [ ] Text is readable

## Environment Variables

### Backend (.env)
- [ ] DATABASE_URL is set and correct
- [ ] JWT_SECRET_KEY is strong
- [ ] OPENAI_API_KEY or GROQ_API_KEY is set
- [ ] CHROMA_PATH exists
- [ ] CORS_ORIGINS includes frontend URL

### Frontend (.env.local)
- [ ] NEXT_PUBLIC_API_URL points to backend
- [ ] No sensitive keys in frontend env

## Logging & Monitoring

- [ ] Backend logs are captured
- [ ] Backend logs show initialization
- [ ] Backend logs show requests
- [ ] Browser console shows relevant info
- [ ] No spam of debug logs

## Final System Test

Complete user journey:
1. [ ] Open landing page
2. [ ] Sign up new account
3. [ ] Add 3+ memories with varied content
4. [ ] Ask a complex question
5. [ ] Review results (insights, connections, actions)
6. [ ] Check query history
7. [ ] Logout
8. [ ] Login again
9. [ ] Verify memories still exist
10. [ ] Ask another question

Expected:
- [ ] All steps succeed
- [ ] Data persists
- [ ] No errors occur
- [ ] Responses are sensible

## Production Readiness

Before deploying:
- [ ] DEBUG=False in backend
- [ ] JWT_SECRET_KEY is strong random value
- [ ] Database backups configured
- [ ] SSL/TLS certificates ready
- [ ] API rate limiting configured (or will be)
- [ ] Error monitoring setup (or planned)
- [ ] All secrets in environment (not hardcoded)
- [ ] Tests pass locally
- [ ] Code reviewed
- [ ] Performance acceptable
- [ ] Security verified

## Sign-Off

- [ ] Developer tested all features
- [ ] All checks passed
- [ ] Documentation reviewed
- [ ] No critical bugs found
- [ ] Ready for deployment

---

## Troubleshooting Quick Reference

| Issue | Solution |
|-------|----------|
| Backend won't start | Check PostgreSQL running, DATABASE_URL correct |
| 401 Unauthorized errors | Verify JWT_SECRET_KEY matches, token not expired |
| Vector search not working | Check data/chroma directory exists, restart services |
| Frontend won't connect | Verify NEXT_PUBLIC_API_URL, backend running on :8000 |
| Slow responses | Check database performance, reduce embedding batch size |
| Out of memory | Increase available RAM or reduce batch sizes |
| CORS errors | Check CORS_ORIGINS in backend config |

---

## Performance Targets

| Metric | Target | Actual |
|--------|--------|--------|
| API Response (health) | < 100ms | _____ |
| Login | < 500ms | _____ |
| Memory add | < 1s | _____ |
| Vector search | < 100ms | _____ |
| Query (full) | 2-5s | _____ |
| Frontend load | < 2s | _____ |
| Page navigation | < 500ms | _____ |

---

## Notes

Use this space for additional verification notes or issues found:

```
[Space for notes]
```

---

## Approval

- Developer Name: ________________
- Date: ________________
- All tests passed: ☐ Yes ☐ No
- Ready for production: ☐ Yes ☐ No

---

**Complete this checklist before deploying to production or sharing with others.**

If any item fails, troubleshoot before proceeding to next phase.
