import type { Metadata } from "next";
import SkyObservatoryContainer from "@/components/sky/SkyObservatoryContainer";

export const metadata: Metadata = {
  title: "Cakrapala — Earth Day/Night Sky Observatory",
  description:
    "Interactive Earth Day/Night Terminator map and 360-degree Stellarium-style ground horizon planetarium.",
};

export default function SkyPage() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-[#020617] text-slate-100 overflow-x-hidden">
      <SkyObservatoryContainer />
    </div>
  );
}
