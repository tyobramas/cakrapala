import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NARA_ROUTER_BASE_URL =
  process.env.NARA_ROUTER_BASE_URL || "https://router.bynara.id/v1";
const NARA_ROUTER_API_KEY = process.env.NARA_ROUTER_API_KEY || "";
const NARA_ROUTER_MODEL =
  process.env.NARA_ROUTER_MODEL || "qwen-3.8-max-free";

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
- Maintain consistent terminology (e.g., Lunar Distance, Apogee/Perigee, Perihelion/Aphelion, Ephemeris, Light Years).

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
- When discussing distances or speeds, provide helpful relatable physical comparisons (e.g., lunar distances, km/s, Megatons of TNT).`;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { messages, stream = false } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Invalid payload: 'messages' array is required." },
        { status: 400 }
      );
    }

    if (!NARA_ROUTER_API_KEY) {
      return NextResponse.json(
        {
          error:
            "NARA_ROUTER_API_KEY is not configured on the server. Please set it in .env.local",
        },
        { status: 500 }
      );
    }

    // Sanitize and construct conversation history with system prompt
    const sanitizedMessages: ChatMessage[] = [
      { role: "system", content: ASTRONOMY_SYSTEM_PROMPT },
      ...messages
        .filter(
          (m: any) =>
            m &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string" &&
            m.content.trim().length > 0
        )
        .slice(-10) // Keep last 10 turns for optimal context window & speed
        .map((m: any) => ({
          role: m.role as "user" | "assistant",
          content: m.content.trim(),
        })),
    ];

    const apiUrl = `${NARA_ROUTER_BASE_URL.replace(/\/+$/, "")}/chat/completions`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s safety timeout for deep reasoning

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NARA_ROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: NARA_ROUTER_MODEL,
        messages: sanitizedMessages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Nara Router Error]", response.status, errorText);
      return NextResponse.json(
        {
          error: `Nara Router API error: ${response.status} ${response.statusText}`,
          details: errorText,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const assistantMessage =
      data.choices?.[0]?.message?.content ||
      "Telemetry signal lost. No response received from Nara Router.";

    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: assistantMessage,
      model: data.model || NARA_ROUTER_MODEL,
      latencyMs,
      usage: data.usage || null,
    });
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    console.error("[AI Chat API Exception]", error);

    if (error.name === "AbortError") {
      return NextResponse.json(
        {
          error: "Request timed out waiting for Nara Router response (45s).",
          latencyMs,
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      {
        error: error.message || "An unexpected error occurred during AI processing.",
        latencyMs,
      },
      { status: 500 }
    );
  }
}
