"use client";

import { useState, useRef, useCallback } from "react";

export type VoiceState =
  | "idle"
  | "recording"
  | "processing"
  | "speaking"
  | "error";

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
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stateRef = useRef<VoiceState>("idle");

  // Keep stateRef in sync so callbacks always see current state
  stateRef.current = state;

  const startRecording = useCallback(async () => {
    // Use ref to avoid stale closure issues with state
    if (stateRef.current !== "idle" && stateRef.current !== "error") return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState("processing");
        stateRef.current = "processing";

        try {
          const blob = new Blob(chunksRef.current, {
            type: mimeType || "audio/webm",
          });
          const text = await transcribeAudio(blob);
          setTranscript(text);
          await onTranscript(text);
        } catch (err) {
          console.error("[STT/transcript error]", err);
          setState("error");
          stateRef.current = "error";
        } finally {
          // If onTranscript completed without transitioning away from 'processing'
          // (e.g. backend error that skips speak), reset to idle.
          setState((prev) => (prev === "processing" ? "idle" : prev));
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setState("recording");
      stateRef.current = "recording";
    } catch (err) {
      console.error("[Mic error]", err);
      setState("error");
      stateRef.current = "error";
    }
  }, [onTranscript]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && stateRef.current === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  /** Toggle: click once to start, click again to stop */
  const toggleRecording = useCallback(() => {
    if (stateRef.current === "recording") {
      stopRecording();
    } else {
      startRecording();
    }
  }, [startRecording, stopRecording]);

  const speak = useCallback(async (text: string) => {
    setState("speaking");
    stateRef.current = "speaking";
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
      const res = await fetch(`${backendUrl}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("TTS request failed");

      const audioBlob = await res.blob();
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);

      await new Promise<void>((resolve) => {
        audio.onended = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.play().catch(resolve);
      });
    } catch (err) {
      console.error("[TTS error]", err);
    } finally {
      setState("idle");
      stateRef.current = "idle";
    }
  }, []);

  const reset = () => {
    setState("idle");
    stateRef.current = "idle";
    setTranscript("");
  };

  return { state, transcript, startRecording, stopRecording, toggleRecording, speak, reset };
}

// ── MIME type detection (audio/webm not supported on Safari) ──────
function getSupportedMimeType(): string {
  const candidates = ["audio/webm", "audio/mp4", "audio/ogg"];
  for (const type of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(type)
    ) {
      return type;
    }
  }
  return "";
}

// ── ElevenLabs Scribe v2 transcription ───────────────────────────
async function transcribeAudio(blob: Blob): Promise<string> {
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
  const res = await fetch(`${backendUrl}/api/stt`, {
    method: "POST",
    headers: {
      "Content-Type": blob.type || "audio/webm",
    },
    body: blob,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`STT proxy error: ${err}`);
  }

  const data = await res.json();
  return data.text ?? "";
}
