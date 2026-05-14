import { NextRequest, NextResponse } from "next/server";
import { db, pendingApprovals } from "@agent-web/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { errorResponse } from "@/lib/errors";

const ApprovalSchema = z.object({
  id: z.string().min(1),
  approved: z.boolean(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = ApprovalSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { id, approved } = validation.data;
    
    const record = await db.select().from(pendingApprovals).where(eq(pendingApprovals.id, id));
    
    if (record.length === 0) {
      return NextResponse.json({ error: "Pending approval not found" }, { status: 404 });
    }

    await db
      .update(pendingApprovals)
      .set({ 
        status: approved ? "approved" : "rejected",
        resolvedAt: new Date()
      })
      .where(eq(pendingApprovals.id, id));

    return NextResponse.json({ success: true, id, status: approved ? "approved" : "rejected" });
  } catch (e) {
    console.error("Approval API Error:", e);
    return errorResponse(e);
  }
}
