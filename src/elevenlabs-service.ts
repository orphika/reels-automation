import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import * as fs from 'fs';
import * as path from 'path';

export class ElevenLabsService {
  private client: ElevenLabsClient;

  constructor(apiKey: string) {
    this.client = new ElevenLabsClient({ apiKey });
  }

  async generateSpeech(text: string, voiceId: string = 'EXAVITQu4vr4xnSDxMaL'): Promise<string> {
    try {
      const audio: any = await this.client.textToSpeech.convert(voiceId, {
        text,
        modelId: 'eleven_multilingual_v2',
      });

      const publicDir = path.join(process.cwd(), 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }

      const timestamp = Date.now();
      const filename = `audio_${timestamp}.mp3`;
      const filepath = path.join(publicDir, filename);

      const arrayBuffer = await audio.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(filepath, buffer);

      return `public/${filename}`;
    } catch (error) {
      console.error('Error generating speech:', error);
      throw new Error('Failed to generate speech with ElevenLabs');
    }
  }
}
