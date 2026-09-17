import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loginAction } from "@/lib/auth/actions";
import { AuthCard } from "@/components/marketing/AuthCard";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false, follow: false },
};

function safeNext(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/app";
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const session = await auth().catch((error) => {
    console.error("Unable to read auth session on login page", error);
    return null;
  });
  if (session) redirect(next);

  const signupHref = next === "/app" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`;

  return (
    <AuthCard
      title="Content de vous revoir"
      subtitle="Connectez-vous pour retrouver le contexte, les décisions et les actions de votre entreprise."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link href={signupHref} className="font-medium text-accent">Créer un espace gratuit</Link>
        </>
      }
    >
      <form action={loginAction} className="space-y-4">
        {params.error && <p className="text-sm text-danger">Email ou mot de passe incorrect.</p>}
        {next !== "/app" && <input type="hidden" name="next" value={next} />}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" placeholder="vous@entreprise.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Mot de passe</Label>
          <Input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <Button type="submit" className="mt-2 w-full">Se connecter</Button>
      </form>
    </AuthCard>
  );
}
