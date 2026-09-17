import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resetPasswordAction } from "@/lib/auth/actions";
import { validatePasswordResetToken } from "@/lib/auth/password-reset";
import { AuthCard } from "@/components/marketing/AuthCard";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Nouveau mot de passe",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  invalid: "Ce lien n'est plus valide ou a déjà été utilisé.",
  invalid_password: "Utilisez au moins 12 caractères et saisissez deux fois le même mot de passe.",
};

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  if (!/^[0-9a-f]{64}$/i.test(token)) notFound();
  const reset = await validatePasswordResetToken(token);
  const { error } = await searchParams;

  if (!reset) {
    return (
      <AuthCard
        title="Lien expiré"
        subtitle="Ce lien n'est plus utilisable. Demandez une nouvelle réinitialisation pour protéger votre compte."
        footer={<Link href="/login" className="font-medium text-accent">Retour à la connexion</Link>}
      >
        <Link href="/forgot-password" className="inline-flex w-full justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground">Demander un nouveau lien</Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choisir un nouveau mot de passe"
      subtitle="Le lien est à usage unique. Les anciennes sessions Pilotzia seront invalidées après la modification."
      footer={<Link href="/login" className="font-medium text-accent">Annuler</Link>}
    >
      <form action={resetPasswordAction} className="space-y-4">
        {error && <p className="text-sm text-danger">{ERRORS[error] ?? ERRORS.invalid}</p>}
        <input type="hidden" name="token" value={token} />
        <div className="space-y-1.5">
          <Label htmlFor="password">Nouveau mot de passe</Label>
          <Input id="password" name="password" type="password" required minLength={12} autoComplete="new-password" />
          <p className="text-xs text-muted-foreground">12 caractères minimum. Une phrase de passe unique est recommandée.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmation">Confirmer le mot de passe</Label>
          <Input id="confirmation" name="confirmation" type="password" required minLength={12} autoComplete="new-password" />
        </div>
        <Button type="submit" className="w-full">Mettre à jour mon mot de passe</Button>
      </form>
    </AuthCard>
  );
}
