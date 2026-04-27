import { AiService } from '../src/ai/ai.service';
import { TranslationService } from '../src/ai/translation.service';

async function testFullAi() {
  const translationService = new TranslationService();
  const aiService = new AiService(translationService);

  console.log('--- Testing Full AI Verification Flow ---');

  // Test Case 1: Matching image (Books) with Turkish prompt
  const testCase1 = {
    imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=1000&auto=format&fit=crop',
    text: 'Kitap Okuma'
  };

  // Test Case 2: Mismatching image (Books) with different prompt
  const testCase2 = {
    imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=1000&auto=format&fit=crop',
    text: 'Diş Fırçalama'
  };

  const cases = [testCase1, testCase2];

  for (const c of cases) {
    console.log(`\nTesting Prompt: "${c.text}"`);
    try {
      const result = await aiService.verify(c);
      console.log(`Result: ${result.verified ? '✅ VERIFIED' : '❌ FAILED'}`);
      console.log(`Score: ${result.score.toFixed(4)}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${message}`);
    }
  }
}

testFullAi().catch(console.error);
