import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ScavengerAPI } from "../api";

interface ClaimPrizeProps {}

const ClaimPrize: React.FC<ClaimPrizeProps> = () => {
  const navigate = useNavigate();
  const [voucherCode, setVoucherCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVoucherCode();
  }, []);

  const loadVoucherCode = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get phone number from localStorage
      const storedPhoneNumber = localStorage.getItem("keeta_phone_number");
      if (!storedPhoneNumber) {
        setError("Phone number not found. Please register again.");
        return;
      }
      
      // Generate voucher code
      const response = await ScavengerAPI.generateVoucher(storedPhoneNumber);
      
      if (response.success && response.data?.voucherCode) {
        setVoucherCode(response.data.voucherCode);
      } else {
        setError(response.error || "Failed to generate voucher code");
      }
    } catch (err) {
      console.error("Error loading voucher code:", err);
      setError("Failed to load voucher code");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFE41F] p-4 flex items-center justify-center font-body">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CC9A] mx-auto mb-4"></div>
          <p className="text-lg text-gray-700">Loading your voucher...</p>
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
            onClick={loadVoucherCode}
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
      <div className="max-w-md mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate("/dashboard")}
          className="mb-4 text-gray-700 hover:text-[#11CC9A] transition-colors font-body text-sm flex items-center gap-2"
        >
          ← Back to Dashboard
        </button>

        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <h1 className="text-3xl font-heading text-center text-[#11CC9A] mb-4">
            Claim Your Prize
          </h1>
          
          <p className="text-center text-gray-700 mb-6 font-body">
            Congratulations! You are able to claim the prize by showing below code to the booth.
          </p>
          
          <div className="text-center mb-6">
            <p className="text-sm text-gray-600 mb-4 font-body">Your Voucher Code:</p>
            <div className="bg-[#FFFF50] border-4 border-[#11CC9A] rounded-lg p-6">
              <span className="text-4xl font-heading text-[#11CC9A] tracking-wider">
                {voucherCode}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaimPrize;
