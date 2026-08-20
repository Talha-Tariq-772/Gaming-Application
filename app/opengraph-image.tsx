import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Nova — Cinematic Game Storefront";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          background: "#08080a",
          backgroundImage:
            "radial-gradient(circle at 78% 30%, rgba(0,230,216,0.22), transparent 55%)",
          padding: "80px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#00e6d8",
            marginBottom: 28,
          }}
        >
          Now Live
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 116,
            fontWeight: 800,
            letterSpacing: -2,
            color: "#f5f5f7",
            lineHeight: 1.02,
          }}
        >
          NOVA
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 34,
            color: "#9a9aa5",
            marginTop: 28,
            maxWidth: 820,
          }}
        >
          A curated, cinematic home for the games you play next.
        </div>
      </div>
    ),
    { ...size }
  );
}
