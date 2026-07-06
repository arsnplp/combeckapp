"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    await fetch("/api/client/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/client/login";
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="mt-6 w-full text-[12px] text-gray-400 hover:text-gray-600 transition-colors py-2 flex items-center justify-center gap-1.5"
    >
      {loading && <Loader2 className="h-3 w-3 animate-spin" />}
      Se déconnecter
    </button>
  );
}
