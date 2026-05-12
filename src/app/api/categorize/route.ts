import { NextRequest, NextResponse } from "next/server";
import { categorizeByRules } from "@/lib/categorizer/rules";

export async function POST(request: NextRequest) {
  const { merchants, categories } = await request.json() as {
    merchants: string[];
    categories: Array<{ name: string; type: string }>;
  };

  if (!merchants?.length) {
    return NextResponse.json({ results: [] });
  }

  // First try rule-based (free, instant)
  const results: Array<{ merchant: string; category: string | null }> = [];
  const unknowns: string[] = [];

  for (const merchant of merchants) {
    const cat = categorizeByRules(merchant);
    if (cat) {
      results.push({ merchant, category: cat });
    } else {
      unknowns.push(merchant);
      results.push({ merchant, category: null });
    }
  }

  // For unknowns, use Groq API if available
  const apiKey = process.env.GROQ_API_KEY;
  if (unknowns.length && apiKey) {
    try {
      const categoryList = categories.map((c) => c.name).join(", ");
      const prompt = `Categorize the following Russian merchant/transaction names into one of these expense or income categories: ${categoryList}.

Respond ONLY with a JSON object mapping each merchant name to the most fitting category name. If none fit, use null.

Merchants: ${JSON.stringify(unknowns)}`;

      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 500,
          temperature: 0,
          response_format: { type: "json_object" },
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content ?? "{}";
        const mapping = JSON.parse(content) as Record<string, string | null>;

        for (const result of results) {
          if (result.category === null && mapping[result.merchant] !== undefined) {
            result.category = mapping[result.merchant];
          }
        }
      }
    } catch {
      // Groq unavailable — return rule-based results only
    }
  }

  return NextResponse.json({ results });
}
