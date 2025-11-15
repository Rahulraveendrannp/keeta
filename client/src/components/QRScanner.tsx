import React, { useState, useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

interface QRScannerProps {
  onScan: (result: string) => void;
  onError: (error: string) => void;
  onClose: () => void;
  title: string;
  expectedQR?: string; // For validation
}

const QRScanner: React.FC<QRScannerProps> = ({
  onScan,
  onClose,
  title,
  expectedQR,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>("");
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && !scannerRef.current) {
      // Initialize the QR scanner
      scannerRef.current = new Html5QrcodeScanner(
        "qr-reader",
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        false,
      );

      // Start scanning
      scannerRef.current.render(
        (decodedText: string) => {
          // QR code successfully scanned
          console.log("QR Code scanned:", decodedText);

          // If expectedQR is provided, validate it
          if (expectedQR) {
            if (
              decodedText.trim().toUpperCase() ===
              expectedQR.trim().toUpperCase()
            ) {
              // Valid QR code
              onScan(decodedText);
              stopScanner();
            } else {
              // Invalid QR code
              setError("Incorrect QR code! Please scan the correct one.");
              setTimeout(() => setError(""), 3000);
            }
          } else {
            // No validation needed, just return the scanned result
            onScan(decodedText);
            stopScanner();
          }
        },
        (errorMessage: string) => {
          // Handle scanning errors
          console.log("QR Scan error:", errorMessage);
          if (errorMessage.includes("NotFound")) {
            // This is normal - no QR code in view
            return;
          }
          setError(`Scanning error: ${errorMessage}`);
        },
      );

      setIsScanning(true);
    }

    return () => {
      stopScanner();
    };
  }, [expectedQR, onScan]);

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
      <div className="bg-[#F4EDE3] rounded-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-heading text-gray-800">{title}</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 p-2"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* QR Scanner Container */}
        <div className="mb-4">
          <div id="qr-reader" ref={containerRef} className="w-full" />
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Instructions */}
        <div className="text-center text-gray-600 text-sm">
          <p className="mb-2">📱 Point your camera at the QR code</p>
          <p className="mb-2">🎯 Keep the QR code within the frame</p>
          <p>✅ Scanning will happen automatically</p>
        </div>

        {/* Status */}
        <div className="mt-4 text-center">
          <div
            className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-body ${
              isScanning
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full mr-2 ${
                isScanning ? "bg-green-500 animate-pulse" : "bg-gray-500"
              }`}
            />
            {isScanning ? "Scanning..." : "Ready"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
