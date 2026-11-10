import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { Role, TaskStatus } from "@prisma/client";
import { requireCurrentUser } from "@/server/services/auth-guard";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ALLOWED_MIME = [
  "image/png", "image/jpeg", "image/webp", "image/gif",
  "video/mp4", "video/webm", "video/quicktime", "application/pdf",
];
const MAX_FILE_SIZE = 25 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as HandleUploadBody;
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const user = await requireCurrentUser();
        if (!process.env.BLOB_READ_WRITE_TOKEN) {
          throw new AppError("Хранилище файлов не настроено. Добавьте BLOB_READ_WRITE_TOKEN.", 503, "STORAGE_NOT_CONFIGURED");
        }

        let uploadContext: { kind?: string; taskId?: string };
        try {
          uploadContext = JSON.parse(clientPayload || "{}") as { kind?: string; taskId?: string };
        } catch {
          throw new AppError("Некорректный контекст загрузки.", 400, "INVALID_UPLOAD_CONTEXT");
        }

        if (user.role === Role.BUYER) {
          if (uploadContext.kind !== "task-reference" || !uploadContext.taskId) {
            throw new AppError("Байер может загружать только референсы в свою новую задачу.", 403, "FORBIDDEN");
          }
          const task = await prisma.task.findFirst({
            where: { id: uploadContext.taskId, buyerId: user.id, status: TaskStatus.NEW },
            select: { id: true },
          });
          if (!task) throw new AppError("Нельзя загружать референсы в чужую или уже взятую задачу.", 403, "FORBIDDEN");
        }
        if (user.role === Role.CREATIVE) {
          if (uploadContext.kind !== "task-result" || !uploadContext.taskId) {
            throw new AppError("Креативщик может загружать результат только в назначенную задачу.", 403, "FORBIDDEN");
          }
          const task = await prisma.task.findFirst({
            where: { id: uploadContext.taskId, assigneeId: user.id, status: TaskStatus.IN_PROGRESS },
            select: { id: true },
          });
          if (!task) throw new AppError("Нельзя загружать результат в чужую или неактивную задачу.", 403, "FORBIDDEN");
        }
        if (user.role === Role.MANAGER) {
          throw new AppError("Руководитель не загружает файлы в задачи.", 403, "FORBIDDEN");
        }

        return {
          allowedContentTypes: ALLOWED_MIME,
          maximumSizeInBytes: MAX_FILE_SIZE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: user.id, kind: uploadContext.kind, taskId: uploadContext.taskId ?? null }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Attachment metadata is written by the authenticated task API after upload.
        // The signed callback is retained for Vercel's upload-completion handshake.
        void blob;
        void tokenPayload;
      },
    });
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось подготовить загрузку файла.";
    const status = error instanceof AppError ? error.status : 400;
    return NextResponse.json({ error: { code: error instanceof AppError ? error.code : "UPLOAD_FAILED", message } }, { status });
  }
}
