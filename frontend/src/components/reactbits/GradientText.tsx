interface GradientTextProps {
  children: React.ReactNode;
  from?: string;
  to?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function GradientText({
  children,
  from = "#7c5cfc",
  to = "#06d6a0",
  className,
  style,
}: GradientTextProps) {
  return (
    <span
      className={className}
      style={{
        background: `linear-gradient(135deg, ${from}, ${to})`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
