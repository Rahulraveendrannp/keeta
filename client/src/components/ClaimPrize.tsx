import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ScavengerAPI } from "../api";
import QRCodeLib from "qrcode";
import type { UserQRData, GameClaims } from "../types";

interface ClaimPrizeProps {}

const GAME_NAMES = [
  "🧠 AI Photobooth",
  "👀 Peek-a-Booth",
  "🛵 Delivery Dash",
  "🐆 Catch-a-Tail",
];

const ClaimPrize: React.FC<ClaimPrizeProps> = () => {
  const navigate = useNavigate();
  const [userQRData, setUserQRData] = useState<UserQRData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const qrCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    loadQRCodes();
  }, []);

  const loadQRCodes = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get phone number from localStorage
      const storedPhoneNumber = localStorage.getItem("keeta_phone_number");
      if (!storedPhoneNumber) {
        setError("Phone number not found. Please register again.");
        return;
      }
      
      // Get user QR codes
      const response = await ScavengerAPI.getUserQRCodes(storedPhoneNumber);
      
      if (response.success && response.data) {
        setUserQRData(response.data);
      } else {
        setError(response.error || "Failed to load QR codes");
      }
    } catch (err) {
      console.error("Error loading QR codes:", err);
      setError("Failed to load QR codes");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userQRData && userQRData.gameQRCodes) {
      // Generate QR codes for each game
      [1, 2, 3, 4].forEach((gameNum) => {
        const qrCode = userQRData.gameQRCodes[`game${gameNum}` as keyof typeof userQRData.gameQRCodes];
        const canvas = qrCanvasRefs.current[gameNum - 1];
        
        if (qrCode && canvas) {
          QRCodeLib.toCanvas(
            canvas,
            qrCode,
            {
              width: 300,
              margin: 4,
              errorCorrectionLevel: 'H',
              color: {
                dark: "#000000",
                light: "#FFFFFF",
              },
            },
            (error) => {
              if (error) console.error(`Error generating QR code for game ${gameNum}:`, error);
            }
          );
        }
      });
    }
  }, [userQRData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFE41F] p-4 flex items-center justify-center font-body">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CC9A] mx-auto mb-4"></div>
          <p className="text-lg text-gray-700">Loading your QR codes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FFE41F] p-4 flex items-center justify-center font-body">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p className="font-heading">Error</p>
            <p>{error}</p>
          </div>
          <button
            onClick={loadQRCodes}
            className="bg-[#11CC9A] text-white px-6 py-2 rounded-lg hover:opacity-90 transition-colors font-body"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFE41F] p-4 font-body">
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate("/dashboard")}
          className="mb-4 text-gray-700 hover:text-[#11CC9A] transition-colors font-body text-sm flex items-center gap-2"
        >
          ← Back to Dashboard
        </button>

        <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 mb-6">
          <h1 className="text-2xl sm:text-3xl font-heading text-center text-[#11CC9A] mb-2">
            Your Game QR Codes
          </h1>
          
          <p className="text-center text-gray-700 mb-6 font-body text-sm sm:text-base">
            Show these QR codes to the admin at each game booth to claim your rewards.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((gameNum) => {
              const qrCode = userQRData?.gameQRCodes[`game${gameNum}` as keyof typeof userQRData.gameQRCodes];
              const isClaimed = userQRData?.gameClaims[`game${gameNum}` as keyof GameClaims];
              
              return (
                <div
                  key={gameNum}
                  className={`bg-white border-4 rounded-xl p-4 text-center ${
                    isClaimed ? "border-gray-400 opacity-60" : "border-[#11CC9A]"
                  }`}
                >
                  <h3 className="text-lg font-heading text-gray-800 mb-3">
                    {GAME_NAMES[gameNum - 1]}
                  </h3>
                  
                      {qrCode ? (
                        <>
                          <div className="flex justify-center mb-3">
                            <canvas ref={(el) => { qrCanvasRefs.current[gameNum - 1] = el; }} />
                          </div>
                      <p className="text-xs text-gray-500 mb-2">Code: {qrCode}</p>
                      {isClaimed && (
                        <div className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm font-body">
                          ✓ Claimed
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">QR code not available</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaimPrize;
