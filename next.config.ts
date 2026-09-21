import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
      },
    ],
  },
  experimental: {
    serverActions: {
      /**
       * Next caps Server Action request bodies at 1 MB by default, and the
       * admin image uploads (src/lib/actions/admin-images.ts) are Server
       * Actions carrying a FormData file. That action advertises a 10 MB
       * ceiling and rejects anything larger with a readable message — but
       * the framework was refusing the request at 1 MB first, with a bare
       * 413 the action never saw. Every real photo in this repo's own
       * source art is 2.8-3.4 MB, so in practice no genuine upload could
       * ever succeed through the admin panel.
       *
       * Set above the action's own limit, not equal to it: multipart
       * framing adds overhead on top of the raw file bytes, so a file just
       * under 10 MB still produces a body slightly over it. The action's
       * MAX_UPLOAD_BYTES stays the real, user-facing rule; this only stops
       * the framework from pre-empting it.
       */
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
