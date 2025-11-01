import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import * as fs from 'fs';
import * as path from 'path';

export class ElevenLabsService {
  private client: ElevenLabsClient;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = new ElevenLabsClient({ apiKey });
  }

  async generateSpeech(text: string, voiceId?: string): Promise<string | null> {
    try {
      if (!this.apiKey) {
        console.log('No API key - skipping audio');
        return null;
      }

      const voice = voiceId || 'EXAVITQu4vr4xnSDxMaL';
      
      console.log('Generating audio with ElevenLabs...');
      
      const audio = await this.client.textToSpeech.convert(voice, {
        text: text,
        model_id: "eleven_turbo_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      });

      const chunks: Buffer[] = [];
      for await (const chunk of audio) {
        chunks.push(chunk);
      }

      const audioBuffer = Buffer.concat(chunks);
      const audioBase64 = audioBuffer.toString('base64');
      const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;

      console.log('Audio generated successfully');
      return audioDataUrl;
      
    } catch (error) {
      console.error('Error generating speech:', error);
      console.log('Continuing without audio...');
      return null;
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}
