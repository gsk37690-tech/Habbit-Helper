import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { createSession, publicUser, UserDocument } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const user = await (await getDatabase()).collection<UserDocument>("users").findOne({ email });
    if (!user || typeof user.passwordHash !== "string" || !(await compare(password, user.passwordHash))) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    await createSession(user._id);
    return NextResponse.json({ user: publicUser(user) });
  } catch {
    return NextResponse.json({ error: "Unable to sign you in right now." }, { status: 500 });
  }
}
