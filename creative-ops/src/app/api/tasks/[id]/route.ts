import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { updateTaskSchema } from "@/lib/validations/tasks";
import { requireCurrentUser, parseRequestBody } from "@/server/services/auth-guard";
import { getTaskById, updateTask } from "@/server/services/task.service";

 export const dynamic = "force-dynamic";

 type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const user = await requireCurrentUser();
    const task = await getTaskById(user, id);
    return NextResponse.json({ data: task });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const user = await requireCurrentUser();
    const body = updateTaskSchema.parse(await parseRequestBody<unknown>(request));
    const task = await updateTask(user, id, body);
    return NextResponse.json({ data: task });
  } catch (error) {
    return apiError(error);
  }
}
