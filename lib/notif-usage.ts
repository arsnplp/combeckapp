import fs from "fs";
import path from "path";

interface NotifLog {
  month: string; // YYYY-MM
  count: number;
}

function logPath(tenantId: string): string {
  return path.join(process.cwd(), "data", "tenants", tenantId, "notif-usage.json");
}

function read(tenantId: string): NotifLog {
  try {
    const data = JSON.parse(fs.readFileSync(logPath(tenantId), "utf8"));
    return data;
  } catch {
    return { month: "", count: 0 };
  }
}

function write(tenantId: string, log: NotifLog) {
  const p = logPath(tenantId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(log, null, 2));
}

export function getMonthlyNotifCount(tenantId: string): number {
  const log = read(tenantId);
  const thisMonth = new Date().toISOString().slice(0, 7);
  if (log.month !== thisMonth) return 0;
  return log.count;
}

export function incrementNotifCount(tenantId: string, amount: number): void {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const log = read(tenantId);
  if (log.month !== thisMonth) {
    write(tenantId, { month: thisMonth, count: amount });
  } else {
    write(tenantId, { month: thisMonth, count: log.count + amount });
  }
}
