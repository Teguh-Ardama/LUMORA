import { useState, useEffect, useCallback } from "react";

export function useKioskTimer(initialSeconds: number, onExpire: () => void, isPaused: boolean = false) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);

  useEffect(() => {
    // Reset timer when initialSeconds changes
    setTimeLeft(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (isPaused || timeLeft <= 0) return;

    const intervalId = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId);
          onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isPaused, onExpire, timeLeft]);

  const resetTimer = useCallback(() => {
    setTimeLeft(initialSeconds);
  }, [initialSeconds]);

  return { timeLeft, resetTimer };
}
