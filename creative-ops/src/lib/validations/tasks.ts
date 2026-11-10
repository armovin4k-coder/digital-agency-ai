import { AiService, CreativeType, Priority, TaskStatus, AttachmentType } from "@prisma/client";
import { z } from "zod";

const httpUrl = z.string().trim().url().refine((value) => /^https?:\/\//i.test(value), "Разрешены только HTTP/HTTPS ссылки.");

export const createTaskSchema = z.object({
  offer: z.string().trim().min(2).max(160),
  geo: z.string().trim().min(2).max(8).transform((value) => value.toUpperCase()),
  creativeType: z.nativeEnum(CreativeType),
  quantity: z.number().int().min(1).max(500),
  description: z.string().trim().min(10).max(10000),
  references: z.array(httpUrl).max(30).default([]),
  priority: z.nativeEnum(Priority).default(Priority.NORMAL),
  deadline: z.string().datetime().transform((value) => new Date(value)).refine((value) => value.getTime() > Date.now(), "Дедлайн должен быть в будущем."),
});

export const updateTaskSchema = z.object({
  offer: z.string().trim().min(2).max(160).optional(),
  geo: z.string().trim().min(2).max(8).transform((value) => value.toUpperCase()).optional(),
  creativeType: z.nativeEnum(CreativeType).optional(),
  quantity: z.number().int().min(1).max(500).optional(),
  description: z.string().trim().min(10).max(10000).optional(),
  references: z.array(httpUrl).max(30).optional(),
  priority: z.nativeEnum(Priority).optional(),
  deadline: z.string().datetime().transform((value) => new Date(value)).refine((value) => value.getTime() > Date.now(), "Дедлайн должен быть в будущем.").optional(),
}).refine((data) => Object.keys(data).length > 0, "Укажите хотя бы одно поле для изменения.");

export const transitionSchema = z.object({
  toStatus: z.nativeEnum(TaskStatus),
  comment: z.string().trim().max(5000).optional(),
});

export const commentSchema = z.object({
  text: z.string().trim().min(1).max(5000),
});

const storagePath = z.string().trim().min(1).max(1024).refine(
  (value) => !value.includes("\\") && !value.split("/").some((part) => part === "." || part === ".."),
  "Некорректный путь файла.",
);

export const attachmentSchema = z.object({
  url: httpUrl.optional(),
  storagePath: storagePath.optional(),
  type: z.nativeEnum(AttachmentType),
  fileName: z.string().trim().max(255).optional(),
  mimeType: z.string().trim().max(120).optional(),
  sizeBytes: z.number().int().min(1).max(25 * 1024 * 1024).optional(),
}).refine((value) => Boolean(value.url) || Boolean(value.storagePath), "Укажите ссылку или путь загруженного файла.");

export const aiUsageSchema = z.object({
  service: z.nativeEnum(AiService),
  credits: z.number().positive().max(1_000_000),
  revisionRound: z.number().int().min(0).max(100).optional(),
  note: z.string().trim().max(2000).optional(),
});

export const assignSchema = z.object({
  assigneeId: z.string().min(1),
});
