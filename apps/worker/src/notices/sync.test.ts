import { describe, expect, it } from "vitest";
import { parseFeed } from "./sync.ts";

describe("parseFeed — veille des avis", () => {
  it("extrait uniquement les publications pertinentes du domaine officiel", () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <item>
          <title>Avis de recherche — enfant disparu</title>
          <link>https://www.116000enfantsdisparus.fr/avis-de-recherche/exemple/</link>
          <guid>notice-123</guid>
          <description><![CDATA[Publication officielle de l'avis de recherche.]]></description>
          <pubDate>Tue, 10 Nov 2026 10:00:00 GMT</pubDate>
        </item>
        <item>
          <title>Article sans rapport</title>
          <link>https://www.116000enfantsdisparus.fr/actualites/article/</link>
          <guid>news-123</guid>
          <description>Actualité générale.</description>
        </item>
        <item>
          <title>Avis de recherche externe</title>
          <link>https://example.org/avis-de-recherche/</link>
          <guid>external-123</guid>
          <description>Ne doit pas être importé.</description>
        </item>
      </channel></rss>`;
    expect(parseFeed(xml)).toEqual([{
      id: "notice-123",
      url: "https://www.116000enfantsdisparus.fr/avis-de-recherche/exemple/",
      title: "Avis de recherche — enfant disparu",
      excerpt: "Publication officielle de l'avis de recherche.",
      publishedAt: "2026-11-10T10:00:00.000Z",
    }]);
  });

  it("retourne une liste vide pour un flux valide sans avis", () => {
    expect(parseFeed("<rss><channel><item><title>Actualité</title><link>https://www.116000enfantsdisparus.fr/news/</link></item></channel></rss>")).toEqual([]);
  });

  it("ignore les liens non HTTPS et les domaines ressemblants", () => {
    const xml = `<rss><channel>
      <item><title>Disparition</title><link>http://www.116000enfantsdisparus.fr/avis</link></item>
      <item><title>Disparition</title><link>https://www.116000enfantsdisparus.fr.evil.test/avis</link></item>
    </channel></rss>`;
    expect(parseFeed(xml)).toEqual([]);
  });
});
