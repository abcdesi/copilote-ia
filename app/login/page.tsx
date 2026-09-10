import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loginAction } from "@/lib/auth/actions";
import { AuthCard } from "@/components/marketing/AuthCard";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/app");

  const { error } = await searchParams;

  return (
    <AuthCard
      title="Content de vous revoir"
      subtitle="Connectez-vous pour retrouver votre cockpit d'automatisation."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link href="/signup" className="font-medium text-accent">
            Créer un espace gratuit
          </Link>
        </>
      }
    >
      <form action={loginAction} className="space-y-4">
        {error && <p className="text-sm text-danger">Email ou mot de passe incorrect.</p>}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" placeholder="vous@entreprise.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Mot de passe</Label>
          <Input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <Button type="submit" className="w-full mt-2">
          Se connecter
        </Button>
      </form>
    </AuthCard>
  );
}
