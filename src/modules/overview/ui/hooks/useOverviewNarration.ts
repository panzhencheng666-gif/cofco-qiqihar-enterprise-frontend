import { useCallback, useEffect, useRef, useState } from "react";

export type NarrationAvailability = "available" | "unsupported";
export type NarrationState = "idle" | "speaking" | "paused" | "ended" | "error";

export function useOverviewNarration(transcript: string) {
  const availability: NarrationAvailability = supportsSpeech()
    ? "available"
    : "unsupported";
  const [state, setState] = useState<NarrationState>("idle");
  const utterance = useRef<SpeechSynthesisUtterance | undefined>(undefined);
  const priorTranscript = useRef(transcript);

  const stop = useCallback(() => {
    utterance.current = undefined;
    if (supportsSpeech()) window.speechSynthesis.cancel();
    setState("idle");
  }, []);

  useEffect(() => {
    if (priorTranscript.current === transcript) return;
    priorTranscript.current = transcript;
    stop();
  }, [stop, transcript]);

  useEffect(
    () => () => {
      utterance.current = undefined;
      if (supportsSpeech()) window.speechSynthesis.cancel();
    },
    [],
  );

  const start = useCallback(() => {
    if (!supportsSpeech() || !transcript.trim()) return;
    window.speechSynthesis.cancel();
    const nextUtterance = new SpeechSynthesisUtterance(transcript);
    nextUtterance.lang = "zh-CN";
    nextUtterance.rate = 0.94;
    nextUtterance.onend = () => {
      if (utterance.current !== nextUtterance) return;
      utterance.current = undefined;
      setState("ended");
    };
    nextUtterance.onerror = () => {
      if (utterance.current !== nextUtterance) return;
      utterance.current = undefined;
      setState("error");
    };
    utterance.current = nextUtterance;
    window.speechSynthesis.speak(nextUtterance);
    setState("speaking");
  }, [transcript]);

  const pauseOrResume = useCallback(() => {
    if (!supportsSpeech()) return;
    if (state === "speaking") {
      window.speechSynthesis.pause();
      setState("paused");
      return;
    }
    if (state === "paused") {
      window.speechSynthesis.resume();
      setState("speaking");
    }
  }, [state]);

  return { availability, pauseOrResume, start, state, stop } as const;
}

function supportsSpeech() {
  return (
    typeof window !== "undefined" &&
    typeof window.speechSynthesis !== "undefined" &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}
