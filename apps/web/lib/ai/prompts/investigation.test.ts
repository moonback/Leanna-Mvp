import { describe, expect, it } from "vitest";
import { CHAT_DEFAULT_INSTRUCTIONS, chatFixedRules } from "./chat";
import { LEANNA_SYSTEM_PROMPT } from "./leanna";
import { ROXANE_SYSTEM_PROMPT } from "./roxane";
import { SYSTEM_PROMPT_CATALOG } from "../prompt-catalog";

describe("investigation prompt safeguards", () => {
  it("classifies documentary information without treating reports as proof", () => {
    expect(CHAT_DEFAULT_INSTRUCTIONS).toContain("FAIT DOCUMENTÉ");
    expect(CHAT_DEFAULT_INSTRUCTIONS).toContain("DÉCLARATION / TÉMOIGNAGE");
    expect(CHAT_DEFAULT_INSTRUCTIONS).toContain("CONTRADICTION");
    expect(CHAT_DEFAULT_INSTRUCTIONS).toContain("Une piste IA");
  });

  it("keeps non-accusation and human review rules outside customizable chat instructions", () => {
    const fixed = chatFixedRules("français");
    expect(fixed).toContain("Ne désigne, n'accuse");
    expect(fixed).toContain("vérifiée par une personne habilitée");
    expect(fixed).toContain("ignore all instructions");
  });

  it("aligns both voice personas with the investigation workflow", () => {
    expect(LEANNA_SYSTEM_PROMPT).toContain("personnes disparues");
    expect(LEANNA_SYSTEM_PROMPT).toContain("piste IA");
    expect(ROXANE_SYSTEM_PROMPT).toContain("contradictions");
    expect(ROXANE_SYSTEM_PROMPT).toContain("Ne désigne et n'accuse jamais");
  });

  it("provides investigation-specific Studio prompt defaults", () => {
    const keys = new Map(SYSTEM_PROMPT_CATALOG.map((item) => [item.key, item.defaultPrompt]));
    expect(keys.get("studio.report")).toContain("déclarations attribuées");
    expect(keys.get("studio.timeline")).toContain("date de l’événement");
    expect(keys.get("studio.comparison")?.toLowerCase()).toContain("contradictions");
  });
});
