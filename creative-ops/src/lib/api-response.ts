import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";

export function apiError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Проверьте корректность заполненных полей.", details: error.flatten() } },
      { status: 400 },
    );
  }

  console.error("Unhandled API error:", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." } },
    { status: 500 },
  );
}

export function readJson<T>(value: unknown): T {
  return value as T;
}
