"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Bot, Zap, Lightbulb, BarChart3, Wrench, Building2, Settings, LogOut, Network, ShieldCheck, Landmark } from "lucide-react";
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
  { href: "/app/settings", label: "Paramètres", icon: Settings },
];

export function Sidebar({ companyName, isAdmin = false }: { companyName: string; isAdmin?: boolean }) {
  const pathname = usePathname();
  const items = isAdmin
    ? [...NAV, { href: "/app/admin/intelligence", label: "Intelligence admin", icon: ShieldCheck }]
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

      <form action={logoutAction} className="px-3 pb-5">
        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <LogOut size={18} />
          Se déconnecter
        </button>
      </form>
    </aside>
  );
}
