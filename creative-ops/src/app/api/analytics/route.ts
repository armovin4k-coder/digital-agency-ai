import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requireCurrentUser } from "@/server/services/auth-guard";
import { getTeamAnalytics } from "@/server/services/analytics.service";

export const dynamic = "force-dynamic";

const querySchema = z.object({ from: z.string().date().optional(), to: z.string().date().optional() });
export async function GET(request: NextRequest) {
  try {
    const actor = await requireCurrentUser();
    const range = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const data = await getTeamAnalytics(actor, range);
    return NextResponse.json({ data });
  } catch (error) { return apiError(error); }
}
