from pydantic import BaseModel, ValidationError
from typing import Optional

class MemoryCreate(BaseModel):
    content: str
    title: Optional[str] = None
    visibility: Optional[str] = "private"

try:
    m = MemoryCreate(**{"content": "test", "title": "t", "metadata": {}})
    print("Success:", m.model_dump())
except ValidationError as e:
    print("Error:", e)
