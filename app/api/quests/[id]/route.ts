import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await context.params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid quest id." }, { status: 400 });
  const body = await request.json();
  const updates: Record<string, unknown> = {};
  for (const field of ["title", "description", "type", "difficulty", "due", "tag", "progress", "pinned"]) {
    if (body[field] !== undefined) updates[field] = body[field];
  }
  if (body.status !== undefined) {
    if (!["active", "stopped", "failed"].includes(body.status)) return NextResponse.json({ error: "Invalid quest status." }, { status: 400 });
    updates.status = body.status;
    updates.completed = false;
  }
  const database = await getDatabase();
  const result = await database.collection("quests").findOneAndUpdate({ _id: new ObjectId(id), userId: user._id }, { $set: updates }, { returnDocument: "after" });
  if (!result) return NextResponse.json({ error: "Quest not found." }, { status: 404 });
  return NextResponse.json({ quest: { ...result, id: result._id.toString() } });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await context.params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid quest id." }, { status: 400 });
  const result = await (await getDatabase()).collection("quests").deleteOne({ _id: new ObjectId(id), userId: user._id });
  if (!result.deletedCount) return NextResponse.json({ error: "Quest not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
