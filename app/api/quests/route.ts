import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const clientDate = request.headers.get("x-client-date");
  const now = new Date();
  const todayKey = clientDate && /^\d{4}-\d{2}-\d{2}$/.test(clientDate)
    ? clientDate
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const database = await getDatabase();
  const questsCollection = database.collection("quests");
  const quests = await questsCollection.find({ userId: user._id }).sort({ createdAt: -1 }).toArray();

  // Reset daily quests that were completed on a previous day
  for (const quest of quests) {
    if (quest.type === "Daily" && (quest.completed || quest.status === "completed")) {
      const compDateKey = quest.completedDate
        ? String(quest.completedDate)
        : quest.completedAt
        ? `${new Date(quest.completedAt).getFullYear()}-${String(new Date(quest.completedAt).getMonth() + 1).padStart(2, "0")}-${String(new Date(quest.completedAt).getDate()).padStart(2, "0")}`
        : null;

      if (compDateKey && compDateKey !== todayKey) {
        quest.completed = false;
        quest.status = "active";
        quest.progress = 0;
        quest.due = "Today";

        await questsCollection.updateOne(
          { _id: quest._id },
          {
            $set: {
              completed: false,
              status: "active",
              progress: 0,
              due: "Today",
            },
          }
        );
      }
    }
  }

  const serialized = quests.map((quest) => {
    const response = { ...quest, id: quest._id.toString() } as Record<string, unknown>;
    delete response._id;
    delete response.userId;
    return response;
  });

  return NextResponse.json({ quests: serialized });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 120) return NextResponse.json({ error: "Quest title is required and must be under 120 characters." }, { status: 400 });
    const quest = {
      userId: user._id,
      title,
      description: typeof body.description === "string" ? body.description.trim() : "",
      type: ["Main", "Daily", "Side", "Weekly"].includes(body.type) ? body.type : "Side",
      difficulty: ["Easy", "Medium", "Hard", "Legendary"].includes(body.difficulty) ? body.difficulty : "Easy",
      xp: Number.isFinite(body.xp) ? Math.max(0, Number(body.xp)) : 10,
      gold: Number.isFinite(body.gold) ? Math.max(0, Number(body.gold)) : 5,
      due: typeof body.due === "string" ? body.due : (body.type === "Daily" ? "Today" : "No deadline"),
      progress: 0,
      tag: typeof body.tag === "string" ? body.tag : "Personal",
      pinned: body.pinned === true,
      completed: false,
      status: "active",
      createdAt: new Date(),
    };
    const result = await (await getDatabase()).collection("quests").insertOne(quest);
    return NextResponse.json({ quest: { ...quest, id: result.insertedId.toString() } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create that quest." }, { status: 500 });
  }
}
