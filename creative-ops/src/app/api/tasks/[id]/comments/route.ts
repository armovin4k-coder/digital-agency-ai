import { NextRequest, NextResponse } from "next/server";
import { commentSchema } from "@/lib/validations/tasks";
import { apiError } from "@/lib/api-response";
import { requireCurrentUser, parseRequestBody } from "@/server/services/auth-guard";
import { addComment } from "@/server/services/task.service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const user = await requireCurrentUser();
    const body = commentSchema.parse(await parseRequestBody<unknown>(request));
    const comment = await addComment(user, id, body.text);
    return NextResponse.json({ data: comment }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
