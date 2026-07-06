import { supabase } from "./supabase";

export interface WalletPass {
  id: string;
  serialNumber: string;
  authenticationToken: string;
  customerId: string;
  customerCardId: string;
  passTypeIdentifier: string;
  updatedAt: string;
  campaignMessage?: string;
  passData: {
    type: "stamps" | "points";
    clientName: string;
    clientId: string;
    stampsRequired: number;
    nextReward: string;
    storeName: string;
    accentColor: string;
    bgColor: string;
    passOrigin: string;
  };
}

export interface WalletDevice {
  id: string;
  deviceLibraryIdentifier: string;
  pushToken: string;
  passId: string;
  registeredAt: string;
}

interface PassRow {
  serial_number: string;
  id: string | null;
  customer_id: string | null;
  customer_card_id: string | null;
  auth_token: string;
  pass_type_identifier: string;
  campaign_message: string | null;
  pass_data: WalletPass["passData"];
  updated_at: string;
}

interface RegRow {
  id: string;
  device_library_id: string;
  push_token: string;
  serial_number: string;
  pass_id: string | null;
  created_at: string;
}

function mapPass(r: PassRow): WalletPass {
  return {
    id: r.id ?? `wp-${r.serial_number}`,
    serialNumber: r.serial_number,
    authenticationToken: r.auth_token,
    customerId: r.customer_id ?? "",
    customerCardId: r.customer_card_id ?? "",
    passTypeIdentifier: r.pass_type_identifier ?? "pass.comeback",
    updatedAt: r.updated_at,
    campaignMessage: r.campaign_message ?? undefined,
    passData: r.pass_data ?? ({} as WalletPass["passData"]),
  };
}

function mapDevice(r: RegRow): WalletDevice {
  return {
    id: r.id,
    deviceLibraryIdentifier: r.device_library_id,
    pushToken: r.push_token,
    passId: r.pass_id ?? `wp-${r.serial_number}`,
    registeredAt: r.created_at,
  };
}

const PASS_COLS = "serial_number, id, customer_id, customer_card_id, auth_token, pass_type_identifier, campaign_message, pass_data, updated_at";

export async function walletDb_upsertPass(pass: WalletPass): Promise<void> {
  await supabase().from("wallet_passes").upsert({
    serial_number: pass.serialNumber,
    id: pass.id,
    customer_id: pass.customerId || null,
    customer_card_id: pass.customerCardId || null,
    auth_token: pass.authenticationToken,
    pass_type_identifier: pass.passTypeIdentifier,
    campaign_message: pass.campaignMessage ?? null,
    pass_data: pass.passData,
    updated_at: pass.updatedAt,
  }, { onConflict: "serial_number" });
}

export async function walletDb_getPass(id: string): Promise<WalletPass | null> {
  const { data } = await supabase().from("wallet_passes").select(PASS_COLS).eq("id", id).maybeSingle();
  return data ? mapPass(data as PassRow) : null;
}

export async function walletDb_getPassBySerial(serialNumber: string): Promise<WalletPass | null> {
  const { data } = await supabase().from("wallet_passes").select(PASS_COLS)
    .eq("serial_number", serialNumber).maybeSingle();
  return data ? mapPass(data as PassRow) : null;
}

export async function walletDb_getPassByCustomerCard(customerCardId: string): Promise<WalletPass | null> {
  const { data } = await supabase().from("wallet_passes").select(PASS_COLS)
    .eq("customer_card_id", customerCardId).limit(1).maybeSingle();
  return data ? mapPass(data as PassRow) : null;
}

export async function walletDb_getPassByToken(authenticationToken: string): Promise<WalletPass | null> {
  const { data } = await supabase().from("wallet_passes").select(PASS_COLS)
    .eq("auth_token", authenticationToken).limit(1).maybeSingle();
  return data ? mapPass(data as PassRow) : null;
}

export async function walletDb_touchPass(passId: string): Promise<string> {
  const now = new Date().toISOString();
  await supabase().from("wallet_passes").update({ updated_at: now }).eq("id", passId);
  return now;
}

export async function walletDb_setCampaignMessage(passId: string, message: string): Promise<void> {
  await supabase().from("wallet_passes")
    .update({ campaign_message: message, updated_at: new Date().toISOString() })
    .eq("id", passId);
}

export async function walletDb_getAllPasses(): Promise<WalletPass[]> {
  const { data } = await supabase().from("wallet_passes").select(PASS_COLS);
  return ((data ?? []) as PassRow[]).map(mapPass);
}

export async function walletDb_registerDevice(device: WalletDevice): Promise<boolean> {
  const sb = supabase();
  const { data: existing } = await sb.from("wallet_registrations").select("id")
    .eq("device_library_id", device.deviceLibraryIdentifier)
    .eq("pass_id", device.passId).maybeSingle();
  if (existing) return false;
  const serial = device.passId.replace(/^wp-/, "");
  await sb.from("wallet_registrations").insert({
    id: device.id,
    device_library_id: device.deviceLibraryIdentifier,
    push_token: device.pushToken,
    serial_number: serial,
    pass_id: device.passId,
    created_at: device.registeredAt,
  });
  return true;
}

export async function walletDb_unregisterDevice(deviceLibraryIdentifier: string, passId: string): Promise<boolean> {
  const { data } = await supabase().from("wallet_registrations").delete()
    .eq("device_library_id", deviceLibraryIdentifier)
    .eq("pass_id", passId).select("id");
  return (data?.length ?? 0) > 0;
}

export async function walletDb_getDevicesForPass(passId: string): Promise<WalletDevice[]> {
  const { data } = await supabase().from("wallet_registrations").select("*").eq("pass_id", passId);
  return ((data ?? []) as RegRow[]).map(mapDevice);
}

export async function walletDb_getPassesForDevice(
  deviceLibraryIdentifier: string,
  passTypeIdentifier: string,
  updatedSince?: string,
): Promise<WalletPass[]> {
  const sb = supabase();
  const { data: regs } = await sb.from("wallet_registrations").select("pass_id")
    .eq("device_library_id", deviceLibraryIdentifier);
  const passIds = [...new Set((regs ?? []).map((r) => r.pass_id).filter(Boolean))] as string[];
  if (!passIds.length) return [];
  let q = sb.from("wallet_passes").select(PASS_COLS)
    .in("id", passIds).eq("pass_type_identifier", passTypeIdentifier);
  if (updatedSince) q = q.gt("updated_at", updatedSince);
  const { data } = await q;
  return ((data ?? []) as PassRow[]).map(mapPass);
}
