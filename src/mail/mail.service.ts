import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    // In a real application, we would use a library like nodemailer or an API like SendGrid here.
    // For now, we mock the email sending process to comply with the feature requirements.

    this.logger.log(`\n
      --- MOCK EMAIL DISPATCH ---
      To: ${email}
      Subject: Password Recovery Instructions
      
      You requested a password reset. Use the following token to reset your password:
      Token: ${token}
      
      If you did not request this, please ignore this email.
      ---------------------------
    `);
  }
}
