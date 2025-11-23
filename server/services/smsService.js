// server/services/smsService.js
const fetch = require("node-fetch");

class SMSService {
  constructor() {
    this.username = process.env.SMS_USERNAME || "descifer";
    this.apiKey = process.env.SMS_API_KEY || "0OXJ6C2YHQ";
    this.baseUrl = "https://bhsms.net/httpget/";
  }

  /**
   * Generate a random 4-digit OTP
   */
  generateOTP() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /**
   * Send OTP via SMS using Qatar SMS API
   * @param {string} phoneNumber - Phone number with country code (e.g., 917907996240)
   * @param {string} otp - The OTP to send
   * @returns {Promise<Object>} - Response from SMS API
   */
  async sendOTP(phoneNumber, otp) {
    try {
  
      return {
        success: true,
        message: "OTP sent successfully",
        otp: otp,
        response: "",
      };

      // Format phone number (remove + if present)
      const formattedPhone = phoneNumber.replace("+", "");

      // Create SMS text
      const message = `You Keeta activation code is ${otp}. It’s valid for 5 minutes. Have fun!`;
      
      // Build URL with parameters
      const url = `${this.baseUrl}?username=${this.username}&apikey=${
        this.apiKey
      }&to=${formattedPhone}&text=${encodeURIComponent(message)}`;

      console.log("Sending SMS to:", formattedPhone);
      console.log("SMS URL:", url);

      // Make GET request to SMS API
      const response = await fetch(url);
      const responseText = await response.text();

      console.log("SMS API Response:", responseText);

      if (
        response.ok &&
        (responseText.includes("ORDERID:") || responseText.includes("success"))
      ) {
        return {
          success: true,
          message: "OTP sent successfully",
          otp: otp,
          response: responseText,
        };
      } else {
        return {
          success: false,
          message: "Failed to send OTP",
          error: responseText,
          response: responseText,
        };
      }
    } catch (error) {
      console.error("SMS Service Error:", error);
      return {
        success: false,
        message: "SMS service error",
        error: error.message,
      };
    }
  }

  /**
   * Send OTP and return the OTP for verification
   * @param {string} phoneNumber - Phone number
   * @returns {Promise<Object>} - Contains success status and OTP
   */
  async sendOTPAndReturn(phoneNumber) {
    const otp = this.generateOTP();

    console.log("OTP generated:", otp);
    const result = await this.sendOTP(phoneNumber, otp);

    if (result.success) {
      return {
        success: true,
        otp: otp,
        message: "OTP sent successfully",
      };
    } else {
      return {
        success: false,
        message: result.message,
        error: result.error,
      };
    }
  }
}

module.exports = new SMSService();
