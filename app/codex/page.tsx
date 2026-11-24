import type { Metadata } from "next";
import SpaceCodexContainer from "@/components/codex/SpaceCodexContainer";

export const metadata: Metadata = {
  title: "Cakrapala — Space Codex & NASA/IAU Astrophysics Lexicon",
  description:
    "Comprehensive interactive astronomy, astrophysics, orbital mechanics, and NASA spaceflight encyclopedia with 110+ certified IAU definitions, formulas, and cross-linked references.",
};

export default function CodexPage() {
  return <SpaceCodexContainer />;
}
