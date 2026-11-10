import { NextRequest, NextResponse } from "next/server";
import { Priority, TaskStatus } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { createTaskSchema } from "@/lib/validations/tasks";
import { requireCurrentUser, parseRequestBody } from "@/server/services/auth-guard";
import { createTask, listTasks } from "@/server/services/task.service";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  geo: z.string().trim().min(2).max(8).optional(),
  offer: z.string().trim().max(160).optional(),
  assigneeId: z.string().min(1).optional(),
  mine: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const result = await listTasks(user, {
      ...query,
      mine: query.mine === "true",
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const body = createTaskSchema.parse(await parseRequestBody<unknown>(request));
    const task = await createTask(user, body);
    return NextResponse.json({ data: task }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
