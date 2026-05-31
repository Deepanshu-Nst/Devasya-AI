from sqlalchemy import create_engine, text
from core.config import settings

engine = create_engine(settings.DATABASE_URL)

with open("../supabase/migrations/03_blocks_schema.sql", "r") as f:
    sql = f.read()

with engine.connect() as conn:
    conn.execute(text(sql))
    conn.commit()
print("Migration applied successfully.")
