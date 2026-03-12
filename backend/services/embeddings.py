"""
Embeddings generation for semantic search.
Uses sentence-transformers all-MiniLM-L6-v2 (384-dim) locally.
Falls back to hash-based embeddings if model unavailable.
"""
from typing import List
import threading

_model = None
_model_lock = threading.Lock()
EMBEDDING_DIM = 384


def _get_model():
    """Lazy-load the sentence-transformers model (thread-safe)."""
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                try:
                    from sentence_transformers import SentenceTransformer
                    _model = SentenceTransformer('all-MiniLM-L6-v2')
                    print("Loaded sentence-transformers model: all-MiniLM-L6-v2")
                except Exception as e:
                    print(f"Failed to load sentence-transformers model: {e}")
                    _model = None
    return _model


def generate_embedding(text: str) -> List[float]:
    """Generate a 384-dim embedding for a single text."""
    model = _get_model()
    if model is None:
        return _fallback_embedding(text)
    try:
        emb = model.encode(text[:8000], normalize_embeddings=True)
        return emb.tolist()
    except Exception as e:
        print(f"Embedding failed: {e}, using fallback")
        return _fallback_embedding(text)


def generate_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """Generate 384-dim embeddings for a batch of texts."""
    model = _get_model()
    if model is None:
        return [_fallback_embedding(t) for t in texts]
    try:
        embs = model.encode([t[:8000] for t in texts], normalize_embeddings=True)
        return [e.tolist() for e in embs]
    except Exception as e:
        print(f"Batch embedding failed: {e}, using fallback")
        return [_fallback_embedding(t) for t in texts]


def _fallback_embedding(text: str) -> List[float]:
    """Hash-based deterministic fallback embedding (384-dim)."""
    import hashlib, math
    h = hashlib.sha256(text.encode()).digest()
    return [math.sin(h[i % 32] * (i + 1) * 0.01) for i in range(EMBEDDING_DIM)]
