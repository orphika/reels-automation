import express, { Request, Response } from 'express';
import cors from 'cors';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { ElevenLabsService } from './elevenlabs-service';
import * as path from 'path';
import * as fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/public', express.static(path.join(process.cwd(), 'public')));

const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
let elevenLabsService: ElevenLabsService | null = null;

if (elevenLabsApiKey) {
  elevenLabsService = new ElevenLabsService(elevenLabsApiKey);
}

interface RenderRequest {
  script: string;
  voiceId?: string;
  avatarUrl?: string;
  backgroundUrl?: string;
  audioUrl?: string;
  style?: {
    backgroundColor?: string;
    fontColor?: string;
  };
}

app.post('/api/render', async (req: Request, res: Response) => {
  try {
    const { script, voiceId, avatarUrl, backgroundUrl, audioUrl, style }: RenderRequest = req.body;

    if (!script) {
      res.status(400).json({ error: 'Script is required' });
      return;
    }

    // Changed: Allow null type
    let finalAudioUrl: string | null | undefined = audioUrl;

    // Generate audio if not provided
    if (!finalAudioUrl && elevenLabsService) {
      console.log('Generating audio with ElevenLabs...');
      finalAudioUrl = await elevenLabsService.generateSpeech(script, voiceId);
      
      if (finalAudioUrl) {
        console.log('Audio generated successfully');
      } else {
        console.log('Audio generation failed, continuing without audio');
      }
    }

    // Bundle Remotion
    const bundleLocation = await bundle({
      entryPoint: path.join(process.cwd(), 'remotion/index.tsx'),
      webpackOverride: (config) => config,
    });

    // Select composition
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'VideoTemplate',
      inputProps: {
        script,
        audioUrl: finalAudioUrl || undefined, // Changed: Handle null
        avatarUrl,
        backgroundUrl,
      },
    });

    // Create output directory
    const outputDir = path.join(process.cwd(), 'public', 'videos');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = Date.now();
    const outputPath = path.join(outputDir, `video_${timestamp}.mp4`);

    console.log('Rendering video...');
    
    // Render video
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: {
        script,
        audioUrl: finalAudioUrl || undefined, // Changed: Handle null
        avatarUrl,
        backgroundUrl,
      },
    });

    console.log('Video rendered successfully!');

    const videoUrl = `public/videos/video_${timestamp}.mp4`;
    
    // Changed: Safe check for finalAudioUrl
    const isAbsoluteAudioUrl = finalAudioUrl ? 
      (finalAudioUrl.startsWith('http://') || finalAudioUrl.startsWith('https://')) : 
      false;
    
    res.json({
      success: true,
      videoUrl: `/${videoUrl}`,
      audioUrl: finalAudioUrl ? (isAbsoluteAudioUrl ? finalAudioUrl : `/${finalAudioUrl}`) : null,
      videoPath: outputPath,
    });
    
  } catch (error) {
    console.error('Error rendering video:', error);
    res.status(500).json({ 
      error: 'Failed to render video', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok',
    elevenLabsConfigured: !!elevenLabsApiKey,
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`); // Fixed: Added ${}
  console.log(`ElevenLabs configured: ${!!elevenLabsApiKey}`); // Fixed: Added ${}
});
