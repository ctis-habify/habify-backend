import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  OnModuleInit,
} from '@nestjs/common';
import axios from 'axios';
import sharp from 'sharp';
import {
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  Tensor,
} from '@xenova/transformers';

type VerifyPayload = {
  imageUrl: string;
  text: string; // verification prompt / task text
};

export type VerifyResult = {
  score: number;
  verified: boolean;
};

// CLIP normalize constants
const MEAN = [0.48145466, 0.4578275, 0.40821073];
const STD = [0.26862954, 0.26130258, 0.27577711];
const INPUT_SIZE = 224;
const MODEL_ID = 'Xenova/clip-vit-base-patch32';

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private textModel: any = null;
  private visionModel: any = null;
  private tokenizer: any = null;
  private readonly threshold: number;

  constructor() {
    this.threshold = Number(process.env.VERIFY_THRESHOLD ?? 0.25);
  }

  async onModuleInit() {
    try {
      await this.ensureModelsLoaded();
    } catch (err) {
      this.logger.error(`Failed to load CLIP models: ${err.message}`);
    }
  }

  private async ensureModelsLoaded() {
    if (this.textModel && this.visionModel && this.tokenizer) return;

    this.logger.log(`[AI] Loading models: ${MODEL_ID}`);
    this.textModel = await CLIPTextModelWithProjection.from_pretrained(MODEL_ID);
    this.visionModel = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID);
    this.tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
    this.logger.log('[AI] Models ready');
  }

  async verify(payload: VerifyPayload): Promise<VerifyResult> {
    if (!payload?.imageUrl?.trim()) {
      throw new Error('verify() requires imageUrl');
    }
    if (!payload?.text?.trim()) {
      throw new Error('verify() requires text');
    }

    try {
      await this.ensureModelsLoaded();

      // 1) download image
      const imgBuf = await this.downloadImageBuffer(payload.imageUrl);

      // 2) preprocess
      const imageInputs = await this.preprocessToPixelValuesFromBuffer(imgBuf);

      // 3) tokenize text
      const textInputs = await this.tokenizer([payload.text], {
        padding: true,
        truncation: true,
        return_tensors: 'pt',
      });

      // 4) encode
      const { image_embeds } = await this.visionModel(imageInputs);
      const { text_embeds } = await this.textModel(textInputs);

      // 5) similarity
      const img = this.l2NormalizeFloat32(image_embeds.data);
      const txt = this.l2NormalizeFloat32(text_embeds.data);
      const similarity = this.cosineSimilarity(img, txt);

      const verified = similarity >= this.threshold;

      return { score: similarity, verified };
    } catch (err) {
      this.logger.error(`AI verify error: ${err.message}`, err.stack);
      throw new ServiceUnavailableException(`AI verification failed: ${err.message}`);
    }
  }

  private async downloadImageBuffer(url: string): Promise<Buffer> {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 25000,
      maxContentLength: 10 * 1024 * 1024, // 10MB
    });
    return Buffer.from(res.data);
  }

  private async preprocessToPixelValuesFromBuffer(buf: Buffer, size = INPUT_SIZE) {
    const { data: raw, info } = await sharp(buf)
      .removeAlpha()
      .resize(size, size, { fit: 'cover', position: 'centre' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (info.channels !== 3) {
      throw new Error(`Expected 3 channels, got ${info.channels}`);
    }

    const H = info.height,
      W = info.width,
      C = 3;
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

    return { pixel_values: new Tensor('float32', out, [1, 3, H, W]) };
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
