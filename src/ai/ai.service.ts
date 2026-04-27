import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import sharp from 'sharp';
import type {
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  PreTrainedTokenizer,
  Tensor,
  AutoTokenizer,
} from '@xenova/transformers';

export interface VerifyPayload {
  imageUrl: string;
  text: string;
}

export interface VerifyResult {
  score: number;
  verified: boolean;
  pending?: boolean;
}

const MEAN = [0.48145466, 0.4578275, 0.40821073];
const STD = [0.26862954, 0.26130258, 0.27577711];
const INPUT_SIZE = 224;
const MODEL_ID = 'Xenova/clip-vit-base-patch32';

/* eslint-disable @typescript-eslint/naming-convention */
interface TransformersModule {
  AutoTokenizer: typeof AutoTokenizer;
  CLIPTextModelWithProjection: typeof CLIPTextModelWithProjection;
  CLIPVisionModelWithProjection: typeof CLIPVisionModelWithProjection;
  Tensor: typeof Tensor;
}
/* eslint-enable @typescript-eslint/naming-convention */

import { TranslationService } from './translation.service';

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private textModel: CLIPTextModelWithProjection | null = null;
  private visionModel: CLIPVisionModelWithProjection | null = null;
  private tokenizer: PreTrainedTokenizer | null = null;
  private tensorClass: typeof Tensor | null = null;
  private readonly threshold: number;

  constructor(private readonly translationService: TranslationService) {
    this.threshold = Number(process.env.VERIFY_THRESHOLD ?? 0.25);
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureModelsLoaded();
      this.logger.log('CLIP models loaded successfully. AI service is ready.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to load CLIP models: ${message}`);
    }
  }

  private async ensureModelsLoaded(): Promise<void> {
    if (this.textModel && this.visionModel && this.tokenizer) return;

    const {
      AutoTokenizer: autoTokenizerClass,
      CLIPTextModelWithProjection: textModelClass,
      CLIPVisionModelWithProjection: visionModelClass,
      Tensor: tensorClass,
    } = (await import('@xenova/transformers')) as unknown as TransformersModule;

    this.tensorClass = tensorClass;
    this.textModel = await textModelClass.from_pretrained(MODEL_ID);
    this.visionModel = await visionModelClass.from_pretrained(MODEL_ID);
    this.tokenizer = await autoTokenizerClass.from_pretrained(MODEL_ID);
  }

  async verify(payload: VerifyPayload): Promise<VerifyResult> {
    if (!payload?.imageUrl?.trim()) {
      throw new Error('verify() requires imageUrl');
    }
    if (!payload?.text?.trim()) {
      throw new Error('verify() requires text');
    }

    try {
      this.logger.log(`Starting AI verification for image: ${payload.imageUrl}`);
      await this.ensureModelsLoaded();

      // Translate Turkish routine name to English for better CLIP accuracy
      const prompt = await this.translationService.translate(payload.text);

      const imgBuf = await this.downloadImageBuffer(payload.imageUrl);
      const imageInputs = await this.preprocessToPixelValuesFromBuffer(imgBuf);

      const textInputs = await this.tokenizer!([prompt], {
        padding: true,
        truncation: true,
        returnTensors: 'pt',
      });

      const { image_embeds: imageEmbeds } = await this.visionModel!(imageInputs);
      const { text_embeds: textEmbeds } = await this.textModel!(textInputs);

      const img = this.l2NormalizeFloat32(imageEmbeds.data);
      const txt = this.l2NormalizeFloat32(textEmbeds.data);
      const similarity = this.cosineSimilarity(img, txt);

      this.logger.log(`AI Score: ${similarity.toFixed(4)} (Threshold: ${this.threshold})`);
      const verified = similarity >= this.threshold;

      return { score: similarity, verified, pending: false };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`AI verification error details: ${message}`);

      // Teknik bir hata olsa bile (boyut, timeout vb.) sonucu 'failed' olarak dönüyoruz
      // ki frontend "System Busy" demesin.
      return { score: 0, verified: false, pending: false };
    }
  }

  private async downloadImageBuffer(url: string): Promise<Buffer> {
    this.validateUrl(url);
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 20000, // 20 saniye timeout (daha uzun süre)
      maxContentLength: 15 * 1024 * 1024, // 15MB limit (3 katına çıktı)
    });
    return Buffer.from(res.data);
  }

  private validateUrl(url: string): void {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol. Only http and https are allowed.');
    }
    const host = parsed.hostname.toLowerCase();
    const isInternal =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      host.includes('169.254'); // Metadata server

    if (isInternal) {
      throw new Error('Access to internal network is forbidden.');
    }
  }

  private async preprocessToPixelValuesFromBuffer(
    buf: Buffer,
    size = INPUT_SIZE,
    // eslint-disable-next-line @typescript-eslint/naming-convention
  ): Promise<{ pixel_values: Tensor }> {
    const { data: raw, info } = await sharp(buf)
      .removeAlpha()
      .resize(size, size, { fit: 'cover', position: 'centre' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (info.channels !== 3) {
      throw new Error(`Expected 3 channels, got ${info.channels}`);
    }

    const H = info.height;
    const W = info.width;
    const C = 3;
    const out = new Float32Array(C * H * W);

    let idx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const r = raw[idx++] / 255;
        const g = raw[idx++] / 255;
        const b = raw[idx++] / 255;

        const base = y * W + x;
        out[0 * H * W + base] = (r - MEAN[0]) / STD[0];
        out[1 * H * W + base] = (g - MEAN[1]) / STD[1];
        out[2 * H * W + base] = (b - MEAN[2]) / STD[2];
      }
    }

    // eslint-disable-next-line @typescript-eslint/naming-convention
    return { pixel_values: new this.tensorClass!('float32', out, [1, 3, H, W]) };
  }

  private l2NormalizeFloat32(arr: Float32Array): Float32Array {
    let sumSq = 0;
    for (let i = 0; i < arr.length; i++) sumSq += arr[i] * arr[i];
    const inv = 1 / Math.sqrt(sumSq || 1);
    const out = new Float32Array(arr.length);
    for (let i = 0; i < arr.length; i++) out[i] = arr[i] * inv;
    return out;
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) dot += a[i] * b[i];
    return dot;
  }
}
