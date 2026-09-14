import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { signupAction } from "@/lib/auth/actions";
import { AuthCard } from "@/components/marketing/AuthCard";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Merci de vérifier les informations saisies (mot de passe : 8 caractères minimum et acceptation des conditions requise).",
  exists: "Un compte existe déjà avec cet email. Connectez-vous plutôt.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/app");

  const { error } = await searchParams;

  return (
    <AuthCard
      title="Créez votre espace gratuitement"
      subtitle="Commencez par votre diagnostic puis construisez progressivement le contexte utile de votre entreprise."
      footer={
        <>
          Déjà un compte ?{" "}
          <Link href="/login" className="font-medium text-accent">Se connecter</Link>
        </>
      }
    >
      <form action={signupAction} className="space-y-4">
        {error && <p className="text-sm text-danger">{ERROR_MESSAGES[error] ?? "Une erreur est survenue."}</p>}
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
          <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="8 caractères minimum" />
        </div>
        <label className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
          <input name="acceptTerms" value="yes" type="checkbox" required className="mt-1" />
          <span>
            J'accepte les <Link href="/cgv" className="font-medium text-accent" target="_blank">CGV</Link> et reconnais avoir lu la <Link href="/confidentialite" className="font-medium text-accent" target="_blank">politique de confidentialité</Link>.
          </span>
        </label>
        <Button type="submit" className="w-full mt-2">Créer mon espace gratuitement</Button>
      </form>
    </AuthCard>
  );
}
