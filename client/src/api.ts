/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// api.ts - Twilio OTP Implementation
import type {
  ApiResponse,
  OTPVerificationResponse,
  GameProgress,
} from "./types";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE ||
  "https://keeta-be-657638641053.us-central1.run.app/api";

function setToken(token: string) {
  localStorage.setItem("jwt_token", token);
}
function getToken(): string | null {
  return localStorage.getItem("jwt_token");
}
function clearToken() {
  localStorage.removeItem("jwt_token");
  localStorage.removeItem("keeta_game_session");
  localStorage.removeItem("keeta_phone_number");
}

export class ScavengerAPI {
  // Health check method
  static async healthCheck(): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(`${API_BASE.replace("/api", "")}/health`);
      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: "API server is not accessible",
      };
    }
  }
  // User Progress Management
  static async getUserProgress(): Promise<ApiResponse<any>> {
    try {
      const token = getToken();

      if (!token) {
        return {
          success: false,
          error: "No authentication token found",
        };
      }

      const response = await fetch(`${API_BASE}/progress`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      // Check if token is invalid
      if (response.status === 401 || data.error?.includes("token")) {
        // Clear invalid token and redirect to registration
        clearToken();
        return {
          success: false,
          error: "Session expired. Please register again.",
        };
      }

      return data;
    } catch (error) {
      return {
        success: false,
        error: "Failed to fetch user progress",
      };
    }
  }


  static async completeCard(cardId: number): Promise<ApiResponse<any>> {
    try {
      const token = getToken();
      if (!token) {
        return {
          success: false,
          error: "No authentication token found",
        };
      }

      const response = await fetch(`${API_BASE}/progress/find-the-card/${cardId}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: "Failed to complete card",
      };
    }
  }

  static async updateCurrentState(
    currentPage: string
  ): Promise<ApiResponse<any>> {
    try {
      const token = getToken();
      if (!token) {
        return {
          success: false,
          error: "No authentication token found",
        };
      }

      const response = await fetch(`${API_BASE}/progress/state`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPage }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: "Failed to update state",
      };
    }
  }

  static async getLeaderboard(): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(`${API_BASE}/progress/leaderboard`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: "Failed to fetch leaderboard",
      };
    }
  }
  // Send OTP using Qatar SMS API
  static async registerUser(
    phoneNumber: string,
    name: string
  ): Promise<ApiResponse<{ otpSent: boolean; isTestNumber?: boolean }>> {
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, name }),
      });

      const data = await response.json();

      if (data.success) {
        return {
          success: true,
          data: {
            otpSent: true,
            isTestNumber: false,
          },
        };
      } else {
        return {
          success: false,
          error: data.message || "Failed to send OTP",
        };
      }
    } catch (error) {
      return {
        success: false,
        error: "Network error. Please try again.",
      };
    }
  }

  // Verify OTP using Qatar SMS API
  static async verifyOTP(
    phoneNumber: string,
    otpCode: string
  ): Promise<OTPVerificationResponse> {
    try {
      const response = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, otpCode }),
      });

      const data = await response.json();

      if (data.success && data.data?.token) {
        setToken(data.data.token);

        // Create game session
        const gameSession = {
          userId: data.data.session.userId,
          startTime: Date.now(),
        };

        return {
          success: true,
          session: gameSession,
        };
      } else {
        return {
          success: false,
          error: data.message || "Invalid OTP",
        };
      }
    } catch (error) {
      return {
        success: false,
        error: "Network error. Please try again.",
      };
    }
  }

  // Resend OTP using Qatar SMS API
  static async resendOTP(
    phoneNumber: string
  ): Promise<ApiResponse<{ otpSent: boolean }>> {
    try {
      const response = await fetch(`${API_BASE}/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });

      const data = await response.json();

      if (data.success) {
        return {
          success: true,
          data: { otpSent: true },
        };
      } else {
        return {
          success: false,
          error: data.message || "Failed to resend OTP",
        };
      }
    } catch (error) {
      return {
        success: false,
        error: "Network error. Please try again.",
      };
    }
  }

  // Logout
  static async logout() {
    try {
      clearToken();
      localStorage.removeItem("keeta_game_session");
      localStorage.removeItem("keeta_phone_number");
      localStorage.removeItem("jwt_token");
    } catch (error) {
      // Silent fail
    }
  }

  static async getGameProgress(): Promise<ApiResponse<GameProgress>> {
    try {
      const token = getToken();
      if (!token) {
        return { success: false, error: "Not authenticated" };
      }

      const response = await fetch(`${API_BASE}/game/progress`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await response.json();

      // Check if token is invalid
      if (response.status === 401 || json.error?.includes("token")) {
        clearToken();
        return {
          success: false,
          error: "Session expired. Please register again.",
        };
      }

      if (!response.ok) {
        return {
          success: false,
          error: json?.message || "Failed to load progress",
        };
      }

      return { success: true, data: json.data };
    } catch (error: any) {
      return { success: false, error: error?.message || "Network error" };
    }
  }

  // Admin API methods (no auth required)
  static async getAllUsers(page: number = 1, limit: number = 25, search: string = ''): Promise<ApiResponse<any>> {
    try {
      console.log("📊 API: Getting all users...", { page, limit, search });

      const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
      const response = await fetch(`${API_BASE}/admin/all-users?page=${page}&limit=${limit}${searchParam}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      console.log("📊 API: Get all users response:", data);

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || "Failed to load users",
        };
      }

      return { success: true, data: data };
    } catch (error: any) {
      console.error("Failed to load users:", error);
      return { success: false, error: error?.message || "Network error" };
    }
  }

  // New Admin API methods for claim functionality
  static async getTotalUsers(): Promise<ApiResponse<{ totalUsers: number }>> {
    try {
      console.log("📊 API: Getting total users count...");

      const response = await fetch(`${API_BASE}/admin/total-users`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      console.log("📊 API: Get total users response:", data);

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || "Failed to load total users",
        };
      }

      return { success: true, data: { totalUsers: data?.totalUsers ?? 0 } };
    } catch (error: any) {
      console.error("Failed to load total users:", error);
      return { success: false, error: error?.message || "Network error" };
    }
  }

  static async generateVoucher(phoneNumber: string): Promise<ApiResponse<any>> {
    try {
      console.log("🎫 API: Generating voucher code...", { phoneNumber });

      const response = await fetch(`${API_BASE}/admin/generate-voucher`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber,
        }),
      });

      const data = await response.json();
      console.log("🎫 API: Generate voucher response:", data);

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || "Failed to generate voucher code",
        };
      }

      console.log("🎫 API: Voucher code retrieved/generated for user");

      return { success: true, data: data.data };
    } catch (error: any) {
      console.error("Failed to generate voucher code:", error);
      return { success: false, error: error?.message || "Network error" };
    }
  }

  static async markUserAsClaimed(
    voucherCode: string
  ): Promise<ApiResponse<any>> {
    try {
      console.log("🏆 API: Marking user as claimed...", { voucherCode });

      const response = await fetch(`${API_BASE}/admin/mark-claimed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voucherCode,
        }),
      });

      const data = await response.json();
      console.log("🏆 API: Mark claimed response:", data);

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || "Failed to mark user as claimed",
        };
      }

      return { success: true, data: data };
    } catch (error: any) {
      console.error("Failed to mark user as claimed:", error);
      return { success: false, error: error?.message || "Network error" };
    }
  }

  static async checkUserClaimed(
    phoneNumber: string
  ): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(
        `${API_BASE}/admin/check-claimed/${phoneNumber}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || "Failed to check claim status",
        };
      }

      return { success: true, data: data.data };
    } catch (error: any) {
      return { success: false, error: error?.message || "Network error" };
    }
  }

  static async getUserQRCodes(phoneNumber: string): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(
        `${API_BASE}/admin/user-qr-codes/${phoneNumber}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || "Failed to get user QR codes",
        };
      }

      return { success: true, data: data.data };
    } catch (error: any) {
      return { success: false, error: error?.message || "Network error" };
    }
  }

  static async scanQRCode(qrCode: string): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(`${API_BASE}/admin/scan-qr`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ qrCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || "Failed to scan QR code",
        };
      }

      return { success: true, data: data.data };
    } catch (error: any) {
      console.error("Failed to scan QR code:", error);
      return { success: false, error: error?.message || "Network error" };
    }
  }

  static async toggleClaimStatus(userId: string, gameNumber?: number): Promise<ApiResponse<any>> {
    try {
      console.log("🔄 API: Toggling claim status...", { userId, gameNumber });

      const response = await fetch(`${API_BASE}/admin/toggle-claim-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          gameNumber,
        }),
      });

      const data = await response.json();
      console.log("🔄 API: Toggle claim status response:", data);

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || "Failed to toggle claim status",
        };
      }

      return { success: true, data: data };
    } catch (error: any) {
      console.error("Failed to toggle claim status:", error);
      return { success: false, error: error?.message || "Network error" };
    }
  }

  static async getAdminStatistics(): Promise<ApiResponse<any>> {
    try {
      console.log("📊 API: Getting admin statistics...");

      const response = await fetch(`${API_BASE}/admin/statistics`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      console.log("📊 API: Get admin statistics response:", data);

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || "Failed to load statistics",
        };
      }

      return { success: true, data: data.data };
    } catch (error: any) {
      console.error("Failed to load admin statistics:", error);
      return { success: false, error: error?.message || "Network error" };
    }
  }
}
