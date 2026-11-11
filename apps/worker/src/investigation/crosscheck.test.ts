import { describe, expect, it } from "vitest";
import { buildSourceFamilies, parseCrosscheck } from "./crosscheck.ts";

describe("investigation cross-source analysis", () => {
  it("parses a proposed lead with cited evidence records", () => {
    const result = parseCrosscheck(JSON.stringify({
      leads: [{
        title: "Comparer deux horaires rapportés",
        verification_question: "Les horaires concernent-ils le même événement ?",
        confidence: "moderate",
        next_check: "Vérifier les horodatages des deux pièces originales.",
        evidence: [
          { record_id: "11111111-1111-4111-8111-111111111111", role: "support", quote: "Le témoin situe le départ vers 18 heures." },
          { record_id: "22222222-2222-4222-8222-222222222222", role: "contrary", quote: "Le rapport indique une observation vers 19 heures." },
        ],
      }],
    }));
    expect(result.leads).toHaveLength(1);
    expect(result.leads[0].evidence).toHaveLength(2);
  });

  it("rejects malformed output and unsupported evidence roles", () => {
    expect(() => parseCrosscheck("not json")).toThrow();
    expect(() => parseCrosscheck(JSON.stringify({
      leads: [{
        title: "Piste", verification_question: "Question ?", confidence: "high", next_check: "Comparer les sources.",
        evidence: [{ record_id: "11111111-1111-4111-8111-111111111111", role: "suspect", quote: "Une citation suffisamment longue." }],
      }],
    }))).toThrow();
  });

  it("treats copies, translations and derivatives in one lineage chain as one origin", () => {
    const families = buildSourceFamilies(
      ["source-a", "source-b", "source-c", "source-independent"],
      [
        { parent_source_id: "source-a", child_source_id: "source-copy" },
        { parent_source_id: "source-copy", child_source_id: "source-b" },
        { parent_source_id: "source-b", child_source_id: "source-c" },
      ],
    );
    expect(families.get("source-a")).toBe(families.get("source-b"));
    expect(families.get("source-b")).toBe(families.get("source-c"));
    expect(families.get("source-a")).not.toBe(families.get("source-independent"));
  });

  it("keeps unrelated sources as independent origins", () => {
    const families = buildSourceFamilies(["source-a", "source-b"], []);
    expect(families.get("source-a")).not.toBe(families.get("source-b"));
  });

  it("accepts an empty result when no documentary lead is supported", () => {
    expect(parseCrosscheck('{"leads":[]}').leads).toEqual([]);
  });
});
