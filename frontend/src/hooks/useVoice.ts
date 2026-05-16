'use client';

import { useState, useRef, useCallback } from 'react';

export type VoiceState = 'idle' | 'recording' | 'processing' | 'speaking' | 'error';

export interface UseVoiceOptions {
  onTranscript: (text: string) => void;
}

/**
 * useVoice
 *
 * Handles:
 *  1. Microphone capture (MediaRecorder)
 *  2. Sending audio to ElevenLabs Scribe v2 through our backend proxy
 *  3. Receiving transcript and calling onTranscript
 *  4. Playing TTS audio from backend /api/tts
 */
export function useVoice({ onTranscript }: UseVoiceOptions) {
  const [state, setState]           = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const mediaRecorderRef            = useRef<MediaRecorder | null>(null);
  const chunksRef                   = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    if (state !== 'idle') return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setState('processing');

        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const text = await transcribeAudio(blob);
          setTranscript(text);
          onTranscript(text);
        } catch (err) {
          console.error('[STT error]', err);
          setState('error');
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setState('recording');
    } catch (err) {
      console.error('[Mic error]', err);
      setState('error');
    }
  }, [state, onTranscript]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, [state]);

  const speak = useCallback(async (text: string) => {
    setState('speaking');
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';
      const res = await fetch(
        `${backendUrl}/api/tts`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ text }),
        }
      );
      if (!res.ok) throw new Error('TTS request failed');

      const audioBlob = await res.blob();
      const url       = URL.createObjectURL(audioBlob);
      const audio     = new Audio(url);

      audio.onended = () => {
        URL.revokeObjectURL(url);
        setState('idle');
      };

      await audio.play();
    } catch (err) {
      console.error('[TTS error]', err);
      setState('idle');
    }
  }, []);

  const reset = () => {
    setState('idle');
    setTranscript('');
  };

  return { state, transcript, startRecording, stopRecording, speak, reset };
}

// ── ElevenLabs Scribe v2 transcription ───────────────────────────
async function transcribeAudio(blob: Blob): Promise<string> {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';
  const res = await fetch(`${backendUrl}/api/stt`, {
    method:  'POST',
    headers: {
      'Content-Type': blob.type || 'audio/webm',
    },
    body: blob,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`STT proxy error: ${err}`);
  }

  const data = await res.json();
  return data.text ?? '';
}
