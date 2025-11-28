import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import AdminLogin from "./AdminLogin";
import QRCodeLib from "qrcode";

const AdminGame3QR: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = () => {
    const authenticated = localStorage.getItem("adminAuthenticated") === "true";
    const loginTime = localStorage.getItem("adminLoginTime");

    if (authenticated && loginTime) {
      const loginTimestamp = parseInt(loginTime, 10);
      const hoursSinceLogin = (Date.now() - loginTimestamp) / (1000 * 60 * 60);
      if (hoursSinceLogin < 24) {
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }
      localStorage.removeItem("adminAuthenticated");
      localStorage.removeItem("adminLoginTime");
    }
    setIsAuthenticated(false);
    setIsLoading(false);
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleShowQRCode = (tier: number) => {
    setSelectedTier(tier);
    setShowQRModal(true);
  };

  const handleCloseQRModal = () => {
    setShowQRModal(false);
    setSelectedTier(null);
  };

  useEffect(() => {
    if (showQRModal && selectedTier && qrCanvasRef.current) {
      const qrCode = `KEETO_GAME3_TIER${selectedTier}`;
      QRCodeLib.toCanvas(
        qrCanvasRef.current,
        qrCode,
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
  }, [showQRModal, selectedTier]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFE41F] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CC9A] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#FFE41F] p-4 font-body">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-heading text-[#11CC9A]">
                Game 3 - Ball Catch
              </h1>
              <p className="text-sm text-gray-600 mt-2">
                Display QR codes for users to scan at the station
              </p>
            </div>
            <button
              onClick={() => navigate("/admin")}
              className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Back to Admin
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-heading text-gray-800 mb-6 text-center">
            Select Tier to Display QR Code
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <button
              onClick={() => handleShowQRCode(1)}
              className="bg-[#11CC9A] text-white px-8 py-6 rounded-xl hover:opacity-90 transition-all transform hover:scale-105 shadow-lg font-body text-lg font-semibold"
            >
              Tier 1
            </button>
            
            <button
              onClick={() => handleShowQRCode(2)}
              className="bg-[#11CC9A] text-white px-8 py-6 rounded-xl hover:opacity-90 transition-all transform hover:scale-105 shadow-lg font-body text-lg font-semibold"
            >
              Tier 2
            </button>
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQRModal && selectedTier && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
            <button
              onClick={handleCloseQRModal}
              className="absolute top-4 right-4 text-gray-600 hover:text-gray-900"
            >
              <X className="w-6 h-6" />
            </button>

            <h3 className="text-2xl font-heading text-[#11CC9A] mb-2 text-center">
              Game 3 - Tier {selectedTier} QR Code
            </h3>
            <p className="text-sm text-gray-600 mb-2 text-center">
              Users should scan this QR code at the station to complete Game 3 - Ball Catch
            </p>
            <p className="text-sm font-semibold text-[#11CC9A] mb-6 text-center">
              Tier {selectedTier} Station QR Code
            </p>

            <div className="flex flex-col items-center justify-center">
              <div className="bg-white p-4 rounded-xl border-4 border-[#11CC9A] shadow-lg">
                <canvas ref={qrCanvasRef} />
              </div>
              <p className="mt-4 text-xs text-gray-500 text-center">
                Code: KEETO_GAME3_TIER{selectedTier}
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

export default AdminGame3QR;

