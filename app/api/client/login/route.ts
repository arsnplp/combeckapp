import { NextRequest, NextResponse } from "next/server";
import { findClientCards } from "@/lib/client-lookup";
import { getClientAccount, verifyClientPassword } from "@/lib/client-accounts";
import { checkRateLimit, getIp, tooManyRequests } from "@/lib/rate-limit";
import { createClientSession } from "@/lib/client-sessions";
import { createResetToken } from "@/lib/reset-tokens";
import { sendPasswordResetClient } from "@/lib/mailer";
import { z } from "zod";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().max(128).optional(),
});

export async function POST(req: NextRequest) {
  // 10 tentatives / 15 min par IP
  if (!checkRateLimit(`client-login:${getIp(req)}`, 10, 15 * 60 * 1000)) {
    return tooManyRequests();
  }

  const parsed = LoginSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Email invalide." }, { status: 400 });
  }
  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  // Le compte est cherché AVANT les cartes : un client qui a quitté tous ses
  // commerces n'a plus aucune carte mais garde son compte, et doit pouvoir se
  // reconnecter pour en rejoindre un nouveau. Exiger une carte l'enfermait
  // dehors définitivement, alors que son mot de passe prouve son identité.
  const account = await getClientAccount(normalizedEmail);

  if (!account) {
    // Aucun mot de passe défini pour cet email : impossible de vérifier que
    // la personne qui se connecte en est bien propriétaire. On envoie un
    // lien de vérification par email (même mécanisme que "mot de passe
    // oublié") — jamais de session accordée sans cette preuve, sinon
    // n'importe qui pourrait se connecter en tapant l'email de quelqu'un
    // d'autre (aucun mot de passe requis à l'inscription initiale).
    // Cet envoi n'a lieu que si l'email est réellement connu de ComeBack :
    // sans ce garde-fou, ce formulaire permettrait de faire envoyer un mail
    // à n'importe quelle adresse.
    const knownCards = await findClientCards(normalizedEmail);
    if (knownCards.length === 0) {
      return NextResponse.json({ error: "Aucun compte trouvé avec cet email." }, { status: 404 });
    }
    try {
      const resetToken = await createResetToken(normalizedEmail, "client");
      await sendPasswordResetClient(normalizedEmail, resetToken);
    } catch (e) {
      console.error("[client/login] envoi email de vérification", e);
    }
    return NextResponse.json(
      { error: "Aucun mot de passe défini pour ce compte — un email de vérification vient de vous être envoyé.", needsVerification: true },
      { status: 401 },
    );
  }

  if (!password) {
    return NextResponse.json({ error: "Mot de passe requis.", needsPassword: true }, { status: 401 });
  }
  const valid = await verifyClientPassword(normalizedEmail, password as string);
  if (!valid) {
    return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
  }

  // Identité prouvée : la session est accordée même sans aucune carte
  // (l'écran "Aucune carte" propose alors d'en ajouter une par scan).
  const cards = await findClientCards(normalizedEmail);
  const token = await createClientSession(normalizedEmail);
  const response = NextResponse.json({ ok: true, count: cards.length });
  response.cookies.set("comeback_client", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 180,
    path: "/",
  });
  return response;
}
