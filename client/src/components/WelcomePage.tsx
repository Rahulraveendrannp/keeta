import React from "react";

interface WelcomePageProps {
  onStart: () => void;
}

const WelcomePage: React.FC<WelcomePageProps> = ({ onStart }) => {
  return (
    <div className="relative min-h-screen bg-[#11CC9A] overflow-hidden font-body flex flex-col items-center">
      {/* Yellow section with curved bottom */}
      <div className="absolute top-0 h-[90%] w-[200vw] bg-[#FFE41F] rounded-b-full" />

      <div className="z-10 flex flex-col items-center w-full max-w-sm px-6 pt-10 sm:pt-20 pb-10 flex-1">
        <img
          src="/game/Group 329.svg"
          alt="Keeta logo"
          className="w-28 sm:w-36"
        />

        <img
          src="/game/Group 383.svg"
          alt="Play your fun self badge"
          className="w-full max-w-[320px] mt-[15%]"
        />

        <button
          onClick={onStart}
          className="inline-flex items-center justify-center w-[69%] mt-[55%] py-3 rounded-xl bg-[#11CC9A] text-[#FFE41F] text-lg font-body shadow-lg shadow-black/10 hover:opacity-90 transition"
        >
          Let&apos;s Play
        </button>
      </div>
    </div>
  );
};

export default WelcomePage;
