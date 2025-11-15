import React, { useEffect, useMemo, useState } from "react";
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  LogOut,
  Gift,
  BarChart3,
  CheckCircle,
} from "lucide-react";
import { ScavengerAPI } from "../api";
import AdminLogin from "./AdminLogin";

interface AdminStatistics {
  totalUsers: number;
  totalClaimed: number;
  totalUnclaimed: number;
  completionBuckets: Record<string, number>;
  overview: {
    averageCardsCompleted: number;
    playersCompletedAll: number;
    playersWithProgress: number;
    recentActivity: number;
  };
}

interface AdminUser {
  _id: string;
  phoneNumber: string;
  voucherCode?: string;
  isClaimed: boolean;
  cardsCompleted: number;
  totalCards: number;
  gameCompleted: boolean;
  createdAt?: string;
  lastQRScanAt?: string;
}

const ITEMS_PER_PAGE = 25;

const AdminPage: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [claimMessage, setClaimMessage] = useState("");
  const [usersList, setUsersList] = useState<AdminUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [statistics, setStatistics] = useState<AdminStatistics | null>(null);
  const [showVoucherInput, setShowVoucherInput] = useState(false);
  const [voucherInput, setVoucherInput] = useState("");
  const [voucherError, setVoucherError] = useState("");

  useEffect(() => {
    checkAuthentication();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      setIsLoading(true);
      Promise.all([loadUsers(1, ""), loadStatistics()]).finally(() => setIsLoading(false));
    }
  }, [isAuthenticated]);

  const checkAuthentication = () => {
    const authenticated = localStorage.getItem("adminAuthenticated") === "true";
    const loginTime = localStorage.getItem("adminLoginTime");

    if (authenticated && loginTime) {
      const loginTimestamp = parseInt(loginTime, 10);
      const hoursSinceLogin = (Date.now() - loginTimestamp) / (1000 * 60 * 60);
      if (hoursSinceLogin < 24) {
        setIsAuthenticated(true);
        return;
      }
      localStorage.removeItem("adminAuthenticated");
      localStorage.removeItem("adminLoginTime");
    }
    setIsAuthenticated(false);
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("adminAuthenticated");
    localStorage.removeItem("adminLoginTime");
    setIsAuthenticated(false);
    setClaimMessage("✅ Logged out successfully");
    setTimeout(() => setClaimMessage(""), 3000);
  };

  const loadUsers = async (page: number = 1, search: string = "") => {
    try {
      setIsLoadingUsers(true);
      const [totalResponse, usersResponse] = await Promise.all([
        ScavengerAPI.getTotalUsers(),
        ScavengerAPI.getAllUsers(page, ITEMS_PER_PAGE, search),
      ]);

      if (totalResponse.success) {
        setTotalUsers(totalResponse.data?.totalUsers ?? 0);
      }

      if (usersResponse.success) {
        setUsersList(usersResponse.data?.users || []);
        if (usersResponse.data?.pagination) {
          setTotalPages(usersResponse.data.pagination.totalPages);
        }
      } else {
        setUsersList([]);
      }
    } catch (error) {
      console.error("Error loading users:", error);
      setUsersList([]);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const loadStatistics = async () => {
    try {
      setIsLoadingStats(true);
      const response = await ScavengerAPI.getAdminStatistics();
      if (response.success) {
        setStatistics(response.data as AdminStatistics);
      } else {
        setStatistics(null);
      }
    } catch (error) {
      console.error("Error loading statistics:", error);
      setStatistics(null);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleVoucherClaim = async () => {
    try {
      setVoucherError("");
      if (!voucherInput.trim()) {
        setVoucherError("❌ Please enter a voucher code");
        return;
      }

      const response = await ScavengerAPI.markUserAsClaimed(voucherInput.trim().toUpperCase());
      if (response.success) {
        setClaimMessage("✅ Reward claimed successfully!");
        setVoucherInput("");
        setShowVoucherInput(false);
        loadUsers(currentPage, searchTerm);
        loadStatistics();
      } else {
        setVoucherError(`❌ ${response.error || "Invalid voucher code or user not found"}`);
      }
    } catch (error) {
      console.error("Error claiming reward:", error);
      setVoucherError("❌ Error processing claim. Please try again.");
    }
  };

  const handleToggleClaimStatus = async (userId: string) => {
    try {
      const response = await ScavengerAPI.toggleClaimStatus(userId);
      if (response.success) {
        setClaimMessage("✅ Claim status updated successfully!");
        loadUsers(currentPage, searchTerm);
        loadStatistics();
      } else {
        setClaimMessage(`❌ ${response.error || "Failed to update claim status"}`);
      }
    } catch (error) {
      console.error("Error toggling claim status:", error);
      setClaimMessage("❌ Error updating claim status");
    } finally {
      setTimeout(() => setClaimMessage(""), 3000);
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    loadUsers(newPage, searchTerm);
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      loadUsers(1, searchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, isAuthenticated]);

  const completionData = useMemo(() => {
    if (!statistics) return [];
    return Object.entries(statistics.completionBuckets || {}).map(([label, value]) => ({ label, value }));
  }, [statistics]);

  if (!isAuthenticated) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#FFE41F] p-4 font-body">
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading text-[#11CC9A]">Find the Card Admin</h1>
            <p className="text-sm text-gray-600">Monitor progress, manage claims, and view live statistics.</p>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 bg-[#11CC9A] text-white px-4 py-2 rounded-full hover:opacity-90 transition-colors text-sm font-body"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        {claimMessage && (
          <div
            className={`mt-4 p-3 rounded-lg text-center font-body ${
              claimMessage.includes("✅") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
          >
            {claimMessage}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="bg-[#11CC9A]/5 rounded-xl p-4 flex items-center gap-3">
            <div className="bg-[#11CC9A]/10 p-2 rounded-lg">
              <Users className="w-6 h-6 text-[#11CC9A]" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-heading text-[#11CC9A]">
                {isLoading || isLoadingStats ? "..." : statistics?.totalUsers ?? totalUsers}
              </p>
            </div>
          </div>
          <div className="bg-[#11CC9A]/5 rounded-xl p-4 flex items-center gap-3">
            <div className="bg-[#11CC9A]/10 p-2 rounded-lg">
              <CheckCircle className="w-6 h-6 text-[#11CC9A]" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Claimed</p>
              <p className="text-2xl font-heading text-[#11CC9A]">
                {isLoadingStats ? "..." : statistics?.totalClaimed ?? 0}
              </p>
            </div>
          </div>
          <div className="bg-[#11CC9A]/5 rounded-xl p-4 flex items-center gap-3">
            <div className="bg-[#11CC9A]/10 p-2 rounded-lg">
              <BarChart3 className="w-6 h-6 text-[#11CC9A]" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg. Cards Completed</p>
              <p className="text-2xl font-heading text-[#11CC9A]">
                {isLoadingStats ? "..." : statistics?.overview.averageCardsCompleted ?? 0}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          <div className="bg-white rounded-xl shadow p-4">
            <h3 className="text-lg font-heading text-gray-800 mb-3">Cards Completion Distribution</h3>
            <div className="space-y-2">
              {completionData.length === 0 && (
                <p className="text-sm text-gray-500">No data available.</p>
              )}
              {completionData.map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-sm text-gray-700">
                  <span>{label}</span>
                  <span className="font-heading">{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <h3 className="text-lg font-heading text-gray-800 mb-3">Overview</h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-700">
              <div>
                <p className="text-xs text-gray-500">Players Completed All</p>
                <p className="text-lg font-heading">{statistics?.overview.playersCompletedAll ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Players With Progress</p>
                <p className="text-lg font-heading">{statistics?.overview.playersWithProgress ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Recent Activity (24h)</p>
                <p className="text-lg font-heading">{statistics?.overview.recentActivity ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Unclaimed Rewards</p>
                <p className="text-lg font-heading">{statistics?.totalUnclaimed ?? 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6">
          <button
            onClick={() => setShowVoucherInput(true)}
            className="inline-flex items-center justify-center gap-2 bg-[#11CC9A] text-white px-4 py-2 rounded-lg hover:opacity-90 transition-colors font-body"
          >
            <Gift className="w-4 h-4" />
            Claim with Voucher
          </button>
          <button
            onClick={() => {
              loadUsers(currentPage, searchTerm);
              loadStatistics();
            }}
            className="inline-flex items-center justify-center gap-2 bg-[#11CC9A] text-white px-4 py-2 rounded-lg hover:opacity-90 transition-colors font-body"
          >
            Refresh Data
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h3 className="text-xl font-heading text-gray-800">Players</h3>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by phone number or voucher code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#11CC9A] focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {isLoadingUsers ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CC9A] mx-auto mb-4" />
            <p className="text-gray-600 text-lg">Loading users...</p>
          </div>
        ) : usersList.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#11CC9A]/5 border-b border-gray-200 text-xs text-gray-600 uppercase tracking-wider">
                  <th className="text-left py-3 px-6">Phone Number</th>
                  <th className="text-center py-3 px-6">Cards</th>
                  <th className="text-center py-3 px-6">Completed</th>
                  <th className="text-center py-3 px-6">Voucher Code</th>
                  <th className="text-center py-3 px-6">Last Scan</th>
                  <th className="text-center py-3 px-6">Claim Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {usersList.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 text-sm text-gray-900 font-body">
                      {user.phoneNumber || "Unknown"}
                    </td>
                    <td className="py-4 px-6 text-center text-sm text-gray-700">
                      {user.cardsCompleted}/{user.totalCards}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {user.gameCompleted ? (
                        <span className="text-green-600 font-body">Yes</span>
                      ) : (
                        <span className="text-gray-500">No</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {user.voucherCode ? (
                        <span className="bg-[#11CC9A]/10 text-[#11CC9A] px-2 py-1 rounded font-mono text-sm">
                          {user.voucherCode}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center text-sm text-gray-700">
                      {user.lastQRScanAt
                        ? `${new Date(user.lastQRScanAt).toLocaleDateString()} ${new Date(user.lastQRScanAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : "Never"}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => handleToggleClaimStatus(user._id)}
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm transition-colors ${
                          user.isClaimed
                            ? "bg-[#11CC9A]/10 text-[#11CC9A] hover:bg-[#11CC9A]/20"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {user.isClaimed ? (
                          <>
                            <ToggleRight className="w-4 h-4" /> Claimed
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-4 h-4" /> Not Claimed
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing page <span className="font-body">{currentPage}</span> of {" "}
              <span className="font-body">{totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1 || isLoadingUsers}
                className="px-3 py-1 text-sm text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </button>
              <button
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages || isLoadingUsers}
                className="px-3 py-1 text-sm text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showVoucherInput && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-heading mb-2">Claim Reward by Voucher</h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter the voucher code shown on the player's device to mark their reward as claimed.
            </p>
            <input
              type="text"
              value={voucherInput}
              onChange={(e) => {
                setVoucherInput(e.target.value.toUpperCase());
                setVoucherError("");
              }}
              placeholder="Enter 4-character voucher code"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#11CC9A] focus:border-transparent uppercase"
              maxLength={6}
            />
            {voucherError && (
              <div className="mt-2 text-sm text-red-600">{voucherError}</div>
            )}
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleVoucherClaim}
                className="flex-1 bg-[#11CC9A] text-white py-2 rounded-lg hover:opacity-90 transition-colors font-body"
              >
                Claim Reward
              </button>
              <button
                onClick={() => {
                  setShowVoucherInput(false);
                  setVoucherInput("");
                  setVoucherError("");
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors font-body"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage; 
