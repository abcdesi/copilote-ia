import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { auth } from "@/lib/auth";
import { signupAction } from "@/lib/auth/actions";
import { AuthCard } from "@/components/marketing/AuthCard";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Créer votre espace",
  robots: { index: false, follow: false },
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Merci de vérifier les informations saisies (mot de passe : 12 caractères minimum et acceptation des conditions requise).",
  exists: "Un compte existe déjà avec cet email. Connectez-vous plutôt.",
};

function safeNext(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/onboarding";
  return value;
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const session = await auth();
  if (session) redirect(next === "/onboarding" ? "/app" : next);

  const loginHref = next === "/onboarding" ? "/login" : `/login?next=${encodeURIComponent(next)}`;

  return (
    <AuthCard
      title="Passez de l'hypothèse à votre vraie simulation"
      subtitle="Créez votre espace. Pilotzia reprend votre première analyse, apprend votre contexte et affine ses recommandations à mesure que vous lui donnez des faits réels."
      footer={
        <>
          Déjà un compte ?{" "}
          <Link href={loginHref} className="font-medium text-accent">Se connecter</Link>
        </>
      }
    >
      <div className="mb-5 grid gap-2 rounded-xl bg-accent-soft p-4 text-xs leading-5 text-muted-foreground">
        <p className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-accent" /> Sans carte bancaire.</p>
        <p className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-accent" /> 14 jours pour tester l'IA réelle sur votre entreprise.</p>
        <p className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-accent" /> Votre contexte et votre historique restent disponibles après l'essai.</p>
      </div>
      <form action={signupAction} className="space-y-4">
        {params.error && <p className="text-sm text-danger">{ERROR_MESSAGES[params.error] ?? "Une erreur est survenue."}</p>}
        {next !== "/onboarding" && <input type="hidden" name="next" value={next} />}
        <div className="space-y-1.5">
          <Label htmlFor="name">Votre nom</Label>
          <Input id="name" name="name" type="text" required autoComplete="name" placeholder="Camille Martin" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email professionnel</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" placeholder="vous@entreprise.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Mot de passe</Label>
          <Input id="password" name="password" type="password" required minLength={12} autoComplete="new-password" placeholder="12 caractères minimum" />
          <p className="text-xs text-muted-foreground">Privilégiez une phrase de passe longue et unique.</p>
        </div>
        <label className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
          <input name="acceptTerms" value="yes" type="checkbox" required className="mt-1" />
          <span>
            J'accepte les <Link href="/cgv" className="font-medium text-accent" target="_blank">CGV</Link> et reconnais avoir lu la <Link href="/confidentialite" className="font-medium text-accent" target="_blank">politique de confidentialité</Link>.
          </span>
        </label>
        <Button type="submit" className="mt-2 w-full">Démarrer ma simulation gratuitement</Button>
      </form>
    </AuthCard>
  );
}
