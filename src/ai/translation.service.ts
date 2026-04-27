import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { TranslationPipeline } from '@xenova/transformers';

@Injectable()
export class TranslationService implements OnModuleInit {
  private readonly logger = new Logger(TranslationService.name);
  private translator: TranslationPipeline | null = null;

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureModelLoaded();
      this.logger.log('Translation model (TR-EN) loaded successfully.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to load translation model: ${message}`);
    }
  }

  private async ensureModelLoaded(): Promise<void> {
    if (this.translator) return;

    const { pipeline } = await import('@xenova/transformers');
    this.translator = (await pipeline(
      'translation',
      'Xenova/opus-mt-tr-en',
    )) as TranslationPipeline;
  }

  /**
   * Translates Turkish text to English if Turkish characters are detected.
   * Otherwise returns the original text.
   */
  async translate(text: string): Promise<string> {
    if (!text?.trim()) return text;

    try {
      await this.ensureModelLoaded();
      if (!this.translator) return text;

      const output = await this.translator(text);
      // TranslationPipeline output can be an array of objects or a single object
      const result = Array.isArray(output) ? output[0] : output;
      const translatedText = (
        (result as Record<string, unknown>)['translation_text']?.toString() || text
      ).trim();

      // Safety net: MarianMT sometimes produces garbage like '♪' for already English or unknown inputs.
      if (translatedText === '♪' || !translatedText) {
        return text;
      }

      this.logger.log(`Translation: "${text}" -> "${translatedText}"`);
      return translatedText;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Translation error for "${text}": ${message}`);
      return text; // Fallback to original
    }
  }
}
