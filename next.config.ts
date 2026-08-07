import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  async headers() {
    return [
      {
        // Static art: planet surface textures and the login card deck. These
        // ship with max-age=0 by default, so every visit pays a conditional
        // request before the planet or the cards can appear — on the path to
        // first paint, for files that change only when we replace them.
        //
        // Deliberately not `immutable`: the filenames carry no content hash
        // (a planet texture is named after its preset), so replacing one has to
        // remain visible to clients that already cached it. A day of freshness
        // with a week of stale-while-revalidate gives the caching without the
        // trap — a swapped file is picked up on the next visit after the day.
        source: "/:dir(planets|login)/:file*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
