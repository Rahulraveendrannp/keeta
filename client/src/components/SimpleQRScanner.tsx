/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef, useCallback } from "react";
import jsQR from "jsqr";

interface SimpleQRScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
  title: string;
  expectedQRCode: string;
}

const SimpleQRScanner: React.FC<SimpleQRScannerProps> = ({
  onScan,
  onClose,
  title,
  expectedQRCode,
}) => {
  const [error, setError] = useState<string>("");
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string>("");
  const [isProcessingQR, setIsProcessingQR] = useState(false);
  const [invalidQRMessage, setInvalidQRMessage] = useState<string>("");
  const [isMobile, setIsMobile] = useState(false); // NEW: Mobile detection

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // NEW: Detect if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileKeywords = [
        "mobile",
        "android",
        "iphone",
        "ipad",
        "ipod",
        "blackberry",
        "windows phone",
      ];
      const isMobileUA = mobileKeywords.some((keyword) =>
        userAgent.includes(keyword)
      );
      const isTouchDevice =
        "ontouchstart" in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth <= 768;

      return isMobileUA || isTouchDevice || isSmallScreen;
    };

    setIsMobile(checkMobile());
  }, []);

  // Utility function to check for active media streams
  const checkActiveStreams = () => {
    console.log("🔍 Checking for active media streams...");

    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const cameras = devices.filter(
            (device) => device.kind === "videoinput"
          );
          console.log("📷 Available cameras:", cameras.length);
        })
        .catch((err) => {
          console.log("❌ Could not enumerate devices:", err);
        });
    }

    if (videoRef.current) {
      const video = videoRef.current;
      console.log("🎥 Video element state:", {
        paused: video.paused,
        srcObject: !!video.srcObject,
        readyState: video.readyState,
      });

      if (video.srcObject) {
        const stream = video.srcObject as MediaStream;
        console.log(
          "🎬 Video stream tracks:",
          stream.getTracks().map((track) => ({
            kind: track.kind,
            readyState: track.readyState,
            enabled: track.enabled,
          }))
        );
      }
    }

    if (streamRef.current) {
      console.log(
        "📡 StreamRef tracks:",
        streamRef.current.getTracks().map((track) => ({
          kind: track.kind,
          readyState: track.readyState,
          enabled: track.enabled,
        }))
      );
    }
  };

  useEffect(() => {
    console.log("📷 Starting camera initialization...");
    initializeCamera();

    return () => {
      console.log("🔴 useEffect cleanup running");
      cleanup();
    };
  }, []);

  const initializeCamera = async () => {
    try {
      setError("");
      setIsCameraReady(false);
      setInvalidQRMessage("");

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera not supported by this browser");
      }

      // Enhanced constraints for better mobile performance
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: isMobile ? 1920 : 1280, min: 640 }, // Higher resolution for mobile
          height: { ideal: isMobile ? 1080 : 720, min: 480 },
          frameRate: { ideal: 30, min: 15 }, // Better frame rate
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current
              .play()
              .then(() => {
                setIsCameraReady(true);
                setIsScanning(true);
                startQRDetection();
              })
              .catch((playError) => {
                console.error("Error playing video:", playError);
                setError(
                  "Failed to start camera preview. Please check permissions."
                );
              });
          }
        };

        videoRef.current.onerror = () => {
          setError("Video stream error. Please refresh and try again.");
        };
      }
    } catch (err: any) {
      console.error("Camera initialization error:", err);
      handleCameraError(err);
    }
  };

  const handleCameraError = (err: any) => {
    if (err.name === "NotAllowedError") {
      setError(
        "Camera permission denied. Please allow camera access and refresh the page."
      );
    } else if (err.name === "NotFoundError") {
      setError("No camera found on this device.");
    } else if (err.name === "NotReadableError") {
      setError(
        "Camera is being used by another application. Please close other apps and try again."
      );
    } else if (err.name === "OverconstrainedError") {
      setError("Camera constraints not supported. Trying fallback...");
      retryWithFallbackConstraints();
    } else {
      setError("Failed to access camera. Try manual input instead.");
    }
  };

  const retryWithFallbackConstraints = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().then(() => {
          setIsCameraReady(true);
          setIsScanning(true);
          setError("");
          startQRDetection();
        });
      }
    } catch (fallbackError) {
      console.error("Fallback camera error:", fallbackError);
      setError("Unable to access camera with any settings.");
    }
  };

  const validateQRCode = (scannedData: string): boolean => {
    return scannedData === expectedQRCode;
  };

  const startQRDetection = useCallback(() => {
    const detectQR = () => {
      if (
        videoRef.current &&
        canvasRef.current &&
        isCameraReady &&
        isScanning &&
        !isProcessingQR
      ) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");

        if (context && video.readyState === video.HAVE_ENOUGH_DATA) {
          // NEW: Resize canvas to smaller dimensions for faster processing (optimized for mobile)
          const maxDimension = isMobile ? 640 : 1024;
          let canvasWidth = video.videoWidth;
          let canvasHeight = video.videoHeight;
          const aspectRatio = video.videoWidth / video.videoHeight;

          if (canvasWidth > maxDimension || canvasHeight > maxDimension) {
            if (aspectRatio > 1) {
              // Landscape
              canvasWidth = maxDimension;
              canvasHeight = Math.round(maxDimension / aspectRatio);
            } else {
              // Portrait
              canvasHeight = maxDimension;
              canvasWidth = Math.round(maxDimension * aspectRatio);
            }
          }

          canvas.width = canvasWidth;
          canvas.height = canvasHeight;

          // Draw the resized video frame onto the canvas
          context.drawImage(video, 0, 0, canvas.width, canvas.height);

          // Get image data from the full resized canvas (no region needed)
          const imageData = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
          );

          // Detect QR with inversion attempts for better robustness
          const qrCode = jsQR(
            imageData.data,
            imageData.width,
            imageData.height,
            {
              inversionAttempts: "attemptBoth", // Try both normal and inverted for varied QR appearances
            }
          );

          if (qrCode && qrCode.data) {
            console.log("QR Code detected:", qrCode.data);
            console.log("Expected QR Code:", expectedQRCode);
            console.log("Detected in resized frame");

            const isValidQR = validateQRCode(qrCode.data);
            console.log("QR Code validation result:", isValidQR);

            if (isValidQR) {
              setIsScanning(false);
              setIsProcessingQR(true);
              setScanResult(qrCode.data);
              setInvalidQRMessage("");

              cleanup();

              setTimeout(() => {
                onScan(qrCode.data);
              }, 1000);

              return;
                         } else {
               console.log("❌ Invalid QR code scanned:", qrCode.data);
               setInvalidQRMessage("invalid");

               setTimeout(() => {
                 setInvalidQRMessage("");
               }, 3000);
             }
          }
        }
      }

      if (isScanning) {
        animationFrameRef.current = requestAnimationFrame(detectQR);
      }
    };

    detectQR();
  }, [
    isCameraReady,
    isScanning,
    isProcessingQR,
    expectedQRCode,
    onScan,
    isMobile,
  ]);

  useEffect(() => {
    if (isCameraReady && isScanning) {
      startQRDetection();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isCameraReady, isScanning, startQRDetection]);

  const cleanup = () => {
    console.log("🔴 Cleaning up QR Scanner - stopping camera and animations");
    setIsScanning(false);
    setIsCameraReady(false);
    setIsProcessingQR(false);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      console.log("✅ Animation frame cancelled");
    }

    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
      console.log("✅ Scan interval cleared");
    }

    if (videoRef.current) {
      console.log("🔴 Stopping video element...");
      const video = videoRef.current;

      video.pause();
      console.log("✅ Video paused");

      video.onloadedmetadata = null;
      video.onerror = null;

      const videoStream = video.srcObject as MediaStream;
      if (videoStream) {
        console.log("🔴 Found stream in video element, stopping tracks...");
        videoStream.getTracks().forEach((track, index) => {
          console.log(
            `🔴 Video element track ${index}:`,
            track.kind,
            track.readyState,
            track.enabled
          );
          track.stop();
          console.log(
            `✅ Video element track ${index} stopped:`,
            track.readyState
          );
        });
      }

      video.srcObject = null;
      console.log("✅ Video srcObject cleared");

      video.load();
      console.log("✅ Video element reloaded with no source");
    }

    if (streamRef.current) {
      console.log("🔴 Stopping streamRef tracks...");
      streamRef.current.getTracks().forEach((track, index) => {
        console.log(
          `🔴 StreamRef track ${index}:`,
          track.kind,
          track.readyState,
          track.enabled
        );
        if (track.readyState !== "ended") {
          track.stop();
          console.log(`✅ StreamRef track ${index} stopped:`, track.readyState);
        } else {
          console.log(`⚠️ StreamRef track ${index} was already ended`);
        }
      });
      streamRef.current = null;
      console.log("✅ StreamRef cleared");
    }

    if ((window as any).gc) {
      (window as any).gc();
      console.log("✅ Forced garbage collection");
    }

    console.log("🔴 QR Scanner cleanup completed - Camera should be OFF");

    setTimeout(() => {
      console.log("🔍 Verifying camera shutdown...");
      if (videoRef.current && videoRef.current.srcObject) {
        console.log("⚠️ WARNING: Video still has srcObject after cleanup!");
      } else {
        console.log("✅ Verified: Video srcObject is null");
      }

      if (streamRef.current) {
        console.log("⚠️ WARNING: StreamRef still exists after cleanup!");
      } else {
        console.log("✅ Verified: StreamRef is null");
      }
    }, 100);
  };

  const handleRetry = () => {
    setError("");
    setScanResult("");
    setIsProcessingQR(false);
    setInvalidQRMessage("");
    cleanup();

    setTimeout(() => {
      initializeCamera();
    }, 100);
  };

  useEffect(() => {
    console.log("🔄 Component mounted - QR Scanner initialized");

    return () => {
      console.log(
        "🔴 QR Scanner component unmounting - forcing camera cleanup"
      );

      if (videoRef.current) {
        const video = videoRef.current;
        video.pause();

        const stream = video.srcObject as MediaStream;
        if (stream) {
          console.log("🔴 UNMOUNT: Stopping tracks from video element...");
          stream.getTracks().forEach((track) => {
            console.log(
              "🔴 UNMOUNT: Force stopping track:",
              track.kind,
              track.readyState
            );
            track.stop();
          });
        }

        video.srcObject = null;
        video.load();
      }

      if (streamRef.current) {
        console.log("🔴 UNMOUNT: Stopping tracks from streamRef...");
        streamRef.current.getTracks().forEach((track) => {
          if (track.readyState !== "ended") {
            console.log(
              "🔴 UNMOUNT: Force stopping streamRef track:",
              track.kind
            );
            track.stop();
          }
        });
        streamRef.current = null;
      }

      cleanup();
    };
  }, []);

  useEffect(() => {
    const emergencyCleanup = () => {
      console.log("🚨 EMERGENCY: Stopping all camera activity");

      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => {
          console.log("🚨 EMERGENCY: Stopping track:", track.kind);
          track.stop();
        });
        videoRef.current.srcObject = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          console.log("🚨 EMERGENCY: Stopping streamRef track:", track.kind);
          track.stop();
        });
        streamRef.current = null;
      }
    };

    const handleBeforeUnload = () => {
      console.log("🔴 Window unloading - emergency camera cleanup");
      emergencyCleanup();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log("🔴 Page hidden - emergency camera stop");
        emergencyCleanup();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      emergencyCleanup();
    };
  }, []);

  // NEW: Dynamic viewfinder size based on device type
  const getViewfinderSize = () => {
    if (isMobile) {
      return "w-64 h-64"; // Much larger for mobile (256px x 256px)
    }
    return "w-48 h-48"; // Original size for desktop (192px x 192px)
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center">
      <div className="bg-black text-white rounded-xl p-4 max-w-md w-full mx-4 relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-heading text-white">{title}</h2>
          <button
            onClick={() => {
              console.log("🔴 Close button clicked - cleaning up camera");
              checkActiveStreams();
              cleanup();
              setTimeout(() => {
                console.log("🔍 Post-cleanup verification:");
                checkActiveStreams();
              }, 200);
              setTimeout(() => {
                onClose();
              }, 300);
            }}
            className="text-gray-300 hover:text-white p-2"
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

        {/* Fixed Error/Message Area - Always takes up space */}
        <div className="mb-4 min-h-[80px]">
          {/* Invalid QR Message Display */}
          {invalidQRMessage && (
            <div className="p-3 bg-red-900 border border-red-600 rounded-lg animate-pulse">
              <p className="text-red-200 text-sm font-body flex items-center gap-2">
                <span>❌</span>
                <span>Uh oh! You found a QR code, just not the right one. Keep looking!</span>
              </p>
            </div>
          )}

          {/* Scan Result Display */}
          {scanResult && (
            <div className="p-3 bg-green-900 border border-green-600 rounded-lg">
              <p className="text-green-200 text-sm font-body">
                ✅ Valid QR Code Detected!
              </p>
              <p className="text-green-300 text-xs mt-1 font-mono break-all">
                {scanResult}
              </p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-900 border border-red-600 rounded-lg">
              <p className="text-red-200 text-sm mb-2">⚠️ {error}</p>
              <div className="flex gap-2">
                <button
                  onClick={handleRetry}
                  className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Camera View - Never moves */}
        <div className="relative mb-4">
          <div
            className="relative bg-gray-900 rounded-lg overflow-hidden"
            style={{ aspectRatio: "4/3" }}
          >
            {/* Video Element */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              style={{
                display: isCameraReady ? "block" : "none",
                position: "relative",
                zIndex: 1,
              }}
            />

            {/* Loading State */}
            {!isCameraReady && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-10">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
                  <p className="text-gray-400 text-sm">
                    Initializing camera...
                  </p>
                </div>
              </div>
            )}

            {/* Enhanced Viewfinder Overlay */}
            {isCameraReady && !isProcessingQR && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative z-10">
                  <div className={`${getViewfinderSize()} relative`}>
                    {/* Larger corner brackets for mobile */}
                    <div
                      className={`absolute top-0 left-0 ${
                        isMobile
                          ? "w-12 h-12 border-l-4 border-t-4"
                          : "w-8 h-8 border-l-4 border-t-4"
                      } drop-shadow-lg ${
                        invalidQRMessage ? "border-red-500" : "border-white"
                      }`}
                    ></div>
                    <div
                      className={`absolute top-0 right-0 ${
                        isMobile
                          ? "w-12 h-12 border-r-4 border-t-4"
                          : "w-8 h-8 border-r-4 border-t-4"
                      } drop-shadow-lg ${
                        invalidQRMessage ? "border-red-500" : "border-white"
                      }`}
                    ></div>
                    <div
                      className={`absolute bottom-0 left-0 ${
                        isMobile
                          ? "w-12 h-12 border-l-4 border-b-4"
                          : "w-8 h-8 border-l-4 border-b-4"
                      } drop-shadow-lg ${
                        invalidQRMessage ? "border-red-500" : "border-white"
                      }`}
                    ></div>
                    <div
                      className={`absolute bottom-0 right-0 ${
                        isMobile
                          ? "w-12 h-12 border-r-4 border-b-4"
                          : "w-8 h-8 border-r-4 border-b-4"
                      } drop-shadow-lg ${
                        invalidQRMessage ? "border-red-500" : "border-white"
                      }`}
                    ></div>

                    {/* Scanning line animation */}
                    {isScanning && (
                      <div className="absolute inset-0 overflow-hidden">
                        <div
                          className={`absolute w-full ${
                            isMobile ? "h-1" : "h-0.5"
                          } ${
                            invalidQRMessage ? "bg-red-500" : "bg-orange-500"
                          }`}
                          style={{
                            top: "50%",
                            boxShadow: invalidQRMessage
                              ? "0 0 20px rgba(239, 68, 68, 0.8)"
                              : "0 0 20px rgba(249, 115, 22, 0.8)",
                            animation: "scanLine 2s ease-in-out infinite",
                          }}
                        ></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* CSS Animation for scan line */}
            <style>{`
              @keyframes scanLine {
                0% { transform: translateY(-${
                  isMobile ? "120px" : "100px"
                }); opacity: 0; }
                50% { opacity: 1; }
                100% { transform: translateY(${
                  isMobile ? "120px" : "100px"
                }); opacity: 0; }
              }
            `}</style>

            {/* Processing Overlay */}
            {isProcessingQR && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 z-20">
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <svg
                      className="w-8 h-8 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <p className="text-green-400 font-body text-lg">
                    Valid QR Code Scanned!
                  </p>
                  <p className="text-gray-300 text-sm">
                    Processing checkpoint...
                  </p>
                </div>
              </div>
            )}

            {/* Hidden canvas for QR processing */}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>

        {/* Enhanced Instructions */}
        <div className="text-center text-gray-400 text-sm"></div>
      </div>
    </div>
  );
};

export default SimpleQRScanner;
