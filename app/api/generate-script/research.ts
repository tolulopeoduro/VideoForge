/**
 * ZeroTrack Deep Research Engine
 * Performs autonomous live encyclopedic research, fact-mining, and entity detection
 * without requiring any paid third-party API keys.
 */

export interface ResearchDossier {
  query: string;
  sources: Array<{
    title: string;
    description?: string;
    extract: string;
    url: string;
  }>;
  facts: Array<{
    claim: string;
    source: string;
    stat?: string;
  }>;
  detectedEntities: Array<{
    name: string;
    type: "brand" | "person" | "standard" | "concept";
  }>;
  aggregatedContext: string;
}

export async function performDeepTopicResearch(query: string): Promise<ResearchDossier> {
  const cleanQuery = query
    .replace(/^(how do|how does|what is|why do|why does|tell me about|explain|who is|can you)\s+/i, "")
    .trim();

  const searchTerms = [
    cleanQuery,
    cleanQuery.split(" ").slice(0, 4).join(" "),
  ].filter(Boolean);

  const sources: ResearchDossier["sources"] = [];
  const visitedTitles = new Set<string>();

  for (const term of searchTerms) {
    if (sources.length >= 3) break;
    try {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        term
      )}&utf8=&format=json&limit=4`;

      const searchRes = await fetch(searchUrl, {
        headers: { "User-Agent": "ZeroTrack-AI-Studio/1.0 (academic/research; contact@zerotrack.studio)" },
      });

      if (!searchRes.ok) continue;
      const searchData = await searchRes.json();
      const hits = searchData?.query?.search || [];

      for (const hit of hits) {
        if (sources.length >= 3) break;
        if (visitedTitles.has(hit.title)) continue;
        visitedTitles.add(hit.title);

        try {
          const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
            hit.title
          )}`;
          const summaryRes = await fetch(summaryUrl, {
            headers: { "User-Agent": "ZeroTrack-AI-Studio/1.0" },
          });

          if (summaryRes.ok) {
            const summaryData = await summaryRes.json();
            if (summaryData.extract && summaryData.extract.length > 60) {
              sources.push({
                title: hit.title,
                description: summaryData.description || hit.snippet?.replace(/<[^>]+>/g, ""),
                extract: summaryData.extract,
                url: summaryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title)}`,
              });
            }
          }
        } catch (e) {
          console.warn(`Failed to fetch summary for ${hit.title}:`, e);
        }
      }
    } catch (e) {
      console.warn(`Failed search for term "${term}":`, e);
    }
  }

  // Extract facts with numbers, years, percentages, or measurements
  const facts: ResearchDossier["facts"] = [];
  const allSentences: string[] = [];

  for (const src of sources) {
    const sentences = src.extract.match(/[^.!?]+[.!?]+/g) || [];
    for (const sent of sentences) {
      const trimmed = sent.trim();
      allSentences.push(trimmed);

      // Match numbers, years (19xx, 20xx), percentages, units
      const statMatch = trimmed.match(
        /\b(\d+(?:,\d+)*(?:\.\d+)?(?:\s*(?:%|percent|billion|million|trillion|bits?|qubits?|km|mph|sec|seconds|x|times|years?))\b|\b(?:19|20)\d{2}\b)/i
      );

      if (statMatch && facts.length < 6) {
        facts.push({
          claim: trimmed,
          source: src.title,
          stat: statMatch[1],
        });
      }
    }
  }

  // Detect proper nouns & entities
  const detectedEntities: ResearchDossier["detectedEntities"] = [];
  const entitySet = new Set<string>();

  for (const src of sources) {
    if (entitySet.has(src.title)) continue;
    entitySet.add(src.title);

    let type: ResearchDossier["detectedEntities"][0]["type"] = "concept";
    if (/nist|ieee|iso|gchq|nsa|fbi|fda|who/i.test(src.title)) type = "standard";
    else if (/google|ibm|microsoft|apple|nvidia|amazon|meta|openai/i.test(src.title)) type = "brand";
    else if (/rivest|shamir|adleman|shor|turing|newton|einstein|feynman/i.test(src.title)) type = "person";

    detectedEntities.push({
      name: src.title,
      type,
    });
  }

  const aggregatedContext = sources
    .map((s) => `### Source: ${s.title}\n${s.extract}`)
    .join("\n\n");

  return {
    query,
    sources,
    facts,
    detectedEntities,
    aggregatedContext,
  };
}
