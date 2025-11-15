import React, { useState } from "react";
import { ScavengerAPI } from "../api";

interface RegistrationPageProps {
  onBack?: () => void;
  onSuccess: (phoneNumber: string) => void;
}

const RegistrationPage: React.FC<RegistrationPageProps> = ({ onSuccess }) => {
  const [localPhone, setLocalPhone] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    // Validate Qatar phone number format
    if (!/^\d{8}$/.test(localPhone)) {
      setError("Please enter a valid 8-digit Qatar phone number");
      return;
    }

    // Validate name
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }

    const phoneNumber = `+974${localPhone}`;

    setIsLoading(true);
    setError("");

    try {
      console.log("Attempting to send OTP to:", phoneNumber);

      const response = await ScavengerAPI.registerUser(phoneNumber, name.trim());

      if (response.success) {
        console.log("OTP sent successfully to:", phoneNumber);
        onSuccess(phoneNumber);
      } else {
        console.error("OTP send failed:", response.error);
        setError(response.error || "Failed to send OTP. Please try again.");
      }
    } catch (err) {
      console.error("Network error:", err);
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#11CC9A] overflow-hidden font-body flex flex-col items-center">
      {/* Yellow section with curved bottom */}
      <div className="absolute top-0 h-[90%] w-[200vw] bg-[#FFE41F] rounded-b-full" />

      <div className="z-10 flex flex-col items-center w-full max-w-sm px-6 pt-10 sm:pt-20 pb-10 flex-1">
        {/* Logo */}
        <img
          src="/game/Group 329.svg"
          alt="Keeta logo"
          className="w-28 sm:w-36"
        />

        {/* Register badge */}
        <img
          src="/game/Group 382.svg"
          alt="Register to play"
          className="w-[80%] max-w-[320px] mt-[15%]"
        />

        {/* Form section */}
        <div className="w-full mt-8 space-y-4">
          {/* Name input */}
          <div className="w-full">
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError("");
              }}
              className="w-full px-4 py-2 bg-[#FFFF50] border-4 border-[#11CC9A] rounded-lg text-[#5D4E37] focus:outline-none font-body placeholder:text-gray-400"
              placeholder="Name"
              disabled={isLoading}
            />
          </div>

          {/* Phone input */}
          <div className="w-full">
            <div className="flex bg-[#FFFF50] border-4 border-[#11CC9A] rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-[#FFFF50] border-r-4 border-[#11CC9A]">
                <span className="text-[#5D4E37] font-body">+974</span>
              </div>
              <input
                type="tel"
                value={localPhone}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 8);
                  setLocalPhone(val);
                  if (error) setError("");
                }}
                className="flex-1 px-3 py-3 bg-[#FFFF50] text-[#5D4E37] focus:outline-none font-body placeholder:text-gray-400"
                placeholder="12345678"
                disabled={isLoading}
                maxLength={8}
                inputMode="numeric"
              />
            </div>
          </div>

          {/* Error message */}
          {error && (
            <p className="text-red-600 text-sm text-center">{error}</p>
          )}

          {/* Send OTP button */}
          <button
            onClick={handleSubmit}
            disabled={isLoading || localPhone.length !== 8 || !name.trim()}
            className="w-[69%] mt-[27%] mx-auto block py-3 rounded-xl bg-[#11CC9A] text-[#FFE41F] text-lg font-body shadow-lg shadow-black/10 hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {isLoading ? "Sending OTP..." : "Send OTP"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegistrationPage;