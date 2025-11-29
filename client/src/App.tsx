// App.tsx
import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import type { GameSession } from "./types";
import { ScavengerAPI } from "./api";

// Import all page components
import LandingPage from "./components/LandingPage";
import InstructionsPage from "./components/InstructionsPage";
import RegistrationPage from "./components/RegistrationPage";
import OTPPage from "./components/OTPPage";
import Dashboard from "./components/Dashboard";
import AdminPage from "./components/AdminPage";
import AdminGame3QR from "./components/AdminGame3QR";
import AdminGame4QR from "./components/AdminGame4QR";
import WelcomePage from "./components/WelcomePage";

// Context to share state across components
const AppContext = React.createContext<{
  phoneNumber: string;
  setPhoneNumber: (phone: string) => void;
  gameSession: GameSession | null;
  setGameSession: (session: GameSession | null) => void;
}>({
  phoneNumber: "",
  setPhoneNumber: () => {},
  gameSession: null,
  setGameSession: () => {},
});

// Wrapper components for each route
const WelcomePageWrapper: React.FC = () => {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate("/register");
  };

  return <WelcomePage onStart={handleStart} />;
};

const LandingPageWrapper: React.FC = () => {
  const navigate = useNavigate();

  const handleStartHunt = () => {
    navigate("/instructions");
  };

  return <LandingPage onStartHunt={handleStartHunt} />;
};

const InstructionsPageWrapper: React.FC = () => {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate("/register");
  };

  return <InstructionsPage onStart={handleStart} />;
};

const RegistrationPageWrapper: React.FC = () => {
  const navigate = useNavigate();
  const { setPhoneNumber } = React.useContext(AppContext);

  const handleBack = () => {
    // No back action since this is the first page
  };

  const handleSuccess = (phoneNumber: string) => {
    setPhoneNumber(phoneNumber);
    navigate("/verify-otp");
  };

  return <RegistrationPage onBack={handleBack} onSuccess={handleSuccess} />;
};

const OTPPageWrapper: React.FC = () => {
  const navigate = useNavigate();
  const { phoneNumber, setGameSession } = React.useContext(AppContext);

  const handleBack = () => {
    navigate("/register");
  };

  const handleSuccess = (session: GameSession) => {
    setGameSession(session);
    navigate("/dashboard");
  };

  return (
    <OTPPage
      onBack={handleBack}
      onSuccess={handleSuccess}
      phoneNumber={phoneNumber}
    />
  );
};

const DashboardWrapper: React.FC = () => {
  const navigate = useNavigate();
  const {
    phoneNumber,
    setGameSession,
    setPhoneNumber,
  } = React.useContext(AppContext);

  const handleLogout = () => {
    console.log("🔐 App: Logging out user...");

    // Call the API logout method to clear tokens properly
    ScavengerAPI.logout();
    // Clear all localStorage data
    localStorage.removeItem("keeta_phone_number");
    localStorage.removeItem("keeta_game_session");
    localStorage.removeItem("keeta_user_progress");
    localStorage.removeItem("jwt_token");

    // Reset all state
    setGameSession(null);
    setPhoneNumber("");
    console.log("🔐 App: Logout completed, redirecting to registration");
    navigate("/");
  };

  return (
    <Dashboard
      phoneNumber={phoneNumber}
      onLogout={handleLogout}
    />
  );
};

const AdminPageWrapper: React.FC = () => {
  return <AdminPage />;
};

const AdminGame3QRWrapper: React.FC = () => {
  return <AdminGame3QR />;
};

const AdminGame4QRWrapper: React.FC = () => {
  return <AdminGame4QR />;
};

// Main App Component
const AppContent: React.FC = () => {
  const { phoneNumber, gameSession } = React.useContext(AppContext);

  // If user has a game session, they should be on dashboard or game pages
  const isAuthenticated = phoneNumber && gameSession;

  return (
    <Routes>
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <WelcomePageWrapper />
          )
        }
      />
      <Route path="/landing" element={<LandingPageWrapper />} />
      <Route path="/instructions" element={<InstructionsPageWrapper />} />
      <Route
        path="/register"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <RegistrationPageWrapper />
          )
        }
      />
      <Route
        path="/verify-otp"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <OTPPageWrapper />
          )
        }
      />
      <Route
        path="/dashboard"
        element={
          isAuthenticated ? (
            <DashboardWrapper />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route path="/admin" element={<AdminPageWrapper />} />
      <Route path="/admin/game3-qr" element={<AdminGame3QRWrapper />} />
      <Route path="/admin/game4-qr" element={<AdminGame4QRWrapper />} />
      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? "/dashboard" : "/"} replace />}
      />
    </Routes>
  );
};

const App: React.FC = () => {
  // Initialize state from localStorage or defaults
  const [phoneNumber, setPhoneNumber] = useState(() => {
    return localStorage.getItem("keeta_phone_number") || "";
  });
  const [gameSession, setGameSession] = useState<GameSession | null>(() => {
    const saved = localStorage.getItem("keeta_game_session");
    return saved ? JSON.parse(saved) : null;
  });

  const [userProgress, setUserProgress] = useState<Record<
    string,
    unknown
  > | null>(null);

  // Check authentication on app load
  useEffect(() => {
    const checkAuthentication = () => {
      const token = localStorage.getItem("jwt_token");
      const savedPhoneNumber = localStorage.getItem("keeta_phone_number");

      console.log("🔐 App: Checking authentication on load...");
      console.log("🔐 App: Token exists:", !!token);
      console.log("🔐 App: Phone number exists:", !!savedPhoneNumber);

      // If we have a token but no phone number, or vice versa, clear everything
      if ((token && !savedPhoneNumber) || (!token && savedPhoneNumber)) {
        console.log(
          "🔐 App: Inconsistent authentication state, clearing all data"
        );
        localStorage.clear();
        setPhoneNumber("");
        setGameSession(null);
        return false;
      }

      // If we have both token and phone number, verify they're valid
      if (token && savedPhoneNumber) {
        console.log("🔐 App: Authentication found, verifying...");
        // The actual verification will happen when components try to use the token
        return true;
      }

      console.log("🔐 App: No authentication found");
      return false;
    };

    checkAuthentication();
  }, []);

  // Load user progress when authenticated
  useEffect(() => {
    const loadUserProgress = async () => {
      if (phoneNumber && gameSession && !userProgress) {
        try {
          const response = await ScavengerAPI.getUserProgress();
          if (response.success) {
            setUserProgress(response.data);
          } else {
            console.error("Failed to load user progress:", response.error);
          }
        } catch (error) {
          console.error("Error loading user progress:", error);
        }
      }
    };

    loadUserProgress();
  }, [phoneNumber, gameSession, userProgress]);

  // Enhanced setters that persist to localStorage
  const setPhoneNumberWithPersistence = (phone: string) => {
    setPhoneNumber(phone);
    if (phone) {
      localStorage.setItem("keeta_phone_number", phone);
    } else {
      localStorage.removeItem("keeta_phone_number");
    }
  };

  const setGameSessionWithPersistence = (session: GameSession | null) => {
    setGameSession(session);
    if (session) {
      localStorage.setItem("keeta_game_session", JSON.stringify(session));
    } else {
      localStorage.removeItem("keeta_game_session");
    }
  };

  return (
    <AppContext.Provider
      value={{
        phoneNumber,
        setPhoneNumber: setPhoneNumberWithPersistence,
        gameSession,
        setGameSession: setGameSessionWithPersistence,
      }}
    >
      <Router>
        <AppContent />
      </Router>
    </AppContext.Provider>
  );
};

export default App;
