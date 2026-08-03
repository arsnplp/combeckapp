"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function AccountMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch("/api/client/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/client/login";
  };

  return (
    <div className="relative ml-auto" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-[13px] font-bold text-white active:scale-95 transition-transform"
        aria-label="Mon compte"
      >
        {email.charAt(0).toUpperCase()}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-20 w-56 rounded-2xl border border-gray-100 bg-white p-3 shadow-xl">
          <p className="truncate px-1 text-[12.5px] font-medium text-gray-700">{email}</p>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="mt-2 flex w-full items-center gap-1.5 rounded-xl px-1 py-2 text-[12.5px] text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
          >
            {loggingOut && <Loader2 className="h-3 w-3 animate-spin" />}
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
