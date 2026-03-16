import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const prospect = searchParams.get("prospect") || "";
    const headline =
      searchParams.get("headline") || "A personalised pitch just for you";
    const logo = searchParams.get("logo") || "";

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
            backgroundColor: "#000000",
          }}
        >
          {/* Prospect logo */}
          {logo ? (
            <img
              src={logo}
              width="80"
              height="80"
              style={{
                borderRadius: "16px",
                objectFit: "cover",
                marginBottom: "24px",
              }}
            />
          ) : null}

          {/* Headline */}
          <div
            style={{
              color: "#ffffff",
              fontSize: "48px",
              fontWeight: 700,
              textAlign: "center",
              maxWidth: "800px",
              lineHeight: 1.2,
              marginBottom: prospect ? "12px" : "32px",
              display: "flex",
            }}
          >
            {headline}
          </div>

          {/* Prospect name */}
          {prospect ? (
            <div
              style={{
                color: "#666666",
                fontSize: "22px",
                textAlign: "center",
                marginBottom: "32px",
                display: "flex",
              }}
            >
              for {prospect}
            </div>
          ) : null}

          {/* Start button — matching the live page */}
          <div
            style={{
              backgroundColor: "#ffffff",
              color: "#000000",
              fontSize: "16px",
              fontWeight: 600,
              padding: "14px 40px",
              borderRadius: "999px",
              display: "flex",
            }}
          >
            Start
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch {
    return new Response("Failed to generate OG image", { status: 500 });
  }
}
