"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCompany } from "@/lib/companies/current";
import { rebuildBusinessGraph } from "@/lib/business-graph";

export async function rebuildBusinessGraphAction() {
  const company = await getCurrentCompany();
  await rebuildBusinessGraph(company.id);
  revalidatePath("/app/context");
  revalidatePath("/app");
}
