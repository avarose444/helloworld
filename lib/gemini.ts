import "server-only";

const API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

type CaptionRequest = {
  imageBase64: string;
  mimeType: string;
  neighborhood: string | null;
  note: string | null;
  count: number;
  avoid?: string[];
};

export function buildCaptionPrompt({ neighborhood, note, count, avoid }: Omit<CaptionRequest, "imageBase64" | "mimeType">) {
  const lines = [
    `You write captions for "Caption the City", an app where college students in New York City post photos from their weekends and vote on the funniest captions.`,
    `Write ${count} captions for the attached photo. Each one should read like an English subtitle from a 1960s French New Wave film (deadpan, dramatic, a little existential), filtered through someone who is extremely online.`,
    `Mix the angles: one moody Godard-style line, one chronically-online joke, one specific observation about New York, and one wildcard.`,
    `Rules: each caption is a single line under 120 characters. Describe what is actually in the photo. Never insult anyone's appearance, identity, or body, and never guess who a real person is. No hashtags, no emoji.`,
  ];
  if (neighborhood) lines.push(`The photo was taken in ${neighborhood}.`);
  if (note) lines.push(`The poster added this context: "${note}"`);
  if (avoid?.length) lines.push(`Do not repeat or closely paraphrase these existing captions:\n${avoid.map((c) => `- ${c}`).join("\n")}`);
  return lines.join("\n\n");
}

// Sends the photo and prompt to Gemini and returns the captions it wrote.
export async function generateCaptions(request: CaptionRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY environment variable.");

  const prompt = buildCaptionPrompt(request);
  const response = await fetch(`${API_URL}/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: request.mimeType, data: request.imageBase64 } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 1,
        responseMimeType: "application/json",
        responseSchema: { type: "ARRAY", items: { type: "STRING" } },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Gemini error", response.status, detail);
    throw new Error(
      response.status === 429
        ? "The caption writer is out of breath (rate limit). Try again in a minute."
        : "The caption writer couldn't read this photo. Try another one."
    );
  }

  const data = await response.json();
  const text: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text;
  let captions: unknown;
  try {
    captions = text ? JSON.parse(text) : null;
  } catch {
    captions = null;
  }

  const cleaned = Array.isArray(captions)
    ? captions
        .filter((c): c is string => typeof c === "string")
        .map((c) => c.trim())
        .filter((c) => c.length > 0 && c.length <= 200)
        .slice(0, request.count)
    : [];

  if (cleaned.length === 0) {
    throw new Error("The caption writer came back empty-handed. Try another photo.");
  }

  return { captions: cleaned, prompt, model: GEMINI_MODEL };
}
