#!/bin/bash

# Devasya AI Setup Script
echo "🚀 Setting up Devasya AI..."

# Check Python version
echo "Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.10 or higher."
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "✓ Python $PYTHON_VERSION found"

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "📦 Installing uv package manager..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
fi

# Create data directory for ChromaDB
echo "📁 Creating data directories..."
mkdir -p data/chroma
mkdir -p logs

# Install Python dependencies
echo "📦 Installing Python dependencies..."
cd $(dirname "$0")/.
uv venv
source .venv/bin/activate
uv sync

# Create PostgreSQL database
echo "🗄️  Setting up PostgreSQL database..."
echo ""
echo "Make sure PostgreSQL is running and configure DATABASE_URL in .env"
echo "Default: postgresql://user:password@localhost:5432/devasya_db"
echo ""
echo "To create the database manually:"
echo "  createdb -U user devasya_db"
echo ""

# Initialize database
echo "🔄 Initializing database schema..."
python3 -c "from backend.db.postgres import init_db; init_db()"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Configure .env file with your settings"
echo "2. Set up PostgreSQL database"
echo "3. Start the backend: python -m uvicorn backend.main:app --reload"
echo "4. Start the frontend: npm run dev"
echo ""
