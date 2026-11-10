import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import { requireCurrentUser } from "@/server/services/auth-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireCurrentUser();
    const items = await prisma.user.findMany({
      where: { role: Role.CREATIVE },
      select: { id: true, name: true, avatar: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ items });
  } catch (error) {
    return apiError(error);
  }
}
