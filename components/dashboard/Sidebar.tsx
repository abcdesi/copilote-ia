"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Bot, Zap, Lightbulb, BarChart3, Wrench, Building2, Settings, LogOut, Network, ShieldCheck, Landmark, LifeBuoy } from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { logoutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils/cn";

const NAV = [
  { href: "/app", label: "Accueil", icon: Home },
  { href: "/app/copilot", label: "Copilote", icon: Bot },
  { href: "/app/automations", label: "Automatisations", icon: Zap },
  { href: "/app/opportunities", label: "Opportunités", icon: Lightbulb },
  { href: "/app/results", label: "Résultats", icon: BarChart3 },
  { href: "/app/finance", label: "Finance & audit", icon: Landmark },
  { href: "/app/context", label: "Contexte IA", icon: Network },
  { href: "/app/tools", label: "Outils", icon: Wrench },
  { href: "/app/company", label: "Mon entreprise", icon: Building2 },
  { href: "/app/support", label: "Assistance", icon: LifeBuoy },
  { href: "/app/settings", label: "Paramètres", icon: Settings },
];

export function Sidebar({
  companyName,
  knowledgeScore,
  isAdmin = false,
}: {
  companyName: string;
  knowledgeScore?: number;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const items = isAdmin
    ? [
        ...NAV,
        { href: "/app/admin/intelligence", label: "Intelligence admin", icon: ShieldCheck },
        { href: "/app/admin/support", label: "Support admin", icon: LifeBuoy },
      ]
    : NAV;

  return (
    <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-col lg:border-r lg:border-border lg:bg-card">
      <div className="px-6 py-5">
        <Link href="/app" className="text-lg font-semibold tracking-tight">{APP_NAME}</Link>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{companyName}</p>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {items.map((item) => {
          const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-accent-soft text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {typeof knowledgeScore === "number" && knowledgeScore < 90 && (
        <Link href="/app/company" className="mx-3 mb-3 rounded-xl border border-accent/20 bg-accent-soft p-3 transition hover:border-accent/40">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold">
            <span>Connaissance entreprise</span>
            <span className="tabular-nums text-accent">{knowledgeScore}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-card">
            <div className="h-full rounded-full bg-accent" style={{ width: `${knowledgeScore}%` }} />
          </div>
          <p className="mt-2 text-[11px] leading-4 text-muted-foreground">Complétez votre contexte pour affiner les conseils.</p>
        </Link>
      )}

      <form action={logoutAction} className="px-3 pb-5">
        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <LogOut size={18} />
          Se déconnecter
        </button>
      </form>
    </aside>
  );
}
