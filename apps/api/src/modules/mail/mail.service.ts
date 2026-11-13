import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private fromAddress: string;
  private fromName: string;

  constructor(private readonly config: ConfigService) {
    this.fromName = this.config.get<string>('SMTP_FROM_NAME', 'Lumi Lite');
    this.fromAddress =
      this.config.get<string>('SMTP_FROM_ADDRESS') ||
      this.config.get<string>('SMTP_USER') ||
      'noreply@lumi.local';
  }

  onModuleInit() {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      this.logger.warn(
        'SMTP_HOST not set — mail will be logged, not sent',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: this.config.get<number>('SMTP_PORT', 587),
      secure: this.config.get<boolean>('SMTP_SECURE', false),
      auth: {
        user: this.config.get<string>('SMTP_USER', ''),
        pass: this.config.get<string>('SMTP_PASSWORD', ''),
      },
    });
  }

  async send(payload: MailPayload): Promise<void> {
    if (payload.to.endsWith('@lumi.local')) {
      this.logger.log(
        `Skipping mail to ${payload.to} (@lumi.local): ${payload.subject}`,
      );
      return;
    }

    if (!this.transporter) {
      this.logger.log(
        `[Mail not sent — no SMTP] To: ${payload.to}, Subject: ${payload.subject}, Text: ${payload.text}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromAddress}>`,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send mail to ${payload.to}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
