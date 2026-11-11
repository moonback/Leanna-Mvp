import { describe, expect, it } from "vitest";
import { exactQuoteOffset, parseExtraction } from "./extract.ts";

describe("investigation extraction", () => {
  it("parses the strict structured extraction contract", () => {
    const result = parseExtraction(JSON.stringify({
      entities: [{ entity_type: "person", label: "Alice", quote: "Alice a été vue mardi." }],
      events: [{ title: "Observation", description: "Une observation est rapportée.", original_date_text: "mardi", date_precision: "exact", quote: "Alice a été vue mardi." }],
      statements: [{ statement_type: "testimony", content: "Alice a été vue mardi.", speaker_label: "Témoin A", quote: "Alice a été vue mardi." }],
    }));
    expect(result.entities).toHaveLength(1);
    expect(result.events[0].original_date_text).toBe("mardi");
    expect(result.statements[0].statement_type).toBe("testimony");
  });

  it("accepts JSON wrapped in a Markdown code fence", () => {
    expect(parseExtraction('```json\n{"entities":[],"events":[],"statements":[]}\n```').entities).toEqual([]);
  });

  it("rejects unsupported categories and malformed model output", () => {
    expect(() => parseExtraction('{"entities":[{"entity_type":"suspect","label":"X","quote":"Une citation suffisamment longue."}],"events":[],"statements":[]}')).toThrow();
    expect(() => parseExtraction("not json")).toThrow();
  });

  it("requires the exact quote to exist in the original passage", () => {
    const passage = "Le témoin indique : Alice a été vue mardi soir.";
    expect(exactQuoteOffset(passage, "Alice a été vue mardi")).toBeGreaterThanOrEqual(0);
    expect(exactQuoteOffset(passage, "Alice aurait été vue mardi")).toBe(-1);
    expect(exactQuoteOffset("Alice est partie. Puis Alice est revenue.", "Alice")).toBe(-1);
  });
});
