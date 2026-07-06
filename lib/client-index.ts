import fs from "fs";
import path from "path";

const INDEX_PATH = path.join(process.cwd(), "data", "client-index.json");

type Index = Record<string, string[]>; // email → tenantId[]

function read(): Index {
  try {
    return JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  } catch {
    return {};
  }
}

function write(index: Index) {
  const tmp = INDEX_PATH + ".tmp";
  fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(index, null, 2));
  fs.renameSync(tmp, INDEX_PATH);
}

export function indexAddCustomer(email: string, tenantId: string): void {
  const normalized = email.toLowerCase().trim();
  const index = read();
  const existing = index[normalized] ?? [];
  if (!existing.includes(tenantId)) {
    index[normalized] = [...existing, tenantId];
    write(index);
  }
}

export function indexRemoveCustomer(email: string, tenantId: string): void {
  const normalized = email.toLowerCase().trim();
  const index = read();
  if (!index[normalized]) return;
  index[normalized] = index[normalized].filter((id) => id !== tenantId);
  if (index[normalized].length === 0) delete index[normalized];
  write(index);
}

export function indexRemoveAllForEmail(email: string): void {
  const normalized = email.toLowerCase().trim();
  const index = read();
  delete index[normalized];
  write(index);
}

/** Retourne les tenantIds connus pour cet email, ou null si l'index est absent (fallback scan). */
export function indexGetTenants(email: string): string[] | null {
  const normalized = email.toLowerCase().trim();
  const raw = (() => { try { return fs.readFileSync(INDEX_PATH, "utf8"); } catch { return null; } })();
  if (raw === null) return null; // index absent → fallback
  const index: Index = JSON.parse(raw);
  return index[normalized] ?? [];
}
