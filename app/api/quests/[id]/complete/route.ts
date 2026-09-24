import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await context.params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid quest id." }, { status: 400 });
  const database = await getDatabase();
  const quest = await database.collection("quests").findOne({ _id: new ObjectId(id), userId: user._id });
  if (!quest) return NextResponse.json({ error: "Quest not found." }, { status: 404 });
  if (quest.completed || quest.status === "completed") return NextResponse.json({ quest: { ...quest, id: quest._id.toString() }, reward: null });
  const now = new Date();
  await database.collection("quests").updateOne({ _id: quest._id }, { $set: { completed: true, status: "completed", completedAt: now, progress: 100 } });
  await database.collection("users").updateOne({ _id: user._id }, { $inc: { xp: quest.xp, gold: quest.gold } });
  return NextResponse.json({ quest: { ...quest, id: quest._id.toString(), completed: true, status: "completed", progress: 100 }, reward: { xp: quest.xp, gold: quest.gold } });
}
