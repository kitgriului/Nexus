
import React, { useState, useRef, useEffect } from 'react';
import { Icon } from './Icons';

interface RecorderProps {
  onStop: (blob: Blob, type: 'audio' | 'video') => void;
  onCancel: () => void;
}

export const Recorder: React.FC<RecorderProps> = ({ onStop, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [mode, setMode] = useState<'audio' | 'video'>('audio');
  const [duration, setDuration] = useState(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<number | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode === 'video'
      });
      
      if (videoRef.current && mode === 'video') {
        videoRef.current.srcObject = stream;
      }

      const recorder = new MediaRecorder(stream);
      mediaRecorder.current = recorder;
      chunks.current = [];

      recorder.ondataavailable = (e) => chunks.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: mode === 'audio' ? 'audio/webm' : 'video/webm' });
        onStop(blob, mode);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      timerRef.current = window.setInterval(() => setDuration(prev => prev + 1), 1000);
    } catch (err) {
      console.error("Recording error:", err);
    }
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setDuration(0);
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-6 backdrop-blur-sm">
      <div className="w-full max-w-sm flex flex-col items-center">
        {mode === 'video' && (
          <div className="w-full aspect-square bg-gray-900 rounded-3xl overflow-hidden mb-8 border border-white/10">
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
          </div>
        )}
        
        <div className="text-white text-5xl font-light mb-12 tabular-nums">
          {formatTime(duration)}
        </div>

        <div className="flex gap-4 mb-12">
          {!isRecording && (
            <>
              <button 
                onClick={() => setMode('audio')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${mode === 'audio' ? 'bg-white text-black' : 'text-white/40 border border-white/20'}`}
              >
                Audio
              </button>
              <button 
                onClick={() => setMode('video')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${mode === 'video' ? 'bg-white text-black' : 'text-white/40 border border-white/20'}`}
              >
                Video
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-12">
          <button onClick={onCancel} className="p-4 text-white/40 hover:text-white transition-colors">
            <Icon name="x" size={28} />
          </button>
          
          <button 
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 scale-110' : 'bg-white hover:scale-105'}`}
          >
            {isRecording ? (
              <div className="w-8 h-8 bg-white rounded-sm" />
            ) : (
              <div className="w-8 h-8 bg-red-500 rounded-full" />
            )}
          </button>

          <div className="w-10" /> {/* Spacer */}
        </div>
      </div>
    </div>
  );
};
