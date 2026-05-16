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
  const stateRef                    = useRef<VoiceState>('idle');

  // Keep stateRef in sync so callbacks always see current state
  stateRef.current = state;

  const startRecording = useCallback(async () => {
    // Use ref to avoid stale closure issues with state
    if (stateRef.current !== 'idle' && stateRef.current !== 'error') return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Check supported MIME types
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';

      const recorderOptions: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, recorderOptions);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setState('processing');
        stateRef.current = 'processing';

        try {
          const actualMime = mimeType || 'audio/webm';
          const blob = new Blob(chunksRef.current, { type: actualMime });
          const text = await transcribeAudio(blob);
          setTranscript(text);
          onTranscript(text);
        } catch (err) {
          console.error('[STT error]', err);
          setState('error');
          stateRef.current = 'error';
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setState('recording');
      stateRef.current = 'recording';
    } catch (err) {
      console.error('[Mic error]', err);
      setState('error');
      stateRef.current = 'error';
    }
  }, [onTranscript]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && stateRef.current === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  /** Toggle: click once to start, click again to stop */
  const toggleRecording = useCallback(() => {
    if (stateRef.current === 'recording') {
      stopRecording();
    } else {
      startRecording();
    }
  }, [startRecording, stopRecording]);

  const speak = useCallback(async (text: string) => {
    setState('speaking');
    stateRef.current = 'speaking';
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
        stateRef.current = 'idle';
      };

      await audio.play();
    } catch (err) {
      console.error('[TTS error]', err);
      setState('idle');
      stateRef.current = 'idle';
    }
  }, []);

  const reset = () => {
    setState('idle');
    stateRef.current = 'idle';
    setTranscript('');
  };

  return { state, transcript, startRecording, stopRecording, toggleRecording, speak, reset };
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
