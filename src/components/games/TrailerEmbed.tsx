"use client";

import Image from "next/image";
import { useState } from "react";

function toEmbedUrl(watchUrl: string): string | null {
  try {
    const url = new URL(watchUrl);
    const id = url.searchParams.get("v");
    if (!id) return null;
    return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
  } catch {
    return null;
  }
}

export default function TrailerEmbed({
  trailerUrl,
  posterUrl,
  title,
}: {
  trailerUrl: string;
  posterUrl: string;
  title: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const embedUrl = toEmbedUrl(trailerUrl);

  if (!embedUrl) return null;

  if (!loaded) {
    return (
      <button
        type="button"
        onClick={() => setLoaded(true)}
        className="group relative aspect-video w-full overflow-hidden rounded-lg border border-nova-hairline"
        aria-label={`Play trailer for ${title}`}
      >
        <Image
          src={posterUrl}
          alt=""
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-nova-void/50 transition-colors duration-(--duration-fast) ease-standard group-hover:bg-nova-void/30">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-nova-ember-lo text-nova-bone">
            <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-6 w-6">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg border border-nova-hairline">
      <iframe
        src={embedUrl}
        title={`${title} trailer`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="h-full w-full"
      />
    </div>
  );
}
