import { get } from "@vercel/blob";
import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api-response";
import { assertFound, AppError } from "@/lib/errors";
import { assertCanViewTask } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/server/services/auth-guard";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const user = await requireCurrentUser();
    const attachment = assertFound(
      await prisma.attachment.findUnique({
        where: { id },
        include: { task: { select: { buyerId: true, assigneeId: true, status: true } } },
      }),
      "Файл не найден.",
    );
    assertCanViewTask(user, attachment.task);
    if (!attachment.storagePath) throw new AppError("Файл не найден.", 404, "NOT_FOUND");

    const blob = await get(attachment.storagePath, { access: "private" });
    if (!blob || blob.statusCode !== 200) throw new AppError("Файл не найден.", 404, "NOT_FOUND");

    const filename = encodeURIComponent(attachment.fileName ?? "attachment").replace(/['()*]/g, (char) =>
      `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    return new NextResponse(blob.stream, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
        "Content-Type": blob.blob.contentType,
        "Content-Security-Policy": "sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
