import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useVoice } from "./useVoice";

type MockTrack = { stop: ReturnType<typeof vi.fn> };

let getUserMediaMock: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;

class MockMediaRecorder {
  static isTypeSupported = vi.fn(() => true);

  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void | Promise<void>) | null = null;

  constructor(
    public stream: MediaStream,
    public options: MediaRecorderOptions
  ) {
    mediaRecorderInstances.push(this);
  }

  start = vi.fn();

  stop = vi.fn(() => {
    this.onstop?.();
  });
}

const mediaRecorderInstances: MockMediaRecorder[] = [];

describe("useVoice", () => {
  beforeEach(() => {
    mediaRecorderInstances.length = 0;

    getUserMediaMock = vi.fn();
    fetchMock = vi.fn();

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: getUserMediaMock,
      },
    });

    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: MockMediaRecorder,
    });

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:mock-audio"),
    });

    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });

    Object.defineProperty(globalThis, "Audio", {
      configurable: true,
      value: class MockAudio {
        onended: (() => void) | null = null;
        onerror: (() => void) | null = null;

        constructor(public src: string) {}

        play = vi.fn(() => {
          this.onended?.();
          return Promise.resolve();
        });
      },
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  it("records audio, sends it to STT, and calls the transcript handler", async () => {
    const trackStop = vi.fn();
    const stream = {
      getTracks: () => [{ stop: trackStop } as MockTrack],
    } as unknown as MediaStream;

    getUserMediaMock.mockResolvedValue(stream);
    fetchMock.mockImplementation(async (input) => {
      if (String(input).includes("/api/stt")) {
        return {
          ok: true,
          json: async () => ({ text: "hello world" }),
        } as Response;
      }

      throw new Error(`Unexpected fetch: ${String(input)}`);
    });

    const onTranscript = vi.fn();
    const { result } = renderHook(() => useVoice({ onTranscript }));

    await act(async () => {
      await result.current.startRecording();
    });

    expect(getUserMediaMock).toHaveBeenCalledWith({ audio: true });
    expect(result.current.state).toBe("recording");
    expect(mediaRecorderInstances).toHaveLength(1);

    mediaRecorderInstances[0].ondataavailable?.({
      data: new Blob(["chunk"], { type: "audio/webm" }),
    });

    await act(async () => {
      result.current.stopRecording();
    });

    await waitFor(() =>
      expect(onTranscript).toHaveBeenCalledWith("hello world")
    );
    expect(result.current.transcript).toBe("hello world");
    expect(result.current.state).toBe("idle");
    expect(trackStop).toHaveBeenCalled();
  });

  it("moves to error when microphone access fails", async () => {
    getUserMediaMock.mockRejectedValue(new Error("permission denied"));

    const { result } = renderHook(() => useVoice({ onTranscript: vi.fn() }));

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.state).toBe("error");
  });

  it("plays TTS audio and resets back to idle", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["audio"], { type: "audio/mpeg" }),
    } as Response);

    const { result } = renderHook(() => useVoice({ onTranscript: vi.fn() }));

    await act(async () => {
      await result.current.speak("hello");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/tts",
      expect.objectContaining({ method: "POST" })
    );
    expect(result.current.state).toBe("idle");
  });
});
