"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import {
  storeSettings as defaultSettings,
  products as defaultProducts,
  rewards as defaultRewards,
  customers as defaultCustomers,
  walletConfig as defaultWalletConfig,
} from "./mock-data";
import type {
  Product, Reward, Customer, StoreSettings, WalletConfig,
  ActivityItem, CustomerStatus, LoyaltyCard, CustomerCard,
} from "@/types";

// ── Version guard + localStorage scopé par tenant ────────────────────────────
const STORE_VERSION = "cards-v2";

const DEFAULT_CATEGORIES: string[] = [];

function makeKeys(tenantId: string) {
  const p = `cc_${tenantId}_`;
  return {
    version:      `${p}version`,
    settings:     `${p}settings`,
    products:     `${p}products`,
    rewards:      `${p}rewards`,
    categories:   `${p}categories`,
    customers:    `${p}customers`,
    wallet:       `${p}wallet`,
    activity:     `${p}activity`,
    loyalty_cards:`${p}loyalty_cards`,
    customer_cards:`${p}customer_cards`,
  };
}

function initVersionGuard(keys: ReturnType<typeof makeKeys>) {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(keys.version) !== STORE_VERSION) {
    Object.values(keys).forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(keys.version, STORE_VERSION);
  }
}

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function save<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function computeStatus(totalVisits: number): CustomerStatus {
  if (totalVisits >= 15) return "vip";
  if (totalVisits >= 3) return "active";
  return "new";
}

// ── Context interface ─────────────────────────────────────────────────────────

interface StoreCtx {
  settings: StoreSettings;
  updateSettings: (patch: Partial<StoreSettings>) => void;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  rewards: Reward[];
  setRewards: React.Dispatch<React.SetStateAction<Reward[]>>;
  categories: string[];
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  walletConfig: WalletConfig;
  setWalletConfig: React.Dispatch<React.SetStateAction<WalletConfig>>;
  activity: ActivityItem[];
  addActivity: (item: Omit<ActivityItem, "id" | "time">) => void;
  // Loyalty cards
  loyaltyCards: LoyaltyCard[];
  addLoyaltyCard: (data: Omit<LoyaltyCard, "id" | "createdAt">) => LoyaltyCard;
  updateLoyaltyCard: (id: string, patch: Partial<LoyaltyCard>) => void;
  deleteLoyaltyCard: (id: string) => void;
  // Customer-card assignments
  customerCards: CustomerCard[];
  assignCard: (customerId: string, cardId: string) => CustomerCard;
  unassignCard: (customerCardId: string) => void;
  addStampToCard: (customerCardId: string) => void;
  addPointsToCard: (customerCardId: string, amount: number) => void;
  useRewardOnCard: (customerCardId: string, reward: Reward) => void;
  // Rédemptions serveur (historique récompenses utilisées)
  serverRedemptions: Array<{ id: string; customerId: string; customerCardId: string; rewardName: string; rewardEmoji: string; cost: number; costType: string; redeemedAt: string }>;
  // Legacy customer actions (global, uses settings)
  syncFromServer: () => Promise<number>;
  addCustomer: (data: { name: string; email: string; phone: string }) => Customer;
  updateCustomer: (id: string, patch: { name: string; email: string; phone: string }) => void;
  deleteCustomer: (id: string) => void;
  addStamp: (customerId: string) => void;
  addPoints: (customerId: string, amount: number) => void;
  useReward: (customerId: string, reward: Reward) => void;
}

const StoreContext = createContext<StoreCtx | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function StoreProvider({ children, tenantId }: { children: ReactNode; tenantId: string }) {
  const KEYS = makeKeys(tenantId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { initVersionGuard(KEYS); }, [tenantId]);
  const [settings, setSettings]         = useState<StoreSettings>(defaultSettings);
  const [products, setProducts]         = useState<Product[]>(defaultProducts);
  const [rewards, setRewards]           = useState<Reward[]>(defaultRewards);
  const [categories, setCategories]     = useState<string[]>(DEFAULT_CATEGORIES);
  const [customers, setCustomers]       = useState<Customer[]>(defaultCustomers);
  const [walletConfig, setWalletConfig] = useState<WalletConfig>(defaultWalletConfig);
  const [activity, setActivity]         = useState<ActivityItem[]>([]);
  const [loyaltyCards, setLoyaltyCards] = useState<LoyaltyCard[]>([]);
  const [customerCards, setCustomerCards] = useState<CustomerCard[]>([]);
  type ServerRedemption = { id: string; customerId: string; customerCardId: string; rewardName: string; rewardEmoji: string; cost: number; costType: string; redeemedAt: string };
  const [serverRedemptions, setServerRedemptions] = useState<ServerRedemption[]>([]);
  // Blocks server save until initial hydration is complete (prevents overwriting server data with defaults)
  const serverHydrated = useRef(false);

  // Sync new registrations from server into local state — returns count of new clients added
  const syncFromServer = useCallback(async (): Promise<number> => {
    try {
      const res = await fetch("/api/register");
      const { customers: srvC, customerCards: srvCC, redemptions: srvR } = await res.json();
      if (!Array.isArray(srvC)) return 0;

      let added = 0;
      const srvIds = new Set(srvC.map((c: { id: string }) => c.id));
      setCustomers((prev) => {
        const srvMap = new Map(srvC.map((c: { id: string; totalVisits?: number; lastVisitAt?: string }) => [c.id, c]));
        const existingIds = new Set(prev.map((c) => c.id));
        // Supprimer les clients qui n'existent plus sur le serveur
        const filtered = prev.filter((c) => srvIds.has(c.id));
        // Mettre à jour totalVisits depuis le serveur pour les clients existants
        let changed = filtered.length !== prev.length;
        const updated = filtered.map((c) => {
          const srv = srvMap.get(c.id) as { totalVisits?: number } | undefined;
          if (srv && (srv.totalVisits ?? 0) !== c.totalVisits) {
            changed = true;
            return { ...c, totalVisits: srv.totalVisits ?? c.totalVisits };
          }
          return c;
        });
        const newOnes: Customer[] = srvC
          .filter((c: { id: string }) => !existingIds.has(c.id))
          .map((c: { id: string; name: string; email: string; phone: string; joinDate: string; totalVisits?: number; lastVisitAt?: string }) => ({
            id: c.id, name: c.name, email: c.email ?? "", phone: c.phone ?? "",
            joinDate: c.joinDate, lastVisit: c.lastVisitAt ?? c.joinDate,
            totalVisits: c.totalVisits ?? 0, rewardsUsed: 0, status: "new" as const,
            points: 0, stamps: 0, totalSpent: 0, notes: "", categories: [],
          }));
        added = newOnes.length;
        if (newOnes.length > 0 || changed) return [...updated, ...newOnes];
        return prev;
      });
      setCustomerCards((prev) => {
        const existingById = new Map(prev.map((c) => [c.id, c]));
        const incoming: CustomerCard[] = srvCC ?? [];
        const srvCCIds = new Set(incoming.map((cc: CustomerCard) => cc.id));
        let changed = false;
        // Supprimer les cartes dont le client n'existe plus
        const filtered = prev.filter((c) => srvIds.has(c.customerId));
        changed = filtered.length !== prev.length;
        // Toujours utiliser les valeurs serveur (gère les déductions QR)
        const merged = filtered.map((c) => {
          const srv = incoming.find((s: CustomerCard) => s.id === c.id);
          if (srv && (
            srv.stamps !== c.stamps || srv.points !== c.points ||
            (srv.referralPoints ?? 0) !== (c.referralPoints ?? 0)
          )) {
            changed = true;
            return { ...c, stamps: srv.stamps, points: srv.points, referralCount: srv.referralCount ?? 0, referralPoints: srv.referralPoints ?? 0 };
          }
          return c;
        });
        const newCCs: CustomerCard[] = incoming.filter((cc: CustomerCard) => !existingById.has(cc.id));
        void srvCCIds;
        if (newCCs.length > 0 || changed) return [...merged, ...newCCs];
        return prev;
      });
      // Sync rédemptions serveur
      if (Array.isArray(srvR)) {
        setServerRedemptions(srvR);
      }
      return added;
    } catch {
      return 0;
    }
  }, []);

  // Hydrate: server settings take priority over localStorage
  useEffect(() => {
    // Load localStorage immédiatement (scopé au tenant)
    setSettings(load(KEYS.settings, defaultSettings));
    setProducts(load(KEYS.products, defaultProducts));
    setRewards(load(KEYS.rewards, defaultRewards));
    setCategories(load(KEYS.categories, DEFAULT_CATEGORIES));
    setCustomers(load(KEYS.customers, defaultCustomers));
    setWalletConfig(load(KEYS.wallet, defaultWalletConfig));
    setActivity(load(KEYS.activity, []));
    setLoyaltyCards(load(KEYS.loyalty_cards, []));
    setCustomerCards(load(KEYS.customer_cards, []));

    // Fetch server settings (source of truth — overrides localStorage)
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) setSettings(data.settings);
        if (data.walletConfig) setWalletConfig(data.walletConfig);
        if (data.loyaltyCards) setLoyaltyCards(data.loyaltyCards);
        if (data.products) setProducts(data.products);
        if (data.rewards) setRewards(data.rewards);
      })
      .catch(() => {})
      .finally(() => {
        serverHydrated.current = true;
      });

    syncFromServer();
  }, [syncFromServer]);

  // Persist to localStorage (scopé au tenant)
  useEffect(() => { save(KEYS.settings, settings); }, [KEYS.settings, settings]);
  useEffect(() => { save(KEYS.products, products); }, [KEYS.products, products]);
  useEffect(() => { save(KEYS.rewards, rewards); }, [KEYS.rewards, rewards]);
  useEffect(() => { save(KEYS.categories, categories); }, [KEYS.categories, categories]);
  useEffect(() => { save(KEYS.customers, customers); }, [KEYS.customers, customers]);
  useEffect(() => { save(KEYS.wallet, walletConfig); }, [KEYS.wallet, walletConfig]);
  useEffect(() => { save(KEYS.activity, activity); }, [KEYS.activity, activity]);
  useEffect(() => { save(KEYS.loyalty_cards, loyaltyCards); }, [KEYS.loyalty_cards, loyaltyCards]);
  useEffect(() => { save(KEYS.customer_cards, customerCards); }, [KEYS.customer_cards, customerCards]);

  // Persist merchant config to server (debounced 1s, only after hydration)
  useEffect(() => {
    if (!serverHydrated.current) return;
    const t = setTimeout(() => {
      fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings, walletConfig, loyaltyCards, products, rewards }),
      }).catch(() => {});
    }, 1000);
    return () => clearTimeout(t);
  }, [settings, walletConfig, loyaltyCards, products, rewards]);

  const updateSettings = useCallback((patch: Partial<StoreSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const addActivity = useCallback((item: Omit<ActivityItem, "id" | "time">) => {
    const full: ActivityItem = { ...item, id: `a${Date.now()}`, time: new Date().toISOString() };
    setActivity((prev) => [full, ...prev].slice(0, 200));
  }, []);

  // ── Loyalty card CRUD ───────────────────────────────────────────────────────

  const addLoyaltyCard = useCallback((data: Omit<LoyaltyCard, "id" | "createdAt">): LoyaltyCard => {
    const card: LoyaltyCard = {
      ...data,
      id: `lc${Date.now()}${Math.random().toString(36).slice(2, 5)}`,
      createdAt: new Date().toISOString(),
    };
    setLoyaltyCards((prev) => [...prev, card]);
    return card;
  }, []);

  const updateLoyaltyCard = useCallback((id: string, patch: Partial<LoyaltyCard>) => {
    setLoyaltyCards((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c));
  }, []);

  const deleteLoyaltyCard = useCallback((id: string) => {
    setLoyaltyCards((prev) => prev.filter((c) => c.id !== id));
    setCustomerCards((prev) => prev.filter((cc) => cc.cardId !== id));
  }, []);

  // ── Customer-card assignment ────────────────────────────────────────────────

  const assignCard = useCallback((customerId: string, cardId: string): CustomerCard => {
    const now = new Date().toISOString();
    const cc: CustomerCard = {
      id: `cc${Date.now()}${Math.random().toString(36).slice(2, 5)}`,
      customerId,
      cardId,
      stamps: 0,
      points: 0,
      joinDate: now,
      lastActivity: now,
    };
    const card = loyaltyCards.find((c) => c.id === cardId);
    if (card && card.welcomePoints > 0) cc.points = card.welcomePoints;
    setCustomerCards((prev) => [...prev, cc]);
    return cc;
  }, [loyaltyCards]);

  const unassignCard = useCallback((customerCardId: string) => {
    setCustomerCards((prev) => prev.filter((cc) => cc.id !== customerCardId));
  }, []);

  const addStampToCard = useCallback((customerCardId: string) => {
    const cc = customerCards.find((c) => c.id === customerCardId);
    if (!cc) return;
    const card = loyaltyCards.find((c) => c.id === cc.cardId);
    const maxStamps = card?.stampsRequired ?? 8;
    const customer = customers.find((c) => c.id === cc.customerId);
    const newStamps = Math.min(cc.stamps + 1, maxStamps);
    const now = new Date().toISOString();
    setCustomerCards((prev) => prev.map((c) =>
      c.id !== customerCardId ? c : { ...c, stamps: newStamps, lastActivity: now }
    ));
    const newVisits = (customer?.totalVisits ?? 0) + 1;
    setCustomers((prev) => prev.map((c) =>
      c.id !== cc.customerId ? c : { ...c, totalVisits: newVisits, lastVisit: now, status: computeStatus(newVisits) }
    ));
    if (customer) addActivity({ type: "visit", customerId: cc.customerId, customerName: customer.name, description: `+1 tampon — ${card?.name ?? "carte"}`, value: 1 });
    // Persist to server so stamp survives localStorage clear / multi-device
    fetch("/api/register", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stamp", customerCardId }),
    }).catch(() => {});
  }, [customerCards, loyaltyCards, customers, addActivity]);

  const addPointsToCard = useCallback((customerCardId: string, amount: number) => {
    const cc = customerCards.find((c) => c.id === customerCardId);
    if (!cc) return;
    const card = loyaltyCards.find((c) => c.id === cc.cardId);
    const customer = customers.find((c) => c.id === cc.customerId);
    const now = new Date().toISOString();
    setCustomerCards((prev) => prev.map((c) =>
      c.id !== customerCardId ? c : { ...c, points: c.points + amount, lastActivity: now }
    ));
    const newVisits = (customer?.totalVisits ?? 0) + 1;
    setCustomers((prev) => prev.map((c) =>
      c.id !== cc.customerId ? c : { ...c, totalVisits: newVisits, lastVisit: now, status: computeStatus(newVisits) }
    ));
    if (customer) addActivity({ type: "points_added", customerId: cc.customerId, customerName: customer.name, description: `+${amount} pts — ${card?.name ?? "carte"}`, value: amount });
    fetch("/api/register", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "points", customerCardId, points: amount }),
    }).catch(() => {});
  }, [customerCards, loyaltyCards, customers, addActivity]);

  const useRewardOnCard = useCallback((customerCardId: string, reward: Reward) => {
    const cc = customerCards.find((c) => c.id === customerCardId);
    if (!cc) return;
    const customer = customers.find((c) => c.id === cc.customerId);
    const now = new Date().toISOString();
    setCustomerCards((prev) => prev.map((c) =>
      c.id !== customerCardId ? c : {
        ...c,
        stamps: reward.mode === "stamps" ? Math.max(0, c.stamps - reward.cost) : c.stamps,
        points: reward.mode === "points" ? Math.max(0, c.points - reward.cost) : c.points,
        lastActivity: now,
      }
    ));
    if (customer) {
      setCustomers((prev) => prev.map((c) =>
        c.id !== cc.customerId ? c : { ...c, rewardsUsed: c.rewardsUsed + 1 }
      ));
      addActivity({ type: "reward", customerId: cc.customerId, customerName: customer.name, description: `${reward.name} utilisé` });
    }
    // Persister côté serveur + notifier Apple Wallet
    fetch("/api/register", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reward",
        customerCardId,
        customerId: cc.customerId,
        rewardName: reward.name,
        rewardEmoji: reward.emoji ?? "",
        cost: reward.cost,
        costType: reward.mode,
      }),
    }).catch(() => {});
  }, [customerCards, customers, addActivity]);

  // ── Legacy actions (global, use StoreSettings) ──────────────────────────────

  const addCustomer = useCallback((data: { name: string; email: string; phone: string }): Customer => {
    const now = new Date().toISOString();
    const customer: Customer = {
      id: `c${Date.now()}${Math.random().toString(36).slice(2, 5)}`,
      name: data.name.trim(),
      email: data.email.trim(),
      phone: data.phone.trim(),
      status: "new",
      points: 0,
      stamps: 0,
      totalVisits: 0,
      lastVisit: now,
      joinDate: now,
      totalSpent: 0,
      rewardsUsed: 0,
    };
    setCustomers((prev) => [customer, ...prev]);
    addActivity({ type: "new_client", customerId: customer.id, customerName: customer.name, description: "Nouvel inscrit" });
    return customer;
  }, [addActivity]);

  const updateCustomer = useCallback((id: string, patch: { name: string; email: string; phone: string }) => {
    setCustomers((prev) => prev.map((c) =>
      c.id !== id ? c : { ...c, name: patch.name.trim(), email: patch.email.trim(), phone: patch.phone.trim() }
    ));
  }, []);

  const deleteCustomer = useCallback((id: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    setCustomerCards((prev) => prev.filter((cc) => cc.customerId !== id));
    // Also remove from server DB so sync doesn't re-add them
    fetch("/api/register", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: id }),
    }).catch(() => {});
  }, []);

  const addStamp = useCallback((customerId: string) => {
    const target = customers.find((c) => c.id === customerId);
    if (!target) return;
    const newStamps = Math.min(target.stamps + 1, settings.stampsRequired);
    const newVisits = target.totalVisits + 1;
    setCustomers((prev) => prev.map((c) =>
      c.id !== customerId ? c : { ...c, stamps: newStamps, totalVisits: newVisits, lastVisit: new Date().toISOString(), status: computeStatus(newVisits) }
    ));
    addActivity({ type: "visit", customerId, customerName: target.name, description: "Visite + 1 tampon", value: 1 });
  }, [customers, settings.stampsRequired, addActivity]);

  const addPoints = useCallback((customerId: string, amount: number) => {
    const target = customers.find((c) => c.id === customerId);
    if (!target) return;
    const newVisits = target.totalVisits + 1;
    setCustomers((prev) => prev.map((c) =>
      c.id !== customerId ? c : { ...c, points: c.points + amount, totalVisits: newVisits, lastVisit: new Date().toISOString(), status: computeStatus(newVisits) }
    ));
    addActivity({ type: "points_added", customerId, customerName: target.name, description: `+${amount} points ajoutés`, value: amount });
  }, [customers, addActivity]);

  const useReward = useCallback((customerId: string, reward: Reward) => {
    const target = customers.find((c) => c.id === customerId);
    if (!target) return;
    setCustomers((prev) => prev.map((c) =>
      c.id !== customerId ? c : {
        ...c,
        stamps: reward.mode === "stamps" ? Math.max(0, c.stamps - reward.cost) : c.stamps,
        points: reward.mode === "points" ? Math.max(0, c.points - reward.cost) : c.points,
        rewardsUsed: c.rewardsUsed + 1,
      }
    ));
    addActivity({ type: "reward", customerId, customerName: target.name, description: `${reward.name} utilisé` });
  }, [customers, addActivity]);

  return (
    <StoreContext.Provider value={{
      settings, updateSettings,
      products, setProducts,
      rewards, setRewards,
      categories, setCategories,
      customers, setCustomers,
      walletConfig, setWalletConfig,
      activity, addActivity,
      loyaltyCards, addLoyaltyCard, updateLoyaltyCard, deleteLoyaltyCard,
      customerCards, assignCard, unassignCard,
      addStampToCard, addPointsToCard, useRewardOnCard,
      syncFromServer,
      serverRedemptions,
      addCustomer, updateCustomer, deleteCustomer,
      addStamp, addPoints, useReward,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
