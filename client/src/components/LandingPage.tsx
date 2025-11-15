// components/LandingPage.tsx
import React from "react";

interface LandingPageProps {
  onStartHunt: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStartHunt }) => {
  return (
    <div className="min-h-screen bg-[#F5F5DC] flex flex-col items-center justify-center p-4 font-body">
      {/* Main Title */}
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-[#8B4513] leading-tight">
          Welcome to Tasku's
          <br />
          <span className="text-5xl md:text-6xl">SCAVENGER</span>
          <br />
          <span className="text-5xl md:text-6xl">HUNT</span>
        </h1>
      </div>

      {/* How it works button */}
      <button
        onClick={onStartHunt}
        className="bg-[#FF8C00] text-white px-12 py-4 rounded-full text-xl font-body font-semibold hover:bg-[#FF7F00] transition-colors shadow-lg"
      >
        How it works
      </button>
    </div>
  );
};

export default LandingPage;
