import { MongoClient } from "mongodb";

const options = {
  maxPoolSize: 5,
  maxIdleTimeMS: 20000,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
};

type MongoGlobal = typeof globalThis & { _mongoClientPromise?: Promise<MongoClient> };
const globalWithMongo = globalThis as MongoGlobal;

function getClientPromise() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured");
  return globalWithMongo._mongoClientPromise ?? new MongoClient(uri, options).connect();
}

export async function getDatabase() {
  const clientPromise = getClientPromise();
  if (process.env.NODE_ENV !== "production") globalWithMongo._mongoClientPromise = clientPromise;
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB ?? "questlife");
}
