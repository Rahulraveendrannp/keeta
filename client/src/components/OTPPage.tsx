// components/OTPPage.tsx
import React, { useState } from "react";
import { ScavengerAPI } from "../api";
import { validateOTP } from "../utils";
import type { GameSession } from "../types";

interface OTPPageProps {
  onBack: () => void;
  onSuccess: (session: GameSession) => void;
  phoneNumber: string;
}

const OTPPage: React.FC<OTPPageProps> = ({
  onBack,
  onSuccess,
  phoneNumber,
}) => {
  const [otpCode, setOtpCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleVerifyOTP = async () => {
    if (!validateOTP(otpCode)) {
      setError("Please enter a valid 4-digit code");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await ScavengerAPI.verifyOTP(phoneNumber, otpCode);

      if (response.success && response.session) {
        onSuccess(response.session);
      } else {
        setError(response.error || "Invalid OTP. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 4);
    setOtpCode(value);
    if (error) setError("");
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

        {/* Verify OTP badge */}
        <img
          src="/game/Group 382.svg"
          alt="Verify OTP"
          className="w-[80%] max-w-[320px] mt-[15%]"
        />

        {/* Form section */}
        <div className="w-full mt-8 space-y-4">
          <p className="text-gray-700 text-sm text-center mb-4">
            Enter the 4-digit code sent to {phoneNumber}
          </p>

          {/* OTP input */}
          <div className="w-full">
            <input
              type="text"
              value={otpCode}
              onChange={handleOtpChange}
              className={`w-full px-4 py-2 bg-[#FFFF50] border-4 rounded-lg text-[#5D4E37] focus:outline-none font-body text-center text-lg tracking-widest placeholder:text-gray-400 ${
                error ? "border-red-500" : "border-[#11CC9A]"
              }`}
              placeholder="0000"
              disabled={isLoading}
              maxLength={4}
              inputMode="numeric"
            />
          </div>

          {/* Error message */}
          {error && (
            <p className="text-red-600 text-sm text-center">{error}</p>
          )}

          {/* Verify OTP button */}
          <button
            onClick={handleVerifyOTP}
            disabled={otpCode.length !== 4 || isLoading}
            className="w-[69%] mt-[27%] mx-auto block py-3 rounded-xl bg-[#11CC9A] text-[#FFE41F] text-lg font-body shadow-lg shadow-black/10 hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {isLoading ? "Verifying..." : "Verify OTP"}
          </button>

          {/* Back button */}
          <button
            onClick={onBack}
            disabled={isLoading}
            className="w-full text-center text-gray-700 text-sm hover:text-[#11CC9A] disabled:opacity-50 transition-colors mt-4"
          >
            ← Back to registration
          </button>
        </div>
      </div>
    </div>
  );
};

export default OTPPage;
