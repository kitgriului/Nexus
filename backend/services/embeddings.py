"""
Embeddings generation for semantic search
"""
from typing import List
from sentence_transformers import SentenceTransformer

# Load model once at module import
model = SentenceTransformer('sentence-transformers/all-mpnet-base-v2')


def generate_embedding(text: str) -> List[float]:
    """
    Generate embedding vector for text
    
    Returns:
        list[float]: 768-dimensional embedding vector
    """
    embedding = model.encode(text, convert_to_numpy=True)
    return embedding.tolist()


def generate_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """
    Generate embeddings for multiple texts (more efficient)
    """
    embeddings = model.encode(texts, convert_to_numpy=True, batch_size=32)
    return [emb.tolist() for emb in embeddings]
