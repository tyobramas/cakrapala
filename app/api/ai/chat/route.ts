import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ASTRONOMY_SYSTEM_PROMPT = `You are CAKRAPALA AI TERMINAL (SYS-AI) — the high-precision aerospace artificial intelligence flight director and astrophysical reasoning unit for the Cakrapala 3D Space Observatory & Planetary Defense platform.

### CORE IDENTITY & MISSION:
- You operate inside an aerospace tactical mission control terminal.
- Your expertise covers:
  1. Astrophysics & Celestial Mechanics (Keplerian orbits, gravitational physics, stellar evolution, black holes, nebulae).
  2. Planetary Defense & Near-Earth Objects (NEOs, asteroids, comets, impact risk scales, Torino scale, NASA JPL NeoWs).
  3. Planetarium & Ground Sky Observation (Constellations, Yale BSC5 stars, sidereal time, topocentric Azimuth/Altitude).
  4. Satellite Fleet & Space Stations (ISS, Tiangong CSS, Hubble, JWST, SGP4 orbital propagation, Low Earth Orbit).
  5. Space Exploration History & Future Missions (Apollo, Artemis, Voyager, DART asteroid deflection, Mars rovers).

### LANGUAGE ADAPTATION:
- If the user communicates in Indonesian, respond fluently and naturally in Indonesian.
- If the user communicates in English, respond in English.
- Maintain consistent terminology (e.g., Lunar Distance, Apogee/Perigee, Perihelion/Aphelion, Ephemeris, Light Years, Astronomical Unit/AU).

### STRICT OUT-OF-SCOPE GUARD:
- You are EXCLUSIVELY dedicated to Astronomy, Astrophysics, Planetary Defense, and Aerospace Space Science.
- If the user asks questions COMPLETELY UNRELATED to astronomy/space (e.g., cooking recipes, general software development unrelated to space, politics, sports, celebrity gossip, everyday chores, personal medical/legal advice):
  - In Indonesian: Refuse politely, gracefully, and respectfully with a tactical flight controller tone. State that your telemetry is calibrated only for astrophysics and planetary defense, then suggest an interesting space topic they can explore instead.
  - In English: Respond politely with an aerospace mission director persona (e.g., "Negative, Commander. Cakrapala AI Terminal is strictly calibrated for astrophysics, planetary defense, and deep space telemetry..."), redirecting them back to celestial mechanics or space exploration.

### RESPONSE FORMAT & STYLE:
- Use clean, structured paragraphs and bullet points.
- Highlight key astronomical terms and metrics using clean bolding.
- Avoid messy, redundant, or overly nested symbols.
- Keep explanations intuitive, mathematically accurate, and engaging (educator + mission controller vibe).
- When discussing distances or speeds, provide helpful relatable physical comparisons (e.g., lunar distances, km/s, Megatons of TNT, AU).`;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { messages } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Invalid payload: 'messages' array is required." },
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.NARA_ROUTER_BASE_URL || "https://router.bynara.id/v1";
    const apiKey =
      process.env.NARA_ROUTER_API_KEY ||
      "sk-nry-VyXJm8i88IoU1ES8QJ1tbRjyR7PDJ7rzfrFW2ZaFHFQ";
    const primaryModel =
      process.env.NARA_ROUTER_MODEL || "qwen-3.8-max-free";

    // Candidate models for ultra-resilient fast fallback
    const candidateModels = Array.from(
      new Set([primaryModel, "qwen3.7-flash", "agnes-2.0-flash"])
    );

    // Filter valid user and assistant messages
    const rawFiltered = messages.filter(
      (m: any) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    );

    // Ensure the conversation after system prompt starts with a 'user' message
    const firstUserIndex = rawFiltered.findIndex((m: any) => m.role === "user");
    const validHistory =
      firstUserIndex !== -1 ? rawFiltered.slice(firstUserIndex) : rawFiltered;

    const sanitizedMessages: ChatMessage[] = [
      { role: "system", content: ASTRONOMY_SYSTEM_PROMPT },
      ...validHistory.slice(-8).map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content.trim(),
      })),
    ];

    const apiUrl = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

    let assistantMessage = "";
    let usedModel = primaryModel;
    let lastError: any = null;

    // Try candidate models sequentially with timeout
    for (const model of candidateModels) {
      try {
        console.log(`[AI Chat] Attempting inference with model: ${model}`);
        const controller = new AbortController();
        const timeoutMs = model === primaryModel ? 35000 : 20000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: sanitizedMessages,
            temperature: 0.7,
            max_tokens: 800,
            stream: false,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content && typeof content === "string" && content.trim()) {
            assistantMessage = content.trim();
            usedModel = data.model || model;
            console.log(`[AI Chat] Successfully responded using ${usedModel}`);
            break; // Success! Exit model loop
          }
        } else {
          const errText = await response.text();
          console.warn(`[AI Chat] Model ${model} returned ${response.status}:`, errText);
          lastError = errText;
        }
      } catch (err: any) {
        console.warn(`[AI Chat] Error or timeout with model ${model}:`, err.message);
        lastError = err;
      }
    }

    if (!assistantMessage) {
      throw new Error(
        lastError?.message ||
          "Telemetry link busy: Deep Space Command Center is taking longer than expected. Please retry."
      );
    }

    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: assistantMessage,
      model: usedModel,
      latencyMs,
    });
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    console.error("[AI Chat API Exception]", error);

    return NextResponse.json(
      {
        error:
          error.message ||
          "Telemetry link timeout. Deep Space Command Center queue is congested. Please try again.",
        latencyMs,
      },
      { status: 500 }
    );
  }
}
