import express, { Request, Response } from 'express';
import cors from 'cors';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { google } from 'googleapis';
import * as path from 'path';
import * as fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/public', express.static(path.join(process.cwd(), 'public')));

const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

// === FONCTION AUDIO AVEC FALLBACK ===
async function generateAudioWithElevenLabs(text: string, voiceId: string = "TxGEqnHWrfWFTfGW9XjX"): Promise<string | null> {
  try {
    console.log(`🎵 Generating audio with voice: ${voiceId}`);
    
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY!
      },
      body: JSON.stringify({
        text: text.substring(0, 5000),
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.7,
          similarity_boost: 0.8
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ ElevenLabs API error: ${response.status}`, errorText);
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const audioDir = path.join(process.cwd(), 'public', 'audio');
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    
    const audioPath = path.join(audioDir, `audio_${Date.now()}.mp3`);
    fs.writeFileSync(audioPath, Buffer.from(audioBuffer));
    
    console.log(`✅ Audio generated successfully: ${audioPath}`);
    return audioPath;
    
  } catch (error) {
    console.error('❌ ElevenLabs failed:', error);
    
    if (voiceId === "TxGEqnHWrfWFTfGW9XjX") {
      console.log('🔄 Trying backup voice: Bella');
      return await generateAudioWithElevenLabs(text, "4RZ84U1b4WCqpu57LvIq");
    } else {
      console.log('🔇 All voice generation failed, continuing without audio');
      return null;
    }
  }
}

// === FONCTION UPLOAD GOOGLE DRIVE ===
async function uploadToGoogleDrive(filePath: string, fileName: string): Promise<{ driveLink: string | null; driveId: string | null }> {
  try {
    console.log('📤 Uploading to Google Drive...');
    
    if (!process.env.GOOGLE_CREDENTIALS) {
      console.error('❌ GOOGLE_CREDENTIALS not found in environment variables');
      return { driveLink: null, driveId: null };
    }

    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    const fileMetadata = {
      name: fileName,
      mimeType: 'video/mp4',
    };

    const media = {
      mimeType: 'video/mp4',
      body: fs.createReadStream(filePath),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink',
    });

    if (response.data.id) {
      await drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });
    }

    console.log('✅ Video uploaded to Google Drive!');
    console.log(`📁 Drive ID: ${response.data.id}`);
    console.log(`🔗 View Link: ${response.data.webViewLink}`);

    return {
      driveLink: response.data.webViewLink || null,
      driveId: response.data.id || null
    };
    
  } catch (error) {
    console.error('❌ Google Drive upload failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    return { driveLink: null, driveId: null };
  }
}

// === FONCTION NETTOYAGE MÉMOIRE ===
function cleanupMemory() {
  if (global.gc) {
    console.log('🧹 Running garbage collection...');
    global.gc();
  }
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

    let finalAudioUrl: string | null | undefined = audioUrl;

    // Génération audio (désactivée pour économiser RAM)
    if (!finalAudioUrl && elevenLabsApiKey) {
      console.log('⚠️  Audio generation skipped to save RAM');
      finalAudioUrl = null;
    }

    console.log('🧹 Cleaning memory before render...');
    cleanupMemory();

    // Bundling Remotion
    const bundleLocation = await bundle({
      entryPoint: path.join(process.cwd(), 'remotion/index.tsx'),
      webpackOverride: (config) => config,
    });

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'VideoTemplate',
      inputProps: {
        script,
        audioUrl: finalAudioUrl || undefined,
        avatarUrl,
        backgroundUrl,
      },
    });

    const outputDir = path.join(process.cwd(), 'public', 'videos');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = Date.now();
    const outputPath = path.join(outputDir, `video_${timestamp}.mp4`);

    console.log('🎬 Rendering video with optimizations...');
    
    // ⚡ OPTIMISATIONS POUR RENDER GRATUIT
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      // Optimisations RAM
      concurrency: 1,              // ✅ 1 seul process au lieu de plusieurs
      imageFormat: 'jpeg',         // ✅ JPEG consomme moins que PNG
      scale: 0.75,                 // ✅ Réduire la résolution de 25%
      crf: 28,                     // ✅ Compression (18=haute, 28=moyenne, 32=basse)
      pixelFormat: 'yuv420p',
      enforceAudioTrack: false,    // ✅ Pas de piste audio vide
      inputProps: {
        script,
        audioUrl: finalAudioUrl || undefined,
        avatarUrl,
        backgroundUrl,
      },
    });

    console.log('✅ Video rendered successfully!');
    
    console.log('🧹 Cleaning memory after render...');
    cleanupMemory();

    // Upload vers Google Drive
    const { driveLink, driveId } = await uploadToGoogleDrive(
      outputPath, 
      `reel_${timestamp}.mp4`
    );

    // Nettoyage du fichier local pour libérer espace
    try {
      fs.unlinkSync(outputPath);
      console.log('🗑️  Local file cleaned up');
    } catch (e) {
      console.log('⚠️  Could not delete local file');
    }

    const videoUrl = `public/videos/video_${timestamp}.mp4`;
    
    const isAbsoluteAudioUrl = finalAudioUrl ? 
      (finalAudioUrl.startsWith('http://') || finalAudioUrl.startsWith('https://')) : 
      false;
    
    res.json({
      success: true,
      videoUrl: `/${videoUrl}`,
      videoPath: outputPath,
      driveLink: driveLink,
      driveId: driveId,
      audioUrl: finalAudioUrl ? (isAbsoluteAudioUrl ? finalAudioUrl : `/${finalAudioUrl}`) : null,
      timestamp: timestamp,
    });
    
  } catch (error) {
    console.error('❌ Error rendering video:', error);
    cleanupMemory();
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
    googleDriveConfigured: !!process.env.GOOGLE_CREDENTIALS,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🎵 ElevenLabs configured: ${!!elevenLabsApiKey}`);
  console.log(`📁 Google Drive configured: ${!!process.env.GOOGLE_CREDENTIALS}`);
  console.log(`⚡ Optimizations enabled for 512MB RAM`);
});
