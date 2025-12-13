import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export interface AuditLogEntry {
  timestamp: string;
  userId: string;
  username: string;
  email: string;
  roles: string[];
  method: string;
  url: string;
  body?: any;
  ip: string;
  userAgent: string;
  status: 'SUCCESS' | 'FAILED';
  response?: any;
  error?: string;
  errorStack?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly auditLogPath: string;

  constructor(private configService: ConfigService) {
    this.auditLogPath = this.configService.get<string>('AUDIT_LOG_PATH') || '/var/log/ekg/audit.log';
    this.ensureLogDirectory();
  }

  logAction(entry: AuditLogEntry): void {
    const logLine = JSON.stringify(entry) + '\n';

    try {
      fs.appendFileSync(this.auditLogPath, logLine, { encoding: 'utf-8' });

      if (entry.status === 'FAILED') {
        this.logger.warn(
          `Audit: FAILED action by ${entry.username} (${entry.userId}): ${entry.method} ${entry.url} - ${entry.error}`,
        );
      } else {
        this.logger.log(
          `Audit: ${entry.username} (${entry.userId}): ${entry.method} ${entry.url}`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to write audit log: ${error.message}`);
    }
  }

  async queryAuditLogs(filters: {
    userId?: string;
    username?: string;
    startDate?: string;
    endDate?: string;
    method?: string;
    status?: 'SUCCESS' | 'FAILED';
    limit?: number;
  }): Promise<AuditLogEntry[]> {
    const { limit = 100 } = filters;

    try {
      const fileContent = fs.readFileSync(this.auditLogPath, 'utf-8');
      const lines = fileContent.trim().split('\n');

      const entries: AuditLogEntry[] = lines
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter((entry) => entry !== null);

      let filtered = entries;

      if (filters.userId) {
        filtered = filtered.filter((e) => e.userId === filters.userId);
      }

      if (filters.username) {
        filtered = filtered.filter((e) => e.username.includes(filters.username));
      }

      if (filters.method) {
        filtered = filtered.filter((e) => e.method === filters.method);
      }

      if (filters.status) {
        filtered = filtered.filter((e) => e.status === filters.status);
      }

      if (filters.startDate) {
        filtered = filtered.filter((e) => e.timestamp >= filters.startDate);
      }

      if (filters.endDate) {
        filtered = filtered.filter((e) => e.timestamp <= filters.endDate);
      }

      return filtered.slice(-limit).reverse();
    } catch (error) {
      this.logger.error(`Failed to query audit logs: ${error.message}`);
      return [];
    }
  }

  private ensureLogDirectory(): void {
    const dir = path.dirname(this.auditLogPath);

    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (!fs.existsSync(this.auditLogPath)) {
        fs.writeFileSync(this.auditLogPath, '', { encoding: 'utf-8' });
      }
    } catch (error) {
      this.logger.warn(`Could not create audit log directory: ${error.message}. Using console logging only.`);
    }
  }
}
