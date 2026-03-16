import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const prospect = searchParams.get("prospect") ?? "Your Company";
    const product = searchParams.get("product") ?? "Our Product";
    const headline =
      searchParams.get("headline") ?? "A personalised pitch just for you";

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
            backgroundColor: "#0f0f0f",
            fontFamily: "sans-serif",
            padding: "60px",
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
            }}
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                backgroundColor: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: "8px",
              }}
            >
              <div
                style={{
                  width: "14px",
                  height: "14px",
                  backgroundColor: "#000000",
                  borderRadius: "2px",
                  display: "flex",
                }}
              />
            </div>
            <span
              style={{
                color: "#e6e6e6",
                fontSize: "18px",
                fontWeight: 600,
              }}
            >
              PitchLink
            </span>
          </div>

          {/* Play button circle — using SVG instead of border trick */}
          <div
            style={{
              width: "96px",
              height: "96px",
              borderRadius: "50%",
              backgroundColor: "rgba(255,255,255,0.12)",
              border: "3px solid rgba(255,255,255,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "36px",
            }}
          >
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="white"
              style={{ marginLeft: "4px" }}
            >
              <path d="M8 5v14l11-7z" />
            </svg>
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
              display: "flex",
            }}
          >
            {headline}
          </div>

          {/* Personalised for */}
          <div
            style={{
              color: "#8b8b8b",
              fontSize: "22px",
              textAlign: "center",
              marginBottom: "40px",
              display: "flex",
            }}
          >
            Personalised for{" "}
            <span
              style={{
                color: "#d9d9d9",
                fontWeight: 600,
                marginLeft: "6px",
              }}
            >
              {prospect}
            </span>
          </div>

          {/* CTA pill */}
          <div
            style={{
              backgroundColor: "#ffffff",
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
              color: "#666666",
              fontSize: "16px",
              display: "flex",
            }}
          >
            {product}
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch {
    return new Response("Failed to generate OG image", { status: 500 });
  }
}
