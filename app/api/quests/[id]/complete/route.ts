import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getCurrentUser, publicUser, type UserDocument } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await context.params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid quest id." }, { status: 400 });

  const database = await getDatabase();
  const questsCollection = database.collection("quests");
  const usersCollection = database.collection<UserDocument>("users");

  const quest = await questsCollection.findOne({ _id: new ObjectId(id), userId: user._id });
  if (!quest) return NextResponse.json({ error: "Quest not found." }, { status: 404 });
  if (quest.completed || quest.status === "completed") {
    return NextResponse.json({
      quest: { ...quest, id: quest._id.toString() },
      reward: null,
      user: publicUser(user),
    });
  }

  const now = new Date();
  const clientDate = request.headers.get("x-client-date");
  const todayKey = clientDate && /^\d{4}-\d{2}-\d{2}$/.test(clientDate)
    ? clientDate
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const [y, m, d] = todayKey.split("-").map(Number);
  const yesterday = new Date(y, m - 1, d);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  // Complete the quest
  await questsCollection.updateOne(
    { _id: quest._id },
    {
      $set: {
        completed: true,
        status: "completed",
        completedAt: now,
        completedDate: todayKey,
        progress: 100,
      },
    }
  );

  // Calculate streak progression
  const currentStreak = typeof user.streak === "number" ? user.streak : 0;
  let newStreak = 1;
  if (user.lastStreakDate === todayKey) {
    // Already completed a quest today; preserve streak
    newStreak = Math.max(1, currentStreak);
  } else if (user.lastStreakDate === yesterdayKey) {
    // Completed a quest yesterday; streak increments by 1!
    newStreak = currentStreak + 1;
  } else {
    // First time or broken streak; starts at 1
    newStreak = 1;
  }

  const newXp = (user.xp || 0) + quest.xp;
  const newGold = (user.gold || 0) + quest.gold;
  const newLevel = Math.max(user.level || 1, Math.floor(newXp / 500) + 1);

  await usersCollection.updateOne(
    { _id: user._id },
    {
      $set: {
        xp: newXp,
        gold: newGold,
        level: newLevel,
        streak: newStreak,
        lastStreakDate: todayKey,
      },
    }
  );

  const updatedUser: UserDocument = {
    ...user,
    xp: newXp,
    gold: newGold,
    level: newLevel,
    streak: newStreak,
    lastStreakDate: todayKey,
  };

  return NextResponse.json({
    quest: {
      ...quest,
      id: quest._id.toString(),
      completed: true,
      status: "completed",
      completedAt: now,
      completedDate: todayKey,
      progress: 100,
    },
    reward: { xp: quest.xp, gold: quest.gold },
    user: publicUser(updatedUser),
  });
}
