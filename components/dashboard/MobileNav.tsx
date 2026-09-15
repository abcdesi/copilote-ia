"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Home, Bot, Zap, Lightbulb, BarChart3, Wrench, Building2, Settings, Network, ShieldCheck, Landmark } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { APP_NAME } from "@/lib/config";
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

export function MobileNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = isAdmin
    ? [...NAV, { href: "/app/admin/intelligence", label: "Intelligence admin", icon: ShieldCheck }]
    : NAV;

  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
      <Link href="/app" className="text-base font-semibold tracking-tight">{APP_NAME}</Link>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Trigger className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><Menu size={20} /></DialogPrimitive.Trigger>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <DialogPrimitive.Content className="fixed right-0 top-0 z-50 h-full w-64 bg-card p-4 shadow-xl outline-none">
            <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
            <nav className="mt-8 space-y-0.5">
              {items.map((item) => {
                const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
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
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
