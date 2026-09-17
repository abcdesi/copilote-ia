import { NextResponse } from "next/server";
import { getCurrentCompanyAccess } from "@/lib/companies/access";
import { getBusinessGraphContext } from "@/lib/business-graph";

export async function GET() {
  const access = await getCurrentCompanyAccess();
  const context = await getBusinessGraphContext(access.company.id);
  return NextResponse.json({
    version: "2026-09-14",
    companyId: access.company.id,
    actorRole: access.role,
    ...context,
  });
}
