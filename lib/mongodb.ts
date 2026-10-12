import { MongoClient, ObjectId, type Db, type Document, type Collection } from "mongodb";
import { hashSync } from "bcryptjs";

const options = {
  maxPoolSize: 5,
  maxIdleTimeMS: 20000,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
};

type StoredDoc = Document & { _id?: ObjectId | string; [key: string]: unknown };

class MemoryCollection<TSchema extends StoredDoc = StoredDoc> {
  private docs: TSchema[];

  constructor(initialDocs: TSchema[] = []) {
    this.docs = [...initialDocs];
  }

  private matches(doc: TSchema, query: Record<string, unknown>): boolean {
    if (query.$or && Array.isArray(query.$or)) {
      return query.$or.some(
        (subQuery) =>
          typeof subQuery === "object" && subQuery !== null && this.matches(doc, subQuery as Record<string, unknown>)
      );
    }

    for (const [key, value] of Object.entries(query)) {
      if (key === "$or") continue;
      const docVal = doc[key];

      if (value === undefined) continue;

      if (value instanceof ObjectId || (value && typeof value === "object" && "_bsontype" in value)) {
        if (!docVal) return false;
        if (String(docVal) !== value.toString()) return false;
      } else if (docVal instanceof ObjectId) {
        if (docVal.toString() !== String(value)) return false;
      } else if (typeof value === "string" && typeof docVal === "string") {
        if (key === "email") {
          if (docVal.toLowerCase() !== value.toLowerCase()) return false;
        } else {
          if (docVal !== value) return false;
        }
      } else if (docVal !== value) {
        return false;
      }
    }
    return true;
  }

  async findOne(
    query: Record<string, unknown>,
    options?: { projection?: Record<string, number> }
  ): Promise<TSchema | null> {
    const found = this.docs.find((d) => this.matches(d, query));
    if (!found) return null;
    const cloned = { ...found };
    if (options?.projection) {
      for (const [projKey, projVal] of Object.entries(options.projection)) {
        if (projVal === 0) {
          delete cloned[projKey];
        }
      }
    }
    return cloned;
  }

  find(query: Record<string, unknown>) {
    const results = this.docs.filter((d) => this.matches(d, query)).map((d) => ({ ...d }));

    return {
      sort: (sortObj: Record<string, number>) => {
        const sortField = Object.keys(sortObj)[0];
        const dir = sortObj[sortField] ?? 1;
        results.sort((a, b) => {
          const valA = a[sortField];
          const valB = b[sortField];
          const timeA = valA instanceof Date ? valA.getTime() : typeof valA === "number" ? valA : 0;
          const timeB = valB instanceof Date ? valB.getTime() : typeof valB === "number" ? valB : 0;
          if (timeA < timeB) return -1 * dir;
          if (timeA > timeB) return 1 * dir;
          return 0;
        });
        return {
          toArray: async (): Promise<TSchema[]> => [...results],
        };
      },
      toArray: async (): Promise<TSchema[]> => [...results],
    };
  }

  async insertOne(doc: TSchema): Promise<{ insertedId: ObjectId }> {
    const docToInsert = { ...doc };
    if (!docToInsert._id) {
      docToInsert._id = new ObjectId();
    }
    this.docs.push(docToInsert);
    return { insertedId: docToInsert._id as ObjectId };
  }

  async updateOne(
    query: Record<string, unknown>,
    update: Record<string, unknown>
  ): Promise<{ modifiedCount: number }> {
    const index = this.docs.findIndex((d) => this.matches(d, query));
    if (index === -1) return { modifiedCount: 0 };
    const doc = this.docs[index] as Record<string, unknown>;
    if (update.$set && typeof update.$set === "object") {
      Object.assign(doc, update.$set);
    }
    if (update.$inc && typeof update.$inc === "object") {
      for (const [k, v] of Object.entries(update.$inc)) {
        const current = typeof doc[k] === "number" ? (doc[k] as number) : 0;
        doc[k] = current + Number(v);
      }
    }
    return { modifiedCount: 1 };
  }

  async findOneAndUpdate(
    query: Record<string, unknown>,
    update: Record<string, unknown>
  ): Promise<TSchema | null> {
    const index = this.docs.findIndex((d) => this.matches(d, query));
    if (index === -1) return null;
    const doc = this.docs[index] as Record<string, unknown>;
    if (update.$set && typeof update.$set === "object") {
      Object.assign(doc, update.$set);
    }
    if (update.$inc && typeof update.$inc === "object") {
      for (const [k, v] of Object.entries(update.$inc)) {
        const current = typeof doc[k] === "number" ? (doc[k] as number) : 0;
        doc[k] = current + Number(v);
      }
    }
    return { ...this.docs[index] };
  }

  async deleteOne(query: Record<string, unknown>): Promise<{ deletedCount: number }> {
    const index = this.docs.findIndex((d) => this.matches(d, query));
    if (index === -1) return { deletedCount: 0 };
    this.docs.splice(index, 1);
    return { deletedCount: 1 };
  }
}

function createInitialData() {
  const demoUserId = new ObjectId("650000000000000000000001");
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  const users: StoredDoc[] = [
    {
      _id: demoUserId,
      username: "Wayfinder",
      email: "wayfinder@questlife.com",
      passwordHash: hashSync("wayfinder123", 10),
      level: 3,
      xp: 350,
      gold: 125,
      streak: 5,
      lastStreakDate: yesterdayKey,
      createdAt: new Date(),
    },
  ];

  const quests: StoredDoc[] = [
    {
      _id: new ObjectId("650000000000000000000101"),
      userId: demoUserId,
      title: "The Morning Rite: Clear the Mind",
      description: "Spend 10 minutes meditating and organizing today's quest objectives.",
      type: "Daily",
      difficulty: "Easy",
      xp: 50,
      gold: 20,
      due: "Today",
      progress: 0,
      tag: "Rituals",
      pinned: true,
      completed: false,
      status: "active",
      createdAt: new Date(),
    },
    {
      _id: new ObjectId("650000000000000000000102"),
      userId: demoUserId,
      title: "Conquer the Ancient Code Fortress",
      description: "Implement core business features and resolve high-priority backlog bugs.",
      type: "Main",
      difficulty: "Hard",
      xp: 200,
      gold: 80,
      due: "Tomorrow",
      progress: 0,
      tag: "Focus",
      pinned: false,
      completed: false,
      status: "active",
      createdAt: new Date(),
    },
    {
      _id: new ObjectId("650000000000000000000103"),
      userId: demoUserId,
      title: "Hydration Potion: 8 Goblets of Water",
      description: "Keep stamina high with regular hydration throughout the workday.",
      type: "Daily",
      difficulty: "Easy",
      xp: 30,
      gold: 15,
      due: "Today",
      progress: 0,
      tag: "Stamina",
      pinned: false,
      completed: false,
      status: "active",
      createdAt: new Date(),
    },
    {
      _id: new ObjectId("650000000000000000000104"),
      userId: demoUserId,
      title: "Weekly Review: Assess Battle Log",
      description: "Reflect on accomplishments, claim rewards, and plan the campaign ahead.",
      type: "Weekly",
      difficulty: "Medium",
      xp: 120,
      gold: 50,
      due: "In 3 days",
      progress: 0,
      tag: "Planning",
      pinned: false,
      completed: false,
      status: "active",
      createdAt: new Date(),
    },
  ];

  return {
    users: new MemoryCollection(users),
    quests: new MemoryCollection(quests),
    generic: new Map<string, MemoryCollection>(),
  };
}

type MongoGlobal = typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
  _memoryCollections?: ReturnType<typeof createInitialData>;
};
const globalWithMongo = globalThis as MongoGlobal;

function getMemoryDatabase(): Db {
  if (!globalWithMongo._memoryCollections) {
    globalWithMongo._memoryCollections = createInitialData();
  }
  const dbMock = {
    collection: <TSchema extends Document = Document>(name: string): Collection<TSchema> => {
      const collections = globalWithMongo._memoryCollections!;
      if (name === "users") return collections.users as unknown as Collection<TSchema>;
      if (name === "quests") return collections.quests as unknown as Collection<TSchema>;
      if (!collections.generic.has(name)) {
        collections.generic.set(name, new MemoryCollection());
      }
      return collections.generic.get(name)! as unknown as Collection<TSchema>;
    },
  };
  return dbMock as unknown as Db;
}

export async function getDatabase(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return getMemoryDatabase();
  }

  try {
    if (!globalWithMongo._mongoClientPromise) {
      globalWithMongo._mongoClientPromise = new MongoClient(uri, options).connect();
    }
    const client = await globalWithMongo._mongoClientPromise;
    return client.db(process.env.MONGODB_DB ?? "questlife");
  } catch (error) {
    console.warn("[QuestLife] MongoDB connection failed, falling back to in-memory store:", error);
    return getMemoryDatabase();
  }
}

export { ObjectId };
