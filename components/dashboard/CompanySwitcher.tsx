import { Building2 } from "lucide-react";
import { COMPANY_ROLE_LABELS, type CompanyRole } from "@/lib/companies/access";
import { switchActiveCompanyAction } from "@/lib/companies/company-switch-actions";

export function CompanySwitcher({
  currentCompanyId,
  choices,
}: {
  currentCompanyId: string;
  choices: Array<{ companyId: string; companyName: string; role: CompanyRole }>;
}) {
  if (choices.length <= 1) return null;

  return (
    <div className="border-b border-border bg-card px-4 py-3 sm:px-6">
      <form action={switchActiveCompanyAction} className="mx-auto flex max-w-7xl flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Building2 size={14} /> Entreprise active
        </div>
        <select
          name="companyId"
          defaultValue={currentCompanyId}
          className="h-9 min-w-56 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent"
        >
          {choices.map((choice) => (
            <option key={choice.companyId} value={choice.companyId}>
              {choice.companyName} — {COMPANY_ROLE_LABELS[choice.role]}
            </option>
          ))}
        </select>
        <button className="h-9 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted">Changer</button>
        <p className="text-xs text-muted-foreground">Le contexte, les permissions et les actions s'appliquent uniquement à l'entreprise sélectionnée.</p>
      </form>
    </div>
  );
}
