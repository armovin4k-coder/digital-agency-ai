import { getCurrentUser } from "@/lib/session";
import { AppError } from "@/lib/errors";

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new AppError("Для выполнения действия необходимо войти в систему.", 401, "UNAUTHENTICATED");
  return user;
}

export async function parseRequestBody<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new AppError("Некорректный JSON в теле запроса.", 400, "INVALID_JSON");
  }
}
