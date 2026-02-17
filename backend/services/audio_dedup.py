"""
Audio deduplication using chromaprint fingerprinting
"""
import base64
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

            # Normalize fingerprint to a stable ASCII string for DB storage
            if isinstance(fingerprint, bytes):
                encoded = base64.urlsafe_b64encode(fingerprint).decode('ascii')
            else:
                encoded = str(fingerprint)

            # Truncate to fit the database column size
            return encoded[:64]
            
        except Exception as e:
            raise Exception(f"Failed to generate audio fingerprint: {str(e)}")
    
    def compare_hashes(self, hash1: str, hash2: str) -> bool:
        """
        Compare two audio hashes for similarity
        
        For chromaprint, exact match is sufficient for duplicates
        """
        return hash1 == hash2
