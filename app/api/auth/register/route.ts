import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { createSession, publicUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (username.length < 2 || username.length > 30) return NextResponse.json({ error: "Username must be 2-30 characters." }, { status: 400 });
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

    const database = await getDatabase();
    const users = database.collection("users");
    const existing = await users.findOne({ $or: [{ email }, { username }] });
    if (existing) return NextResponse.json({ error: "That username or email is already registered." }, { status: 409 });
    const user = { username, email, passwordHash: await hash(password, 12), level: 1, xp: 0, gold: 0, streak: 0, createdAt: new Date() };
    const result = await users.insertOne(user);
    const createdUser = { _id: result.insertedId, ...user };
    await createSession(result.insertedId);
    return NextResponse.json({ user: publicUser(createdUser) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create your account right now." }, { status: 500 });
  }
}
