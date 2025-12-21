import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class AiService {
  async verify(payload: { imageUrl: string; text: string }) {
    const res = await axios.post(`${process.env.AI_URL}/verify`, payload, {
      timeout: 30000,
    });
    return {
      score: res.data.similarity,
      verified: res.data.verified,
    };
  }
}
