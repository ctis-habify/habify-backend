import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance } from 'axios';

type VerifyPayload = {
  imageUrl: string;
  text: string; // verification prompt / task text
};

type AiVerifyResponse = {
  similarity: number; // AI servisinin döndürdüğü alan
  verified: boolean;
};

export type VerifyResult = {
  score: number;
  verified: boolean;
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: AxiosInstance;
  private readonly baseUrl: string;

  constructor() {
    // 1) Env doğrulama
    const raw = process.env.AI_URL?.trim();
    if (!raw) {
      // Bu hata, deploy/config hatasıdır. Sessiz fail yerine net patlasın.
      throw new Error('AI_URL is not set. Please set process.env.AI_URL');
    }

    // trailing slash temizle: https://x/ -> https://x
    this.baseUrl = raw.replace(/\/+$/, '');

    // 2) Axios instance (reuse + default ayarlar)
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
      },
      // validateStatus: (s) => s >= 200 && s < 300, // default zaten böyle
    });
  }

  async verify(payload: VerifyPayload): Promise<VerifyResult> {
    // 3) Input guard (kendi kendine patlamasın)
    if (!payload?.imageUrl?.trim()) {
      throw new Error('verify() requires imageUrl');
    }
    if (!payload?.text?.trim()) {
      throw new Error('verify() requires text');
    }

    try {
      const res = await this.client.post<AiVerifyResponse>('/verify', {
        imageUrl: payload.imageUrl,
        text: payload.text,
      });

      // 4) Response validation (AI servisinde alan isimleri değişirse sessiz bozulmasın)
      const similarity = res.data?.similarity;
      const verified = res.data?.verified;

      if (typeof similarity !== 'number' || typeof verified !== 'boolean') {
        this.logger.error(`Unexpected AI response shape: ${JSON.stringify(res.data)}`);
        // Burada fail-safe mi yoksa exception mı istediğine göre karar:
        // Ben exception seçtim ki yanlış entegrasyon prod'da gizlenmesin.
        throw new ServiceUnavailableException('AI response format invalid');
      }

      return { score: similarity, verified };
    } catch (err) {
      // 5) Hata yönetimi
      const e = err as AxiosError;

      // Timeout / network
      if (e.code === 'ECONNABORTED' || e.message?.includes('timeout')) {
        this.logger.warn('AI verify timed out');
        // Fail-safe istersen aşağıdaki gibi dönebilirsin:
        // return { score: 0, verified: false };
        throw new ServiceUnavailableException('AI verification timeout');
      }

      // AI servis 4xx/5xx
      if (e.response) {
        this.logger.warn(
          `AI verify failed: status=${e.response.status} body=${JSON.stringify(e.response.data)}`,
        );
        // Fail-safe istersen return { score: 0, verified: false };
        throw new ServiceUnavailableException('AI verification failed');
      }

      // Diğer hatalar
      this.logger.error(`AI verify error: ${e.message}`);
      throw new ServiceUnavailableException('AI service unavailable');
    }
  }
}
