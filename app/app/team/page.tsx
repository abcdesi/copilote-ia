import Link from "next/link";
import { ShieldCheck, UserPlus, Users } from "lucide-react";
import { getDashboardShellAccess, hasCompanyPermission, normalizeCompanyRole, COMPANY_ROLE_LABELS } from "@/lib/companies/access";
import { safeRead } from "@/lib/runtime/safe-read";
import { getTeamOverview } from "@/lib/companies/team";
import {
  inviteTeamMemberAction,
  removeTeamMemberAction,
  revokeTeamInvitationAction,
  updateTeamMemberRoleAction,
  transferCompanyOwnershipAction,
} from "@/lib/companies/team-actions";

const ERROR_MESSAGES: Record<string, string> = {
  forbidden: "Vous n'avez pas les droits nécessaires pour modifier l'équipe.",
  account_incomplete: "Votre compte doit avoir une adresse email valide.",
  invalid_invitation: "Invitation invalide.",
  already_member: "Cette personne fait déjà partie de l'entreprise.",
  seat_limit_reached: "Tous les sièges inclus dans votre offre sont déjà utilisés ou réservés.",
  role_not_allowed: "Votre rôle ne permet pas d'attribuer ce niveau d'accès.",
  delivery_failed: "L'invitation n'a pas pu être envoyée. Aucun siège n'a été réservé.",
  invitation_failed: "L'invitation n'a pas pu être créée.",
  invitation_not_found: "Cette invitation n'est plus active.",
  invalid_member: "Membre invalide.",
  member_not_found: "Ce membre n'est plus actif.",
  ownership_confirmation: "Saisissez exactement le nom de l'entreprise pour confirmer le transfert de propriété.",
  ownership_changed: "La propriété de l'entreprise a changé. Rechargez la page avant de réessayer.",
  ownership_transfer_failed: "Le transfert de propriété n'a pas pu être effectué.",
};

const ROLE_DESCRIPTIONS = {
  owner: "Gouvernance, facturation, équipe et toutes les actions sensibles.",
  admin: "Configure l'entreprise, l'équipe, les intégrations et les actions jusqu'au risque moyen.",
  operator: "Exécute les opérations quotidiennes et les actions à faible risque.",
  viewer: "Consulte Pilotzia et le contexte sans modifier la gouvernance.",
};

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invited?: string; ownership?: string }>;
}) {
  const access = await getDashboardShellAccess();
  const overview = await safeRead(
    "team.overview",
    () => getTeamOverview(access.company.id),
    {
      capacity: {
        seatLimit: 1,
        activeMembers: 0,
        pendingInvitations: 0,
        reservedSeats: 0,
        seatsAvailable: 0,
        plan: "free",
      },
      members: [],
      invitations: [],
    }
  );
  const params = await searchParams;
  const canManage = hasCompanyPermission(access.role, "manage_team");
  const assignableRoles = access.role === "owner" ? ["admin", "operator", "viewer"] as const : ["operator", "viewer"] as const;

  return (
    <div className="mx-auto max-w-5xl space-y-7 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-accent"><Users size={18} /><span className="text-xs font-semibold uppercase tracking-[0.14em]">Gouvernance</span></div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Équipe & accès</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Chaque membre a un rôle nominatif. Les validations, changements de permissions et actions sensibles restent attribués à leur auteur avec date et heure.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <p className="text-xs text-muted-foreground">Sièges réservés</p>
          <p className="mt-1 font-semibold tabular-nums">{overview.capacity.reservedSeats} / {overview.capacity.seatLimit}</p>
        </div>
      </div>

      {params.error && <div className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">{ERROR_MESSAGES[params.error] ?? "Une erreur est survenue."}</div>}
      {params.invited === "1" && <div className="rounded-xl border border-accent/25 bg-accent-soft p-4 text-sm text-accent">Invitation envoyée et siège réservé jusqu'à son expiration.</div>}
      {params.ownership === "transferred" && <div className="rounded-xl border border-success/25 bg-success/10 p-4 text-sm text-success">La propriété de l'entreprise a été transférée. Votre compte conserve un rôle Administrateur.</div>}

      {canManage && (
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center gap-2"><UserPlus size={17} className="text-accent" /><h2 className="font-semibold">Inviter un membre</h2></div>
          <p className="mt-1 text-sm text-muted-foreground">L'invitation expire après 7 jours. Un siège n'est réservé que si l'email a été envoyé.</p>
          {overview.capacity.seatsAvailable > 0 ? (
            <form action={inviteTeamMemberAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
              <input name="email" type="email" required placeholder="collaborateur@entreprise.com" className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent" />
              <select name="role" defaultValue="operator" className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent">
                {assignableRoles.map((role) => <option key={role} value={role}>{COMPANY_ROLE_LABELS[role]}</option>)}
              </select>
              <button className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground">Envoyer</button>
            </form>
          ) : (
            <div className="mt-4 flex flex-col gap-3 rounded-xl bg-muted/50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span>
                {overview.capacity.plan === "business"
                  ? "Les 10 sièges inclus sont utilisés. Des sièges supplémentaires peuvent être activés après validation."
                  : "Aucun siège disponible dans l'offre actuelle."}
              </span>
              <Link
                href={overview.capacity.plan === "business" ? "/app/support?category=billing" : "/app/settings"}
                className="font-semibold text-accent"
              >
                {overview.capacity.plan === "business" ? "Demander des sièges supplémentaires" : "Voir l'offre supérieure"}
              </Link>
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="font-semibold">Membres actifs</h2>
        <div className="mt-4 divide-y divide-border">
          {overview.members.map((member) => {
            const memberRole = normalizeCompanyRole(member.role);
            const isSelf = member.userId === access.session.user.id;
            const canEditTarget = canManage && !isSelf && memberRole !== "owner" && (access.role === "owner" || memberRole !== "admin");
            return (
              <div key={member.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{member.user.name || member.user.email}{isSelf ? " — vous" : ""}</p>
                    <p className="truncate text-sm text-muted-foreground">{member.user.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{COMPANY_ROLE_LABELS[memberRole]} · {ROLE_DESCRIPTIONS[memberRole]}</p>
                  </div>
                  {canEditTarget ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <form action={updateTeamMemberRoleAction} className="flex items-center gap-2">
                        <input type="hidden" name="membershipId" value={member.id} />
                        <select name="role" defaultValue={memberRole} className="h-9 rounded-lg border border-border bg-background px-2 text-xs">
                          {assignableRoles.map((role) => <option key={role} value={role}>{COMPANY_ROLE_LABELS[role]}</option>)}
                        </select>
                        <button className="h-9 rounded-lg border border-border px-3 text-xs font-semibold">Modifier</button>
                      </form>
                      <form action={removeTeamMemberAction}>
                        <input type="hidden" name="membershipId" value={member.id} />
                        <button className="h-9 rounded-lg border border-danger/30 px-3 text-xs font-semibold text-danger">Retirer</button>
                      </form>
                    </div>
                  ) : (
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs"><ShieldCheck size={12} /> {COMPANY_ROLE_LABELS[memberRole]}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {access.role === "owner" && overview.members.some((member) => member.userId !== access.session.user.id) && (
        <section className="rounded-2xl border border-danger/20 bg-card p-5 sm:p-6">
          <h2 className="font-semibold">Transférer la propriété</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Cette action transfère la gouvernance, la facturation et les validations à un autre membre actif. Votre compte devient Administrateur et l'opération reste tracée.
          </p>
          <form action={transferCompanyOwnershipAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <select name="membershipId" required defaultValue="" className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent">
              <option value="" disabled>Choisir le nouveau propriétaire</option>
              {overview.members
                .filter((member) => member.userId !== access.session.user.id)
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.user.name || member.user.email} · {COMPANY_ROLE_LABELS[normalizeCompanyRole(member.role)]}
                  </option>
                ))}
            </select>
            <input
              name="confirmation"
              required
              placeholder={`Tapez exactement : ${access.company.name}`}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent"
            />
            <button className="h-10 rounded-xl border border-danger/30 px-4 text-sm font-semibold text-danger">
              Transférer
            </button>
          </form>
        </section>
      )}

      {overview.invitations.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="font-semibold">Invitations en attente</h2>
          <div className="mt-4 divide-y divide-border">
            {overview.invitations.map((invitation) => (
              <div key={invitation.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">{invitation.email}</p>
                  <p className="text-xs text-muted-foreground">{COMPANY_ROLE_LABELS[normalizeCompanyRole(invitation.role)]} · expire le {invitation.expiresAt.toLocaleDateString("fr-FR")}</p>
                </div>
                {canManage && (access.role === "owner" || invitation.role !== "admin") && (
                  <form action={revokeTeamInvitationAction}>
                    <input type="hidden" name="invitationId" value={invitation.id} />
                    <button className="text-xs font-semibold text-danger">Révoquer</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
