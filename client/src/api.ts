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
  "https://talabat-scavenger-hunt-backend-657638641053.us-central1.run.app/api";

function setToken(token: string) {
  console.log(
    "🔐 setToken: Saving token to localStorage:",
    token ? "Token provided" : "No token"
  );
  localStorage.setItem("jwt_token", token);
  console.log("🔐 setToken: Token saved successfully");
}
function getToken(): string | null {
  const token = localStorage.getItem("jwt_token");
  console.log(
    "🔐 getToken: Retrieved token from localStorage:",
    token ? "Token exists" : "No token found"
  );
  return token;
}
function clearToken() {
  console.log("🔐 clearToken: Clearing JWT token from localStorage");
  localStorage.removeItem("jwt_token");
    localStorage.removeItem("keeta_game_session");
    localStorage.removeItem("keeta_phone_number");
  console.log("🔐 clearToken: All tokens cleared");
}

export class ScavengerAPI {
  // Health check method
  static async healthCheck(): Promise<ApiResponse<any>> {
    try {
      console.log("Checking API health...");
      const response = await fetch(`${API_BASE.replace("/api", "")}/health`);
      const data = await response.json();
      console.log("Health check response:", data);
      return data;
    } catch (error) {
      console.error("Health check failed:", error);
      return {
        success: false,
        error: "API server is not accessible",
      };
    }
  }
  // User Progress Management
  static async getUserProgress(): Promise<ApiResponse<any>> {
    try {
      console.log("🔍 getUserProgress: Attempting to get token...");
      const token = getToken();
      console.log(
        "🔍 getUserProgress: Token result:",
        token ? "Token found" : "No token"
      );

      if (!token) {
        console.error("❌ getUserProgress: No authentication token found");
        return {
          success: false,
          error: "No authentication token found",
        };
      }

      console.log("Fetching user progress...");

      const response = await fetch(`${API_BASE}/progress`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      console.log("User progress response:", data);

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
      console.error("Error fetching user progress:", error);
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

      console.log("🎴 Completing card:", cardId);

      const response = await fetch(`${API_BASE}/progress/find-the-card/${cardId}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      console.log("🎴 Card completion response:", data);
      return data;
    } catch (error) {
      console.error("❌ Error completing card:", error);
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
        console.log("❌ updateCurrentState: No authentication token found");
        return {
          success: false,
          error: "No authentication token found",
        };
      }

      console.log("🔍 updateCurrentState: Updating current state:", {
        currentPage,
      });
      console.log(
        "🔍 updateCurrentState: API URL:",
        `${API_BASE}/progress/state`
      );

      const response = await fetch(`${API_BASE}/progress/state`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPage }),
      });

      console.log("🔍 updateCurrentState: Response status:", response.status);
      console.log("🔍 updateCurrentState: Response ok:", response.ok);

      const data = await response.json();
      console.log("🔍 updateCurrentState: Update state response:", data);
      return data;
    } catch (error) {
      console.error("❌ updateCurrentState: Error updating state:", error);
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
      console.error("Error fetching leaderboard:", error);
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
      console.log("Sending SMS OTP to:", phoneNumber);

      const response = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, name }),
      });

      const data = await response.json();

      if (data.success) {
        console.log("SMS OTP sent successfully");
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
      console.error("SMS OTP error:", error);
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
      console.log("Verifying SMS OTP for:", phoneNumber, "Code:", otpCode);

      const response = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, otpCode }),
      });

      const data = await response.json();
      console.log("🔐 API: Server response data:", data);
      console.log(
        "🔐 API: Checking if token exists in response:",
        data.data?.token ? "Token found" : "No token in response"
      );

      if (data.success && data.data?.token) {
        console.log("🔐 API: Received token from server:", data.data.token);
        setToken(data.data.token);
        console.log("🔐 API: Token saved to localStorage");

        // Verify token was saved
        const savedToken = getToken();
        console.log(
          "🔐 API: Verified saved token:",
          savedToken ? "Token exists" : "No token found"
        );

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
      console.error("SMS verification error:", error);
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
      console.log("🔐 Logout: Clearing all authentication data...");
      clearToken();
      // Clear all related localStorage items
    localStorage.removeItem("keeta_game_session");
    localStorage.removeItem("keeta_phone_number");
      localStorage.removeItem("jwt_token");
      console.log("🔐 Logout: All authentication data cleared successfully");
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  static async getGameProgress(): Promise<ApiResponse<GameProgress>> {
    try {
      const token = getToken();
      if (!token) {
        console.log("❌ getGameProgress: No authentication token found");
        return { success: false, error: "Not authenticated" };
      }

      console.log("🔍 getGameProgress: Fetching game progress...");
      console.log("🔍 getGameProgress: API URL:", `${API_BASE}/game/progress`);
      console.log("🔍 getGameProgress: Token available:", token ? "Yes" : "No");

      const response = await fetch(`${API_BASE}/game/progress`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("🔍 getGameProgress: Response status:", response.status);
      console.log("🔍 getGameProgress: Response ok:", response.ok);

      const json = await response.json();
      console.log("🔍 getGameProgress: Game progress response:", json);

      // Check if token is invalid
      if (response.status === 401 || json.error?.includes("token")) {
        console.log(
          "🔍 getGameProgress: Token invalid, clearing and redirecting"
        );
        // Clear invalid token and redirect to registration
        clearToken();
        return {
          success: false,
          error: "Session expired. Please register again.",
        };
      }

      if (!response.ok) {
        console.log("🔍 getGameProgress: Response not ok, returning error");
        return {
          success: false,
          error: json?.message || "Failed to load progress",
        };
      }

      console.log(
        "🔍 getGameProgress: Successfully loaded progress:",
        json.data
      );
      return { success: true, data: json.data };
    } catch (error: any) {
      console.error("❌ getGameProgress: Error fetching game progress:", error);
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
      console.log("🔍 API: Checking if user is claimed...", { phoneNumber });

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
      console.log("🔍 API: Check claimed response:", data);

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || "Failed to check claim status",
        };
      }

      return { success: true, data: data.data };
    } catch (error: any) {
      console.error("Failed to check claim status:", error);
      return { success: false, error: error?.message || "Network error" };
    }
  }

  static async toggleClaimStatus(userId: string): Promise<ApiResponse<any>> {
    try {
      console.log("🔄 API: Toggling claim status...", { userId });

      const response = await fetch(`${API_BASE}/admin/toggle-claim-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
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
