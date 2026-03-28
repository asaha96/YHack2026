import { useEffect, useState, useRef } from "react";

interface BlurTextProps {
  text: string;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function BlurText({
  text,
  delay = 50,
  className,
  style,
}: BlurTextProps) {
  const [displayedChars, setDisplayedChars] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setDisplayedChars((prev) => {
        if (prev >= text.length) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          return prev;
        }
        return prev + 1;
      });
    }, delay);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [text, delay]);

  return (
    <span className={className} style={style}>
      {text.split("").map((char, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            filter: i < displayedChars ? "blur(0px)" : "blur(8px)",
            opacity: i < displayedChars ? 1 : 0.3,
            transition: "filter 0.4s ease, opacity 0.4s ease",
            minWidth: char === " " ? "0.25em" : undefined,
          }}
        >
          {char}
        </span>
      ))}
    </span>
  );
}
