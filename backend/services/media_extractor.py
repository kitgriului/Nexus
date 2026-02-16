"""
Media extraction service using yt-dlp and ffmpeg
"""
import os
import subprocess
from typing import Dict
import yt_dlp

from backend.config.settings import settings


class MediaExtractor:
    """Extract audio from URLs (YouTube, etc.) using yt-dlp"""
    
    def __init__(self):
        self.temp_dir = settings.TEMP_DIR
    
    def download_url(self, url: str) -> Dict[str, any]:
        """
        Download media from URL and extract audio
        
        Returns:
            dict: {
                'audio_path': str,
                'title': str,
                'duration': int (seconds)
            }
        """
        output_template = os.path.join(self.temp_dir, '%(id)s.%(ext)s')
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': output_template,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'wav',
                'preferredquality': '192',
            }],
            'quiet': True,
            'no_warnings': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            
            # Get downloaded file path
            video_id = info['id']
            audio_path = os.path.join(self.temp_dir, f"{video_id}.wav")
            
            return {
                'audio_path': audio_path,
                'title': info.get('title', 'Unknown Title'),
                'duration': int(info.get('duration', 0))
            }
    
    def get_audio_duration(self, file_path: str) -> int:
        """
        Get audio duration in seconds using ffprobe
        """
        try:
            result = subprocess.run(
                [
                    'ffprobe',
                    '-v', 'error',
                    '-show_entries', 'format=duration',
                    '-of', 'default=noprint_wrappers=1:nokey=1',
                    file_path
                ],
                capture_output=True,
                text=True,
                check=True
            )
            return int(float(result.stdout.strip()))
        except Exception:
            return 0
    
    def convert_to_wav(self, input_path: str, output_path: str):
        """
        Convert any audio format to WAV using ffmpeg
        """
        subprocess.run(
            [
                'ffmpeg',
                '-i', input_path,
                '-ar', '16000',  # 16kHz sample rate (optimal for Whisper)
                '-ac', '1',  # Mono
                '-c:a', 'pcm_s16le',  # 16-bit PCM
                output_path,
                '-y'  # Overwrite
            ],
            check=True,
            capture_output=True
        )
