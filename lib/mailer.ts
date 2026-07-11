import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY non configuré dans .env.local");
  return new Resend(key);
}

const FROM = process.env.RESEND_FROM_EMAIL ?? "ComeBack <noreply@getcomeback.fr>";
const APP_URL = process.env.AUTH_URL ?? "https://app.getcomeback.fr";

function html(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06)">
        <tr><td style="background:#111827;padding:28px 32px">
          <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px">⟳ ComeBack</p>
        </td></tr>
        <tr><td style="padding:32px">
          ${body}
          <p style="margin:28px 0 0;font-size:12px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:20px">
            Ce lien expire dans <strong>1 heure</strong>. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendEmailVerification(to: string, token: string): Promise<void> {
  const url = `${APP_URL}/verify-email?token=${token}`;
  await getResend().emails.send({
    from: FROM,
    to,
    subject: "Vérifiez votre adresse email — ComeBack",
    html: html(
      "Vérifiez votre adresse email",
      `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">Vérifiez votre adresse email</h1>
       <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6">Merci de vous être inscrit sur ComeBack ! Cliquez sur le bouton ci-dessous pour activer votre compte.</p>
       <a href="${url}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600">Vérifier mon adresse email</a>
       <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">Ou copiez ce lien : <span style="color:#6366f1">${url}</span></p>`
    ),
  });
}

export async function sendPasswordResetClient(to: string, token: string): Promise<void> {
  const url = `${APP_URL}/client/reset-password?token=${token}`;
  await getResend().emails.send({
    from: FROM,
    to,
    subject: "Réinitialiser votre mot de passe — ComeBack",
    html: html(
      "Réinitialiser votre mot de passe",
      `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">Réinitialiser votre mot de passe</h1>
       <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6">Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe pour votre espace fidélité.</p>
       <a href="${url}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600">Réinitialiser mon mot de passe</a>
       <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">Ou copiez ce lien : <span style="color:#6366f1">${url}</span></p>`
    ),
  });
}

export async function sendWelcomeClient(to: string, clientName: string, storeName: string): Promise<void> {
  const url = `${APP_URL}/client/cards`;
  await getResend().emails.send({
    from: FROM,
    to,
    subject: `Votre carte ${storeName} est activée — ComeBack`,
    html: html(
      "Bienvenue",
      `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">Bienvenue ${clientName} ! 🎉</h1>
       <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6">
         Votre carte de fidélité chez <strong>${storeName}</strong> est activée.<br>
         Retrouvez toutes vos cartes et suivez vos tampons en temps réel.
       </p>
       <a href="${url}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600">📲 Ajouter ma carte au Wallet</a>
       <p style="margin:16px 0 0;font-size:13px;color:#64748b;line-height:1.6">
         Avec la carte dans <strong>Apple Wallet</strong> ou <strong>Google Wallet</strong>, votre solde
         se met à jour tout seul et vous recevez les offres du commerçant directement sur votre téléphone.
       </p>
       <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">Ou copiez ce lien : <span style="color:#6366f1">${url}</span></p>`
    ),
  });
}

export async function sendPasswordResetRestaurant(to: string, token: string): Promise<void> {
  const url = `${APP_URL}/reset-password?token=${token}`;
  await getResend().emails.send({
    from: FROM,
    to,
    subject: "Réinitialiser votre mot de passe — ComeBack",
    html: html(
      "Réinitialiser votre mot de passe",
      `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">Réinitialiser votre mot de passe</h1>
       <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6">Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe pour votre tableau de bord ComeBack.</p>
       <a href="${url}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600">Réinitialiser mon mot de passe</a>
       <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">Ou copiez ce lien : <span style="color:#6366f1">${url}</span></p>`
    ),
  });
}

// ═══════════════════════════════════════════════════════════════════
// Emails du programme d'affiliation
// ═══════════════════════════════════════════════════════════════════

export async function sendAffiliateWelcome(to: string, name: string, refLink: string): Promise<void> {
  await getResend().emails.send({
    from: FROM, to,
    subject: "Bienvenue dans le programme partenaires ComeBack 🤝",
    html: html("Bienvenue",
      `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">Bienvenue ${name} !</h1>
       <p style="margin:0 0 20px;font-size:14px;color:#64748b;line-height:1.6">
         Votre compte partenaire est actif. Partagez votre lien : chaque commerce qui
         s'abonne via ce lien vous rapporte une commission sur ses paiements.
       </p>
       <p style="margin:0 0 20px;padding:12px 16px;background:#f0fdf4;border-radius:10px;font-size:13px;color:#166534;word-break:break-all">${refLink}</p>
       <a href="${APP_URL}/affilies/dashboard" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600">Accéder à mon tableau de bord</a>`),
  });
}

export async function sendAffiliateCommissionEmail(to: string, p: { clientName: string; amount: number; unlockDate: string }): Promise<void> {
  await getResend().emails.send({
    from: FROM, to,
    subject: `🎉 +${p.amount.toFixed(2)} € de commission !`,
    html: html("Commission gagnée",
      `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">+${p.amount.toFixed(2)} € 🎉</h1>
       <p style="margin:0 0 20px;font-size:14px;color:#64748b;line-height:1.6">
         <strong>${p.clientName}</strong> vient de payer son abonnement ComeBack grâce à vous.
         Votre commission sera débloquée le <strong>${p.unlockDate}</strong> (période de garantie).
       </p>
       <a href="${APP_URL}/affilies/dashboard" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600">Voir ma cagnotte</a>`),
  });
}

export async function sendAffiliateUnlockedEmail(to: string, amount: number): Promise<void> {
  await getResend().emails.send({
    from: FROM, to,
    subject: `✅ ${amount.toFixed(2)} € disponibles au retrait`,
    html: html("Commission débloquée",
      `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">${amount.toFixed(2)} € débloqués ✅</h1>
       <p style="margin:0 0 20px;font-size:14px;color:#64748b;line-height:1.6">
         Votre commission est maintenant disponible dans votre cagnotte. Vous pouvez demander un retrait à tout moment.
       </p>
       <a href="${APP_URL}/affilies/dashboard" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600">Demander un retrait</a>`),
  });
}

export async function sendAffiliateRefundEmail(to: string, p: { amount: number }): Promise<void> {
  await getResend().emails.send({
    from: FROM, to,
    subject: "⚠️ Commission annulée",
    html: html("Commission annulée",
      `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">Commission annulée</h1>
       <p style="margin:0;font-size:14px;color:#64748b;line-height:1.6">
         Un client a été remboursé : la commission de <strong>${p.amount.toFixed(2)} €</strong> associée a été retirée de votre cagnotte.
       </p>`),
  });
}

export async function sendAffiliateWithdrawalEmail(to: string, status: "approved" | "paid" | "rejected", amount: number, notes?: string): Promise<void> {
  const subjects = {
    approved: `Retrait de ${amount.toFixed(2)} € approuvé — paiement sous 2-3 jours`,
    paid: `💸 ${amount.toFixed(2)} € envoyés !`,
    rejected: `Retrait de ${amount.toFixed(2)} € refusé`,
  };
  const bodies = {
    approved: "Votre demande de retrait a été approuvée. Le paiement sera effectué sous 2 à 3 jours ouvrés.",
    paid: "Votre retrait a été payé. Merci pour votre partenariat !",
    rejected: `Votre demande de retrait a été refusée${notes ? ` : ${notes}` : ""}. Le montant a été recrédité sur votre cagnotte.`,
  };
  await getResend().emails.send({
    from: FROM, to,
    subject: subjects[status],
    html: html("Retrait",
      `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">${subjects[status]}</h1>
       <p style="margin:0;font-size:14px;color:#64748b;line-height:1.6">${bodies[status]}</p>`),
  });
}

export async function sendAffiliateTierEmail(to: string, tier: string): Promise<void> {
  const labels: Record<string, string> = { gold: "Gold 🥇", platinum: "Platinum 💎" };
  await getResend().emails.send({
    from: FROM, to,
    subject: `🎉 Vous êtes passé ${labels[tier] ?? tier} !`,
    html: html("Nouveau palier",
      `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">Félicitations, palier ${labels[tier] ?? tier} !</h1>
       <p style="margin:0 0 20px;font-size:14px;color:#64748b;line-height:1.6">
         Vos nouveaux avantages vous attendent sur votre tableau de bord partenaire.
       </p>
       <a href="${APP_URL}/affilies/dashboard" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600">Voir mes avantages</a>`),
  });
}

export async function notifyAdminEmail(subject: string, fields: Record<string, string>): Promise<void> {
  const admin = process.env.ADMIN_EMAIL;
  if (!admin) return;
  const rows = Object.entries(fields)
    .map(([k, v]) => `<p style="margin:0 0 6px;font-size:14px;color:#334155"><strong>${k} :</strong> ${v}</p>`).join("");
  await getResend().emails.send({
    from: FROM, to: admin, subject: `[Admin] ${subject}`,
    html: html("Notification admin",
      `<h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827">${subject}</h1>${rows}`),
  });
}
