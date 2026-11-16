"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * DICTATION INTO THE ASSISTANT'S FIELD, WHERE THE BROWSER CAN DO IT.
 *
 * The browser's own speech recognition (`SpeechRecognition`, or the
 * `webkitSpeechRecognition` Safari and Chrome expose). Vallo sends nothing
 * anywhere for it: the browser turns speech into words and hands them to the
 * field, and the member still decides whether to send them. Where the browser
 * has no recognition, `supported` stays false and the microphone is not drawn,
 * so the control never does nothing.
 *
 * `supported` is false on the server and in the hydrating render, so the
 * server's HTML and the first client render agree.
 */

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

const noSubscribe = () => () => undefined;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useDictation({
  onText,
  onRefused,
}: {
  /** The words so far for this take: replaces what this take wrote last time. */
  onText: (spoken: string) => void;
  /** The browser refused the microphone. */
  onRefused: () => void;
}) {
  const supported = useSyncExternalStore(
    noSubscribe,
    () => recognitionCtor() !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const textRef = useRef(onText);
  const refusedRef = useRef(onRefused);
  useEffect(() => {
    textRef.current = onText;
    refusedRef.current = onRefused;
  });

  useEffect(() => {
    return () => {
      try {
        recRef.current?.abort();
      } catch {
        /* Nothing was listening. */
      }
    };
  }, []);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* Already stopped. */
    }
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    try {
      recRef.current?.abort();
    } catch {
      /* Nothing to abort. */
    }
    const rec = new Ctor();
    rec.lang = (typeof navigator !== "undefined" && navigator.language) || "en-NG";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let spoken = "";
      for (let i = 0; i < event.results.length; i += 1) {
        spoken += event.results[i]?.[0].transcript ?? "";
      }
      textRef.current(spoken.trim());
    };
    rec.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") refusedRef.current();
    };
    rec.onend = () => {
      setListening(false);
      if (recRef.current === rec) recRef.current = null;
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return { supported, listening, toggle, stop };
}
