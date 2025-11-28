import React, { useEffect, useMemo, useState } from "react";
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  LogOut,
  CheckCircle,
  QrCode,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ScavengerAPI } from "../api";
import AdminLogin from "./AdminLogin";
import SimpleQRScanner from "./SimpleQRScanner";

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
  cardsCompleted: number;
  totalCards: number;
  gameCompleted: boolean;
  createdAt?: string;
  lastQRScanAt?: string;
  gameClaims?: {
    game1: boolean;
    game2: boolean;
    game3: boolean;
  };
  gameQRCodes?: {
    game1?: string;
    game2?: string;
    game3?: string;
  };
  gameTiers?: {
    game1?: number;
    game2?: number;
    game3?: number;
  };
  profile?: {
    name?: string;
  };
}

const ITEMS_PER_PAGE = 12;

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [usersList, setUsersList] = useState<AdminUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [statistics, setStatistics] = useState<AdminStatistics | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrScanMessage, setQRScanMessage] = useState("");
  const [selectedUserForScan, setSelectedUserForScan] = useState<AdminUser | null>(null);
  const [userQRCodes, setUserQRCodes] = useState<string[]>([]);
  const [loadingUserPhone, setLoadingUserPhone] = useState<string | null>(null);

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



  const handleOpenQRScannerForUser = async (user: AdminUser) => {
    setSelectedUserForScan(user);
    setQRScanMessage("");
    setLoadingUserPhone(user.phoneNumber);
    
    try {
      const response = await ScavengerAPI.getUserQRCodes(user.phoneNumber);
      
      if (response.success && response.data?.gameQRCodes) {
        const qrCodes = response.data.gameQRCodes;
        const qrCodeArray = [
          qrCodes.game1,
          qrCodes.game2,
          qrCodes.game3,
        ].filter(code => code);
        
        setUserQRCodes(qrCodeArray);
        setShowQRScanner(true);
      } else {
        setQRScanMessage(`❌ Failed to load QR codes for ${user.profile?.name || user.phoneNumber}`);
      }
    } catch {
      setQRScanMessage(`❌ Error loading QR codes`);
    } finally {
      setLoadingUserPhone(null);
    }
  };

  const handleQRScan = async (qrData: string): Promise<{ success: boolean; message?: string }> => {
    try {
      setQRScanMessage("");
      
      // Validate against the fetched QR codes
      const isValid = userQRCodes.includes(qrData);
      
      if (!isValid) {
        const userName = selectedUserForScan?.profile?.name || selectedUserForScan?.phoneNumber || "this user";
        const errorMsg = `❌ This QR code doesn't belong to ${userName}`;
        return { success: false, message: errorMsg };
      }
      
      const response = await ScavengerAPI.scanQRCode(qrData);
      
      if (response.success) {
        const gameNumber = response.data?.gameNumber || "unknown";
        const userName = selectedUserForScan?.profile?.name || response.data?.phoneNumber || "User";
        const successMsg = `✅ Game ${gameNumber} claimed for ${userName}!`;
        setQRScanMessage(successMsg);
        
        setShowQRScanner(false);
        setSelectedUserForScan(null);
        setUserQRCodes([]);
        loadUsers(currentPage, searchTerm);
        loadStatistics();
        
        setTimeout(() => setQRScanMessage(""), 5000);
        
        return { success: true };
      } else {
        const errorMsg = `❌ ${response.error || "Invalid QR code"}`;
        return { success: false, message: errorMsg };
      }
    } catch {
      return { success: false, message: "❌ Error processing QR code scan" };
    }
  };

  const handleCloseQRScanner = () => {
    setShowQRScanner(false);
    setSelectedUserForScan(null);
    setUserQRCodes([]);
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
            <h1 className="text-2xl sm:text-3xl font-heading text-[#11CC9A]">Admin Dashboard</h1>
            <p className="text-sm text-gray-600 mt-2">Monitor progress, manage claims, and view live statistics.</p>
          </div>
          <button
            onClick={() => navigate("/admin/game3-qr")}
            className="inline-flex items-center gap-2 bg-[#11CC9A] text-white px-4 py-2 rounded-lg hover:opacity-90 transition-colors text-sm font-body shadow-lg"
          >
            <QrCode className="w-4 h-4" />
            Game 3 QR Codes
          </button>
        </div>
      </div>

      {/* Players Table Section - Moved to top for mobile */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-4 sm:mb-6">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h3 className="text-xl font-heading text-gray-800">Players</h3>
            </div>
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#11CC9A] w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name or phone number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#11CC9A] focus:border-[#11CC9A] transition-colors font-body"
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
                  <th className="text-left py-3 px-4">Name</th>
                  <th className="text-left py-3 px-4">Phone</th>
                  <th className="text-center py-3 px-3">Cards</th>
                  <th className="text-center py-3 px-3">Game 1</th>
                  <th className="text-center py-3 px-3">Game 2</th>
                  <th className="text-center py-3 px-3">Game 3</th>
                  <th className="text-center py-3 px-4">Scan QR</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {usersList.map((user) => {
                  const gameClaims = user.gameClaims || { game1: false, game2: false, game3: false };
                  return (
                  <tr key={user._id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 text-sm text-gray-900 font-body">
                        {user.profile?.name || "N/A"}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700 font-mono">
                      {user.phoneNumber || "Unknown"}
                    </td>
                      <td className="py-3 px-3 text-center text-sm text-gray-700">
                      {user.cardsCompleted}/{user.totalCards}
                    </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center">
                          {(() => {
                            const tier = user.gameTiers?.game1;
                            const isClaimed = gameClaims.game1;
                            const isGameCompleted = user.cardsCompleted >= 1;
                            
                            // Only show tier if it's 1 or 2 (not 0, null, or undefined)
                            // Convert to number to handle string "1" or number 1
                            const tierNum = tier != null ? Number(tier) : null;
                            const hasValidTier = tierNum === 1 || tierNum === 2;
                            
                            if (isClaimed) {
                              // Show T1 or T2 inside green circle if claimed and has valid tier
                              return (
                                <div
                                  className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#11CC9A] text-white font-bold text-sm"
                                  title={hasValidTier ? `Game 1 Claimed - Tier ${tierNum} Voucher` : "Game 1 Claimed"}
                                >
                                  {hasValidTier ? `T${tierNum}` : "✓"}
                                </div>
                              );
                            } else if (hasValidTier) {
                              // Show tier if available, regardless of completion status
                              return (
                                <div
                                  className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-300 text-gray-700 font-bold text-sm border-2 border-gray-400"
                                  title={isGameCompleted ? `Game 1 Completed - Tier ${tierNum} Eligible (Not Claimed)` : `Game 1 - Tier ${tierNum} (In Progress)`}
                                >
                                  T{tierNum}
                                </div>
                              );
                            } else {
                              // Show empty circle if not completed
                              return (
                                <div
                                  className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 text-gray-400"
                                  title="Game 1 Not Completed"
                                >
                                  ○
                                </div>
                              );
                            }
                          })()}
                        </div>
                    </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center">
                          {(() => {
                            const tier = user.gameTiers?.game2;
                            const isClaimed = gameClaims.game2;
                            const isGameCompleted = user.cardsCompleted >= 2;
                            
                            // Only show tier if it's 1 or 2 (not 0, null, or undefined)
                            // Convert to number to handle string "1" or number 1
                            const tierNum = tier != null ? Number(tier) : null;
                            const hasValidTier = tierNum === 1 || tierNum === 2;
                            
                            if (isClaimed) {
                              return (
                                <div
                                  className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#11CC9A] text-white font-bold text-sm"
                                  title={hasValidTier ? `Game 2 Claimed - Tier ${tierNum} Voucher` : "Game 2 Claimed"}
                                >
                                  {hasValidTier ? `T${tierNum}` : "✓"}
                                </div>
                              );
                            } else if (hasValidTier) {
                              // Show tier if available, regardless of completion status
                              return (
                                <div
                                  className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-300 text-gray-700 font-bold text-sm border-2 border-gray-400"
                                  title={isGameCompleted ? `Game 2 Completed - Tier ${tierNum} Eligible (Not Claimed)` : `Game 2 - Tier ${tierNum} (In Progress)`}
                                >
                                  T{tierNum}
                                </div>
                              );
                            } else {
                              return (
                                <div
                                  className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 text-gray-400"
                                  title="Game 2 Not Completed"
                                >
                                  ○
                                </div>
                              );
                            }
                          })()}
                        </div>
                    </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center">
                          {(() => {
                            const tier = user.gameTiers?.game3;
                            const isClaimed = gameClaims.game3;
                            const isGameCompleted = user.cardsCompleted >= 3;
                            
                            // Only show tier if it's 1 or 2 (not 0, null, or undefined)
                            // Convert to number to handle string "1" or number 1
                            const tierNum = tier != null ? Number(tier) : null;
                            const hasValidTier = tierNum === 1 || tierNum === 2;
                            
                            if (isClaimed) {
                              return (
                                <div
                                  className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#11CC9A] text-white font-bold text-sm"
                                  title={hasValidTier ? `Game 3 Claimed - Tier ${tierNum} Voucher` : "Game 3 Claimed"}
                                >
                                  {hasValidTier ? `T${tierNum}` : "✓"}
                                </div>
                              );
                            } else if (hasValidTier) {
                              // Show tier if available, regardless of completion status
                              return (
                                <div
                                  className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-300 text-gray-700 font-bold text-sm border-2 border-gray-400"
                                  title={isGameCompleted ? `Game 3 Completed - Tier ${tierNum} Eligible (Not Claimed)` : `Game 3 - Tier ${tierNum} (In Progress)`}
                                >
                                  T{tierNum}
                                </div>
                              );
                            } else {
                              return (
                                <div
                                  className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 text-gray-400"
                                  title="Game 3 Not Completed"
                                >
                                  ○
                                </div>
                              );
                            }
                          })()}
                        </div>
                    </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleOpenQRScannerForUser(user)}
                          disabled={loadingUserPhone !== null || (gameClaims.game1 && gameClaims.game2 && gameClaims.game3)}
                          className="inline-flex items-center justify-center bg-[#11CC9A] text-white hover:opacity-90 px-3 py-2 rounded-lg transition-colors text-xs font-body disabled:opacity-50 disabled:cursor-not-allowed"
                          title={(gameClaims.game1 && gameClaims.game2 && gameClaims.game3) ? "All games claimed - no QR codes to scan" : "Scan user's QR code"}
                        >
                          {loadingUserPhone === user.phoneNumber ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                              Loading...
                          </>
                        ) : (
                          "Scan QR"
                        )}
                      </button>
                    </td>
                  </tr>
                  );
                })}
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

      {/* Statistics Section - Simplified */}
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
        <h3 className="text-xl font-heading text-gray-800 mb-4">Statistics</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-[#11CC9A]/5 rounded-xl p-4 flex items-center gap-3">
            <div className="bg-[#11CC9A]/10 p-3 rounded-lg">
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
            <div className="bg-[#11CC9A]/10 p-3 rounded-lg">
              <CheckCircle className="w-6 h-6 text-[#11CC9A]" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Claimed</p>
              <p className="text-2xl font-heading text-[#11CC9A]">
                {isLoadingStats ? "..." : statistics?.totalClaimed ?? 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4">
          <h4 className="text-lg font-heading text-gray-800 mb-4">Card Completion Distribution</h4>
          <div className="space-y-3">
            {completionData.length === 0 ? (
              <p className="text-sm text-gray-500">No data available.</p>
            ) : (
              completionData.map(({ label, value }) => {
                // Filter to show only 0, 1, 2, 3 cards (remove 4 since we only have 3 games)
                const cardCount = parseInt(label.split('/')[0]);
                if (cardCount > 3) return null;
                
                return (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 font-body">
                      {cardCount} {cardCount === 1 ? 'Card' : 'Cards'} Completed
                    </span>
                    <span className="text-lg font-heading text-[#11CC9A]">{value}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {qrScanMessage && (
          <div
            className={`mt-4 p-3 rounded-lg text-center font-body ${
              qrScanMessage.includes("✅") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
          >
            {qrScanMessage}
          </div>
        )}
      </div>

      {/* QR Scanner Modal */}
      {showQRScanner && selectedUserForScan && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-[#1A1A1A] text-white rounded-2xl shadow-2xl w-full max-w-xl p-4 sm:p-6 relative max-h-[95vh] overflow-y-auto">
            <button
              onClick={handleCloseQRScanner}
              className="absolute top-4 right-4 text-gray-300 hover:text-white text-2xl"
            >
              ✕
            </button>

            <h3 className="text-2xl font-heading mb-2">
              Scan QR Code for {selectedUserForScan.profile?.name || "User"}
            </h3>
            <p className="text-sm text-gray-300 mb-2">
              Phone: <span className="font-mono text-[#11CC9A]">{selectedUserForScan.phoneNumber}</span>
            </p>
            <p className="text-sm text-gray-400 mb-2">
              Validating against {userQRCodes.length} QR codes for this user
            </p>
            <p className="text-sm text-gray-300 mb-4">
              Ask the user to show their game QR code, then hold it inside the frame to scan.
            </p>

            {userQRCodes.length > 0 ? (
              <>
                <div className="bg-[#11CC9A]/10 rounded-lg p-3 mb-4">
                  <p className="text-sm text-gray-300 mb-2">
                    📱 Ready to scan {userQRCodes.length} QR codes for this user
                  </p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {userQRCodes.map((code, index) => (
                      <button
                        key={index}
                        onClick={async () => {
                          await handleQRScan(code);
                        }}
                        className="text-xs font-mono text-[#11CC9A] bg-black/20 rounded px-2 py-1 hover:bg-black/40 transition-colors text-left"
                        title="Click to test claiming this game"
                      >
                        Game {index + 1}: {code.substring(0, 12)}...
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    💡 Tip: Click a game code above to test, or scan the QR code from user's device
                  </p>
                </div>
                <SimpleQRScanner
                  title=""
                  expectedQRCode=""
                  onScan={handleQRScan}
                  onClose={handleCloseQRScanner}
                />
              </>
            ) : (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#11CC9A] mx-auto mb-4"></div>
                <p className="text-gray-400">Loading QR codes...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Logout Button at Bottom */}
      <div className="flex justify-center mt-6 sm:mt-8 mb-4">
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 bg-[#11CC9A] text-white px-6 py-3 rounded-full hover:opacity-90 transition-colors text-sm font-body shadow-lg"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>

    </div>
  );
};

export default AdminPage; 
