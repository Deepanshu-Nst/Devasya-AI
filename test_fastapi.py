from fastapi import FastAPI, BackgroundTasks, Depends
from pydantic import BaseModel
from typing import Optional
from fastapi.testclient import TestClient

app = FastAPI()

class MemoryCreate(BaseModel):
    content: str
    title: Optional[str] = None
    visibility: Optional[str] = "private"

def fake_db():
    yield "db"

def bg_task(memory_id, content):
    print("running bg task for", memory_id)

@app.post("/add")
def add_memory(
    memory_data: MemoryCreate,
    background_tasks: BackgroundTasks,
    db: str = Depends(fake_db)
):
    background_tasks.add_task(bg_task, "123", memory_data.content)
    return {"id": "123", "content": memory_data.content}

client = TestClient(app)
response = client.post("/add", json={"content": "test", "title": "t"})
print(response.status_code, response.json())
