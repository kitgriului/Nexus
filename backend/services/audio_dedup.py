"""
Audio deduplication using chromaprint fingerprinting
"""
import acoustid
from backend.config.settings import settings


class AudioDeduplicator:
    """Generate audio fingerprints for deduplication"""
    
    def generate_hash(self, audio_path: str) -> str:
        """
        Generate chromaprint fingerprint hash
        
        Returns:
            str: Hex-encoded fingerprint hash
        """
        try:
            # Generate fingerprint using acoustid
            duration, fingerprint = acoustid.fingerprint_file(audio_path)
            
            # Use fingerprint as hash (it's already a unique representation)
            # Truncate to reasonable length for storage
            return fingerprint[:64]
            
        except Exception as e:
            raise Exception(f"Failed to generate audio fingerprint: {str(e)}")
    
    def compare_hashes(self, hash1: str, hash2: str) -> bool:
        """
        Compare two audio hashes for similarity
        
        For chromaprint, exact match is sufficient for duplicates
        """
        return hash1 == hash2
