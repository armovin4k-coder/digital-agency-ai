import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requireCurrentUser } from "@/server/services/auth-guard";
import { listActivity } from "@/server/services/task.service";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  action: z.string().trim().max(80).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  q: z.string().trim().max(160).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const result = await listActivity(user, query);
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
