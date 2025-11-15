// components/InstructionsPage.tsx
import React from "react";

interface InstructionsPageProps {
  onStart: () => void;
}

const InstructionsPage: React.FC<InstructionsPageProps> = ({ onStart }) => {
  return (
    <div className="min-h-screen bg-[#F5F5DC] flex flex-col items-center justify-center p-4 font-body">
      {/* Instructions */}
      <div className="text-center mb-16 max-w-md">
        <div className="space-y-6 text-[#8B4513]">
          <div className="text-lg">
            <span className="font-heading">1.</span> You'll get 8 clues.
          </div>
          <div className="text-lg">
            <span className="font-heading">2.</span> Find as many checkpoints as
            you can.
          </div>
          <div className="text-lg">
            <span className="font-heading">3.</span> Scan each QR to mark it as
            found.
          </div>
          <div className="text-lg">
            <span className="font-heading">4.</span> Return to the booth to claim
            your prize.
          </div>
        </div>
      </div>

      {/* Start button */}
      <button
        onClick={onStart}
        className="bg-[#FF8C00] text-white px-16 py-4 rounded-full text-xl font-body hover:bg-[#FF7F00] transition-colors shadow-lg"
      >
        Start
      </button>
    </div>
  );
};

export default InstructionsPage;
