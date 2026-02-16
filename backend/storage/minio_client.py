"""
MinIO client for object storage
"""
import os
from minio import Minio
from minio.error import S3Error
from backend.config.settings import settings


class MinIOClient:
    """MinIO/S3 client for storing media files"""
    
    def __init__(self):
        self.client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE
        )
        self.bucket = settings.MINIO_BUCKET
        self._ensure_bucket()
    
    def _ensure_bucket(self):
        """Create bucket if it doesn't exist"""
        try:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
                print(f"✅ Created MinIO bucket: {self.bucket}")
        except S3Error as e:
            print(f"❌ MinIO bucket error: {e}")
    
    def upload_audio(self, file_path: str, media_id: str) -> str:
        """
        Upload audio file to MinIO
        
        Returns:
            str: MinIO object path (audio/{media_id}.wav)
        """
        object_name = f"audio/{media_id}.wav"
        
        try:
            self.client.fput_object(
                self.bucket,
                object_name,
                file_path,
                content_type='audio/wav'
            )
            return object_name
        except S3Error as e:
            raise Exception(f"Failed to upload to MinIO: {str(e)}")
    
    def download_audio(self, object_name: str) -> str:
        """
        Download audio file from MinIO to temp directory
        
        Returns:
            str: Local file path
        """
        local_path = os.path.join(
            settings.TEMP_DIR,
            os.path.basename(object_name)
        )
        
        try:
            self.client.fget_object(
                self.bucket,
                object_name,
                local_path
            )
            return local_path
        except S3Error as e:
            raise Exception(f"Failed to download from MinIO: {str(e)}")
    
    def delete_audio(self, object_name: str):
        """Delete audio file from MinIO"""
        try:
            self.client.remove_object(self.bucket, object_name)
        except S3Error as e:
            raise Exception(f"Failed to delete from MinIO: {str(e)}")
    
    def get_presigned_url(self, object_name: str, expires_seconds: int = 3600) -> str:
        """
        Get temporary presigned URL for direct audio access
        """
        try:
            url = self.client.presigned_get_object(
                self.bucket,
                object_name,
                expires=expires_seconds
            )
            return url
        except S3Error as e:
            raise Exception(f"Failed to generate presigned URL: {str(e)}")
