import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

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
        return null;
      }

      const voice = voiceId || 'EXAVITQu4vr4xnSDxMaL';
      
      console.log('Generating audio with ElevenLabs...');
      
      const audio = await this.client.textToSpeech.convert(voice, {
        text: text,
        modelId: "eleven_turbo_v2",
        voiceSettings: {
          stability: 0.5,
          similarityBoost: 0.75
        }
      });

      const chunks: Uint8Array[] = [];
      for await (const chunk of audio) {
        chunks.push(chunk);
      }

      const audioBuffer = Buffer.concat(chunks);
      const audioBase64 = audioBuffer.toString('base64');
      const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;

      console.log('Audio generated successfully');
      return audioDataUrl;
      
    } catch (error) {
      console.error('ElevenLabs error:', error);
      return null;
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}
