import { NextRequest, NextResponse } from "next/server";
import { transitionSchema } from "@/lib/validations/tasks";
import { apiError } from "@/lib/api-response";
import { requireCurrentUser, parseRequestBody } from "@/server/services/auth-guard";
import { transitionTask } from "@/server/services/task.service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const user = await requireCurrentUser();
    const body = transitionSchema.parse(await parseRequestBody<unknown>(request));
    const task = await transitionTask(user, id, body.toStatus, body.comment);
    return NextResponse.json({ data: task });
  } catch (error) {
    return apiError(error);
  }
}
