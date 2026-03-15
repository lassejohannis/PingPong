import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prospect = searchParams.get("prospect") ?? "Your Company";
  const product = searchParams.get("product") ?? "Our Product";
  const headline = searchParams.get("headline") ?? "A personalised pitch just for you";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%)",
          fontFamily: "sans-serif",
          padding: "60px",
          position: "relative",
        }}
      >
        {/* Top label */}
        <div
          style={{
            position: "absolute",
            top: "40px",
            left: "60px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: "14px", height: "14px", background: "#000", borderRadius: "2px", display: "flex" }} />
          </div>
          <span style={{ color: "#ffffff", fontSize: "18px", fontWeight: 600, opacity: 0.9 }}>
            PingPong
          </span>
        </div>

        {/* Play button circle */}
        <div
          style={{
            width: "96px",
            height: "96px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.12)",
            border: "3px solid rgba(255,255,255,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "36px",
          }}
        >
          {/* Triangle play icon */}
          <div
            style={{
              width: 0,
              height: 0,
              borderTop: "18px solid transparent",
              borderBottom: "18px solid transparent",
              borderLeft: "32px solid #ffffff",
              marginLeft: "8px",
              display: "flex",
            }}
          />
        </div>

        {/* Headline */}
        <div
          style={{
            color: "#ffffff",
            fontSize: "42px",
            fontWeight: 700,
            textAlign: "center",
            maxWidth: "800px",
            lineHeight: 1.2,
            marginBottom: "16px",
          }}
        >
          {headline}
        </div>

        {/* Personalised for */}
        <div
          style={{
            color: "rgba(255,255,255,0.55)",
            fontSize: "22px",
            textAlign: "center",
            marginBottom: "40px",
          }}
        >
          Personalised for <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>{prospect}</span>
        </div>

        {/* CTA pill */}
        <div
          style={{
            background: "#ffffff",
            color: "#0f0f0f",
            fontSize: "18px",
            fontWeight: 600,
            padding: "14px 36px",
            borderRadius: "999px",
            display: "flex",
          }}
        >
          Watch your personalised pitch →
        </div>

        {/* Product name bottom right */}
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            right: "60px",
            color: "rgba(255,255,255,0.4)",
            fontSize: "16px",
          }}
        >
          {product}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
