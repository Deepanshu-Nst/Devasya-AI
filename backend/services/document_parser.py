import io
import docx
from PyPDF2 import PdfReader

def extract_text_from_file(file_content: bytes, filename: str) -> str:
    """Extract text from PDF, DOCX, or TXT content."""
    text = ""
    file_ext = filename.split(".")[-1].lower() if "." in filename else ""
    
    try:
        if file_ext == "pdf":
            reader = PdfReader(io.BytesIO(file_content))
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        elif file_ext in ["doc", "docx"]:
            doc = docx.Document(io.BytesIO(file_content))
            for para in doc.paragraphs:
                text += para.text + "\n"
        else:
            # Assume plain text
            text = file_content.decode("utf-8")
    except Exception as e:
        raise ValueError(f"Failed to extract text from {filename}: {str(e)}")
        
    return text.strip()

import re

def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 100) -> list[str]:
    """Split text into sentence-aware overlapping chunks."""
    lines = text.split('\n')
    sentences = []
    for line in lines:
        for s in re.split(r'(?<=[.!?])\s+', line):
            if s.strip():
                sentences.append(s.strip())
    
    chunks = []
    if not sentences:
        return chunks
        
    current_chunk = []
    current_length = 0
    
    for sentence in sentences:
        sentence_len = len(sentence)
        if current_length + sentence_len > chunk_size and current_length > 0:
            chunks.append(" ".join(current_chunk))
            
            # Start new chunk with overlap
            overlap_length = 0
            overlap_chunk = []
            for s in reversed(current_chunk):
                if overlap_length + len(s) > overlap:
                    break
                overlap_chunk.insert(0, s)
                overlap_length += len(s) + 1
                
            current_chunk = overlap_chunk if overlap_chunk else [current_chunk[-1]]
            current_length = sum(len(s) + 1 for s in current_chunk)
            
        current_chunk.append(sentence)
        current_length += sentence_len + 1
        
    if current_chunk:
        chunks.append(" ".join(current_chunk))
        
    return chunks
