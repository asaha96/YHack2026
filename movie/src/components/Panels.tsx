import React from "react";
import { C, mono, serif } from "../constants";

export const PanelShell: React.FC<{
  children: React.ReactNode;
  width: number | string;
  height: number | string;
  style?: React.CSSProperties;
}> = ({ children, width, height, style }) => (
  <div
    style={{
      width,
      height,
      borderRadius: 34,
      overflow: "hidden",
      background: C.panel,
      border: `1px solid ${C.line}`,
      boxShadow: `0 36px 90px ${C.shadowDeep}, 0 12px 30px ${C.shadow}`,
      ...style,
    }}
  >
    {children}
  </div>
);

export const HeaderBar: React.FC<{
  title: string;
  detail: string;
  dotColor?: string;
}> = ({ title, detail, dotColor = C.ember }) => (
  <div
    style={{
      height: 58,
      padding: "0 20px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottom: `1px solid ${C.line}`,
      background: "rgba(255,255,255,0.34)",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: dotColor,
          boxShadow: `0 0 14px ${dotColor}44`,
        }}
      />
      <span
        style={{
          fontFamily: mono,
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: C.inkMuted,
        }}
      >
        {title}
      </span>
    </div>
    <span
      style={{
        fontFamily: mono,
        fontSize: 10,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: C.inkMuted,
      }}
    >
      {detail}
    </span>
  </div>
);

// macOS-style window chrome for app footage frames
export const WindowChrome: React.FC<{
  title: string;
  children: React.ReactNode;
  width: number | string;
  height?: number | string;
  style?: React.CSSProperties;
}> = ({ title, children, width, height, style }) => (
  <div
    style={{
      width,
      height,
      borderRadius: 20,
      overflow: "hidden",
      background: C.panelStrong,
      border: `1px solid rgba(255,255,255,0.7)`,
      borderBottom: `1px solid rgba(0,0,0,0.08)`,
      boxShadow: [
        `0 48px 120px rgba(38,29,20,0.26)`,
        `0 16px 48px rgba(38,29,20,0.14)`,
        `inset 0 1.5px 0 rgba(255,255,255,0.9)`,
      ].join(", "),
      ...style,
    }}
  >
    {/* Window toolbar */}
    <div
      style={{
        height: 52,
        padding: "0 20px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "rgba(248,244,240,0.96)",
        borderBottom: `1px solid ${C.line}`,
        flexShrink: 0,
      }}
    >
      {/* Traffic lights */}
      {["#ff5f57", "#febc2e", "#28c840"].map((color, i) => (
        <div
          key={i}
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: color,
            opacity: 0.9,
          }}
        />
      ))}
      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 16px",
            background: "rgba(0,0,0,0.04)",
            borderRadius: 8,
            border: `1px solid ${C.line}`,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: C.ember,
              boxShadow: "0 0 8px rgba(178,110,87,0.4)",
            }}
          />
          <span
            style={{
              fontFamily: mono,
              fontSize: 11,
              color: C.inkMuted,
              letterSpacing: "0.04em",
            }}
          >
            {title}
          </span>
        </div>
      </div>
    </div>
    {children}
  </div>
);

// Stat card for ProblemScene
export const StatCard: React.FC<{
  number: string;
  label: string;
  detail: string;
  opacity: number;
  translateY: number;
  accentColor?: string;
}> = ({
  number,
  label,
  detail,
  opacity,
  translateY,
  accentColor = C.ember,
}) => (
  <div
    style={{
      padding: "36px 40px",
      borderRadius: 28,
      background: "rgba(255,255,255,0.52)",
      border: `1px solid ${C.line}`,
      boxShadow: `0 18px 48px ${C.shadow}`,
      opacity,
      transform: `translateY(${translateY}px)`,
    }}
  >
    <div
      style={{
        fontFamily: serif,
        fontSize: 72,
        lineHeight: 1,
        letterSpacing: "-0.05em",
        color: accentColor,
        marginBottom: 12,
      }}
    >
      {number}
    </div>
    <div
      style={{
        fontFamily: serif,
        fontSize: 24,
        letterSpacing: "-0.03em",
        color: C.ink,
        marginBottom: 8,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: mono,
        fontSize: 11,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: C.inkMuted,
      }}
    >
      {detail}
    </div>
  </div>
);
