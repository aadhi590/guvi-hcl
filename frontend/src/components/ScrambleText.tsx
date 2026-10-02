import { useEffect, useRef, useState } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

interface ScrambleTextProps {
  text: string;
  className?: string;
}

// A short decode/scramble-in effect on hover — nav labels resolve back to
// themselves through a brief flicker of random characters. Disabled
// entirely under prefers-reduced-motion.
export default function ScrambleText({ text, className = "" }: ScrambleTextProps) {
  const [display, setDisplay] = useState(text);
  const timeoutRef = useRef<number | undefined>(undefined);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return () => window.clearTimeout(timeoutRef.current);
  }, []);

  function handleEnter() {
    if (reducedMotionRef.current) return;
    window.clearTimeout(timeoutRef.current);

    let iteration = 0;
    const totalIterations = text.length * 3;

    function tick() {
      setDisplay(
        text
          .split("")
          .map((char, index) => {
            if (char === " ") return " ";
            if (index < iteration / 3) return text[index];
            return CHARS[Math.floor(Math.random() * CHARS.length)];
          })
          .join(""),
      );

      iteration++;
      if (iteration <= totalIterations) {
        timeoutRef.current = window.setTimeout(tick, 18);
      } else {
        setDisplay(text);
      }
    }

    tick();
  }

  function handleLeave() {
    window.clearTimeout(timeoutRef.current);
    setDisplay(text);
  }

  return (
    <span onMouseEnter={handleEnter} onMouseLeave={handleLeave} className={className}>
      {display}
    </span>
  );
}
