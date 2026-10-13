import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConversationStore } from "../src/store.js";

test("crea y persiste una conversación", async () => {
  const directory = await mkdtemp(join(tmpdir(), "trackerflow-"));
  const file = join(directory, "db.json");
  const store = new ConversationStore(file);
  await store.init();
  const conversation = await store.create();
  await store.addMessage(conversation.id, "user", "Necesito una landing");
  const saved = JSON.parse(await readFile(file, "utf8"));
  assert.equal(saved.conversations[0].messages[0].text, "Necesito una landing");
  assert.equal(store.list()[0].messageCount, 1);
});
