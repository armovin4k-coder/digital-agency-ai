import { NextRequest, NextResponse } from "next/server";
import { assignSchema } from "@/lib/validations/tasks";
import { apiError } from "@/lib/api-response";
import { requireCurrentUser, parseRequestBody } from "@/server/services/auth-guard";
import { assignTask } from "@/server/services/task.service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const user = await requireCurrentUser();
    const body = assignSchema.parse(await parseRequestBody<unknown>(request));
    const task = await assignTask(user, id, body.assigneeId);
    return NextResponse.json({ data: task });
  } catch (error) {
    return apiError(error);
  }
}
