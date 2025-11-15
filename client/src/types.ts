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
