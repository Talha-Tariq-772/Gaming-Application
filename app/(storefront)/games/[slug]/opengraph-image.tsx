import { ImageResponse } from "next/og";
import { formatPrice } from "@/src/lib/format";
import { getGameBySlug } from "@/src/lib/catalog";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TITLE_MAX_CHARS = 170;

/**
 * Satori (the renderer behind ImageResponse) doesn't reliably honor
 * -webkit-line-clamp scoped to a fixed-size canvas — tried it, and long
 * titles clipped mid-glyph instead of at a line boundary. Sizing the font
 * to the title length and hard-capping the character count is a lot more
 * predictable: no CSS truncation trick, no risk of a half-cut line.
 */
function titleFontSize(title: string): number {
  if (title.length <= 50) return 54;
  if (title.length <= 90) return 42;
  return 30;
}

function truncateTitle(title: string): string {
  if (title.length <= TITLE_MAX_CHARS) return title;
  return `${title.slice(0, TITLE_MAX_CHARS - 1).trimEnd()}…`;
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);

  if (!game) {
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
          PSCBUNDLE
        </div>
      ),
      { ...size }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#08080a",
        }}
      >
        {/* next/og renders via Satori, not the DOM/React tree — next/image
            can't run here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={game.coverImageUrl}
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
            backgroundImage:
              "linear-gradient(180deg, #08080a 0%, #131316 100%)",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#c1440e",
              marginBottom: 20,
            }}
          >
            {game.genre} &middot; {game.platform}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: titleFontSize(game.title),
              fontWeight: 800,
              letterSpacing: -1,
              lineHeight: 1.15,
              color: "#f5f5f7",
            }}
          >
            {truncateTitle(game.title)}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 40,
              fontWeight: 700,
              color: "#f5f5f7",
              marginTop: 28,
            }}
          >
            {formatPrice(game.price)}
          </div>
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
            PSCBUNDLE
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
