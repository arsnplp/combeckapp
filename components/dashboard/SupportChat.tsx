"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";

interface Message {
  id: string;
  sender: "merchant" | "admin";
  body: string;
  createdAt: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function SupportChat() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Badge non-lu — pollé en continu, même widget fermé
  useEffect(() => {
    const poll = () => fetch("/api/support/unread").then((r) => r.json()).then((d) => setUnread(d.count ?? 0)).catch(() => {});
    poll();
    const t = setInterval(poll, 10000);
    return () => clearInterval(t);
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/support/messages");
      const data = await res.json();
      setMessages(data.messages ?? []);
      setUnread(0);
    } catch { /* ignore */ }
  }, []);

  // Rafraîchit la conversation pendant qu'elle est ouverte (réponses admin en quasi temps réel)
  useEffect(() => {
    if (!open) return;
    loadMessages();
    const t = setInterval(loadMessages, 5000);
    return () => clearInterval(t);
  }, [open, loadMessages]);

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const handleOpen = () => {
    setOpen(true);
    setLoading(true);
    loadMessages().finally(() => setLoading(false));
  };

  const handleSend = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText("");
    try {
      const res = await fetch("/api/support/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (res.ok && data.message) {
        setMessages((prev) => [...prev, data.message]);
      } else {
        alert(data.error ?? "Erreur lors de l'envoi.");
        setText(body);
      }
    } catch {
      alert("Erreur réseau.");
      setText(body);
    }
    setSending(false);
  };

  return (
    <>
      <button
        onClick={() => (open ? setOpen(false) : handleOpen())}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-lg shadow-green-600/30 transition-transform hover:bg-green-700 active:scale-95 lg:bottom-6 lg:right-6"
        aria-label="Support"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-[152px] right-4 z-40 flex h-[65vh] max-h-[520px] w-[calc(100vw-32px)] max-w-[360px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl lg:bottom-24 lg:right-6"
          >
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-900 px-4 py-3.5">
              <div>
                <p className="text-[13.5px] font-semibold text-white">Support ComeBack</p>
                <p className="text-[11px] text-slate-400">On vous répond dès que possible</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div ref={listRef} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                  <MessageCircle className="h-8 w-8 text-slate-200" />
                  <p className="text-[13px] text-slate-400">Une question, un souci ?<br />Écrivez-nous directement ici.</p>
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender === "merchant" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      m.sender === "merchant" ? "bg-green-600 text-white" : "bg-slate-100 text-slate-800"
                    }`}>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p className={`mt-1 text-[10px] ${m.sender === "merchant" ? "text-green-100/80" : "text-slate-400"}`}>
                        {formatTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-end gap-2 border-t border-slate-100 p-3">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Votre message…"
                rows={1}
                className="max-h-24 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-green-400 focus:bg-white focus:ring-2 focus:ring-green-100"
              />
              <button
                onClick={handleSend}
                disabled={!text.trim() || sending}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-green-600 text-white transition-colors hover:bg-green-700 disabled:opacity-40"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
