"use client";

import { useState } from "react";
import { Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/types";

interface ProductCardProps {
  product: Product;
  onEdit?: (product: Product) => void;
  onDelete?: (id: string) => void;
  onToggle?: (id: string) => void;
}

function ProductAvatar({ product }: { product: Product }) {
  if (product.imageUrl) {
    return (
      <div className="h-10 w-10 rounded-lg overflow-hidden flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
      </div>
    );
  }
  const letter = product.name.charAt(0).toUpperCase();
  const colors = [
    ["#f59e0b", "#1a0a00"],
    ["#8b5cf6", "#0d0a1a"],
    ["#10b981", "#001a10"],
    ["#06b6d4", "#001a1a"],
    ["#f87171", "#1a0505"],
    ["#a3e635", "#0d1a00"],
  ];
  const idx = letter.charCodeAt(0) % colors.length;
  const [fg, bg] = colors[idx];

  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold flex-shrink-0"
      style={{ background: bg, color: fg, border: `1px solid ${fg}30` }}
    >
      {letter}
    </div>
  );
}

export default function ProductCard({ product, onEdit, onDelete, onToggle }: ProductCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group relative rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
      style={{
        opacity: product.active ? 1 : 0.6,
      }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      <div className="flex items-start gap-3">
        <ProductAvatar product={product} />
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{product.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">{product.category}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm font-semibold text-green-700">{formatPrice(product.price)}</span>
            {product.pointsValue && (
              <Badge variant="outline" className="text-[10px]">
                {product.pointsValue} pts
              </Badge>
            )}
            {!product.active && (
              <Badge variant="secondary" className="text-[10px]">Inactif</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Hover actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: hovered ? 1 : 0 }}
        className="absolute top-2 right-2 flex items-center gap-1"
      >
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onToggle?.(product.id)}
          className="h-7 w-7"
          title={product.active ? "Désactiver" : "Activer"}
        >
          {product.active ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onEdit?.(product)}
          className="h-7 w-7"
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onDelete?.(product.id)}
          className="h-7 w-7 text-red-400 hover:text-red-300"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </motion.div>
    </motion.div>
  );
}
