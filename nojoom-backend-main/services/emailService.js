// server/services/emailService.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

class EmailService {
  constructor() {
    // استخدام المتغيرات الصحيحة من .env
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: false, // true إذا كان المنفذ 465
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  async sendVerificationEmail(user, verificationToken) {
    const frontendUrl = process.env.FRONTEND_URL || (process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',')[0].trim() : 'https://unique-alignment-production-4b0d305b.up.railway.app');
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Nojoom App'}" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Verify Your Email Address',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #000; color: #fff; padding: 20px; text-align: center; }
                .content { background: #f9f9f9; padding: 30px; }
                .button { display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>${process.env.APP_NAME || 'Nojoom App'}</h1>
                </div>
                <div class="content">
                    <h2>Hello ${user.username}!</h2>
                    <p>Thank you for signing up. Please verify your email address by clicking the button below:</p>
                    <p style="text-align: center;">
                        <a href="${verificationUrl}" class="button">Verify Email Address</a>
                    </p>
                    <p>If the button doesn't work, you can also copy and paste the following link in your browser:</p>
                    <p><a href="${verificationUrl}">${verificationUrl}</a></p>
                    <p>This verification link will expire in 24 hours.</p>
                </div>
                <div class="footer">
                    <p>If you didn't create an account, please ignore this email.</p>
                </div>
            </div>
        </body>
        </html>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Verification email sent to:', user.email);
      console.log('Preview URL:', nodemailer.getTestMessageUrl(info)); // رابط المعاينة في Ethereal
      return true;
    } catch (error) {
      console.error('❌ Error sending verification email:', error);
      return false;
    }
  }

  async sendPasswordResetEmail(user, resetToken) {
    const frontendUrl = process.env.FRONTEND_URL || (process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',')[0].trim() : 'https://unique-alignment-production-4b0d305b.up.railway.app');
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Nojoom App'}" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Reset Your Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #000; color: #fff; padding: 20px; text-align: center; }
                .content { background: #f9f9f9; padding: 30px; }
                .button { display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>${process.env.APP_NAME || 'Nojoom App'}</h1>
                </div>
                <div class="content">
                    <h2>Password Reset Request</h2>
                    <p>Hello ${user.username},</p>
                    <p>We received a request to reset your password. Click the button below to create a new password:</p>
                    <p style="text-align: center;">
                        <a href="${resetUrl}" class="button">Reset Password</a>
                    </p>
                    <p>If you didn't request a password reset, please ignore this email.</p>
                    <p>This reset link will expire in 1 hour.</p>
                </div>
                <div class="footer">
                    <p>If you're having trouble clicking the button, copy and paste the URL below into your web browser:</p>
                    <p><a href="${resetUrl}">${resetUrl}</a></p>
                </div>
            </div>
        </body>
        </html>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Password reset email sent to:', user.email);
      console.log('Preview URL:', nodemailer.getTestMessageUrl(info)); // رابط المعاينة في Ethereal
      return true;
    } catch (error) {
      console.error('❌ Error sending password reset email:', error);
      return false;
    }
  }

  async sendActivityNotificationEmail(recipient, notification) {
    const subject = `Nojoom - New ${notification.type}`;
    let actionText = '';
    const frontendUrl = process.env.FRONTEND_URL || (process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',')[0].trim() : 'https://unique-alignment-production-4b0d305b.up.railway.app');
    let actionUrl = `${frontendUrl}`;

    switch (notification.type) {
      case 'follow':
        actionText = `${notification.actor_username || 'Someone'} started following you!`;
        actionUrl += `/profile/${notification.actor_id}`;
        break;
      case 'comment':
        actionText = `${notification.actor_username || 'Someone'} commented on your video!`;
        actionUrl += `/video/${notification.target_id}`;
        break;
      case 'like':
        actionText = `${notification.actor_username || 'Someone'} liked your video!`;
        actionUrl += `/video/${notification.target_id}`;
        break;
      case 'message':
        actionText = `${notification.actor_username || 'Someone'} sent you a direct message!`;
        actionUrl += `/chat/${notification.actor_id}`;
        break;
      default:
        actionText = notification.message || 'You have a new notification!';
        actionUrl += `/notifications`;
    }

    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Nojoom App'}" <${process.env.EMAIL_USER}>`,
      to: recipient.email,
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #000; color: #fff; padding: 20px; text-align: center; }
                .content { background: #f9f9f9; padding: 30px; }
                .button { display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>${process.env.APP_NAME || 'Nojoom App'}</h1>
                </div>
                <div class="content">
                    <h2>Hello ${recipient.username || 'there'},</h2>
                    <p>${actionText}</p>
                    <p style="text-align: center;">
                        <a href="${actionUrl}" class="button">View on Nojoom</a>
                    </p>
                    <p>Or copy this link to your browser:</p>
                    <p><a href="${actionUrl}">${actionUrl}</a></p>
                </div>
                <div class="footer">
                    <p>You received this email because you are a registered user of Nojoom App.</p>
                </div>
            </div>
        </body>
        </html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('✅ Activity notification email sent to:', recipient.email);
      return true;
    } catch (error) {
      console.error('❌ Error sending activity notification email:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
