import type { Metadata } from "next";
import Link from "next/link";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { AuthCard } from "@/components/marketing/AuthCard";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Mot de passe oublié",
  robots: { index: false, follow: false },
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthCard
      title="Récupérer votre accès"
      subtitle="Indiquez votre email. Si un compte correspond, Pilotzia enverra un lien valable 30 minutes."
      footer={<Link href="/login" className="font-medium text-accent">Retour à la connexion</Link>}
    >
      {params.sent === "1" ? (
        <div className="rounded-xl border border-accent/25 bg-accent-soft p-4 text-sm leading-6">
          Si un compte correspond à cette adresse, un email de réinitialisation a été envoyé. Vérifiez aussi vos courriers indésirables.
        </div>
      ) : (
        <form action={requestPasswordResetAction} className="space-y-4">
          {params.error && <p className="text-sm text-danger">Le lien n'est plus valide. Demandez-en un nouveau.</p>}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" placeholder="vous@entreprise.com" />
          </div>
          <Button type="submit" className="w-full">Envoyer le lien</Button>
        </form>
      )}
    </AuthCard>
  );
}
