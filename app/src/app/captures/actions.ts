"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/db";

export async function dismissCapture(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;
  const id = String(formData.get("captureId") ?? "");
  if (!id) return;
  await db
    .update(schema.captures)
    .set({ status: "dismissed", updatedAt: new Date() })
    .where(
      and(eq(schema.captures.id, id), eq(schema.captures.userId, session.user.id))
    );
  revalidatePath("/captures");
  revalidatePath("/");
}
