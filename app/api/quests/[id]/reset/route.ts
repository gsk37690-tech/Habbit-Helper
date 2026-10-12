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
  const questsCollection = database.collection("quests");

  const quest = await questsCollection.findOne({ _id: new ObjectId(id), userId: user._id });
  if (!quest) return NextResponse.json({ error: "Quest not found." }, { status: 404 });

  const updates = {
    completed: false,
    status: "active",
    progress: 0,
    due: quest.type === "Daily" ? "Today" : quest.due,
  };

  const result = await questsCollection.findOneAndUpdate(
    { _id: new ObjectId(id), userId: user._id },
    { $set: updates },
    { returnDocument: "after" }
  );

  return NextResponse.json({
    quest: {
      ...(result || quest),
      ...updates,
      id: quest._id.toString(),
    },
  });
}
