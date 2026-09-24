import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { ObjectId } from "mongodb";
import { getDatabase } from "./mongodb";

const cookieName = "questlife_session";
export type UserDocument = { _id: ObjectId; username: string; email: string; passwordHash: string; level: number; xp: number; gold: number; streak: number; createdAt: Date };

function getKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return new TextEncoder().encode(secret);
}

export async function createSession(userId: ObjectId) {
  const token = await new SignJWT({ userId: userId.toString() }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(getKey());
  const cookieStore = await cookies();
  cookieStore.set(cookieName, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7 });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getKey());
    if (typeof payload.userId !== "string" || !ObjectId.isValid(payload.userId)) return null;
    const database = await getDatabase();
    return database.collection<UserDocument>("users").findOne({ _id: new ObjectId(payload.userId) }, { projection: { passwordHash: 0 } });
  } catch {
    return null;
  }
}

export function publicUser(user: Pick<UserDocument, "_id" | "username" | "email" | "level" | "xp" | "gold" | "streak">) {
  return { id: user._id.toString(), username: user.username, email: user.email, level: user.level, xp: user.xp, gold: user.gold, streak: user.streak };
}
