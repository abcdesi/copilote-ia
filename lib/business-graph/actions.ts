"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCompany } from "@/lib/companies/current";
import { rebuildBusinessGraph } from "@/lib/business-graph";
import { resolveKnownCompanyIdentities } from "@/lib/business-graph/entity-resolution";

export async function rebuildBusinessGraphAction() {
  const company = await getCurrentCompany();
  await rebuildBusinessGraph(company.id);
  await resolveKnownCompanyIdentities(company.id);
  revalidatePath("/app/context");
  revalidatePath("/app");
}
