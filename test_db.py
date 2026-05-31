from sqlalchemy import create_engine, inspect
import os
import sys

db_url = "postgresql://neondb_owner:npg_CceEs4iB2pDu@ep-long-shape-ami8oi05-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require"
try:
    engine = create_engine(db_url)
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print("Tables:", tables)
    if "tasks" in tables:
        print("tasks table columns:", [col['name'] for col in inspector.get_columns("tasks")])
except Exception as e:
    print("Error:", e)
