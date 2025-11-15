import { useState, useEffect, useRef } from "react";

export const useTimer = (startTime?: number) => {
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<number>(0);

  useEffect(() => {
    if (isRunning && startTime) {
      intervalRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setTimeElapsed(elapsed);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, startTime]);

  const start = () =>
    // customStartTime?: number
    {
      // const time = customStartTime || Date.now();
      setIsRunning(true);
      setTimeElapsed(0);
    };

  const stop = () => {
    setIsRunning(false);
  };

  const reset = () => {
    setIsRunning(false);
    setTimeElapsed(0);
  };

  return {
    timeElapsed,
    isRunning,
    start,
    stop,
    reset,
  };
};
