import { ImageResponse } from "next/og";
import { getNewsPostBySlug } from "@/src/lib/news";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TITLE_MAX_CHARS = 170;

/** Same approach as games/[slug]/opengraph-image.tsx: size the font to the
 * title length and hard-cap the character count rather than relying on
 * CSS line-clamp, which Satori doesn't reliably honor on a fixed canvas. */
function titleFontSize(title: string): number {
  if (title.length <= 50) return 54;
  if (title.length <= 90) return 42;
  return 30;
}

function truncateTitle(title: string): string {
  if (title.length <= TITLE_MAX_CHARS) return title;
  return `${title.slice(0, TITLE_MAX_CHARS - 1).trimEnd()}…`;
}

function eyebrow() {
  return (
    <div
      style={{
        display: "flex",
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: 4,
        textTransform: "uppercase" as const,
        color: "#00e6d8",
        marginBottom: 20,
      }}
    >
      News
    </div>
  );
}

function wordmark() {
  return (
    <div
      style={{
        display: "flex",
        fontSize: 24,
        fontWeight: 700,
        letterSpacing: 3,
        color: "#6f6f7a",
        marginTop: 40,
      }}
    >
      NOVA
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getNewsPostBySlug(slug);

  if (!post) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#08080a",
            fontSize: 64,
            fontWeight: 800,
            color: "#f5f5f7",
          }}
        >
          Nova
        </div>
      ),
      { ...size },
    );
  }

  if (!post.coverImageUrl) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "64px 56px",
            background: "linear-gradient(180deg, #08080a 0%, #131316 100%)",
          }}
        >
          {eyebrow()}
          <div
            style={{
              display: "flex",
              fontSize: titleFontSize(post.title),
              fontWeight: 800,
              letterSpacing: -1,
              lineHeight: 1.15,
              color: "#f5f5f7",
            }}
          >
            {truncateTitle(post.title)}
          </div>
          {wordmark()}
        </div>
      ),
      { ...size },
    );
  }

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#08080a" }}>
        {/* next/og renders via Satori, not the DOM/React tree — next/image can't run here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.coverImageUrl}
          alt=""
          width={size.height}
          height={size.height}
          style={{ objectFit: "cover" }}
        />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "64px 56px",
            backgroundImage: "linear-gradient(180deg, #08080a 0%, #131316 100%)",
          }}
        >
          {eyebrow()}
          <div
            style={{
              display: "flex",
              fontSize: titleFontSize(post.title),
              fontWeight: 800,
              letterSpacing: -1,
              lineHeight: 1.15,
              color: "#f5f5f7",
            }}
          >
            {truncateTitle(post.title)}
          </div>
          {wordmark()}
        </div>
      </div>
    ),
    { ...size },
  );
}
