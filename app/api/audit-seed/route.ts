import { NextResponse } from "next/server";
import { seedAuditLogs } from "@/app/actions/seed-audit";

export async function GET() {
    const result = await seedAuditLogs();
    return NextResponse.json(result);
}
