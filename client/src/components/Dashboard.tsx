import React, { useEffect, useMemo, useState, useRef } from "react";
import { CheckCircle, Gift, LogOut, QrCode, X } from "lucide-react";
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
    title: "🧠 AI Photobooth",
    description: "Play the quiz and get your AI avatar.",
    qrCode: "AI_PHOTOBOOTH_QR_001",
    icon: "/Lunchbox.svg",
  },
  {
    id: 2,
    title: "👀 Peek-a-Booth",
    description: "Peek inside and answer to win.",
    qrCode: "PEEK_A_BOOTH_QR_002",
    icon: "/Runner.svg",
  },
  {
    id: 3,
    title: "🛵 Delivery Dash",
    description: "Finish the dash and score high.",
    qrCode: "DELIVERY_DASH_QR_003",
    icon: "/Talabeat.svg",
  },
  {
    id: 4,
    title: "🐆 Catch-a-Tail",
    description: "Catch the tails and test reflex.",
    qrCode: "CATCH_A_TAIL_QR_004",
    icon: "/Scavenger.svg",
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
  const [userQRCodes, setUserQRCodes] = useState<Record<number, string>>({});
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const completedSet = useMemo(() => new Set(completedCards), [completedCards]);
  const totalCompleted = completedCards.length;
  const totalCards = GAME_TASKS.length;
  const progressPercentage = Math.round((totalCompleted / totalCards) * 100);

  useEffect(() => {
    const initialise = async () => {
      setIsLoading(true);
      try {
        await ScavengerAPI.updateCurrentState("dashboard");
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
            4: claims.game4 || false,
          });
        }

        // Get user QR codes
        const qrResponse = await ScavengerAPI.getUserQRCodes(phoneNumber);
        if (qrResponse.success && qrResponse.data) {
          const qrCodes = qrResponse.data.gameQRCodes || {};
          setUserQRCodes({
            1: qrCodes.game1 || '',
            2: qrCodes.game2 || '',
            3: qrCodes.game3 || '',
            4: qrCodes.game4 || '',
          });
        }
      } catch (error) {
        console.error("Error loading progress:", error);
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

  const handleScanSuccess = async (): Promise<void> => {
    if (!selectedCard) return;

    try {
      setIsSubmitting(true);
      setErrorMessage("");

        await ScavengerAPI.updateCurrentState("find-the-card");
      const response = await ScavengerAPI.completeCard(selectedCard.id);

      if (response.success) {
        setCompletedCards((prev) => {
          const next = new Set(prev);
          next.add(selectedCard.id);
          return Array.from(next).sort((a, b) => a - b);
        });
        setShowScanner(false);
        setSelectedCard(null);
      } else {
        setErrorMessage(response.error || "Unable to record this scan. Please try again.");
      }
    } catch (error) {
      console.error("Error completing card:", error);
      setErrorMessage("Something went wrong while saving your scan. Please try again.");
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

  const handleShowQRCode = (gameId: number) => {
    const qrCode = userQRCodes[gameId];
    if (qrCode) {
      setSelectedGameQR({ gameId, qrCode });
      setShowQRModal(true);
    } else {
      setErrorMessage(`QR code not available for Game ${gameId}`);
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
        (error) => {
          if (error) console.error("Error generating QR code:", error);
        }
      );
    }
  }, [showQRModal, selectedGameQR]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFE41F] flex items-center justify-center">
        <div className="bg-white rounded-xl p-6 text-center shadow-lg">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CC9A] mx-auto mb-4" />
          <p className="text-gray-700 font-body">Loading your cards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFE41F] p-4 font-body">
      <div className="max-w-5xl mx-auto">
        <header className="bg-white rounded-xl shadow-lg p-5 sm:p-6 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-heading text-[#11CC9A]">Welcome {userName?.split('')[0]?.toUpperCase()+userName?.slice(1)}!</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                Complete each station by scanning the QR codes. Finish all four to unlock your reward.
              </p>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600 mb-2">
                  <span>{totalCompleted}/{totalCards} games completed</span>
                  <span>{progressPercentage}% complete</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3">
                  <div
                    className="bg-[#11CC9A] h-2 sm:h-3 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        {errorMessage && (
          <div className="bg-white/90 text-red-600 border border-red-300 rounded-lg p-3 mb-4 text-sm shadow">
            {errorMessage}
          </div>
        )}

        <section className="grid grid-cols-2 gap-4 sm:gap-6">
          {GAME_TASKS.map((task) => {
            const isCompleted = completedSet.has(task.id);
            return (
              <article
                key={task.id}
                className={`bg-white rounded-xl shadow-lg p-5 flex flex-col justify-between transition transform hover:-translate-y-1 hover:shadow-2xl ${
                  isCompleted ? "ring-2 ring-[#11CC9A]" : ""
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-4xl">
                      {task.title.split(' ')[0]}
                    </div>
                    {isCompleted && (
                      <div className="ml-auto">
                        <CheckCircle className="w-6 h-6 text-[#11CC9A]" />
                      </div>
                    )}
                  </div>
                  <h2 className="text-lg font-heading text-gray-900 mb-2">
                    {task.title.split(' ').slice(1).join(' ')}
                  </h2>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {task.description}
                  </p>
                </div>
                <div className="mt-6 space-y-2">
                  {!isCompleted ? (
                    <button
                      onClick={() => handleOpenScanner(task)}
                      disabled={isSubmitting}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full font-body text-sm transition-colors bg-[#11CC9A] text-white hover:opacity-90 disabled:opacity-60"
                    >
                      <QrCode className="w-4 h-4" />
                      Scan
                    </button>
                  ) : gameClaims[task.id] ? (
                    <button
                      disabled
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full font-body text-sm bg-gray-400 text-white cursor-not-allowed"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Claimed
                    </button>
                  ) : (
                    <button
                      onClick={() => handleShowQRCode(task.id)}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full font-body text-sm transition-colors bg-[#11CC9A] text-white hover:opacity-90"
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

        {/* Logout button at bottom */}
        <footer className="mt-6 sm:mt-8 flex justify-center">
          <button
            onClick={onLogout}
            className="inline-flex items-center justify-center gap-2 bg-[#11CC9A] text-white px-6 py-2 rounded-full hover:opacity-90 transition-colors text-sm font-body"
          >
            <LogOut className="w-4 h-4" />
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
              Hold the QR code for {selectedCard.title} inside the frame to capture it.
            </p>

            <SimpleQRScanner
              title=""
              expectedQRCode={selectedCard.qrCode}
              onScan={() => { handleScanSuccess(); }}
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
            <p className="text-sm text-gray-600 mb-6 text-center">
              Show this QR code to the admin to claim your reward for{" "}
              {GAME_TASKS.find(t => t.id === selectedGameQR.gameId)?.title || `Game ${selectedGameQR.gameId}`}
            </p>

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
