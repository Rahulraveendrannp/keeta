import React, { useEffect, useMemo, useState, useRef } from "react";
import { CheckCircle, Gift, LogOut, X } from "lucide-react";
import { ScavengerAPI } from "../api";
import SimpleQRScanner from "./SimpleQRScanner";
import QRCodeLib from "qrcode";

interface DashboardProps {
  phoneNumber: string;
  onLogout: () => void;
}

interface CardInfo {
  id: number;
  title: string;
  description: string;
  qrCode: string;
  icon: string;
}

const GAME_TASKS: CardInfo[] = [
  {
    id: 1,
    title: "Pose Battle",
    description: "Match the coach's pose and earn your score.",
    qrCode: "KEETO_GAME1_TIER1", // Station QR codes - users can scan either TIER1 or TIER2
    icon: "/Lunchbox.svg",
  },
  {
    id: 2,
    title: "Dribble Dash",
    description: "Keep the momentum and collect items on the run.",
    qrCode: "KEETO_GAME2_TIER1", // Station QR codes - users can scan either TIER1 or TIER2
    icon: "/Runner.svg",
  },
  {
    id: 3,
    title: "Reflex Ball Catch",
    description: "Catch the falling balls and test your reflex.",
    qrCode: "KEETO_GAME3_TIER1", // Station QR codes - users can scan either TIER1 or TIER2
    icon: "/Talabeat.svg",
  },
];

const Dashboard: React.FC<DashboardProps> = ({ phoneNumber, onLogout }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [completedCards, setCompletedCards] = useState<number[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardInfo | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [gameClaims, setGameClaims] = useState<Record<number, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userName, setUserName] = useState<string>("Player");
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedGameQR, setSelectedGameQR] = useState<{gameId: number, qrCode: string} | null>(null);
  const [gameTiers, setGameTiers] = useState<Record<number, number>>({});
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const completedSet = useMemo(() => new Set(completedCards), [completedCards]);

  useEffect(() => {
    const initialise = async () => {
      setIsLoading(true);
      try {
        const [progressResponse, claimResponse] = await Promise.all([
          ScavengerAPI.getGameProgress(),
          phoneNumber ? ScavengerAPI.checkUserClaimed(phoneNumber) : Promise.resolve({ success: false, data: { isClaimed: false } }),
        ]);

        if (progressResponse.success && progressResponse.data) {
          const completedIds = Array.isArray(progressResponse.data.completedCards)
            ? progressResponse.data.completedCards.map(Number)
            : [];
          setCompletedCards(completedIds);
          // Get userName from data if available
          const userData = progressResponse.data as { userName?: string; completedCards?: number[] };
          if (userData.userName) {
            setUserName(userData.userName);
          }
        } else if (progressResponse.error?.includes("Session expired")) {
          onLogout();
          return;
        }

        if (claimResponse.success && claimResponse.data) {
          const claims = claimResponse.data.gameClaims || {};
          setGameClaims({
            1: claims.game1 || false,
            2: claims.game2 || false,
            3: claims.game3 || false,
          });
        }

        // Get user QR codes and tiers
        const qrResponse = await ScavengerAPI.getUserQRCodes(phoneNumber);
        if (qrResponse.success && qrResponse.data) {
          const tiers = qrResponse.data.gameTiers || {};
          
          // Store tiers
          setGameTiers({
            1: tiers.game1 || 0,
            2: tiers.game2 || 0,
            3: tiers.game3 || 0,
          });
        }
      } catch {
        setErrorMessage("Failed to load your progress. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    initialise();
  }, [onLogout, phoneNumber]);

  const handleOpenScanner = (card: CardInfo) => {
    if (completedSet.has(card.id) || isSubmitting) {
      return;
    }
    setSelectedCard(card);
    setShowScanner(true);
    setErrorMessage("");
  };

  const handleScanSuccess = async (scannedQRCode: string): Promise<{ success: boolean; message?: string }> => {
    if (!selectedCard) {
      return { success: false, message: "No card selected" };
    }

    // Validate QR code on frontend before sending to backend
    // All games (1-3) accept either TIER1 or TIER2
    const validQRCodes = [
      `KEETO_GAME${selectedCard.id}_TIER1`,
      `KEETO_GAME${selectedCard.id}_TIER2`
    ];

    // Check if scanned QR code matches any valid code
    if (!validQRCodes.includes(scannedQRCode)) {
      const errorMsg = `Invalid QR code`;
      setErrorMessage(errorMsg);
      return { success: false, message: errorMsg };
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");

      const response = await ScavengerAPI.completeCard(selectedCard.id, scannedQRCode);

      if (response.success) {
        setCompletedCards((prev) => {
          const next = new Set(prev);
          next.add(selectedCard.id);
          return Array.from(next).sort((a, b) => a - b);
        });
        
        // Refresh QR codes to get updated tier information
        const qrResponse = await ScavengerAPI.getUserQRCodes(phoneNumber);
        if (qrResponse.success && qrResponse.data) {
          const tiers = qrResponse.data.gameTiers || {};
          
          setGameTiers({
            1: tiers.game1 || 0,
            2: tiers.game2 || 0,
            3: tiers.game3 || 0,
          });
        }
        
        setShowScanner(false);
        setSelectedCard(null);
        return { success: true };
      } else {
        const errorMsg = response.error || "Unable to record this scan. Please try again.";
        setErrorMessage(errorMsg);
        return { success: false, message: errorMsg };
      }
    } catch {
      const errorMsg = "Something went wrong while saving your scan. Please try again.";
      setErrorMessage(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseScanner = () => {
    if (isSubmitting) return;
    setShowScanner(false);
    setSelectedCard(null);
    setErrorMessage("");
  };

  const handleShowQRCode = async (gameId: number) => {
    // Always refresh QR codes and tier info before showing QR code
    try {
      const qrResponse = await ScavengerAPI.getUserQRCodes(phoneNumber);
      if (qrResponse.success && qrResponse.data) {
        const qrCodes = qrResponse.data.gameQRCodes || {};
        const tiers = qrResponse.data.gameTiers || {};
        
        // Update tier information
        setGameTiers({
          1: tiers.game1 || 0,
          2: tiers.game2 || 0,
          3: tiers.game3 || 0,
        });
        
        // Get QR code for this game
        const qrCode = qrCodes[`game${gameId}`] || '';
        
        if (qrCode) {
          setSelectedGameQR({ gameId, qrCode });
          setShowQRModal(true);
        } else {
          setErrorMessage(`QR code not available for Game ${gameId}. Please contact support.`);
        }
      } else {
        setErrorMessage(`Failed to load QR code for Game ${gameId}. Please try again.`);
      }
    } catch {
      setErrorMessage(`Error loading QR code for Game ${gameId}. Please try again.`);
    }
  };

  const handleCloseQRModal = () => {
    setShowQRModal(false);
    setSelectedGameQR(null);
  };

  useEffect(() => {
    if (showQRModal && selectedGameQR && qrCanvasRef.current) {
      QRCodeLib.toCanvas(
        qrCanvasRef.current,
        selectedGameQR.qrCode,
        {
          width: 300,
          margin: 2,
          errorCorrectionLevel: 'H',
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        },
            () => {}
      );
    }
  }, [showQRModal, selectedGameQR]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFE41F] flex items-center justify-center p-4">
        <div className="bg-transparent  p-8 sm:p-12 text-center max-w-md w-full">
          {/* Animated Logo/Icon */}
          <div className="relative mb-6">
            <div className="w-20 h-20 mx-auto relative">
              {/* Outer rotating ring */}
              <div className="absolute inset-0 rounded-full border-4 border-[#11CC9A]/20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#11CC9A] animate-spin"></div>
              
              {/* Inner pulsing circle */}
              <div className="absolute inset-2 rounded-full bg-[#11CC9A]/10 animate-pulse"></div>
              <div className="absolute inset-4 rounded-full bg-[#11CC9A] flex items-center justify-center">
                <Gift className="w-6 h-6 text-white animate-bounce" />
              </div>
            </div>
          </div>
          
          {/* Loading text with animation */}
          <h3 className="text-xl font-heading text-[#11CC9A] mb-2">
            Loading your adventures
          </h3>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#11CC9A] font-body overflow-hidden flex flex-col items-center">
      {/* Yellow section with curved bottom - using same method as login/OTP pages */}
      <div className="absolute top-0 h-[90%] w-[200vw] bg-[#FFE41F] rounded-b-full"></div>
      
      <div className="max-w-md mx-auto px-4 pt-8 pb-32 relative z-10">
        {/* Welcome header - centered */}
        <header className="text-center mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#11CC9A] mb-2">
            Welcome {userName?.split('')[0]?.toUpperCase()+userName?.slice(1)}
          </h1>
          <p className="text-sm text-gray-900 w-[80%] mx-auto">
            Finish the challenge and scan the prize QR code to collect your reward.
          </p>
        </header>

        {errorMessage && (
          <div className="bg-white/90 text-red-600 border border-red-300 rounded-lg p-3 mb-4 text-sm shadow">
            {errorMessage}
          </div>
        )}

        {/* Challenge cards - vertical list */}
        <section className="space-y-4 mb-6">
          {GAME_TASKS.map((task) => {
            const isCompleted = completedSet.has(task.id);
            return (
              <article
                key={task.id}
                className={`bg-white rounded-xl shadow-lg p-5 relative ${
                  isCompleted ? "ring-2 ring-[#11CC9A]" : ""
                }`}
              >
                {isCompleted && (
                  <div className="absolute top-4 right-4">
                    <CheckCircle className="w-6 h-6 text-[#11CC9A]" />
                  </div>
                )}
                <div className="mb-4">
                  <h2 className="text-lg font-heading text-black mb-1">
                    {task.title}
                  </h2>
                  <p className="text-sm text-black ">
                    {task.description}
                  </p>
                </div>
                <div className="flex justify-end">
                  {!isCompleted ? (
                    <button
                      onClick={() => handleOpenScanner(task)}
                      disabled={isSubmitting}
                      className="inline-flex items-center justify-center gap-2 px-10 py-2.5 rounded-full font-body text-sm transition-colors bg-[#11CC9A] text-white hover:opacity-90 disabled:opacity-60"
                    >
                      <img src="/game/qr-icon.svg" alt="QR" className="w-4 h-4" />
                      Scan
                    </button>
                  ) : gameClaims[task.id] ? (
                    <button
                      disabled
                      className="inline-flex items-center justify-center gap-2 px-10 py-2.5 rounded-full font-body text-sm bg-gray-400 text-white cursor-not-allowed"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Claimed
                    </button>
                  ) : (
                    <button
                      onClick={() => handleShowQRCode(task.id)}
                      className="inline-flex items-center justify-center gap-2 px-10 py-2.5 rounded-full font-body text-sm transition-colors bg-[#11CC9A] text-white hover:opacity-90"
                    >
                      <Gift className="w-4 h-4" />
                      Claim
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>

        {/* Logout button at bottom - centered over wave */}
        <footer className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-20">
          <button
            onClick={onLogout}
            className="inline-flex items-center justify-center gap-2 bg-[#11CC9A] text-white px-8 py-3 rounded-full hover:opacity-90 transition-colors text-base font-body shadow-lg"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </footer>
      </div>

      {showScanner && selectedCard && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1A1A1A] text-white rounded-2xl shadow-2xl w-full max-w-xl p-6 relative">
            <button
              onClick={handleCloseScanner}
              className="absolute top-4 right-4 text-gray-300 hover:text-white"
            >
              ✕
            </button>

            <h3 className="text-xl font-heading mb-2">Scan Card {selectedCard.id}</h3>
            <p className="text-sm text-gray-300 mb-4">
              Scan either the Tier 1 (GAME{selectedCard.id}_TIER1) or Tier 2 (GAME{selectedCard.id}_TIER2) station QR code for {selectedCard.title}.
            </p>

            <SimpleQRScanner
              title=""
              expectedQRCode="" // Validation happens in handleScanSuccess before API call
              onScan={handleScanSuccess}
              onClose={handleCloseScanner}
            />
          </div>
        </div>
      )}

      {showQRModal && selectedGameQR && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
            <button
              onClick={handleCloseQRModal}
              className="absolute top-4 right-4 text-gray-600 hover:text-gray-900"
            >
              <X className="w-6 h-6" />
            </button>

            <h3 className="text-2xl font-heading text-[#11CC9A] mb-2 text-center">
              Game {selectedGameQR.gameId} QR Code
            </h3>
            <p className="text-sm text-gray-600 mb-2 text-center">
              Show this QR code to the admin to claim your reward for{" "}
              {GAME_TASKS.find(t => t.id === selectedGameQR.gameId)?.title || `Game ${selectedGameQR.gameId}`}
            </p>
            {selectedGameQR.gameId <= 3 && (() => {
              const tier = gameTiers[selectedGameQR.gameId];
              // Only show tier if it's 1 or 2 (not 0, null, or undefined)
              if (tier === 1 || tier === 2) {
                return (
                  <p className="text-sm font-semibold text-[#11CC9A] mb-6 text-center">
                    Eligible for Tier {tier} Voucher
                  </p>
                );
              }
              return null;
            })()}

            <div className="flex flex-col items-center justify-center">
              <div className="bg-white p-4 rounded-xl border-4 border-[#11CC9A] shadow-lg">
                <canvas ref={qrCanvasRef} />
              </div>
              <p className="mt-4 text-xs text-gray-500 text-center">
                Code: {selectedGameQR.qrCode}
              </p>
            </div>

            <button
              onClick={handleCloseQRModal}
              className="mt-6 w-full bg-[#11CC9A] text-white px-6 py-3 rounded-full hover:opacity-90 transition-colors font-body"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 
