import test from "node:test";
import assert from "node:assert/strict";
import { TRACKERFLOW_PROMPT } from "../src/prompt.js";

test("el prompt contiene las reglas comerciales críticas", () => {
  for (const value of ["$65.000 CLP", "3 días hábiles", "$30.000 CLP", "50%", "dominio .cl", "exclusivamente"]) {
    assert.match(TRACKERFLOW_PROMPT, new RegExp(value.replace(/[.$]/g, "\\$&"), "i"));
  }
});
