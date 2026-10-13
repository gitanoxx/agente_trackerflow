import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export class ConversationStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.items = new Map();
    this.pendingWrite = Promise.resolve();
  }

  async init() {
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      const raw = JSON.parse(await readFile(this.filePath, "utf8"));
      for (const item of raw.conversations ?? []) this.items.set(item.id, item);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  list() {
    return [...this.items.values()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(({ messages, ...item }) => ({ ...item, messageCount: messages.length }));
  }

  get(id) {
    return this.items.get(id) ?? null;
  }

  async create() {
    const now = new Date().toISOString();
    const conversation = {
      id: randomUUID(),
      status: "RECOPILANDO_INFORMACION",
      createdAt: now,
      updatedAt: now,
      summary: "",
      messages: []
    };
    this.items.set(conversation.id, conversation);
    await this.save();
    return conversation;
  }

  async addMessage(id, role, text) {
    const conversation = this.get(id);
    if (!conversation) return null;
    conversation.messages.push({ id: randomUUID(), role, text, createdAt: new Date().toISOString() });
    conversation.updatedAt = new Date().toISOString();
    await this.save();
    return conversation;
  }

  async setSummary(id, summary) {
    const conversation = this.get(id);
    if (!conversation) return null;
    conversation.summary = summary;
    conversation.updatedAt = new Date().toISOString();
    await this.save();
    return conversation;
  }

  async save() {
    this.pendingWrite = this.pendingWrite.then(async () => {
      const tempPath = `${this.filePath}.tmp`;
      const value = JSON.stringify({ conversations: [...this.items.values()] }, null, 2);
      await writeFile(tempPath, value, { mode: 0o600 });
      await rename(tempPath, this.filePath);
    });
    return this.pendingWrite;
  }
}
