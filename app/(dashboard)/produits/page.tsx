"use client";

import { useState, useRef } from "react";
import { Plus, Package, Gift, FolderEdit, Trash2, Check, X, ImagePlus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProductCard from "@/components/produits/ProductCard";
import RewardCard from "@/components/produits/RewardCard";
import { useStore } from "@/lib/store-context";
import type { Product, Reward } from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_POINTS_COST = 10000;
const MAX_PRICE = 9999;
const MAX_POINTS_VALUE = 50000;

function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = String(item[key]);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

function readImageFile(file: File, cb: (url: string) => void) {
  const reader = new FileReader();
  reader.onload = (e) => cb(e.target?.result as string);
  reader.readAsDataURL(file);
}

// ── Product form types ────────────────────────────────────────────────────────

interface ProductFormState {
  name: string;
  price: string;
  category: string;
  imageUrl: string;
  pointsValue: string;
}

const emptyProductForm = (cat = ""): ProductFormState => ({
  name: "", price: "", category: cat, imageUrl: "", pointsValue: "",
});

// ── ProductForm — defined OUTSIDE page component to prevent focus loss ────────

const inputCls =
  "h-[44px] w-full rounded-xl border border-slate-300 bg-white px-4 text-[14px] text-slate-900 shadow-sm placeholder:text-slate-400 outline-none transition focus:border-green-500 focus:ring-[3px] focus:ring-green-500/10";

function ProductForm({
  form,
  onChange,
  categories,
  imageRef,
}: {
  form: ProductFormState;
  onChange: (patch: Partial<ProductFormState>) => void;
  categories: string[];
  imageRef: React.RefObject<HTMLInputElement | null>;
}) {
  const autoPoints = form.price && !isNaN(parseFloat(form.price))
    ? Math.round(parseFloat(form.price) * 10)
    : null;

  return (
    <div className="space-y-6">
      {/* Nom */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-slate-400">
            Nom du produit
          </label>
          {/* Photo button — next to label, minimal */}
          <button
            type="button"
            onClick={() => imageRef.current?.click()}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
          >
            {form.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.imageUrl} alt="" className="h-3.5 w-3.5 rounded object-cover" />
            ) : (
              <ImagePlus className="h-3 w-3" />
            )}
            {form.imageUrl ? "Changer" : "Photo"}
          </button>
        </div>
        <input
          className={inputCls}
          placeholder="ex: Café Noisette"
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          autoFocus
        />
        <input
          ref={imageRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) readImageFile(file, (url) => onChange({ imageUrl: url }));
          }}
        />
      </div>

      {/* Prix + Catégorie */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-slate-400">
            Prix (€)
          </label>
          <input
            className={inputCls}
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={form.price}
            onChange={(e) => onChange({ price: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-slate-400">
            Catégorie
          </label>
          {categories.length > 0 ? (
            <Select value={form.category} onValueChange={(v) => onChange({ category: v })}>
              <SelectTrigger className="h-[44px] rounded-xl border-slate-300 px-4 text-[14px] shadow-sm focus:ring-green-500/10">
                <SelectValue placeholder="Choisir…" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex h-[44px] items-center rounded-xl border border-dashed border-slate-200 px-4 text-[13px] text-slate-400">
              Aucune catégorie
            </div>
          )}
        </div>
      </div>

      {/* Points */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-slate-400">
          Points
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-slate-500">
            optionnel
          </span>
        </label>
        <input
          className={inputCls}
          type="text"
          inputMode="numeric"
          placeholder={autoPoints !== null ? `Auto : ${autoPoints} pts` : "ex: 90"}
          value={form.pointsValue}
          onChange={(e) => onChange({ pointsValue: e.target.value.replace(/\D/g, "") })}
        />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProduitsPage() {
  const { settings, products, setProducts, rewards, setRewards, categories, setCategories } = useStore();

  const [activeTab, setActiveTab] = useState<"produits" | "recompenses">("produits");

  // Product dialogs
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm());
  const patchForm = (patch: Partial<ProductFormState>) =>
    setProductForm((prev) => ({ ...prev, ...patch }));

  // Category management
  const [showCategories, setShowCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryIdx, setEditingCategoryIdx] = useState<number | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState("");

  // Reward dialog
  const [showAddReward, setShowAddReward] = useState(false);
  const [newRewardName, setNewRewardName] = useState("");
  const [newRewardCost, setNewRewardCost] = useState("");
  const [newRewardMode, setNewRewardMode] = useState<"stamps" | "points">("stamps");
  const [newRewardIsReferral, setNewRewardIsReferral] = useState(false);
  const [newRewardEmoji, setNewRewardEmoji] = useState("🎁");
  const [newRewardProductId, setNewRewardProductId] = useState<string | null>(null);

  // Edit reward dialog
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [editRewardName, setEditRewardName] = useState("");
  const [editRewardCost, setEditRewardCost] = useState("");
  const [editRewardEmoji, setEditRewardEmoji] = useState("🎁");
  const [editRewardMode, setEditRewardMode] = useState<"stamps" | "points">("stamps");
  const [editRewardIsReferral, setEditRewardIsReferral] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const editImageInputRef = useRef<HTMLInputElement>(null);

  const grouped = groupBy(products, "category");

  // ── Product handlers ──────────────────────────────────────────────────────

  const openAdd = () => {
    setProductForm(emptyProductForm(categories[0] ?? ""));
    setShowAddProduct(true);
  };

  const openEdit = (product: Product) => {
    setProductForm({
      name: product.name,
      price: String(product.price),
      category: product.category,
      imageUrl: product.imageUrl ?? "",
      pointsValue: product.pointsValue ? String(product.pointsValue) : "",
    });
    setEditingProduct(product);
  };

  const handleAddProduct = () => {
    const price = parseFloat(productForm.price);
    if (!productForm.name || isNaN(price)) return;
    const p: Product = {
      id: `p${Date.now()}`,
      name: productForm.name,
      category: productForm.category,
      price: Math.min(price, MAX_PRICE),
      imageUrl: productForm.imageUrl || undefined,
      active: true,
      pointsValue: productForm.pointsValue
        ? Math.min(parseInt(productForm.pointsValue), MAX_POINTS_VALUE)
        : Math.round(price * 10),
    };
    setProducts((prev) => [...prev, p]);
    setShowAddProduct(false);
    setProductForm(emptyProductForm(categories[0] ?? ""));
  };

  const handleSaveEdit = () => {
    const price = parseFloat(productForm.price);
    if (!editingProduct || !productForm.name || isNaN(price)) return;
    setProducts((prev) =>
      prev.map((p) =>
        p.id !== editingProduct.id ? p : {
          ...p,
          name: productForm.name,
          category: productForm.category,
          price: Math.min(price, MAX_PRICE),
          imageUrl: productForm.imageUrl || undefined,
          pointsValue: productForm.pointsValue
            ? Math.min(parseInt(productForm.pointsValue), MAX_POINTS_VALUE)
            : p.pointsValue,
        }
      )
    );
    setEditingProduct(null);
  };

  const handleDeleteProduct = (id: string) => setProducts((prev) => prev.filter((p) => p.id !== id));
  const handleToggleProduct = (id: string) => setProducts((prev) => prev.map((p) => p.id === id ? { ...p, active: !p.active } : p));

  // ── Category handlers ─────────────────────────────────────────────────────

  const handleAddCategory = () => {
    const name = newCategoryName.trim();
    if (!name || categories.includes(name)) return;
    setCategories((prev) => [...prev, name]);
    setNewCategoryName("");
  };

  const handleRenameCategory = (idx: number) => {
    const newName = editingCategoryValue.trim();
    if (!newName || newName === categories[idx]) { setEditingCategoryIdx(null); return; }
    const old = categories[idx];
    setCategories((prev) => prev.map((c, i) => i === idx ? newName : c));
    setProducts((prev) => prev.map((p) => p.category === old ? { ...p, category: newName } : p));
    setEditingCategoryIdx(null);
  };

  const handleDeleteCategory = (idx: number) => {
    if (products.some((p) => p.category === categories[idx])) return;
    setCategories((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Reward handlers ───────────────────────────────────────────────────────

  const handleDeleteReward = (id: string) => setRewards((prev) => prev.filter((r) => r.id !== id));

  const openEditReward = (reward: Reward) => {
    setEditingReward(reward);
    setEditRewardName(reward.name);
    setEditRewardCost(String(reward.cost));
    setEditRewardEmoji(reward.emoji ?? "🎁");
    setEditRewardMode(reward.mode as "stamps" | "points");
    setEditRewardIsReferral(reward.referral === true);
  };

  const handleSaveEditReward = () => {
    if (!editingReward || !editRewardName.trim() || !editRewardCost) return;
    const cost = parseInt(editRewardCost);
    if (isNaN(cost) || cost < 1) return;
    setRewards((prev) => prev.map((r) => r.id !== editingReward.id ? r : {
      ...r,
      name: editRewardName.trim(),
      description: `Récompense : ${editRewardName.trim()}`,
      cost: editRewardIsReferral ? cost : Math.min(cost, editRewardMode === "stamps" ? settings.stampsRequired : MAX_POINTS_COST),
      mode: editRewardIsReferral ? "stamps" : editRewardMode,
      emoji: editRewardEmoji,
      referral: editRewardIsReferral || undefined,
    }));
    setEditingReward(null);
  };

  const handleAddReward = () => {
    if (!newRewardName || !newRewardCost) return;
    const cost = parseInt(newRewardCost);
    if (isNaN(cost) || cost < 1) return;
    const r: Reward = {
      id: `r${Date.now()}`,
      name: newRewardName,
      description: `Récompense : ${newRewardName}`,
      cost: newRewardIsReferral ? cost : Math.min(cost, newRewardMode === "stamps" ? settings.stampsRequired : MAX_POINTS_COST),
      mode: newRewardIsReferral ? "stamps" : newRewardMode,
      emoji: newRewardEmoji,
      productId: newRewardProductId ?? undefined,
      usageCount: 0,
      active: true,
      referral: newRewardIsReferral || undefined,
    };
    setRewards((prev) => [...prev, r]);
    setShowAddReward(false);
    setNewRewardName("");
    setNewRewardCost("");
    setNewRewardEmoji("🎁");
    setNewRewardProductId(null);
    setNewRewardIsReferral(false);
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl space-y-5">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "produits" | "recompenses")}>
        <div className="flex items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="produits" className="gap-2">
              <Package className="h-3.5 w-3.5" />
              Produits ({products.length})
            </TabsTrigger>
            <TabsTrigger value="recompenses" className="gap-2">
              <Gift className="h-3.5 w-3.5" />
              Récompenses ({rewards.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            {activeTab === "produits" && (
              <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => setShowCategories(true)}>
                <FolderEdit className="h-3.5 w-3.5" />
                Catégories
              </Button>
            )}
            <Button
              className="gap-2"
              onClick={() => activeTab === "produits" ? openAdd() : setShowAddReward(true)}
            >
              <Plus className="h-4 w-4" />
              {activeTab === "produits" ? "Ajouter un produit" : "Ajouter une récompense"}
            </Button>
          </div>
        </div>

        <TabsContent value="produits" className="mt-5">
          {products.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                <Package className="h-6 w-6 text-slate-300" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-slate-700">Aucun produit</p>
                <p className="mt-1 text-[12.5px] text-slate-400">Créez d'abord une catégorie, puis ajoutez vos produits.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowCategories(true)}>Créer une catégorie</Button>
                <Button size="sm" onClick={openAdd} disabled={categories.length === 0}>Ajouter un produit</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">{category}</p>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                    {items.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onEdit={openEdit}
                        onDelete={handleDeleteProduct}
                        onToggle={handleToggleProduct}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recompenses" className="mt-5">
          <div className="space-y-6">
            {(["stamps", "points"] as const).map((mode) => {
              const list = rewards.filter((r) => r.mode === mode && !r.referral);
              return (
                <div key={mode}>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                    {mode === "stamps" ? "Récompenses tampons" : "Récompenses points"}
                  </p>
                  {list.length > 0 ? (
                    <div className="space-y-2">
                      {list.map((reward) => (
                        <RewardCard key={reward.id} reward={reward} onEdit={openEditReward} onDelete={handleDeleteReward} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12.5px] text-slate-400">Aucune récompense {mode === "stamps" ? "tampons" : "points"}</p>
                  )}
                </div>
              );
            })}
            {(() => {
              const list = rewards.filter((r) => r.referral);
              return (
                <div>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                    Récompenses parrainage
                  </p>
                  {list.length > 0 ? (
                    <div className="space-y-2">
                      {list.map((reward) => (
                        <RewardCard key={reward.id} reward={reward} onEdit={openEditReward} onDelete={handleDeleteReward} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12.5px] text-slate-400">Aucune récompense parrainage</p>
                  )}
                </div>
              );
            })()}
            {rewards.length === 0 && (
              <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-slate-200 bg-white py-14 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                  <Gift className="h-6 w-6 text-slate-300" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-slate-700">Aucune récompense</p>
                  <p className="mt-1 text-[12.5px] text-slate-400">Définissez ce que vos clients peuvent échanger.</p>
                </div>
                <Button size="sm" onClick={() => setShowAddReward(true)}>Ajouter une récompense</Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Add Product Dialog ─────────────────────────────────────────────── */}
      <Dialog open={showAddProduct} onOpenChange={setShowAddProduct}>
        <DialogContent className="sm:max-w-[500px]">
          <div className="px-7 pt-7 pb-5 pr-14">
            <DialogTitle className="text-[16px] font-semibold text-slate-900">Ajouter un produit</DialogTitle>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="px-7 py-6">
            <ProductForm form={productForm} onChange={patchForm} categories={categories} imageRef={imageInputRef} />
          </div>
          <div className="h-px bg-slate-100" />
          <div className="flex justify-end gap-2 px-7 py-5">
            <Button variant="secondary" onClick={() => setShowAddProduct(false)}>Annuler</Button>
            <Button onClick={handleAddProduct} disabled={!productForm.name.trim() || !productForm.price || isNaN(parseFloat(productForm.price))}>
              Ajouter le produit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Product Dialog ────────────────────────────────────────────── */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => { if (!open) setEditingProduct(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <div className="px-7 pt-7 pb-5 pr-14">
            <DialogTitle className="text-[16px] font-semibold text-slate-900">Modifier le produit</DialogTitle>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="px-7 py-6">
            <ProductForm form={productForm} onChange={patchForm} categories={categories} imageRef={editImageInputRef} />
          </div>
          <div className="h-px bg-slate-100" />
          <div className="flex justify-end gap-2 px-7 py-5">
            <Button variant="secondary" onClick={() => setEditingProduct(null)}>Annuler</Button>
            <Button onClick={handleSaveEdit} disabled={!productForm.name.trim() || !productForm.price || isNaN(parseFloat(productForm.price))}>
              Sauvegarder
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Categories Dialog ──────────────────────────────────────────────── */}
      <Dialog open={showCategories} onOpenChange={setShowCategories}>
        <DialogContent className="sm:max-w-[400px]">
          <div className="px-6 pt-6 pb-4 pr-12">
            <DialogTitle className="text-[15px] font-semibold text-slate-900">Catégories</DialogTitle>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="px-6 py-5 space-y-3">
            {categories.length === 0 && (
              <p className="py-2 text-center text-[12.5px] text-slate-400">Aucune catégorie encore</p>
            )}
            <div className="space-y-1.5">
              {categories.map((cat, idx) => {
                const inUse = products.some((p) => p.category === cat);
                const count = products.filter((p) => p.category === cat).length;
                return (
                  <div
                    key={cat}
                    className="flex items-center gap-2 rounded-lg border border-black/[0.06] bg-slate-50 px-3 py-2.5"
                  >
                    {editingCategoryIdx === idx ? (
                      <>
                        <Input
                          value={editingCategoryValue}
                          onChange={(e) => setEditingCategoryValue(e.target.value)}
                          className="h-7 flex-1 text-[13px]"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameCategory(idx);
                            if (e.key === "Escape") setEditingCategoryIdx(null);
                          }}
                        />
                        <button
                          onClick={() => handleRenameCategory(idx)}
                          className="cursor-pointer rounded p-0.5 text-emerald-600 hover:bg-emerald-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingCategoryIdx(null)}
                          className="cursor-pointer rounded p-0.5 text-slate-400 hover:bg-slate-200"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-[13px] font-medium text-slate-700">{cat}</span>
                        {inUse && (
                          <span className="text-[11px] text-slate-400">{count} produit{count > 1 ? "s" : ""}</span>
                        )}
                        <button
                          onClick={() => { setEditingCategoryIdx(idx); setEditingCategoryValue(cat); }}
                          className="cursor-pointer rounded p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
                          title="Renommer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(idx)}
                          disabled={inUse}
                          className={`rounded p-1 transition-colors ${inUse ? "cursor-not-allowed text-slate-300" : "cursor-pointer text-slate-400 hover:bg-red-50 hover:text-red-500"}`}
                          title={inUse ? "Utilisée par des produits" : "Supprimer"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 pt-1">
              <Input
                placeholder="Nouvelle catégorie…"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                className="flex-1"
              />
              <Button
                size="icon"
                onClick={handleAddCategory}
                disabled={!newCategoryName.trim() || categories.includes(newCategoryName.trim())}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="flex justify-end px-6 py-4">
            <Button variant="secondary" onClick={() => setShowCategories(false)}>Fermer</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Reward Dialog ──────────────────────────────────────────────── */}
      <Dialog open={showAddReward} onOpenChange={(open) => {
        setShowAddReward(open);
        if (!open) { setNewRewardName(""); setNewRewardCost(""); setNewRewardEmoji("🎁"); setNewRewardProductId(null); setNewRewardIsReferral(false); }
      }}>
        <DialogContent className="sm:max-w-[460px]">
          <div className="px-7 pt-7 pb-5 pr-14">
            <DialogTitle className="text-[16px] font-semibold text-slate-900">Ajouter une récompense</DialogTitle>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="px-7 py-6 space-y-5">

            {/* ── Depuis un produit existant ── */}
            {products.length > 0 && (
              <div className="space-y-2">
                <Label className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-slate-400">Depuis un produit</Label>
                <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto pr-1">
                  {products.filter((p) => p.active).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setNewRewardProductId(p.id);
                        setNewRewardName(p.name);
                        setNewRewardEmoji(p.emoji ?? "🎁");
                      }}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                        newRewardProductId === p.id
                          ? "border-green-300 bg-green-50 text-green-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {p.emoji && <span>{p.emoji}</span>}
                      <span>{p.name}</span>
                      <span className="text-[11px] text-slate-400">{p.price.toFixed(2)} €</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-[11px] text-slate-400 font-medium">ou saisie libre</span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>
              </div>
            )}

            {/* ── Nom libre ── */}
            <div className="space-y-2">
              <Label htmlFor="reward-name">Nom de la récompense *</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-lg hover:bg-slate-50 transition-colors"
                  onClick={() => {
                    const emojis = ["🎁","☕","🥐","🍕","🍔","🧁","🍦","🥤","🎀","💐","🛍️","✨"];
                    const idx = emojis.indexOf(newRewardEmoji);
                    setNewRewardEmoji(emojis[(idx + 1) % emojis.length]);
                  }}
                  title="Changer l'emoji"
                >
                  {newRewardEmoji}
                </button>
                <Input
                  id="reward-name"
                  placeholder="ex: Café offert"
                  value={newRewardName}
                  onChange={(e) => { setNewRewardName(e.target.value); setNewRewardProductId(null); }}
                  autoFocus
                  className="flex-1"
                />
              </div>
            </div>

            {/* ── Type de programme ── */}
            <div className="space-y-2">
              <Label>Type de programme</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["stamps", "points"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setNewRewardMode(m); setNewRewardIsReferral(false); }}
                    className={`rounded-lg border py-2.5 text-[13px] font-medium transition-colors ${
                      !newRewardIsReferral && newRewardMode === m
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
                    }`}
                  >
                    {m === "stamps" ? "🎫 Tampons" : "⭐ Points"}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setNewRewardIsReferral(true)}
                  className={`rounded-lg border py-2.5 text-[13px] font-medium transition-colors ${
                    newRewardIsReferral
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  🤝 Parrainage
                </button>
              </div>
            </div>

            {/* ── Coût ── */}
            <div className="space-y-2">
              <Label htmlFor="reward-cost">
                Coût en {newRewardIsReferral ? "points de parrainage" : newRewardMode === "stamps" ? "tampons" : "points"} *
              </Label>
              <Input
                id="reward-cost"
                type="text"
                inputMode="numeric"
                placeholder={newRewardIsReferral ? "ex: 3" : newRewardMode === "stamps" ? `1 – ${settings.stampsRequired}` : `1 – ${MAX_POINTS_COST}`}
                value={newRewardCost}
                onChange={(e) => setNewRewardCost(e.target.value.replace(/\D/g, ""))}
              />
              {!newRewardIsReferral && newRewardMode === "stamps" && newRewardCost && parseInt(newRewardCost) > settings.stampsRequired && (
                <p className="text-[11.5px] text-amber-600">
                  Le maximum est {settings.stampsRequired} tampons (configuré dans Programme)
                </p>
              )}
            </div>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="flex justify-end gap-2 px-7 py-5">
            <Button variant="secondary" onClick={() => setShowAddReward(false)}>Annuler</Button>
            <Button
              onClick={handleAddReward}
              disabled={!newRewardName.trim() || !newRewardCost || parseInt(newRewardCost) < 1}
            >
              Ajouter
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Reward Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!editingReward} onOpenChange={(open) => { if (!open) setEditingReward(null); }}>
        <DialogContent className="sm:max-w-[460px]">
          <div className="px-7 pt-7 pb-5 pr-14">
            <DialogTitle className="text-[16px] font-semibold text-slate-900">Modifier la récompense</DialogTitle>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="px-7 py-6 space-y-5">
            {/* Nom */}
            <div className="space-y-2">
              <Label>Nom de la récompense</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-lg hover:bg-slate-50 transition-colors"
                  onClick={() => {
                    const emojis = ["🎁","☕","🥐","🍕","🍔","🧁","🍦","🥤","🎀","💐","🛍️","✨"];
                    const idx = emojis.indexOf(editRewardEmoji);
                    setEditRewardEmoji(emojis[(idx + 1) % emojis.length]);
                  }}
                >
                  {editRewardEmoji}
                </button>
                <Input
                  placeholder="ex: Café offert"
                  value={editRewardName}
                  onChange={(e) => setEditRewardName(e.target.value)}
                  autoFocus
                  className="flex-1"
                />
              </div>
            </div>

            {/* Mode */}
            <div className="space-y-2">
              <Label>Type de programme</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["stamps", "points"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setEditRewardMode(m); setEditRewardIsReferral(false); }}
                    className={`rounded-xl border py-3 text-[13px] font-medium transition-all ${!editRewardIsReferral && editRewardMode === m ? "border-green-500 bg-green-50 text-green-700" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}
                  >
                    {m === "stamps" ? "🎟️ Tampons" : "⭐ Points"}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setEditRewardIsReferral(true)}
                  className={`rounded-xl border py-3 text-[13px] font-medium transition-all ${editRewardIsReferral ? "border-green-500 bg-green-50 text-green-700" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}
                >
                  🤝 Parrainage
                </button>
              </div>
            </div>

            {/* Coût */}
            <div className="space-y-2">
              <Label>Coût ({editRewardIsReferral ? "points de parrainage" : editRewardMode === "stamps" ? "tampons" : "points"})</Label>
              <Input
                type="number" min="1"
                placeholder={editRewardIsReferral ? "ex: 3" : editRewardMode === "stamps" ? "ex: 10" : "ex: 100"}
                value={editRewardCost}
                onChange={(e) => setEditRewardCost(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="flex justify-end gap-2 px-7 py-5">
            <Button variant="secondary" onClick={() => setEditingReward(null)}>Annuler</Button>
            <Button
              onClick={handleSaveEditReward}
              disabled={!editRewardName.trim() || !editRewardCost || parseInt(editRewardCost) < 1}
            >
              Sauvegarder
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
