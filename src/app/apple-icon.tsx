import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 40,
          background: "#040811",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "2px solid rgba(255,176,32,0.25)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Amber tint */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(255,176,32,0.10)",
          }}
        />
        {/* Shield large */}
        <svg
          width="110"
          height="110"
          viewBox="0 0 24 24"
          fill="none"
          style={{ position: "relative" }}
        >
          <path
            d="M12 3L20 6.5V13C20 17.5 16.5 21.5 12 23C7.5 21.5 4 17.5 4 13V6.5Z"
            stroke="#ffb020"
            strokeWidth="1.8"
            strokeLinejoin="round"
            fill="rgba(255,176,32,0.12)"
          />
          <polyline
            points="9,12 11,14.5 15,10"
            stroke="#ffb020"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
