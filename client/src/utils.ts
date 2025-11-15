// utils.ts
import type { RewardTier } from "./types";

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export const calculateRewardTier = (timeInMinutes: number): RewardTier => {
  if (timeInMinutes < 20) return "Gold";
  if (timeInMinutes <= 40) return "Silver";
  return "Bronze";
};

export const generateRewardToken = (phoneNumber: string): string => {
  return `TLB-${phoneNumber.slice(-4)}-${Date.now().toString().slice(-6)}`;
};

export const validatePhoneNumber = (phone: string): boolean => {
  // Now only check for 8 digits (local part)
  return /^\d{8}$/.test(phone);
};

export const validateOTP = (otp: string): boolean => {
  return /^\d{4}$/.test(otp);
};

export const maskPhoneNumber = (phone: string): string => {
  if (phone.length < 4) return phone;
  return `***${phone.slice(-4)}`;
};
