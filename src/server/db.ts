import { MongoClient, Db, Collection } from "mongodb";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { AppendixAKit, GenerationProgress, PracticeReview } from "../../packages/shared/types";

export interface UserDoc {
  _id: string;
  email: string;
  passwordHash: string;
  name?: string;
  createdAt: string;
}

export interface KitDoc extends AppendixAKit {
  _id: string;
  userId: string;
  fingerprint: string;
  generation: GenerationProgress;
  createdAt: string;
  updatedAt: string;
}

export interface PracticeReviewDoc extends PracticeReview {
  _id: string;
}

export interface DatabaseStore {
  users: {
    findByEmail(email: string): Promise<UserDoc | null>;
    findById(id: string): Promise<UserDoc | null>;
    insert(doc: Omit<UserDoc, "_id">): Promise<UserDoc>;
  };
  kits: {
    findByUser(userId: string): Promise<KitDoc[]>;
    findById(id: string, userId: string): Promise<KitDoc | null>;
    findByFingerprint(userId: string, fingerprint: string): Promise<KitDoc | null>;
    insert(doc: Omit<KitDoc, "_id">): Promise<KitDoc>;
    update(id: string, userId: string, update: Partial<KitDoc>): Promise<KitDoc | null>;
    delete(id: string, userId: string): Promise<boolean>;
  };
  practice: {
    recordReview(review: Omit<PracticeReviewDoc, "_id">): Promise<PracticeReviewDoc>;
    getReviewsByKit(kitId: string, userId: string): Promise<PracticeReviewDoc[]>;
  };
}

class MemoryStore implements DatabaseStore {
  private userList: UserDoc[] = [];
  private kitList: KitDoc[] = [];
  private reviewList: PracticeReviewDoc[] = [];

  public users = {
    findByEmail: async (email: string) => {
      return this.userList.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
    },
    findById: async (id: string) => {
      return this.userList.find(u => u._id === id) || null;
    },
    insert: async (doc: Omit<UserDoc, "_id">) => {
      const user: UserDoc = { ...doc, _id: crypto.randomUUID() };
      this.userList.push(user);
      return user;
    },
  };

  public kits = {
    findByUser: async (userId: string) => {
      return this.kitList
        .filter(k => k.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    findById: async (id: string, userId: string) => {
      return this.kitList.find(k => k._id === id && k.userId === userId) || null;
    },
    findByFingerprint: async (userId: string, fingerprint: string) => {
      return this.kitList.find(k => k.userId === userId && k.fingerprint === fingerprint) || null;
    },
    insert: async (doc: Omit<KitDoc, "_id">) => {
      const kit: KitDoc = { ...doc, _id: crypto.randomUUID() };
      this.kitList.push(kit);
      return kit;
    },
    update: async (id: string, userId: string, update: Partial<KitDoc>) => {
      const index = this.kitList.findIndex(k => k._id === id && k.userId === userId);
      if (index === -1) return null;
      this.kitList[index] = {
        ...this.kitList[index],
        ...update,
        updatedAt: new Date().toISOString(),
      };
      return this.kitList[index];
    },
    delete: async (id: string, userId: string) => {
      const index = this.kitList.findIndex(k => k._id === id && k.userId === userId);
      if (index === -1) return false;
      this.kitList.splice(index, 1);
      return true;
    },
  };

  public practice = {
    recordReview: async (review: Omit<PracticeReviewDoc, "_id">) => {
      const item: PracticeReviewDoc = {
        ...review,
        _id: crypto.randomUUID(),
      };
      this.reviewList.push(item);
      return item;
    },
    getReviewsByKit: async (kitId: string, userId: string) => {
      return this.reviewList.filter(r => r.kitId === kitId && r.userId === userId);
    },
  };
}

class MongoDbStore implements DatabaseStore {
  constructor(private db: Db) {}

  public users = {
    findByEmail: async (email: string) => {
      const doc = await this.db.collection<UserDoc>("users").findOne({ email: email.toLowerCase() });
      return doc ? { ...doc, _id: doc._id.toString() } : null;
    },
    findById: async (id: string) => {
      const doc = await this.db.collection<UserDoc>("users").findOne({ _id: id as any });
      return doc ? { ...doc, _id: doc._id.toString() } : null;
    },
    insert: async (doc: Omit<UserDoc, "_id">) => {
      const user: UserDoc = { ...doc, _id: crypto.randomUUID() };
      await this.db.collection("users").insertOne(user as any);
      return user;
    },
  };

  public kits = {
    findByUser: async (userId: string) => {
      const cursor = this.db
        .collection<KitDoc>("kits")
        .find({ userId })
        .sort({ createdAt: -1 });
      const docs = await cursor.toArray();
      return docs.map(d => ({ ...d, _id: d._id.toString() }));
    },
    findById: async (id: string, userId: string) => {
      const doc = await this.db.collection<KitDoc>("kits").findOne({ _id: id as any, userId });
      return doc ? { ...doc, _id: doc._id.toString() } : null;
    },
    findByFingerprint: async (userId: string, fingerprint: string) => {
      const doc = await this.db.collection<KitDoc>("kits").findOne({ userId, fingerprint });
      return doc ? { ...doc, _id: doc._id.toString() } : null;
    },
    insert: async (doc: Omit<KitDoc, "_id">) => {
      const kit: KitDoc = { ...doc, _id: crypto.randomUUID() };
      await this.db.collection("kits").insertOne(kit as any);
      return kit;
    },
    update: async (id: string, userId: string, update: Partial<KitDoc>) => {
      const updated = await this.db.collection<KitDoc>("kits").findOneAndUpdate(
        { _id: id as any, userId },
        { $set: { ...update, updatedAt: new Date().toISOString() } },
        { returnDocument: "after" }
      );
      return updated ? ({ ...updated, _id: updated._id.toString() } as KitDoc) : null;
    },
    delete: async (id: string, userId: string) => {
      const res = await this.db.collection("kits").deleteOne({ _id: id as any, userId });
      return (res.deletedCount ?? 0) > 0;
    },
  };

  public practice = {
    recordReview: async (review: Omit<PracticeReviewDoc, "_id">) => {
      const doc: PracticeReviewDoc = { ...review, _id: crypto.randomUUID() };
      await this.db.collection("practice_reviews").insertOne(doc as any);
      return doc;
    },
    getReviewsByKit: async (kitId: string, userId: string) => {
      const cursor = this.db.collection<PracticeReviewDoc>("practice_reviews").find({ kitId, userId });
      const docs = await cursor.toArray();
      return docs.map(d => ({ ...d, _id: d._id.toString() }));
    },
  };
}

let storeInstance: DatabaseStore | null = null;

export async function getDbStore(): Promise<DatabaseStore> {
  if (storeInstance) return storeInstance;

  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    try {
      const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 2000 });
      await client.connect();
      const db = client.db();
      storeInstance = new MongoDbStore(db);
      console.log("[Database] Connected successfully to MongoDB.");
      return storeInstance;
    } catch (e: any) {
      console.warn(`[Database] Could not connect to MongoDB (${e.message}). Falling back to in-memory store.`);
    }
  }

  storeInstance = new MemoryStore();
  return storeInstance;
}
