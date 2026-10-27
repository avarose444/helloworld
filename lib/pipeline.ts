import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Caption generation driven by the database: the prompt chain (picked by
// prompt_chain_mix weights), its steps, models, terms and examples all come
// from Supabase, and every request and model call is logged to
// generation_requests / llm_responses. If the pipeline tables are missing or
// empty, it falls back to the built-in chain below so posting never breaks.
// Shared by Caption the City and its admin area; keep the two copies in sync.

const DEFAULT_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const FALLBACK_MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-2.5-flash"];

const FALLBACK_TEMPLATE = `You write captions for "Caption the City", an app where college students in New York City post photos from their weekends and vote on the funniest captions.

Write {{count}} captions for the attached photo. Each one should read like an English subtitle from a 1960s French New Wave film (deadpan, dramatic, a little existential), filtered through someone who is extremely online.

Mix the angles: one moody Godard-style line, one chronically-online joke, one specific observation about New York, and one wildcard.

Rules: each caption is a single line under 120 characters. Describe what is actually in the photo. Never insult anyone's appearance, identity, or body, and never guess who a real person is. No hashtags, no emoji.

{{neighborhood}}
{{note}}
{{terms}}
{{examples}}
{{avoid}}`;

type Model = { api_model_id: string; temperature: number };
type Step = { step_order: number; title: string; include_image: boolean; output_json: boolean; prompt_template: string; model: Model | null };
type Chain = { id: string | null; name: string; steps: Step[] };

type Pipeline = {
  chain: Chain;
  models: Model[];
  apiUrl: string;
  terms: { term: string; definition: string }[];
  examples: { scene: string; caption: string }[];
};

export type GenerateRequest = {
  supabase: SupabaseClient;
  userId: string;
  source: "post" | "more" | "admin";
  photoId?: string | null;
  imageBase64: string;
  mimeType: string;
  neighborhood: string | null;
  note: string | null;
  count: number;
  avoid?: string[];
};

function pickWeighted<T extends { weight: number }>(items: T[]) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll < 0) return item;
  }
  return items[items.length - 1];
}

async function loadPipeline(supabase: SupabaseClient): Promise<Pipeline> {
  const fallback: Pipeline = {
    chain: {
      id: null,
      name: "Built-in fallback",
      steps: [{ step_order: 1, title: "Write subtitles", include_image: true, output_json: true, prompt_template: FALLBACK_TEMPLATE, model: null }],
    },
    models: FALLBACK_MODELS.map((api_model_id) => ({ api_model_id, temperature: 1 })),
    apiUrl: DEFAULT_API_URL,
    terms: [],
    examples: [],
  };

  try {
    const [mix, models, terms, examples] = await Promise.all([
      supabase
        .from("prompt_chain_mix")
        .select("weight, llm_prompt_chains!inner (id, name, is_active, llm_prompt_chain_steps (step_order, title, include_image, output_json, prompt_template, llm_models (api_model_id, temperature, is_active)))")
        .gt("weight", 0),
      supabase
        .from("llm_models")
        .select("api_model_id, temperature, llm_providers (base_url)")
        .eq("is_active", true)
        .order("priority"),
      supabase.from("terms").select("term, definition").eq("is_active", true).limit(12),
      supabase.from("generation_examples").select("scene, caption").eq("is_active", true).limit(6),
    ]);
    if (mix.error || models.error) return fallback;

    type MixRow = {
      weight: number;
      llm_prompt_chains: {
        id: string;
        name: string;
        is_active: boolean;
        llm_prompt_chain_steps: (Omit<Step, "model"> & { llm_models: (Model & { is_active: boolean }) | null })[];
      };
    };
    const candidates = ((mix.data ?? []) as unknown as MixRow[]).filter(
      (m) => m.llm_prompt_chains.is_active && m.llm_prompt_chains.llm_prompt_chain_steps.length > 0,
    );
    const modelRows = (models.data ?? []) as unknown as (Model & { llm_providers: { base_url: string | null } | null })[];
    if (!candidates.length || !modelRows.length) return { ...fallback, terms: terms.data ?? [], examples: examples.data ?? [] };

    const picked = pickWeighted(candidates).llm_prompt_chains;
    const steps = [...picked.llm_prompt_chain_steps]
      .sort((a, b) => a.step_order - b.step_order)
      .map(({ llm_models: m, ...s }) => ({ ...s, model: m?.is_active ? { api_model_id: m.api_model_id, temperature: Number(m.temperature) } : null }));
    // The last step always has to produce the caption list.
    steps[steps.length - 1].output_json = true;

    return {
      chain: { id: picked.id, name: picked.name, steps },
      models: modelRows.map((m) => ({ api_model_id: m.api_model_id, temperature: Number(m.temperature) })),
      apiUrl: modelRows[0].llm_providers?.base_url || DEFAULT_API_URL,
      terms: terms.data ?? [],
      examples: examples.data ?? [],
    };
  } catch {
    return fallback;
  }
}

function render(template: string, vars: Record<string, string>) {
  return template
    .replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function promptVars(req: GenerateRequest, p: Pipeline, previous: string) {
  return {
    count: String(req.count),
    neighborhood: req.neighborhood ? `The photo was taken in ${req.neighborhood}.` : "",
    note: req.note ? `The poster added this context: "${req.note}"` : "",
    terms: p.terms.length
      ? `Local vocabulary you may use when it fits:\n${p.terms.map((t) => `- ${t.term}: ${t.definition}`).join("\n")}`
      : "",
    examples: p.examples.length
      ? `Captions the crowd loved before (match the tone, never copy):\n${p.examples.map((e) => `- [${e.scene}] ${e.caption}`).join("\n")}`
      : "",
    avoid: req.avoid?.length
      ? `Do not repeat or closely paraphrase these existing captions:\n${req.avoid.map((c) => `- ${c}`).join("\n")}`
      : "",
    previous,
  };
}

// Best-effort logging: a logging failure must never break caption generation.
async function safe<T>(fn: () => PromiseLike<T>) {
  try {
    return await fn();
  } catch (error) {
    console.error("Pipeline logging failed", error);
    return null;
  }
}

export async function generateCaptions(req: GenerateRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY environment variable.");

  const started = Date.now();
  const pipeline = await loadPipeline(req.supabase);

  const logged = await safe(() =>
    req.supabase
      .from("generation_requests")
      .insert({
        user_id: req.userId,
        photo_id: req.photoId ?? null,
        chain_id: pipeline.chain.id,
        chain_name: pipeline.chain.name,
        source: req.source,
        requested_count: req.count,
      })
      .select("id")
      .single(),
  );
  const requestId: string | null = logged?.data?.id ?? null;

  const finish = (fields: Record<string, unknown>) =>
    requestId
      ? safe(() =>
          req.supabase
            .from("generation_requests")
            .update({ ...fields, duration_ms: Date.now() - started, finished_at: new Date().toISOString() })
            .eq("id", requestId),
        )
      : null;

  try {
    let previous = "";
    let lastPrompt = "";
    let lastModel = "";

    for (const step of pipeline.chain.steps) {
      const prompt = render(step.prompt_template, promptVars(req, pipeline, previous));
      const models = step.model
        ? [step.model, ...pipeline.models.filter((m) => m.api_model_id !== step.model!.api_model_id)]
        : pipeline.models;
      const { text, model } = await callModels(req, pipeline.apiUrl, apiKey, models, step, prompt, requestId);
      previous = text;
      lastPrompt = prompt;
      lastModel = model;
    }

    const captions = parseCaptions(previous, req.count);
    await finish({ status: "succeeded", caption_count: captions.length });
    return { captions, prompt: lastPrompt, model: lastModel, requestId, chainName: pipeline.chain.name };
  } catch (error) {
    await finish({ status: "failed", error: (error as Error).message });
    throw error;
  }
}

// Tries each model in order. The free tier is sometimes overloaded, so a busy
// (503) or rate-limited (429) model falls through to the next.
async function callModels(
  req: GenerateRequest,
  apiUrl: string,
  apiKey: string,
  models: Model[],
  step: Step,
  prompt: string,
  requestId: string | null,
) {
  const parts = [
    ...(step.include_image ? [{ inlineData: { mimeType: req.mimeType, data: req.imageBase64 } }] : []),
    { text: prompt },
  ];
  let lastStatus: number | null = null;

  for (const model of models) {
    const started = Date.now();
    let status: number | null = null;
    let raw = "";
    try {
      const response = await fetch(`${apiUrl}/${model.api_model_id}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            temperature: model.temperature,
            ...(step.output_json
              ? { responseMimeType: "application/json", responseSchema: { type: "ARRAY", items: { type: "STRING" } } }
              : {}),
          },
        }),
        signal: AbortSignal.timeout(30_000),
      });
      status = response.status;
      raw = await response.text();
    } catch (error) {
      raw = `Request failed: ${(error as Error).message}`;
    }

    let text = "";
    if (status === 200) {
      try {
        text = JSON.parse(raw).candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      } catch {}
    }
    const ok = status === 200 && text.length > 0;

    if (requestId) {
      await safe(() =>
        req.supabase.from("llm_responses").insert({
          request_id: requestId,
          step_order: step.step_order,
          model: model.api_model_id,
          prompt,
          response_text: ok ? text : raw.slice(0, 4000),
          http_status: status,
          ok,
          duration_ms: Date.now() - started,
        }),
      );
    }

    if (ok) return { text, model: model.api_model_id };
    lastStatus = status;
    if (status !== null && ![429, 500, 503].includes(status)) break;
    console.error("Gemini busy", model.api_model_id, status);
  }

  throw new Error(
    lastStatus === null || lastStatus === 429 || lastStatus === 503
      ? "The caption writer is swamped right now. Try again in a minute."
      : "The caption writer couldn't read this photo. Try another one.",
  );
}

function parseCaptions(text: string, count: number) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  const cleaned = Array.isArray(parsed)
    ? parsed
        .filter((c): c is string => typeof c === "string")
        .map((c) => c.trim())
        .filter((c) => c.length > 0 && c.length <= 200)
        .slice(0, count)
    : [];
  if (cleaned.length === 0) throw new Error("The caption writer came back empty-handed. Try another photo.");
  return cleaned;
}
