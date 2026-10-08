"use client";

import { useEffect, useState } from "react";
import { Users, CreditCard, Store, Loader2, RefreshCw, Euro, LogIn, Key, Check, X, Trash2, ShieldAlert, ShieldCheck, AlertTriangle, Search, ArrowUpDown, Send, MessageCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import type { PlanId } from "@/types";

interface TenantUser {
  daysLeft: number | null;
  planExpiresAt: string | null;
  id: string;
  email: string;
  storeName: string;
  city: string;
  phone: string;
  plan: PlanId;
  monthlyRevenue: number;
  createdAt: string;
  clients: number;
  cards: number;
  loyaltyCards: number;
}

interface ClientCard {
  tenantId: string;
  storeName: string;
  cardName: string;
  loyaltyMode: string;
  stamps: number;
  points: number;
}

interface ClientSummary {
  email: string;
  name: string;
  phone: string;
  hasPassword: boolean;
  joinDate: string;
  cards: ClientCard[];
}

const PLAN_STYLE: Record<PlanId, { label: string; class: string }> = {
  free:     { label: "Essai",    class: "bg-emerald-500/10 text-emerald-400" },
  starter:  { label: "Starter",  class: "bg-slate-500/10 text-slate-400" },
  pro:      { label: "✦ Pro",    class: "bg-amber-500/10 text-amber-400" },
  business: { label: "◆ Business", class: "bg-violet-500/10 text-violet-400" },
};

/**
 * Montant en euros, à deux décimales.
 *
 * Les prix sont additionnés en virgule flottante : 9,99 + 39,99 donne
 * 49.980000000000004, qui s'affichait tel quel. On arrondit au centime.
 */
function formatEuros(amount: number): string {
  return amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: `${color}20` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
        <p className="text-[12px] font-medium text-slate-400">{label}</p>
      </div>
      <p className="text-[28px] font-bold text-white leading-none">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

function InlinePasswordForm({ onSubmit, loading }: {
  onSubmit: (pwd: string) => void;
  loading: boolean;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Nouveau MDP"
        className="h-7 rounded-lg border border-white/10 bg-white/[0.06] px-2 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-green-500/40 w-32"
        minLength={6}
      />
      <button
        onClick={() => value.length >= 6 && onSubmit(value)}
        disabled={loading || value.length < 6}
        className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-green-600/20 hover:border-green-500/30 hover:text-green-300 transition-colors disabled:opacity-40"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        OK
      </button>
    </div>
  );
}

interface CertInfo {
  expiresAt: string;
  daysLeft: number;
  subject: string;
}

interface SystemErrorItem {
  id: string;
  source: string;
  message: string;
  details: Record<string, unknown> | null;
  createdAt: string;
  resolved: boolean;
}

interface ConversationSummary {
  merchantId: string;
  storeName: string;
  email: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadForAdmin: number;
}

interface SupportMsg {
  id: string;
  sender: "merchant" | "admin";
  body: string;
  createdAt: string;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function AdminPage() {
  const [tab, setTab] = useState<"restaurants" | "clients" | "errors" | "messages">("restaurants");
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [systemErrors, setSystemErrors] = useState<SystemErrorItem[]>([]);
  const [loadingErrors, setLoadingErrors] = useState(false);
  const [resolvingError, setResolvingError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingClients, setLoadingClients] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [resetingPwd, setResetingPwd] = useState<string | null>(null);
  const [showResetFor, setShowResetFor] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [deletingClient, setDeletingClient] = useState<string | null>(null);
  const [certInfo, setCertInfo] = useState<CertInfo | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Messages support
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState<string | null>(null);
  const [thread, setThread] = useState<SupportMsg[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDesc, setSortDesc] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const QUICK_LINKS = [
    { emoji: "🌐", label: "Site vitrine", url: "https://getcomeback.fr", desc: "Landing publique" },
    { emoji: "🏪", label: "Inscription commerce", url: "https://app.getcomeback.fr/tarifs", desc: "Choix du plan → création de compte" },
    { emoji: "👤", label: "Espace client", url: "https://app.getcomeback.fr/client/login", desc: "Connexion client (compte créé via le QR d'un commerce)" },
    { emoji: "🤝", label: "Inscription affilié", url: "https://app.getcomeback.fr/affilies/inscription", desc: "Devenir partenaire" },
  ];

  const copyQuickLink = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedLink(url);
    setTimeout(() => setCopiedLink(null), 1500);
  };

  const handleAccess = async (userId: string) => {
    setImpersonating(userId);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const { token, error } = await res.json();
      if (error || !token) { alert(error ?? "Erreur"); setImpersonating(null); return; }
      const result = await signIn("credentials", { impersonateToken: token, redirect: false });
      if (result?.error) { alert("Échec de l'impersonation"); setImpersonating(null); return; }
      window.location.href = "/dashboard";
    } catch {
      alert("Erreur réseau");
      setImpersonating(null);
    }
  };

  const handleResetUserPassword = async (userId: string, newPassword: string) => {
    setResetingPwd(userId);
    try {
      const res = await fetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, newPassword }),
      });
      if (res.ok) {
        setResetSuccess(userId);
        setShowResetFor(null);
        setTimeout(() => setResetSuccess(null), 3000);
      } else {
        const d = await res.json();
        alert(d.error ?? "Erreur");
      }
    } catch {
      alert("Erreur réseau");
    } finally {
      setResetingPwd(null);
    }
  };

  const handleResetClientPassword = async (email: string, newPassword: string) => {
    setResetingPwd(email);
    try {
      const res = await fetch("/api/admin/clients/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword }),
      });
      if (res.ok) {
        setResetSuccess(email);
        setShowResetFor(null);
        // Refresh client list to update hasPassword
        loadClients();
        setTimeout(() => setResetSuccess(null), 3000);
      } else {
        const d = await res.json();
        alert(d.error ?? "Erreur");
      }
    } catch {
      alert("Erreur réseau");
    } finally {
      setResetingPwd(null);
    }
  };

  const handleDeleteClient = async (email: string, name: string) => {
    if (!confirm(`Supprimer définitivement ${name || email} ? Cette action supprime le client de tous les commerces.`)) return;
    setDeletingClient(email || name);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      if (res.ok) {
        setClients((prev) => prev.filter((c) => email ? c.email !== email : c.name !== name));
      } else {
        const d = await res.json();
        alert(d.error ?? "Erreur");
      }
    } catch {
      alert("Erreur réseau");
    } finally {
      setDeletingClient(null);
    }
  };

  const load = async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data);
    setLoading(false);
    setRefreshing(false);
  };

  const loadClients = async () => {
    setLoadingClients(true);
    try {
      const res = await fetch("/api/admin/clients");
      const data = await res.json();
      setClients(data);
    } catch { /* ignore */ }
    setLoadingClients(false);
  };

  const loadErrors = async () => {
    setLoadingErrors(true);
    try {
      const res = await fetch("/api/admin/errors");
      const data = await res.json();
      setSystemErrors(data.errors ?? []);
    } catch { /* ignore */ }
    setLoadingErrors(false);
  };

  const handleResolveError = async (id: string) => {
    setResolvingError(id);
    try {
      await fetch("/api/admin/errors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setSystemErrors((prev) => prev.filter((e) => e.id !== id));
    } catch { /* ignore */ }
    setResolvingError(null);
  };

  /**
   * `silent` : rafraîchissement de fond, déclenché toutes les 15 s. Sans lui,
   * chaque sondage rallumait l'état de chargement et faisait clignoter toute
   * la liste. On ne remplace l'état que si le contenu a réellement changé,
   * pour ne pas re-rendre la liste pour rien.
   */
  const loadConversations = async (silent = false) => {
    if (!silent) setLoadingConvos(true);
    try {
      const res = await fetch("/api/admin/support");
      const data = await res.json();
      const next = data.conversations ?? [];
      setConversations((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    } catch { /* ignore */ }
    if (!silent) setLoadingConvos(false);
  };

  /** Idem : le fil est resondé toutes les 5 s, sans écran de chargement. */
  const loadThread = async (merchantId: string, silent = false) => {
    if (!silent) setLoadingThread(true);
    try {
      const res = await fetch(`/api/admin/support/${merchantId}`);
      const data = await res.json();
      const next = data.messages ?? [];
      setThread((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      setConversations((prev) => prev.map((c) => c.merchantId === merchantId ? { ...c, unreadForAdmin: 0 } : c));
    } catch { /* ignore */ }
    if (!silent) setLoadingThread(false);
  };

  const selectConversation = (merchantId: string) => {
    setSelectedMerchant(merchantId);
    loadThread(merchantId);
  };

  const sendReply = async () => {
    const body = replyText.trim();
    if (!selectedMerchant || !body || sendingReply) return;
    setSendingReply(true);
    setReplyText("");
    try {
      const res = await fetch(`/api/admin/support/${selectedMerchant}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (res.ok && data.message) {
        setThread((prev) => [...prev, data.message]);
        setConversations((prev) => prev.map((c) =>
          c.merchantId === selectedMerchant ? { ...c, lastMessage: data.message.body, lastMessageAt: data.message.createdAt } : c
        ));
      } else {
        alert(data.error ?? "Erreur");
        setReplyText(body);
      }
    } catch {
      alert("Erreur réseau");
      setReplyText(body);
    }
    setSendingReply(false);
  };

  useEffect(() => {
    load();
    fetch("/api/admin/cert-info").then(r => r.json()).then(d => { if (d.daysLeft !== undefined) setCertInfo(d); });
    loadErrors();
    loadConversations(); // pour le badge de messages non lus, même sans avoir ouvert l'onglet
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "clients" && clients.length === 0) {
      loadClients();
    }
    if (tab === "messages" && conversations.length === 0) {
      loadConversations();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Rafraîchit la liste des conversations pendant que l'onglet est ouvert
  useEffect(() => {
    if (tab !== "messages") return;
    const t = setInterval(() => loadConversations(true), 15000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Rafraîchit le fil ouvert (réponses du commerçant en quasi temps réel)
  useEffect(() => {
    if (tab !== "messages" || !selectedMerchant) return;
    const t = setInterval(() => loadThread(selectedMerchant, true), 5000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedMerchant]);

  const mrr          = users.reduce((s, u) => s + u.monthlyRevenue, 0);
  const totalClients = users.reduce((s, u) => s + u.clients, 0);
  const totalCards   = users.reduce((s, u) => s + u.loyaltyCards, 0);

  const totalUnreadMessages = conversations.reduce((s, c) => s + c.unreadForAdmin, 0);
  const filteredConversations = conversations
    .filter((c) =>
      c.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const diff = new Date(a.lastMessageAt).getTime() - new Date(b.lastMessageAt).getTime();
      return sortDesc ? -diff : diff;
    });
  const selectedConversation = conversations.find((c) => c.merchantId === selectedMerchant) ?? null;
  // Fiche du commerçant qui écrit, prise dans la liste déjà chargée —
  // pas d'appel supplémentaire pour afficher son plan et ses chiffres.
  const selectedUser = users.find((u) => u.id === selectedMerchant) ?? null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-amber-400">Super Admin</p>
          <h1 className="mt-1 text-[26px] font-bold text-white">Tableau de bord</h1>
          <p className="mt-0.5 text-[13px] text-slate-400">Vue globale de tous les abonnés Comeback</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/admin/relances"
            className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] text-slate-400 hover:text-white transition-colors">
            📣 Relances
          </a>
          <a href="/admin/affilies"
            className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] text-slate-400 hover:text-white transition-colors">
            🤝 Affiliation
          </a>
          <a href="/admin/promos"
            className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] text-slate-400 hover:text-white transition-colors">
            🎟️ Codes promo
          </a>
          <button onClick={() => { load(true); if (tab === "clients") loadClients(); }} disabled={refreshing}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] text-slate-400 hover:text-white transition-colors disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Liens rapides */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-5">
        <p className="mb-3 text-[13px] font-semibold text-white">🔗 Liens rapides</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {QUICK_LINKS.map((l) => (
            <div key={l.url} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5">
              <span className="text-[18px]">{l.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-white">{l.label}</p>
                <p className="truncate text-[10.5px] text-slate-500">{l.desc}</p>
                <p className="truncate text-[10.5px] text-green-400/70">{l.url}</p>
              </div>
              <button
                onClick={() => copyQuickLink(l.url)}
                className="flex-shrink-0 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition-colors hover:bg-green-600/20 hover:text-green-300"
              >
                {copiedLink === l.url ? "✓ Copié" : "Copier"}
              </button>
              <a
                href={l.url} target="_blank" rel="noopener noreferrer"
                className="flex-shrink-0 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition-colors hover:bg-white/[0.1] hover:text-white"
              >
                Ouvrir ↗
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Certificat Apple Wallet */}
      {certInfo && (
        <div className={`flex items-start gap-4 rounded-xl border px-5 py-4 ${
          certInfo.daysLeft <= 7
            ? "border-red-500/30 bg-red-500/10"
            : certInfo.daysLeft <= 30
            ? "border-amber-500/30 bg-amber-500/10"
            : "border-emerald-500/20 bg-emerald-500/5"
        }`}>
          <div className={`mt-0.5 shrink-0 ${
            certInfo.daysLeft <= 7 ? "text-red-400" : certInfo.daysLeft <= 30 ? "text-amber-400" : "text-emerald-400"
          }`}>
            {certInfo.daysLeft <= 30 ? <ShieldAlert className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[13px] font-semibold ${
              certInfo.daysLeft <= 7 ? "text-red-300" : certInfo.daysLeft <= 30 ? "text-amber-300" : "text-emerald-300"
            }`}>
              {certInfo.daysLeft <= 7
                ? `⚠️ Certificat Apple Wallet expire dans ${certInfo.daysLeft} jour${certInfo.daysLeft > 1 ? "s" : ""} — renouvelez maintenant !`
                : certInfo.daysLeft <= 30
                ? `Certificat Apple Wallet expire dans ${certInfo.daysLeft} jours — pensez à le renouveler`
                : `Certificat Apple Wallet valide — expire dans ${certInfo.daysLeft} jours`}
            </p>
            <p className="mt-0.5 text-[11.5px] text-slate-400">
              {certInfo.subject} · expire le {new Date(certInfo.expiresAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
          </div>
          {certInfo.daysLeft <= 30 && (
            <a
              href="https://developer.apple.com/account/resources/certificates/list"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11.5px] font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              Renouveler →
            </a>
          )}
        </div>
      )}

      {/* Erreurs système non résolues (push Wallet, etc.) */}
      {systemErrors.length > 0 && (
        <button
          onClick={() => setTab("errors")}
          className="flex w-full items-start gap-4 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-left transition-colors hover:bg-red-500/[0.14]"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-red-300">
              ⚠️ {systemErrors.length} erreur{systemErrors.length > 1 ? "s" : ""} système non résolue{systemErrors.length > 1 ? "s" : ""}
            </p>
            <p className="mt-0.5 text-[11.5px] text-slate-400">
              {systemErrors[0].message}
              {systemErrors.length > 1 ? ` (+${systemErrors.length - 1} autre${systemErrors.length - 1 > 1 ? "s" : ""})` : ""}
            </p>
          </div>
          <span className="shrink-0 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11.5px] font-medium text-slate-300">
            Voir →
          </span>
        </button>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Euro}       label="MRR"              value={`${formatEuros(mrr)} €`}      sub="Revenu mensuel récurrent" color="#34d399" />
        <StatCard icon={Store}      label="Abonnés"          value={users.length}     sub={`${users.filter(u=>u.plan==="pro").length} Pro · ${users.filter(u=>u.plan==="business").length} Business · ${users.filter(u=>u.plan==="free" && (u.daysLeft ?? 1) > 0).length} en essai`} color="#60a5fa" />
        <StatCard icon={Users}      label="Clients total"    value={totalClients}     sub="Toutes enseignes" color="#f59e0b" />
        <StatCard icon={CreditCard} label="Cartes créées"    value={totalCards}       sub="Programmes de fidélité" color="#a78bfa" />
      </div>

      {/* Tabs */}
      <div className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
        <button
          onClick={() => setTab("restaurants")}
          className={`rounded-lg px-4 py-2 text-[13px] font-medium transition-colors ${
            tab === "restaurants"
              ? "bg-white/[0.08] text-white"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Commerces
        </button>
        <button
          onClick={() => setTab("clients")}
          className={`rounded-lg px-4 py-2 text-[13px] font-medium transition-colors ${
            tab === "clients"
              ? "bg-white/[0.08] text-white"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Clients
        </button>
        <button
          onClick={() => { setTab("errors"); loadErrors(); }}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium transition-colors ${
            tab === "errors"
              ? "bg-white/[0.08] text-white"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Erreurs
          {systemErrors.length > 0 && (
            <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{systemErrors.length}</span>
          )}
        </button>
        <button
          onClick={() => setTab("messages")}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium transition-colors ${
            tab === "messages"
              ? "bg-white/[0.08] text-white"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Messages
          {totalUnreadMessages > 0 && (
            <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{totalUnreadMessages}</span>
          )}
        </button>
      </div>

      {/* Restaurants Tab */}
      {tab === "restaurants" && (
        <>
        <div className="space-y-2.5 md:hidden">
          {users.map((u) => {
            const planStyle = PLAN_STYLE[u.plan] ?? PLAN_STYLE.starter;
            return (
              <div key={u.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-white">{u.storeName}</p>
                    <p className="truncate text-[12px] text-slate-400">{u.email}</p>
                  </div>
                  <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${planStyle.class}`}>
                    {planStyle.label}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3 text-center">
                  <div>
                    <p className="text-[15px] font-bold text-white">{u.clients}</p>
                    <p className="text-[10.5px] uppercase tracking-wide text-slate-500">clients</p>
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-white">{u.loyaltyCards}</p>
                    <p className="text-[10.5px] uppercase tracking-wide text-slate-500">cartes</p>
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-green-400">{formatEuros(u.monthlyRevenue)} €</p>
                    <p className="text-[10.5px] uppercase tracking-wide text-slate-500">/ mois</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px] text-slate-500">
                  {u.phone && <span>{u.phone}</span>}
                  {u.city && <span>· {u.city}</span>}
                  <span>· inscrit le {formatDate(u.createdAt)}</span>
                  {u.daysLeft !== null && u.plan === "free" && (
                    <span className={u.daysLeft <= 0 ? "text-red-400" : u.daysLeft <= 10 ? "text-amber-400" : "text-emerald-400"}>
                      · {u.daysLeft <= 0 ? "essai expiré" : `essai J-${u.daysLeft}`}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleAccess(u.id)}
                  disabled={impersonating === u.id}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] py-2.5 text-[12.5px] font-medium text-slate-300 transition-colors hover:border-green-500/30 hover:bg-green-600/20 hover:text-green-300 disabled:opacity-40"
                >
                  {impersonating === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
                  Accéder au compte
                </button>
              </div>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto rounded-2xl border border-white/[0.06] bg-white/[0.03] md:block">
          <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-white">Abonnés</h2>
            <span className="text-[12px] text-slate-500">MRR total : <span className="font-bold text-green-400">{formatEuros(mrr)} €/mois</span></span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center text-[13px] text-slate-500">Aucun abonné pour l&apos;instant</div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  {["Établissement", "Email", "Téléphone", "Ville", "Plan", "€/mois", "Clients", "Cartes", "Inscrit le", ""].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {users.map((u) => {
                  const initials = u.storeName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
                  const planStyle = PLAN_STYLE[u.plan] ?? PLAN_STYLE.starter;
                  return (
                    <tr key={u.id} className="group transition-colors hover:bg-white/[0.03]">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-green-600/20 text-[10px] font-bold text-green-400">
                            {initials}
                          </div>
                          <span className="whitespace-nowrap text-[13px] font-medium text-white">{u.storeName}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-[13px] text-slate-400">{u.email}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-[13px] text-slate-400">{u.phone || "—"}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-[13px] text-slate-400">{u.city || "—"}</td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        {u.plan === "free" && u.daysLeft !== null ? (
                          <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            u.daysLeft <= 0 ? "bg-red-500/10 text-red-400"
                            : u.daysLeft <= 10 ? "bg-amber-500/10 text-amber-400"
                            : "bg-emerald-500/10 text-emerald-400"
                          }`}>
                            {u.daysLeft <= 0 ? "Essai expiré" : `Essai · J-${u.daysLeft}`}
                          </span>
                        ) : (
                          <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${planStyle.class}`}>
                            {planStyle.label}
                          </span>
                        )}
                        {u.plan !== "free" && u.daysLeft !== null && u.daysLeft <= 7 && (
                          <span className="ml-1.5 inline-flex items-center whitespace-nowrap rounded-full bg-amber-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-amber-400">
                            expire J-{Math.max(u.daysLeft, 0)}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <span className="text-[13px] font-bold text-green-400">{formatEuros(u.monthlyRevenue)} €</span>
                      </td>
                      <td className="px-5 py-3.5 text-[13px] font-medium text-white">{u.clients}</td>
                      <td className="px-5 py-3.5 text-[13px] text-slate-400">{u.loyaltyCards}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-[12px] text-slate-500">{formatDate(u.createdAt)}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1.5 items-start">
                          <button
                            onClick={() => handleAccess(u.id)}
                            disabled={impersonating === u.id}
                            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-medium text-slate-300 hover:bg-green-600/20 hover:border-green-500/30 hover:text-green-300 transition-colors disabled:opacity-40"
                          >
                            {impersonating === u.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <LogIn className="h-3 w-3" />}
                            Accéder
                          </button>
                          {resetSuccess === u.id ? (
                            <span className="flex items-center gap-1 text-[11px] text-green-400">
                              <Check className="h-3 w-3" /> MDP mis à jour
                            </span>
                          ) : showResetFor === u.id ? (
                            <div className="flex items-center gap-1">
                              <InlinePasswordForm
                                onSubmit={(pwd) => handleResetUserPassword(u.id, pwd)}
                                loading={resetingPwd === u.id}
                              />
                              <button onClick={() => setShowResetFor(null)} className="text-slate-500 hover:text-white ml-1">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowResetFor(u.id)}
                              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-medium text-slate-300 hover:bg-amber-600/20 hover:border-amber-500/30 hover:text-amber-300 transition-colors"
                            >
                              <Key className="h-3 w-3" />
                              MDP
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Total row */}
              <tfoot>
                <tr className="border-t border-white/[0.08] bg-white/[0.02]">
                  <td colSpan={5} className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total</td>
                  <td className="px-5 py-3 text-[13px] font-bold text-green-400">{formatEuros(mrr)} €</td>
                  <td className="px-5 py-3 text-[13px] font-bold text-white">{totalClients}</td>
                  <td className="px-5 py-3 text-[13px] font-bold text-white">{totalCards}</td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
        </>
      )}

      {/* Clients Tab */}
      {tab === "clients" && (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-white/[0.03]">
          <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-white">Clients fidélité</h2>
            <span className="text-[12px] text-slate-500">{clients.length} client{clients.length > 1 ? "s" : ""}</span>
          </div>

          {loadingClients ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
            </div>
          ) : clients.length === 0 ? (
            <div className="py-16 text-center text-[13px] text-slate-500">Aucun client pour l&apos;instant</div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  {["Nom", "Email", "Téléphone", "Cartes", "MDP", "Inscrit le", "Actions"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {clients.map((c) => (
                  <tr key={c.email || c.name} className="group transition-colors hover:bg-white/[0.03]">
                    <td className="px-5 py-3.5 text-[13px] font-medium text-white">{c.name}</td>
                    <td className="px-5 py-3.5 text-[13px] text-slate-400">{c.email}</td>
                    <td className="px-5 py-3.5 text-[13px] text-slate-400 whitespace-nowrap">{c.phone || "—"}</td>
                    <td className="px-5 py-3.5 text-[12px] text-slate-400 max-w-[200px]">
                      {c.cards.length === 0 ? "—" : c.cards.map((card) => (
                        <span key={`${card.tenantId}-${card.cardName}`} className="inline-block mr-2 mb-1">
                          <span className="font-medium text-slate-300">{card.storeName}</span>
                          <span className="text-slate-500">
                            {" "}({card.loyaltyMode === "points" ? `${card.points} pts` : `${card.stamps} tampons`})
                          </span>
                        </span>
                      ))}
                    </td>
                    <td className="px-5 py-3.5">
                      {c.hasPassword ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-semibold text-green-400">
                          <Check className="h-3 w-3" /> Configuré
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                          <X className="h-3 w-3" /> Non configuré
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[12px] text-slate-500">{formatDate(c.joinDate)}</td>
                    <td className="px-4 py-3.5">
                      {resetSuccess === c.email ? (
                        <span className="flex items-center gap-1 text-[11px] text-green-400">
                          <Check className="h-3 w-3" /> MDP mis à jour
                        </span>
                      ) : showResetFor === c.email ? (
                        <div className="flex items-center gap-1">
                          <InlinePasswordForm
                            onSubmit={(pwd) => handleResetClientPassword(c.email, pwd)}
                            loading={resetingPwd === c.email}
                          />
                          <button onClick={() => setShowResetFor(null)} className="text-slate-500 hover:text-white ml-1">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5 items-start">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setShowResetFor(c.email)}
                              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-medium text-slate-300 hover:bg-amber-600/20 hover:border-amber-500/30 hover:text-amber-300 transition-colors"
                            >
                              <Key className="h-3 w-3" />
                              MDP
                            </button>
                            <button
                              onClick={() => handleDeleteClient(c.email, c.name)}
                              disabled={deletingClient === c.email}
                              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-medium text-slate-300 hover:bg-red-600/20 hover:border-red-500/30 hover:text-red-400 transition-colors disabled:opacity-40"
                            >
                              <Trash2 className="h-3 w-3" />
                              Supprimer
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Erreurs Tab */}
      {tab === "errors" && (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-white/[0.03]">
          <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-white">Erreurs système</h2>
            <span className="text-[12px] text-slate-500">
              {systemErrors.length} non résolue{systemErrors.length > 1 ? "s" : ""}
            </span>
          </div>

          {loadingErrors ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
            </div>
          ) : systemErrors.length === 0 ? (
            <div className="py-16 text-center text-[13px] text-slate-500">
              ✓ Aucune erreur système en attente — tout fonctionne normalement
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {systemErrors.map((err) => (
                <div key={err.id} className="flex items-start gap-4 px-6 py-4">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
                        {err.source}
                      </span>
                      <span className="text-[11px] text-slate-500">{formatDate(err.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-[13px] text-white">{err.message}</p>
                    {err.details && (
                      <pre className="mt-1.5 max-w-full overflow-x-auto rounded-lg bg-black/30 px-3 py-2 text-[10.5px] text-slate-400">
                        {JSON.stringify(err.details, null, 2)}
                      </pre>
                    )}
                  </div>
                  <button
                    onClick={() => handleResolveError(err.id)}
                    disabled={resolvingError === err.id}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-medium text-slate-300 transition-colors hover:bg-emerald-600/20 hover:border-emerald-500/30 hover:text-emerald-300 disabled:opacity-40"
                  >
                    {resolvingError === err.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Marquer résolu
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages Tab */}
      {tab === "messages" && (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* Liste des conversations */}
          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03]">
            <div className="space-y-2.5 border-b border-white/[0.06] p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un commerçant…"
                  className="w-full rounded-lg border border-white/10 bg-white/[0.05] py-2 pl-8 pr-3 text-[12.5px] text-white placeholder-slate-500 outline-none focus:border-green-500/40"
                />
              </div>
              <button
                onClick={() => setSortDesc((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] text-slate-400 transition-colors hover:text-white"
              >
                <ArrowUpDown className="h-3 w-3" />
                {sortDesc ? "Plus récent d'abord" : "Plus ancien d'abord"}
              </button>
            </div>
            <div className="max-h-[560px] divide-y divide-white/[0.04] overflow-y-auto">
              {loadingConvos ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="py-12 text-center text-[12.5px] text-slate-500">
                  {conversations.length === 0 ? "Aucun message pour l'instant" : "Aucun résultat"}
                </div>
              ) : (
                filteredConversations.map((c) => (
                  <button
                    key={c.merchantId}
                    onClick={() => selectConversation(c.merchantId)}
                    className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors ${
                      selectedMerchant === c.merchantId ? "bg-white/[0.07]" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-medium text-white">{c.storeName}</span>
                      {c.unreadForAdmin > 0 && (
                        <span className="flex-shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {c.unreadForAdmin}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11.5px] text-slate-500">{c.lastMessage}</p>
                    <p className="text-[10px] text-slate-600">{formatDateTime(c.lastMessageAt)}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Fil de discussion */}
          <div className="flex h-[640px] flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03]">
            {!selectedMerchant || !selectedConversation ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-500">
                <MessageCircle className="h-8 w-8 text-slate-700" />
                <p className="text-[13px]">Sélectionnez une conversation</p>
              </div>
            ) : (
              <>
                <div className="border-b border-white/[0.06] px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-[13.5px] font-semibold text-white">{selectedConversation.storeName}</p>
                    {selectedUser && (
                      <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                        (PLAN_STYLE[selectedUser.plan] ?? PLAN_STYLE.starter).class
                      }`}>
                        {(PLAN_STYLE[selectedUser.plan] ?? PLAN_STYLE.starter).label}
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-slate-500">{selectedConversation.email}</p>
                  {/* Contexte du commerçant, repris de la liste déjà chargée :
                      savoir à qui on parle et ce qu'il a avant de répondre. */}
                  {selectedUser && (
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                      {selectedUser.phone && <span>📞 {selectedUser.phone}</span>}
                      {selectedUser.city && <span>📍 {selectedUser.city}</span>}
                      <span>👥 {selectedUser.clients} client{selectedUser.clients > 1 ? "s" : ""}</span>
                      <span>🎟️ {selectedUser.loyaltyCards} carte{selectedUser.loyaltyCards > 1 ? "s" : ""}</span>
                      <span>inscrit le {formatDate(selectedUser.createdAt)}</span>
                    </p>
                  )}
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                  {loadingThread ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
                    </div>
                  ) : (
                    thread.map((m) => (
                      <div key={m.id} className={`flex ${m.sender === "admin" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                          m.sender === "admin" ? "bg-green-600 text-white" : "bg-white/[0.08] text-white"
                        }`}>
                          <p className="whitespace-pre-wrap">{m.body}</p>
                          <p className={`mt-1 text-[10px] ${m.sender === "admin" ? "text-green-100/70" : "text-slate-500"}`}>
                            {formatDateTime(m.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex items-end gap-2 border-t border-white/[0.06] p-3.5">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                    placeholder="Répondre…"
                    rows={1}
                    className="max-h-24 flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-[13px] text-white placeholder-slate-500 outline-none focus:border-green-500/40"
                  />
                  <button
                    onClick={sendReply}
                    disabled={!replyText.trim() || sendingReply}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-green-600 text-white transition-colors hover:bg-green-700 disabled:opacity-40"
                  >
                    {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <p className="text-center text-[11px] text-slate-600">
        Données en temps réel · {users.length} compte{users.length > 1 ? "s" : ""} enregistré{users.length > 1 ? "s" : ""}
      </p>
    </div>
  );
}
