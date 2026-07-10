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
