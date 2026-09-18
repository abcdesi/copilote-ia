"use server";

import { revalidatePath } from "next/cache";
import { requireCompanyPermission } from "@/lib/companies/access";
import { rebuildBusinessGraph } from "@/lib/business-graph";

export async function rebuildBusinessGraphAction() {
  const access = await requireCompanyPermission("edit_company");
  await rebuildBusinessGraph(access.company.id);
  revalidatePath("/app/context");
  revalidatePath("/app");
}
