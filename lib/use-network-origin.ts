"use client";

import { useState, useEffect } from "react";

export function useNetworkOrigin(): string {
  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    const hostname = window.location.hostname;
    const isLocal = hostname === "localhost" || /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(hostname);

    if (!isLocal) {
      // Production — use the public domain directly
      setOrigin(window.location.origin);
      return;
    }

    // Development — fetch local IP so phones on same WiFi can reach the server
    const port = window.location.port || "3000";
    fetch(`/api/wallet/local-ip?port=${port}`)
      .then((r) => r.json())
      .then(({ origin }: { origin: string }) => setOrigin(origin))
      .catch(() => setOrigin(window.location.origin));
  }, []);

  return origin;
}
