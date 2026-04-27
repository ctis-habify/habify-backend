import { TranslationService } from '../src/ai/translation.service';
import { Logger } from '@nestjs/common';

async function testTranslation() {
  const service = new TranslationService();
  
  console.log('--- Testing Translation Service ---');
  
  const tests = [
    'Kitap Okuma',
    'Diş Fırçalama',
    'Reading a book',
    'Yürüyüş yapmak',
    'Su içmek'
  ];

  for (const text of tests) {
    const result = await service.translate(text);
    console.log(`Original: ${text} | Translated: ${result}`);
  }
}

testTranslation().catch(console.error);
