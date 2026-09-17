import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ShieldCheck, Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { logoutAction } from "@/lib/auth/actions";
import { COMPANY_ROLE_LABELS, normalizeCompanyRole } from "@/lib/companies/access";
import { acceptTeamInvitationAction } from "@/lib/companies/team-actions";
import { getInvitationByToken } from "@/lib/companies/team";

export const metadata: Metadata = {
  title: "Invitation équipe",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  invalid: "Cette invitation n'est plus valide ou a expiré.",
  email_mismatch: "Cette invitation a été envoyée à une autre adresse email.",
  seat_limit: "Le nombre de sièges disponibles a changé. Le propriétaire doit libérer un siège ou adapter l'abonnement.",
};

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  if (!/^[0-9a-f]{64}$/i.test(token)) notFound();
  const invitation = await getInvitationByToken(token);
  if (!invitation) notFound();
  const { error } = await searchParams;
  const session = await auth();
  const role = normalizeCompanyRole(invitation.role);
  const returnPath = `/invite/${token}`;

  if (invitation.status !== "pending") {
    return (
      <InviteShell>
        <CheckCircle2 size={28} className="text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-semibold">Invitation {invitation.status === "accepted" ? "déjà acceptée" : "indisponible"}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Ce lien ne peut plus être utilisé. Demandez une nouvelle invitation à l'administrateur de {invitation.company.name} si nécessaire.</p>
        <Link href={session ? "/app" : "/login"} className="mt-6 inline-flex rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground">Continuer</Link>
      </InviteShell>
    );
  }

  if (!session?.user?.id || !session.user.email) {
    return (
      <InviteShell>
        <Users size={28} className="text-accent" />
        <h1 className="mt-4 text-2xl font-semibold">Rejoindre {invitation.company.name}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{invitation.invitedByName || invitation.invitedByEmail} vous invite avec le rôle <strong>{COMPANY_ROLE_LABELS[role]}</strong>. Connectez-vous avec l'adresse <strong>{invitation.email}</strong> ou créez votre compte.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/login?next=${encodeURIComponent(returnPath)}`} className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground">Se connecter</Link>
          <Link href={`/signup?next=${encodeURIComponent(returnPath)}`} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">Créer mon compte</Link>
        </div>
      </InviteShell>
    );
  }

  const emailMatches = session.user.email.trim().toLowerCase() === invitation.email.trim().toLowerCase();
  return (
    <InviteShell>
      <ShieldCheck size={28} className="text-accent" />
      <h1 className="mt-4 text-2xl font-semibold">Invitation à {invitation.company.name}</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Rôle proposé : <strong>{COMPANY_ROLE_LABELS[role]}</strong>. L'acceptation sera enregistrée avec votre compte, la date et l'heure.</p>
      {error && <p className="mt-4 rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger">{ERRORS[error] ?? ERRORS.invalid}</p>}
      {!emailMatches ? (
        <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <p>Vous êtes connecté avec <strong>{session.user.email}</strong>, mais l'invitation est destinée à <strong>{invitation.email}</strong>.</p>
          <form action={logoutAction} className="mt-3"><button className="font-semibold text-accent">Changer de compte</button></form>
        </div>
      ) : (
        <form action={acceptTeamInvitationAction} className="mt-6">
          <input type="hidden" name="token" value={token} />
          <button className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground">Accepter et rejoindre l'entreprise</button>
        </form>
      )}
    </InviteShell>
  );
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">{children}</div>
    </main>
  );
}
