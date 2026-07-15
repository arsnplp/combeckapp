"use client";

import { useState, useEffect } from "react";
import { Search, ChevronRight, ChevronLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatDateShort } from "@/lib/utils";
import { RANK_COLORS, RANK_EMOJIS } from "@/lib/rank";
import type { Customer, RankType } from "@/types";

export type EnrichedCustomer = Customer & {
  rank: RankType;
  referrals?: number;        // nombre total d'amis parrainés (crédités)
  referralPointsLeft?: number; // points de parrainage encore disponibles
  referralsPending?: number; // filleuls inscrits mais pas encore venus
};

interface CustomerTableProps {
  customers: EnrichedCustomer[];
  onSelect: (customer: EnrichedCustomer) => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

type FilterType = "all" | RankType;

const FILTERS: { label: string; value: FilterType }[] = [
  { label: "Tous", value: "all" },
  { label: "🥈 Silver", value: "silver" },
  { label: "🥇 Gold", value: "gold" },
  { label: "💎 Platine", value: "platine" },
];

const PAGE_SIZE = 50;

export default function CustomerTable({ customers, onSelect, selectedIds, onSelectionChange }: CustomerTableProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [page, setPage] = useState(1);

  const filtered = customers.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || c.rank === filter;
    return matchSearch && matchFilter;
  });

  // Reset page when search or filter changes
  useEffect(() => {
    setPage(1);
  }, [search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedCustomers = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allSelected = pagedCustomers.length > 0 && pagedCustomers.every((c) => selectedIds.has(c.id));
  const someSelected = pagedCustomers.some((c) => selectedIds.has(c.id));

  const toggleAll = () => {
    const next = new Set(selectedIds);
    if (allSelected) pagedCustomers.forEach((c) => next.delete(c.id));
    else pagedCustomers.forEach((c) => next.add(c.id));
    onSelectionChange(next);
  };

  const toggleOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectionChange(next);
  };

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher un client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                filter === f.value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste mobile : cartes compactes (le tableau 8 colonnes est illisible sur téléphone) */}
      <div className="space-y-2 sm:hidden">
        {pagedCustomers.map((customer) => {
          const initials = customer.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
          const isSelected = selectedIds.has(customer.id);
          const rankEmoji = RANK_EMOJIS[customer.rank];
          return (
            <div
              key={customer.id}
              onClick={() => onSelect(customer)}
              className={`cursor-pointer rounded-2xl border p-3.5 transition-colors ${
                isSelected ? "border-green-300 bg-green-50" : "border-slate-100 bg-white active:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 flex-shrink-0 accent-green-600"
                  checked={isSelected}
                  onClick={(e) => toggleOne(customer.id, e)}
                  readOnly
                />
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-green-600 text-[12px] font-bold text-white">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[14px] font-semibold leading-tight text-slate-800">{customer.name}</p>
                    {customer.rank !== "none" && <span className="flex-shrink-0 text-[13px]">{rankEmoji}</span>}
                  </div>
                  <p className="truncate text-[12px] text-slate-400">{customer.email || customer.phone || "—"}</p>
                </div>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" />
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-[52px] text-[11.5px] text-slate-500">
                <span>{customer.totalVisits} visite{customer.totalVisits > 1 ? "s" : ""}</span>
                <span>
                  <span className="font-semibold text-green-600">{customer.points}</span> pts · {customer.stamps} tampon{customer.stamps > 1 ? "s" : ""}
                </span>
                {(customer.referrals ?? 0) > 0 && <span>🤝 {customer.referrals}</span>}
                {(customer.referralsPending ?? 0) > 0 && (
                  <span className="rounded-full border border-amber-100 bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-600">
                    {customer.referralsPending} en attente
                  </span>
                )}
                <span className="text-slate-400">{formatDateShort(customer.lastVisit)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table (écrans >= sm) */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="w-10 py-2 pl-2 pr-3 text-left">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 cursor-pointer accent-green-600"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                  onChange={toggleAll}
                />
              </th>
              <th className="py-2 pr-4 text-left text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">Client</th>
              <th className="py-2 pr-4 text-left text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">Rang</th>
              <th className="py-2 pr-4 text-left text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">Visites</th>
              <th className="py-2 pr-4 text-left text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">Pts / Tampons</th>
              <th className="py-2 pr-4 text-left text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">Parrainages</th>
              <th className="py-2 pr-4 text-left text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">Dernière visite</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {pagedCustomers.map((customer) => {
              const initials = customer.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
              const isSelected = selectedIds.has(customer.id);
              const rankColors = RANK_COLORS[customer.rank];
              const rankEmoji = RANK_EMOJIS[customer.rank];
              return (
                <tr
                  key={customer.id}
                  onClick={() => onSelect(customer)}
                  className={`cursor-pointer transition-colors group ${isSelected ? "bg-green-50" : "hover:bg-slate-50"}`}
                >
                  <td className="py-3 pl-2 pr-3" onClick={(e) => toggleOne(customer.id, e)}>
                    <input type="checkbox" className="h-3.5 w-3.5 cursor-pointer accent-green-600" checked={isSelected} readOnly />
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-green-600 text-[11px] font-bold text-white">{initials}</div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-slate-800 leading-tight">{customer.name}</p>
                        <p className="text-[11.5px] text-slate-400 truncate max-w-[160px]">{customer.email || customer.phone || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    {customer.rank !== "none" ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold border"
                        style={{ background: rankColors.bg, color: rankColors.text, borderColor: rankColors.border }}>
                        {rankEmoji} {customer.rank.charAt(0).toUpperCase() + customer.rank.slice(1)}
                      </span>
                    ) : <span className="text-[12px] text-slate-300">—</span>}
                  </td>
                  <td className="py-3 pr-4 text-[13px] text-slate-600">{customer.totalVisits}</td>
                  <td className="py-3 pr-4">
                    <span className="text-[13px] font-medium text-green-600">{customer.points}</span>
                    <span className="text-[12px] text-slate-300 mx-1">/</span>
                    <span className="text-[13px] text-slate-500">{customer.stamps}</span>
                  </td>
                  <td className="py-3 pr-4">
                    {(customer.referrals ?? 0) > 0 || (customer.referralsPending ?? 0) > 0 ? (
                      <span className="inline-flex flex-wrap items-center gap-1 text-[13px] text-slate-600">
                        {(customer.referrals ?? 0) > 0 && <>🤝 {customer.referrals}</>}
                        {(customer.referralPointsLeft ?? 0) > 0 && (
                          <span className="text-[11.5px] text-slate-400">· {customer.referralPointsLeft} pt{(customer.referralPointsLeft ?? 0) > 1 ? "s" : ""} dispo</span>
                        )}
                        {(customer.referralsPending ?? 0) > 0 && (
                          <span
                            className="rounded-full bg-amber-50 border border-amber-100 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-600"
                            title="Filleul inscrit — le point sera crédité à sa première visite"
                          >
                            {customer.referralsPending} en attente
                          </span>
                        )}
                      </span>
                    ) : <span className="text-[12px] text-slate-300">—</span>}
                  </td>
                  <td className="py-3 pr-4 text-[13px] text-slate-500">{formatDateShort(customer.lastVisit)}</td>
                  <td className="py-3">
                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="py-10 text-center text-[13px] text-slate-400">Aucun client trouvé</div>
      )}

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Précédent
          </button>
          <span className="text-[12.5px] text-slate-500">
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Suivant
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
