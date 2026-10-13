import { NextResponse } from "next/server";
import { getCurrentUser, publicUser } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });

  // Calculate today and yesterday based on client header or server date
  const clientDate = request.headers.get("x-client-date");
  const now = new Date();
  const todayKey = clientDate && /^\d{4}-\d{2}-\d{2}$/.test(clientDate)
    ? clientDate
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const [y, m, d] = todayKey.split("-").map(Number);
  const yesterday = new Date(y, m - 1, d);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  // If the user's last streak activity was before yesterday, streak is broken
  if (user.lastStreakDate && user.lastStreakDate < yesterdayKey && user.streak > 0) {
    const database = await getDatabase();
    await database.collection("users").updateOne({ _id: user._id }, { $set: { streak: 0 } });
    user.streak = 0;
  }

  return NextResponse.json({ user: publicUser(user) });
}
