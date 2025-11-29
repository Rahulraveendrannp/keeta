// components/OTPPage.tsx
import React, { useState, useRef, useEffect } from "react";
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
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const otpCode = otpDigits.join("");

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

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

  const handleDigitChange = (index: number, value: string) => {
    // Only allow single digit
    const digit = value.replace(/\D/g, "").slice(0, 1);
    
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);

    if (error) setError("");

    // Auto-focus next input if digit entered
    if (digit && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    
    if (pastedData.length > 0) {
      const newDigits = [...otpDigits];
      for (let i = 0; i < 4; i++) {
        newDigits[i] = pastedData[i] || "";
      }
      setOtpDigits(newDigits);
      
      // Focus the last filled input or the last input
      const nextIndex = Math.min(pastedData.length, 3);
      inputRefs.current[nextIndex]?.focus();
      
      if (error) setError("");
    }
  };

  const handleResendOTP = async () => {
    setIsResending(true);
    setError("");
    setResendMessage("");

    try {
      const response = await ScavengerAPI.resendOTP(phoneNumber);

      if (response.success) {
        setResendMessage("OTP sent successfully!");
        // Clear OTP inputs
        setOtpDigits(["", "", "", ""]);
        // Focus first input
        inputRefs.current[0]?.focus();
      } else {
        setError(response.error || "Failed to resend OTP. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsResending(false);
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

        {/* Verify OTP badge */}
        <img
          src="/game/otp.svg"
          alt="Verify OTP"
          className="w-[80%] max-w-[320px] mt-[15%]"
        />

        {/* Form section */}
        <div className="w-full mt-8 space-y-4">
          <p className="text-gray-700 text-sm text-center mb-4">
            Enter the 4-digit code sent to {phoneNumber}
          </p>

          {/* OTP input - 4 separate boxes */}
          <div className="w-full flex justify-center gap-3">
            {otpDigits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                value={digit}
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className={`w-16 h-16 bg-[#FFFF50] border-4 rounded-lg text-[#5D4E37] focus:outline-none font-body text-center text-2xl font-bold ${
                  error ? "border-red-500" : "border-[#11CC9A]"
                }`}
                disabled={isLoading}
                maxLength={1}
                inputMode="numeric"
              />
            ))}
          </div>

          {/* Error message */}
          {error && (
            <p className="text-red-600 text-sm text-center">{error}</p>
          )}

          {/* Success message for resend */}
          {resendMessage && (
            <p className="text-[#11CC9A] text-sm text-center font-semibold">{resendMessage}</p>
          )}

          {/* Resend OTP link */}
          <div className="text-center mt-2">
            <button
              onClick={handleResendOTP}
              disabled={isResending || isLoading}
              className="text-sm disabled:opacity-50 transition-colors"
            >
              {isResending ? (
                "Sending..."
              ) : (
                <>
                  <span className="text-gray-700">Didn't receive OTP? </span>
                  <span className="text-[#11CC9A] hover:text-[#0FA882] font-medium">Send again</span>
                </>
              )}
            </button>
          </div>

          {/* Verify OTP button */}
          <button
            onClick={handleVerifyOTP}
            disabled={otpCode.length !== 4 || isLoading}
            className="w-[69%] mt-[20%] mx-auto block py-3 rounded-xl bg-[#11CC9A] text-[#FFE41F] text-lg font-body shadow-lg shadow-black/10 hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {isLoading ? "Verifying..." : "Verify OTP"}
          </button>

          {/* Back button */}
          <button
            onClick={onBack}
            className="w-full text-center text-gray-700 text-sm hover:text-[#11CC9A] transition-colors mt-4"
          >
            ← Back to registration
          </button>
        </div>
      </div>
    </div>
  );
};

export default OTPPage;
