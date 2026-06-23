"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function pickRecorderMimeType(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];

  if (typeof MediaRecorder === "undefined") return undefined;
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export function useVoiceRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopResolverRef = useRef<((blob: Blob | null) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    mediaRecorderRef.current = null;
    chunksRef.current = [];

    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const startRecording = useCallback(async () => {
    if (isRecording) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone recording is not supported in this browser.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickRecorderMimeType();
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    chunksRef.current = [];
    mediaStreamRef.current = stream;
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blobType = recorder.mimeType || mimeType || "audio/webm";
      const blob =
        chunksRef.current.length > 0
          ? new Blob(chunksRef.current, { type: blobType })
          : null;

      cleanup();
      setIsRecording(false);
      setDurationSeconds(0);
      stopResolverRef.current?.(blob);
      stopResolverRef.current = null;
    };

    recorder.onerror = () => {
      cleanup();
      setIsRecording(false);
      setDurationSeconds(0);
      stopResolverRef.current?.(null);
      stopResolverRef.current = null;
    };

    recorder.start();
    setIsRecording(true);
    setDurationSeconds(0);
    timerRef.current = setInterval(() => {
      setDurationSeconds((current) => current + 1);
    }, 1000);
  }, [cleanup, isRecording]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      stopResolverRef.current = resolve;
      recorder.stop();
    });
  }, []);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      stopResolverRef.current = null;
      recorder.stop();
    } else {
      cleanup();
      setIsRecording(false);
      setDurationSeconds(0);
    }
  }, [cleanup]);

  return {
    isRecording,
    durationSeconds,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
