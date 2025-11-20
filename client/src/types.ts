export interface GameSession {
  userId: string;
  startTime: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface OTPVerificationResponse {
  success: boolean;
  session?: GameSession;
  error?: string;
}

export interface GameProgress {
  totalFound: number;
  totalCards: number;
  isCompleted: boolean;
  completedCards: number[];
}

export interface GameQRCodes {
  game1?: string;
  game2?: string;
  game3?: string;
  game4?: string;
}

export interface GameClaims {
  game1: boolean;
  game2: boolean;
  game3: boolean;
  game4: boolean;
}

export interface UserQRData {
  phoneNumber: string;
  userName: string;
  gameQRCodes: GameQRCodes;
  gameClaims: GameClaims;
}