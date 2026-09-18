import { NextResponse } from "next/server";

// Endpoint historique conservé uniquement pour rendre l'ancien contrat explicitement invalide.
// La preuve d'un envoi doit désormais être créée par /send après confirmation du fournisseur
// (Resend + identifiant fournisseur + idempotence). Un callback ne peut plus déclarer lui-même
// qu'un message a été envoyé.
export async function POST() {
  return NextResponse.json(
    {
      error: "Endpoint obsolète. La preuve d'envoi doit provenir du flux d'envoi Pilotzia vérifié.",
      code: "legacy_contact_proof_disabled",
    },
    { status: 410 }
  );
}
