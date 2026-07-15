"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Phone, Mail, Star, Gift, Calendar, Stamp, UserPlus, Users,
  CreditCard, Clock, TrendingUp, UserCheck, ChevronDown, ChevronUp,
  Plus, Pencil, Trash2, RefreshCw, FolderPlus, Folder, FolderOpen,
  MoveRight, CheckSquare, Download,
} from "lucide-react";
import CustomerTable, { type EnrichedCustomer } from "@/components/clients/CustomerTable";
import { computeRank } from "@/lib/rank";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDate, formatTimeAgo } from "@/lib/utils";
import { useStore } from "@/lib/store-context";
import { useNetworkOrigin } from "@/lib/use-network-origin";
import type { ActivityItem, Customer, CustomerCard, LoyaltyCard, Reward } from "@/types";
import { fetchPlanFeatures } from "@/lib/plan-features";

// ── Folder types ──────────────────────────────────────────────────────────────

interface ClientFolder {
  id: string;
  name: string;
  customerIds: string[];
}

const FOLDERS_KEY = "cc_client_folders";
const GENERAL_ID = "general";

function loadFolders(): ClientFolder[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(FOLDERS_KEY) || "[]"); }
  catch { return []; }
}

function saveFolders(folders: ClientFolder[]) {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
}

// ── Per-client Activity Log ───────────────────────────────────────────────────

const logConfig: Record<ActivityItem["type"], { icon: React.ElementType; color: string; bg: string }> = {
  visit:        { icon: TrendingUp, color: "#2563eb", bg: "rgba(37,99,235,0.1)" },
  points_added: { icon: Star,       color: "#7c3aed", bg: "rgba(124,58,237,0.1)" },
  reward:       { icon: Gift,       color: "#d97706", bg: "rgba(217,119,6,0.1)" },
  new_client:   { icon: UserCheck,  color: "#059669", bg: "rgba(5,150,105,0.1)" },
};

type SrvRedemption = { id: string; customerId: string; rewardName: string; rewardEmoji: string; cost: number; costType: string; redeemedAt: string };

function ClientLog({ activity, customerId, serverRedemptions }: {
  activity: ActivityItem[];
  customerId: string;
  serverRedemptions: SrvRedemption[];
}) {
  // Activités locales hors récompenses (les récompenses viennent du serveur)
  const localLogs = activity.filter((a) => a.customerId === customerId && a.type !== "reward");

  // Récompenses serveur converties en entrées d'historique
  const rewardLogs = serverRedemptions
    .filter((r) => r.customerId === customerId)
    .map((r) => ({
      id: `srv-${r.id}`,
      type: "reward" as const,
      description: `${r.rewardEmoji} ${r.rewardName}`,
      time: r.redeemedAt,
      value: undefined as number | undefined,
      cost: r.cost,
      costType: r.costType,
    }));

  // Fusionner et trier par date décroissante
  const merged = [
    ...localLogs.map((a) => ({ id: a.id, type: a.type, description: a.description, time: a.time, value: a.value, cost: undefined as number | undefined, costType: undefined as string | undefined })),
    ...rewardLogs,
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return (
    <div className="border-t border-slate-100 px-5 py-4">
      <div className="mb-3 flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 text-slate-400" />
        <p className="text-[12px] font-medium text-slate-500">Historique</p>
        {merged.length > 0 && (
          <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-500">{merged.length}</span>
        )}
      </div>
      {merged.length === 0 ? (
        <p className="py-4 text-center text-[12px] text-slate-400">Aucune activité</p>
      ) : (
        <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
          {merged.map((item) => {
            const cfg = logConfig[item.type];
            const Icon = cfg.icon;
            return (
              <div key={item.id} className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full" style={{ background: cfg.bg }}>
                  <Icon className="h-3 w-3" style={{ color: cfg.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium leading-tight text-slate-700">{item.description}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{formatTimeAgo(item.time)}</p>
                </div>
                {item.type === "reward" && item.cost !== undefined ? (
                  <span className="flex-shrink-0 text-[12px] font-semibold text-amber-600">
                    -{item.cost} {item.costType === "points" ? "pts" : "🎫"}
                  </span>
                ) : item.value !== undefined ? (
                  <span className="flex-shrink-0 text-[12px] font-semibold" style={{ color: cfg.color }}>+{item.value}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Per-customer-card widget ───────────────────────────────────────────────────

function CustomerCardWidget({
  cc, card, rewards, networkOrigin, customer,
  onAddStamp, onAddPoints, onUseReward, onUnassign,
}: {
  cc: CustomerCard; card: LoyaltyCard; rewards: Reward[];
  networkOrigin: string; customer: Customer;
  onAddStamp: () => void; onAddPoints: () => void;
  onUseReward: (r: Reward) => void; onUnassign?: () => void;
}) {
  const [qrUrl, setQrUrl] = useState("");
  const [walletQrUrl, setWalletQrUrl] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [qrTab, setQrTab] = useState<"scan" | "wallet">("scan");

  const availableReward = rewards.find(
    (r) => r.active && r.mode === card.loyaltyMode &&
      (card.loyaltyMode === "stamps" ? cc.stamps >= r.cost : cc.points >= r.cost)
  ) ?? null;

  useEffect(() => {
    if (!networkOrigin || !expanded) return;
    // QR scanner (process/ pour donner pts)
    const scanUrl = `${networkOrigin}/process/${cc.id}`;
    QRCode.toDataURL(scanUrl, { width: 140, margin: 1.5, color: { dark: "#0f172a", light: "#ffffff" } })
      .then(setQrUrl).catch(() => {});
    // QR re-téléchargement carte wallet
    const walletUrl = `${networkOrigin}/api/client/cards/wallet?ccId=${cc.id}`;
    QRCode.toDataURL(walletUrl, { width: 140, margin: 1.5, color: { dark: "#0f172a", light: "#ffffff" } })
      .then(setWalletQrUrl).catch(() => {});
  }, [cc.id, networkOrigin, expanded]);

  return (
    <div className="rounded-xl border border-black/[0.06] bg-white overflow-hidden">
      <div className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setExpanded((v) => !v)}>
        <div className="h-9 w-9 flex-shrink-0 rounded-lg flex items-center justify-center text-[13px] font-bold"
          style={{ background: card.backgroundColor, color: card.accentColor }}>
          {card.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-slate-800">{card.name}</p>
          <p className="text-[11.5px] text-slate-400">
            {card.loyaltyMode === "stamps"
              ? `${cc.stamps}/${card.stampsRequired} tampons`
              : `${cc.points.toLocaleString("fr-FR")} points`}
            {((cc.referralCount ?? 0) > 0 || (cc.pendingReferrals ?? 0) > 0) && (
              <span className="ml-2 text-slate-400">
                {(cc.referralCount ?? 0) > 0 && <>· 🤝 {cc.referralCount} parrainage{(cc.referralCount ?? 0) > 1 ? "s" : ""}</>}
                {(cc.referralPoints ?? 0) > 0 && ` (${cc.referralPoints} pt${(cc.referralPoints ?? 0) > 1 ? "s" : ""} dispo)`}
                {(cc.pendingReferrals ?? 0) > 0 && <span className="text-amber-500"> · {cc.pendingReferrals} en attente de 1ère visite</span>}
              </span>
            )}
          </p>
        </div>
        {availableReward && (
          <span className="text-[10px] font-medium text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">Récompense !</span>
        )}
        {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </div>

      {card.loyaltyMode === "stamps" && (
        <div className="px-3.5 pb-2">
          <div className="h-1.5 w-full rounded-full bg-slate-100">
            <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min((cc.stamps / card.stampsRequired) * 100, 100)}%`, background: card.accentColor }} />
          </div>
        </div>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="border-t border-slate-100 p-3.5 space-y-3">
              {/* Tabs QR */}
              <div className="flex rounded-lg bg-slate-100 p-0.5 gap-0.5">
                <button onClick={() => setQrTab("scan")}
                  className={`flex-1 rounded-md py-1 text-[11px] font-semibold transition-all ${qrTab === "scan" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  Scanner pts/tampons
                </button>
                <button onClick={() => setQrTab("wallet")}
                  className={`flex-1 rounded-md py-1 text-[11px] font-semibold transition-all ${qrTab === "wallet" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  Retélécharger carte
                </button>
              </div>

              <div className="flex flex-col items-center gap-2 py-1">
                {qrTab === "scan" ? (
                  <>
                    {qrUrl ? (
                      <div className="rounded-xl bg-white p-2 ring-1 ring-black/[0.06]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={qrUrl} alt="QR Scanner" width={120} height={120} className="rounded-lg" />
                      </div>
                    ) : networkOrigin ? (
                      <div className="h-[136px] w-[136px] animate-pulse rounded-xl bg-slate-100" />
                    ) : (
                      <div className="flex h-[136px] w-[136px] items-center justify-center rounded-xl text-[11px] text-slate-400 bg-slate-50">Chargement...</div>
                    )}
                    <p className="text-[10.5px] text-slate-400 text-center">Scanner depuis l&apos;iPhone · même Wi-Fi</p>
                  </>
                ) : (
                  <>
                    {walletQrUrl ? (
                      <div className="rounded-xl bg-white p-2 ring-1 ring-black/[0.06]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={walletQrUrl} alt="QR Wallet" width={120} height={120} className="rounded-lg" />
                      </div>
                    ) : networkOrigin ? (
                      <div className="h-[136px] w-[136px] animate-pulse rounded-xl bg-slate-100" />
                    ) : (
                      <div className="flex h-[136px] w-[136px] items-center justify-center rounded-xl text-[11px] text-slate-400 bg-slate-50">Chargement...</div>
                    )}
                    <p className="text-[10.5px] text-slate-400 text-center">Le client scanne pour retélécharger sa carte avec ses {card.loyaltyMode === "stamps" ? "tampons" : "points"} actuels</p>
                  </>
                )}
              </div>

              {card.loyaltyMode === "stamps" && (
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: card.stampsRequired }).map((_, i) => (
                    <div key={i} className={`flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-medium ${i < cc.stamps ? "bg-green-50 text-green-700 border border-green-200" : "bg-slate-50 text-slate-300 border border-slate-200"}`}>
                      {i < cc.stamps ? "✓" : i + 1}
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                {card.loyaltyMode === "stamps" ? (
                  <Button size="sm" className="w-full gap-2" onClick={onAddStamp}>
                    <Stamp className="h-3.5 w-3.5" />+1 tampon
                  </Button>
                ) : (
                  <Button size="sm" className="w-full gap-2" onClick={onAddPoints}>
                    <Star className="h-3.5 w-3.5" />+{card.pointsPerEuro * 10} points
                  </Button>
                )}
                {availableReward && (
                  <Button size="sm" variant="success" className="w-full gap-2" onClick={() => onUseReward(availableReward)}>
                    <Gift className="h-3.5 w-3.5" />Utiliser : {availableReward.name}
                  </Button>
                )}
                {onUnassign && (
                  <button onClick={onUnassign} className="w-full text-center text-[11px] text-slate-400 hover:text-red-500 transition-colors py-1">
                    Retirer cette carte
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Assign card dialog ────────────────────────────────────────────────────────

function AssignCardDialog({ open, onClose, onAssign, loyaltyCards, alreadyAssigned }: {
  open: boolean; onClose: () => void; onAssign: (cardId: string) => void;
  loyaltyCards: LoyaltyCard[]; alreadyAssigned: string[];
}) {
  const available = loyaltyCards.filter((c) => c.active && !alreadyAssigned.includes(c.id));
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[380px]">
        <div className="px-6 pt-6 pb-4 pr-12">
          <DialogTitle className="text-[15px] font-semibold text-slate-900">Assigner une carte</DialogTitle>
          <p className="mt-0.5 text-[12px] text-slate-400">Choisissez une carte à attribuer à ce client</p>
        </div>
        <div className="h-px bg-slate-100" />
        <div className="px-6 py-5 space-y-2">
          {available.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-slate-400">
              {loyaltyCards.length === 0 ? "Aucune carte créée. Créez d'abord une carte dans Carte Wallet." : "Toutes les cartes sont déjà assignées."}
            </p>
          ) : (
            available.map((card) => (
              <button key={card.id} onClick={() => { onAssign(card.id); onClose(); }}
                className="w-full flex items-center gap-3 rounded-xl border border-black/[0.06] bg-white p-3.5 text-left hover:border-green-200 hover:bg-green-50 transition-colors">
                <div className="h-9 w-9 flex-shrink-0 rounded-lg flex items-center justify-center text-[13px] font-bold"
                  style={{ background: card.backgroundColor, color: card.accentColor }}>
                  {card.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-slate-800">{card.name}</p>
                  <p className="text-[11.5px] text-slate-400">
                    {card.loyaltyMode === "stamps" ? `${card.stampsRequired} tampons` : `${card.pointsPerEuro} pts/€`}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
        <div className="h-px bg-slate-100" />
        <div className="flex justify-end px-6 py-4">
          <Button variant="secondary" onClick={onClose}>Fermer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const {
    customers, rewards, activity,
    loyaltyCards, customerCards,
    syncFromServer, serverRedemptions,
    addCustomer, updateCustomer, deleteCustomer,
    assignCard, unassignCard,
    addStampToCard, addPointsToCard, useRewardOnCard,
  } = useStore();

  // ── Folders ──
  const [folders, setFolders] = useState<ClientFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string>(GENERAL_ID);

  useEffect(() => {
    setFolders(loadFolders());
  }, []);

  const persistFolders = useCallback((next: ClientFolder[]) => {
    setFolders(next);
    saveFolders(next);
  }, []);

  // Customers in active folder
  const customersInFolder = (() => {
    if (activeFolderId === GENERAL_ID) {
      const allAssignedIds = new Set(folders.flatMap((f) => f.customerIds));
      return customers.filter((c) => !allAssignedIds.has(c.id));
    }
    const folder = folders.find((f) => f.id === activeFolderId);
    if (!folder) return customers;
    return customers.filter((c) => folder.customerIds.includes(c.id));
  })();

  // ── Selection ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const clearSelection = () => setSelectedIds(new Set());

  const handleDeleteSelected = () => {
    if (!confirm(`Supprimer ${selectedIds.size} client${selectedIds.size > 1 ? "s" : ""} ? Cette action est irréversible.`)) return;
    selectedIds.forEach((id) => deleteCustomer(id));
    // Remove from all folders too
    persistFolders(folders.map((f) => ({
      ...f,
      customerIds: f.customerIds.filter((cid) => !selectedIds.has(cid)),
    })));
    clearSelection();
  };

  const handleMoveSelected = (targetFolderId: string) => {
    const idsToMove = Array.from(selectedIds);
    persistFolders(
      folders.map((f) => {
        if (f.id === targetFolderId) {
          const next = new Set([...f.customerIds, ...idsToMove]);
          return { ...f, customerIds: Array.from(next) };
        }
        // Remove from other folders
        return { ...f, customerIds: f.customerIds.filter((cid) => !idsToMove.includes(cid)) };
      })
    );
    clearSelection();
  };

  const handleMoveToGeneral = () => {
    const idsToMove = new Set(selectedIds);
    persistFolders(
      folders.map((f) => ({ ...f, customerIds: f.customerIds.filter((cid) => !idsToMove.has(cid)) }))
    );
    clearSelection();
  };

  // ── Folder management ──
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  const createFolder = () => {
    if (!newFolderName.trim()) return;
    const f: ClientFolder = { id: `folder_${Date.now()}`, name: newFolderName.trim(), customerIds: [] };
    persistFolders([...folders, f]);
    setNewFolderName("");
    setShowNewFolder(false);
    setActiveFolderId(f.id);
  };

  const renameFolder = (id: string) => {
    if (!renameValue.trim()) return;
    persistFolders(folders.map((f) => f.id === id ? { ...f, name: renameValue.trim() } : f));
    setRenamingId(null);
  };

  const deleteFolder = (id: string) => {
    if (!confirm("Supprimer ce dossier ? Les clients seront déplacés dans Général.")) return;
    persistFolders(folders.filter((f) => f.id !== id));
    if (activeFolderId === id) setActiveFolderId(GENERAL_ID);
  };

  // ── Sync ──
  const [syncing, setSyncing] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    syncIntervalRef.current = setInterval(async () => {
      const n = await syncFromServer();
      if (n > 0) setNewCount((prev) => prev + n);
    }, 15000);
    return () => { if (syncIntervalRef.current) clearInterval(syncIntervalRef.current); };
  }, [syncFromServer]);

  const handleSync = async () => {
    setSyncing(true);
    await syncFromServer();
    setNewCount(0);
    setSyncing(false);
  };

  const networkOrigin = useNetworkOrigin();

  // ── Client detail ──
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = customers.find((c) => c.id === selectedId) ?? null;

  // Sync automatique à l'ouverture du drawer pour avoir les points/tampons à jour
  useEffect(() => {
    if (selectedId) syncFromServer();
  }, [selectedId, syncFromServer]);

  const [showAddClient, setShowAddClient] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCardId, setNewCardId] = useState("");

  const [showAssign, setShowAssign] = useState(false);
  const [maxClients, setMaxClients] = useState<number | null>(null);

  useEffect(() => {
    fetchPlanFeatures().then((f) => setMaxClients(f?.maxClients ?? null));
  }, []);

  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");

  const openEdit = () => {
    if (!selected) return;
    setEditName(selected.name);
    setEditEmail(selected.email);
    setEditPhone(selected.phone);
    setShowEdit(true);
  };

  const handleEditSave = () => {
    if (!selected || !editName.trim()) return;
    updateCustomer(selected.id, { name: editName, email: editEmail, phone: editPhone });
    setShowEdit(false);
  };

  const handleDelete = () => {
    if (!selected) return;
    if (!confirm(`Supprimer le compte de ${selected.name} ? Cette action est irréversible.`)) return;
    deleteCustomer(selected.id);
    persistFolders(folders.map((f) => ({ ...f, customerIds: f.customerIds.filter((cid) => cid !== selected.id) })));
    setSelectedId(null);
  };

  const clientCards = selected ? customerCards.filter((cc) => cc.customerId === selected.id) : [];

  const handleCreateClient = () => {
    if (!newName.trim()) return;
    if (loyaltyCards.length > 0 && !newCardId) return;
    const c = addCustomer({ name: newName, email: newEmail, phone: newPhone });
    const card = loyaltyCards.find((lc) => lc.id === newCardId);
    const cc = newCardId ? assignCard(c.id, newCardId) : null;
    setNewName(""); setNewEmail(""); setNewPhone(""); setNewCardId("");
    setShowAddClient(false);
    setSelectedId(c.id);
    // Persist to server so forgot-password and admin panel work
    if (cc) {
      fetch("/api/register/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          joinDate: c.joinDate,
          cardId: newCardId || cc.cardId,
          customerCardId: cc.id,
          stamps: cc.stamps,
          points: card?.welcomePoints ?? 0,
        }),
      }).catch(() => {});
    }
  };

  // Count per folder
  const generalCount = (() => {
    const assigned = new Set(folders.flatMap((f) => f.customerIds));
    return customers.filter((c) => !assigned.has(c.id)).length;
  })();

  const tableCustomers: EnrichedCustomer[] = customersInFolder.map((c) => {
    const ccs = customerCards.filter((cc) => cc.customerId === c.id);
    const firstCard = loyaltyCards.find((card) => ccs.some((cc) => cc.cardId === card.id)) ?? null;
    return {
      ...c,
      points: ccs.reduce((s, cc) => s + cc.points, 0),
      stamps: ccs.reduce((s, cc) => s + cc.stamps, 0),
      rank: computeRank(c, firstCard),
      referrals: ccs.reduce((s, cc) => s + (cc.referralCount ?? 0), 0),
      referralPointsLeft: ccs.reduce((s, cc) => s + (cc.referralPoints ?? 0), 0),
      referralsPending: ccs.reduce((s, cc) => s + (cc.pendingReferrals ?? 0), 0),
    };
  });

  const atClientLimit = maxClients !== null && customers.length >= maxClients;
  const nearClientLimit = maxClients !== null && !atClientLimit && customers.length >= maxClients * 0.8;

  return (
    <div className="space-y-4">
      {/* Limite clients du plan */}
      {atClientLimit && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-3.5">
          <span className="text-[20px]">🚫</span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-red-800">
              {customers.length}/{maxClients} clients — les nouvelles inscriptions sont bloquées
            </p>
            <p className="text-[12px] text-red-700/70">
              Vos clients actuels continuent de cumuler normalement, mais personne ne peut plus rejoindre votre programme.
            </p>
          </div>
          <a href="/abonnement"
            className="flex-shrink-0 rounded-xl bg-red-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-md shadow-red-600/25 transition-all hover:bg-red-700 active:scale-[0.98]">
            Passer au plan supérieur
          </a>
        </div>
      )}
      {nearClientLimit && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
          <span className="text-[18px]">⚠️</span>
          <p className="min-w-0 flex-1 text-[13px] text-amber-800">
            <strong>{customers.length}/{maxClients} clients</strong> — plus que {maxClients - customers.length} place{maxClients - customers.length > 1 ? "s" : ""} sur votre plan.
          </p>
          <a href="/abonnement" className="flex-shrink-0 text-[12.5px] font-semibold text-amber-700 underline hover:text-amber-900">
            Voir les plans
          </a>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-green-600">Clients</p>
          <h2 className="mt-0.5 text-[17px] font-semibold text-slate-900">Base de clients</h2>
          <p className="mt-1 text-[13px] text-slate-500">
            {customers.length > 0
              ? `${customers.length} client${customers.length > 1 ? "s" : ""} inscrit${customers.length > 1 ? "s" : ""}`
              : "Aucun client pour l'instant"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSync} disabled={syncing}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12.5px] font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 relative"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            Sync
            {newCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-600 text-[9px] font-bold text-white">{newCount}</span>
            )}
          </button>
          <button
            onClick={() => window.open("/api/register/export", "_blank")}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12.5px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Exporter CSV
          </button>
          <Button
            className="flex-shrink-0 gap-2"
            onClick={() => loyaltyCards.length > 0 ? setShowAddClient(true) : alert("Créez d'abord une carte fidélité dans « Cartes Wallet » avant d'ajouter des clients.")}
          >
            <UserPlus className="h-4 w-4" />
            Nouveau client
          </Button>
        </div>
      </div>

      {/* Selection action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="flex flex-wrap items-center gap-2 rounded-xl bg-green-600 px-4 py-3"
          >
            {/* Count badge */}
            <div className="flex items-center gap-2 rounded-lg bg-white/20 px-3 py-1.5">
              <CheckSquare className="h-3.5 w-3.5 text-white" />
              <span className="text-[13px] font-semibold text-white">
                {selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}
              </span>
            </div>

            <div className="flex-1" />

            {/* Move to folder */}
            <div className="relative">
              <button
                onClick={() => setShowMoveMenu((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg bg-white/15 border border-white/25 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-white/25 transition-colors"
              >
                <MoveRight className="h-3.5 w-3.5" />
                Déplacer vers…
              </button>
              <AnimatePresence>
                {showMoveMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute right-0 top-full mt-1 z-10 min-w-[180px] rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden"
                  >
                    <button
                      onClick={() => { handleMoveToGeneral(); setShowMoveMenu(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-[12.5px] text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Folder className="h-3.5 w-3.5 text-slate-400" /> Général
                    </button>
                    {folders.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => { handleMoveSelected(f.id); setShowMoveMenu(false); }}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-[12.5px] text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Folder className="h-3.5 w-3.5 text-slate-400" /> {f.name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Delete */}
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 rounded-lg bg-white/15 border border-white/25 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-white/30 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </button>

            {/* Cancel */}
            <button
              onClick={clearSelection}
              className="rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-white/70 hover:text-white hover:bg-white/15 transition-colors"
            >
              Annuler
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {customers.length === 0 ? (
        <div className="flex flex-col items-center gap-5 rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <Users className="h-7 w-7 text-slate-300" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-slate-700">Aucun client</p>
            <p className="mt-1 text-[13px] text-slate-400">Ajoutez votre premier client pour commencer.</p>
          </div>
          {loyaltyCards.length === 0 ? (
            <p className="text-[13px] text-amber-600 font-medium">⚠ Créez d&apos;abord une carte fidélité dans <strong>Cartes Wallet</strong>.</p>
          ) : (
            <Button onClick={() => setShowAddClient(true)} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Ajouter le premier client
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          {/* ── Folder sidebar ── */}
          <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white md:w-48 md:flex-shrink-0">
            <div className="border-b border-slate-100 px-3 py-2.5">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-400">Dossiers</p>
            </div>

            {/* Général (always first) */}
            <button
              onClick={() => setActiveFolderId(GENERAL_ID)}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors ${activeFolderId === GENERAL_ID ? "bg-green-50 text-green-700" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {activeFolderId === GENERAL_ID
                ? <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                : <Folder className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />}
              <span className="flex-1 truncate text-[13px] font-medium">Général</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${activeFolderId === GENERAL_ID ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-500"}`}>{generalCount}</span>
            </button>

            {/* Custom folders */}
            {folders.map((folder) => (
              <div key={folder.id} className="group">
                {renamingId === folder.id ? (
                  <div className="p-2">
                    <input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") renameFolder(folder.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      onBlur={() => renameFolder(folder.id)}
                      className="w-full h-7 rounded-md border border-green-400 bg-white px-2 text-[12px] text-slate-800 outline-none ring-2 ring-green-100"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className={`flex items-center gap-1 pr-2 transition-colors ${activeFolderId === folder.id ? "bg-green-50" : "hover:bg-slate-50"}`}>
                    <button
                      onClick={() => setActiveFolderId(folder.id)}
                      className={`flex flex-1 min-w-0 items-center gap-2 px-3 py-2.5 text-left transition-colors ${activeFolderId === folder.id ? "text-green-700" : "text-slate-600"}`}
                    >
                      {activeFolderId === folder.id
                        ? <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                        : <Folder className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />}
                      <span className="flex-1 truncate text-[13px] font-medium">{folder.name}</span>
                      <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${activeFolderId === folder.id ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-500"}`}>
                        {folder.customerIds.filter((id) => customers.some((c) => c.id === id)).length}
                      </span>
                    </button>
                    <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setRenamingId(folder.id); setRenameValue(folder.name); }}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                        title="Renommer"
                      >
                        <Pencil className="h-2.5 w-2.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id); }}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        title="Supprimer le dossier"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* New folder */}
            {showNewFolder ? (
              <div className="border-t border-slate-100 p-2">
                <input
                  placeholder="Nom du dossier"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createFolder();
                    if (e.key === "Escape") { setShowNewFolder(false); setNewFolderName(""); }
                  }}
                  onBlur={() => { if (!newFolderName.trim()) { setShowNewFolder(false); } }}
                  className="w-full h-7 rounded-md border border-slate-200 bg-white px-2 text-[12px] text-slate-800 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                  autoFocus
                />
                <div className="mt-1.5 flex gap-1.5">
                  <button onClick={createFolder} disabled={!newFolderName.trim()} className="flex-1 rounded-md bg-green-600 py-1 text-[11px] font-medium text-white disabled:opacity-50">
                    Créer
                  </button>
                  <button onClick={() => { setShowNewFolder(false); setNewFolderName(""); }} className="flex-1 rounded-md border border-slate-200 py-1 text-[11px] text-slate-600 hover:bg-slate-50">
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowNewFolder(true)}
                className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-[12px] text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                Nouveau dossier
              </button>
            )}
          </div>

          {/* ── Main table ── */}
          <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
            <CustomerTable
              customers={tableCustomers}
              onSelect={(c) => { clearSelection(); setSelectedId(c.id); }}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />
          </div>
        </div>
      )}

      {/* Dialogs */}
      <Dialog open={showAddClient} onOpenChange={(o) => { setShowAddClient(o); if (!o) { setNewName(""); setNewEmail(""); setNewPhone(""); setNewCardId(""); } }}>
        <DialogContent className="sm:max-w-[440px]">
          <div className="px-7 pt-7 pb-5 pr-14">
            <DialogTitle className="text-[16px] font-semibold text-slate-900">Ajouter un client</DialogTitle>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="px-7 py-6 space-y-5">
            <div className="space-y-2">
              <label className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-slate-400">Nom complet *</label>
              <Input placeholder="ex: Marie Dupont" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateClient()} autoFocus />
            </div>
            <div className="space-y-2">
              <label className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-slate-400">Email</label>
              <Input type="email" placeholder="email@exemple.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-slate-400">Téléphone</label>
              <Input placeholder="06 XX XX XX XX" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            </div>
            {loyaltyCards.length > 0 && (
              <div className="space-y-2">
                <label className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-slate-400">Carte fidélité *</label>
                <select
                  value={newCardId}
                  onChange={(e) => setNewCardId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13.5px] text-slate-900 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                >
                  <option value="">Sélectionner une carte…</option>
                  {loyaltyCards.map((card) => (
                    <option key={card.id} value={card.id}>{card.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="h-px bg-slate-100" />
          <div className="flex justify-end gap-2 px-7 py-5">
            <Button variant="secondary" onClick={() => setShowAddClient(false)}>Annuler</Button>
            <Button onClick={handleCreateClient} disabled={!newName.trim() || (loyaltyCards.length > 0 && !newCardId)}>Créer le client</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sm:max-w-[440px]">
          <div className="px-7 pt-7 pb-5 pr-14">
            <DialogTitle className="text-[16px] font-semibold text-slate-900">Modifier le client</DialogTitle>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="px-7 py-6 space-y-5">
            <div className="space-y-2">
              <label className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-slate-400">Nom complet *</label>
              <Input placeholder="ex: Marie Dupont" value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleEditSave()} autoFocus />
            </div>
            <div className="space-y-2">
              <label className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-slate-400">Email</label>
              <Input type="email" placeholder="email@exemple.com" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-slate-400">Téléphone</label>
              <Input placeholder="06 XX XX XX XX" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </div>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="flex justify-end gap-2 px-7 py-5">
            <Button variant="secondary" onClick={() => setShowEdit(false)}>Annuler</Button>
            <Button onClick={handleEditSave} disabled={!editName.trim()}>Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AssignCardDialog
        open={showAssign}
        onClose={() => setShowAssign(false)}
        onAssign={(cardId) => selected && assignCard(selected.id, cardId)}
        loyaltyCards={loyaltyCards}
        alreadyAssigned={clientCards.map((cc) => cc.cardId)}
      />

      {/* Client detail drawer */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/20" onClick={() => setSelectedId(null)} />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", bounce: 0.1, duration: 0.4 }}
              className="fixed right-0 top-0 z-50 flex h-full flex-col overflow-y-auto border-l border-slate-200 bg-[#fafafa]"
              style={{ width: 360 }}
            >
              <div className="flex items-start gap-3 border-b border-slate-100 bg-white p-5">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-green-600 text-[13px] font-bold text-white">
                  {selected.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-slate-900">{selected.name}</p>
                  <p className="text-[11.5px] text-slate-400">Inscrit le {formatDate(selected.joinDate)}</p>
                  <div className="mt-2">
                    <Badge variant={selected.status === "vip" ? "default" : selected.status === "active" ? "success" : selected.status === "new" ? "cyan" : "secondary"}>
                      {selected.status === "vip" ? "VIP" : selected.status === "active" ? "Actif" : selected.status === "new" ? "Nouveau" : "Inactif"}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button onClick={openEdit} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={handleDelete} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setSelectedId(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 border-b border-slate-100 bg-white px-5 py-4">
                {selected.email && (
                  <div className="flex items-center gap-2.5 text-[13px] text-slate-600">
                    <Mail className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />{selected.email}
                  </div>
                )}
                {selected.phone && (
                  <div className="flex items-center gap-2.5 text-[13px] text-slate-600">
                    <Phone className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />{selected.phone}
                  </div>
                )}
                <div className="flex items-center gap-2.5 text-[13px] text-slate-500">
                  <Calendar className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                  Dernière visite : {formatDate(selected.lastVisit)}
                </div>
              </div>

              {(() => {
                const custRedemptions = serverRedemptions.filter((r) => r.customerId === selected.id);
                const totalPtsUsed = custRedemptions.filter((r) => r.costType === "points").reduce((s, r) => s + r.cost, 0);
                return (
                  <>
                    <div className="grid grid-cols-3 gap-2 px-5 py-4">
                      {[
                        { label: "Visites", value: selected.totalVisits, color: "#2563eb" },
                        { label: "Récompenses", value: custRedemptions.length, color: "#059669" },
                        { label: "Pts utilisés", value: totalPtsUsed, color: "#7c3aed" },
                      ].map((stat) => (
                        <div key={stat.label} className="rounded-xl border border-black/[0.06] bg-white p-3 text-center">
                          <p className="text-[18px] font-bold leading-none" style={{ color: stat.color }}>{stat.value}</p>
                          <p className="mt-1.5 text-[10px] text-slate-500">{stat.label}</p>
                        </div>
                      ))}
                    </div>
                    {custRedemptions.length > 0 && (
                      <div className="border-t border-slate-100 px-5 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Récompenses utilisées</p>
                        <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                          {custRedemptions.slice().reverse().map((r) => (
                            <div key={r.id} className="flex items-center justify-between text-[12px]">
                              <span className="flex items-center gap-1.5 text-slate-700">
                                <span>{r.rewardEmoji}</span>{r.rewardName}
                              </span>
                              <span className="text-slate-400 shrink-0 ml-2">
                                -{r.cost} {r.costType === "points" ? "pts" : "🎫"} · {new Date(r.redeemedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              <div className="border-t border-slate-100 px-5 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                    <p className="text-[12px] font-medium text-slate-500">Cartes fidélité</p>
                    {clientCards.length > 0 && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-500">{clientCards.length}</span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowAssign(true)}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11.5px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <Plus className="h-3 w-3" />Assigner
                  </button>
                </div>

                {clientCards.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center">
                    <p className="text-[12.5px] text-slate-400">Aucune carte assignée</p>
                    <button onClick={() => setShowAssign(true)} className="mt-2 text-[12px] font-medium text-green-600 hover:underline">
                      Assigner une carte
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {clientCards.map((cc) => {
                      const card = loyaltyCards.find((c) => c.id === cc.cardId);
                      if (!card) return null;
                      return (
                        <CustomerCardWidget
                          key={cc.id} cc={cc} card={card} rewards={rewards}
                          networkOrigin={networkOrigin} customer={selected}
                          onAddStamp={() => addStampToCard(cc.id)}
                          onAddPoints={() => addPointsToCard(cc.id, card.pointsPerEuro * 10)}
                          onUseReward={(r) => useRewardOnCard(cc.id, r)}
                          onUnassign={clientCards.length > 1 ? () => unassignCard(cc.id) : undefined}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              <ClientLog activity={activity} customerId={selected.id} serverRedemptions={serverRedemptions} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
