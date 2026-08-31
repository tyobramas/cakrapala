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
- If the user communicates in Indonesian, respond fluently, concisely, and naturally in Indonesian.
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
    const apiKey = process.env.NARA_ROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "NARA_ROUTER_API_KEY environment variable is not configured." },
        { status: 500 }
      );
    }
    const configuredModel =
      process.env.NARA_ROUTER_MODEL || "agnes-2.5-flash";

    // Candidate model chain: Configured model first, followed by fast high-reliability flash models
    const candidateModels = Array.from(
      new Set([configuredModel, "agnes-2.5-flash", "agnes-2.0-flash", "mistral-medium-3-5"])
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
      ...validHistory.slice(-6).map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content.trim(),
      })),
    ];

    const apiUrl = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

    let assistantMessage = "";
    let usedModel = configuredModel;
    let lastError: any = null;

    // Try candidate models with adaptive timeouts
    for (const model of candidateModels) {
      try {
        console.log(`[AI Chat] Attempting inference with model: ${model}`);
        const controller = new AbortController();
        // Give mistral 65s, flash models 25s
        const timeoutMs = model.includes("flash") ? 25000 : 65000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "User-Agent": "Cakrapala-Space-Observatory/1.0",
          },
          body: JSON.stringify({
            model,
            messages: sanitizedMessages,
            temperature: 0.7,
            max_tokens: 600,
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
            console.log(`[AI Chat] Success with model: ${usedModel} (${Date.now() - startTime}ms)`);
            break;
          }
        } else {
          const errText = await response.text();
          console.warn(`[AI Chat] Model ${model} returned HTTP ${response.status}:`, errText);
          lastError = new Error(`HTTP ${response.status}: ${errText}`);
        }
      } catch (err: any) {
        console.warn(`[AI Chat] Timeout or error with model ${model}:`, err.message);
        lastError = err;
      }
    }

    if (!assistantMessage) {
      throw new Error(
        lastError?.message ||
          "Telemetry link busy: Deep Space Command Center is experiencing high load. Please try again."
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

    const isAbort = error.name === "AbortError" || error.message?.includes("aborted");

    return NextResponse.json(
      {
        error: isAbort
          ? "Telemetry uplink timed out while awaiting Deep Space Command Center. Please re-send your query."
          : (error.message || "An unexpected error occurred during AI processing."),
        latencyMs,
      },
      { status: 500 }
    );
  }
}
