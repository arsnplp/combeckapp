import { NextRequest, NextResponse } from "next/server";
import { checkAndDowngradeExpiredPlans } from "@/lib/plan-billing";
import { supabase } from "@/lib/supabase";
import { sendTrialReminder } from "@/lib/mailer";

// Rappels de fin d'essai : J-10, J-3, et J-1 avec le code promo -10 %
const REMINDER_STEPS = [10, 3, 1];
const LAST_CHANCE_CODE = "DERNIERECHANCE";

async function sendTrialReminders(): Promise<number> {
  const sb = supabase();

  // trial_reminders (jsonb) trace les paliers déjà envoyés — fallback sans la
  // colonne si le SQL n'a pas encore été exécuté
  let merchants: Array<{ id: string; email: string; store_name: string; plan_expires_at: string; trial_reminders?: number[] }> = [];
  let hasTracking = true;
  const q1 = await sb.from("merchants")
    .select("id, email, store_name, plan_expires_at, trial_reminders")
    .eq("plan", "free").not("plan_expires_at", "is", null);
  if (q1.error) {
    hasTracking = false;
    const q2 = await sb.from("merchants")
      .select("id, email, store_name, plan_expires_at")
      .eq("plan", "free").not("plan_expires_at", "is", null);
    merchants = (q2.data ?? []) as typeof merchants;
  } else {
    merchants = (q1.data ?? []) as typeof merchants;
  }

  let sent = 0;
  for (const m of merchants) {
    if (!m.email || m.email.endsWith("@comeback.local")) continue;
    const daysLeft = Math.ceil((new Date(m.plan_expires_at).getTime() - Date.now()) / 86400_000);
    const already: number[] = Array.isArray(m.trial_reminders) ? m.trial_reminders : [];

    for (const step of REMINDER_STEPS) {
      if (daysLeft !== step || already.includes(step)) continue;
      try {
        await sendTrialReminder(m.email, m.store_name || "votre commerce", step,
          step === 1 ? LAST_CHANCE_CODE : undefined);
        sent++;
        console.log(`[cron] Rappel J-${step} → ${m.email}`);
        if (hasTracking) {
          await sb.from("merchants").update({ trial_reminders: [...already, step] }).eq("id", m.id);
        }
      } catch (e) {
        console.error(`[cron] rappel essai ${m.id}:`, e);
      }
    }
  }
  return sent;
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const count = await checkAndDowngradeExpiredPlans();
    const reminders = await sendTrialReminders();
    return NextResponse.json({ ok: true, downgraded: count, reminders });
  } catch (e) {
    console.error("[cron/plan-expiration]", e);
    return NextResponse.json({ error: "Error." }, { status: 500 });
  }
}
