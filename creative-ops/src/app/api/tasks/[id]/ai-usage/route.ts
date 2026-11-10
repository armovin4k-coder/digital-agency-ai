import { NextRequest, NextResponse } from "next/server";
import { aiUsageSchema } from "@/lib/validations/tasks";
import { apiError } from "@/lib/api-response";
import { requireCurrentUser, parseRequestBody } from "@/server/services/auth-guard";
import { addAiUsage } from "@/server/services/task.service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const user = await requireCurrentUser();
    const body = aiUsageSchema.parse(await parseRequestBody<unknown>(request));
    const usage = await addAiUsage(user, id, body);
    return NextResponse.json({ data: usage }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
