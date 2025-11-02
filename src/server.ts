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
    
    // Essayer la voix de secours
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
    
    // Vérifier si les credentials existent
    if (!process.env.GOOGLE_CREDENTIALS) {
      console.error('❌ GOOGLE_CREDENTIALS not found in environment variables');
      return { driveLink: null, driveId: null };
    }

    // Authentification
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // Métadonnées du fichier
    const fileMetadata = {
      name: fileName,
      mimeType: 'video/mp4',
    };

    // Contenu du fichier
    const media = {
      mimeType: 'video/mp4',
      body: fs.createReadStream(filePath),
    };

    // Upload
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink',
    });

    // Rendre le fichier accessible (optionnel)
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

// === INTERFACE REQUEST ===
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

// === ENDPOINT PRINCIPAL ===
app.post('/api/render', async (req: Request, res: Response) => {
  try {
    const { script, voiceId, avatarUrl, backgroundUrl, audioUrl, style }: RenderRequest = req.body;

    if (!script) {
      res.status(400).json({ error: 'Script is required' });
      return;
    }

    let finalAudioUrl: string | null | undefined = audioUrl;

    // Génération audio avec ElevenLabs
    if (!finalAudioUrl && elevenLabsApiKey) {
      console.log('🎵 Generating audio with ElevenLabs...');
      
      const selectedVoiceId = voiceId || "TxGEqnHWrfWFTfGW9XjX";
      finalAudioUrl = await generateAudioWithElevenLabs(script, selectedVoiceId);
      
      if (finalAudioUrl) {
        console.log('✅ Audio generated successfully');
      } else {
        console.log('❌ Audio generation failed, continuing without audio');
      }
    }

    // Bundling Remotion
    const bundleLocation = await bundle({
      entryPoint: path.join(process.cwd(), 'remotion/index.tsx'),
      webpackOverride: (config) => config,
    });

    // Sélection de la composition
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

    // Préparation du dossier de sortie
    const outputDir = path.join(process.cwd(), 'public', 'videos');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = Date.now();
    const outputPath = path.join(outputDir, `video_${timestamp}.mp4`);

    console.log('🎬 Rendering video...');
    
    // Rendu de la vidéo
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: {
        script,
        audioUrl: finalAudioUrl || undefined,
        avatarUrl,
        backgroundUrl,
      },
    });

    console.log('✅ Video rendered successfully!');

    // Upload vers Google Drive
    const { driveLink, driveId } = await uploadToGoogleDrive(
      outputPath, 
      `reel_${timestamp}.mp4`
    );

    const videoUrl = `public/videos/video_${timestamp}.mp4`;
    
    const isAbsoluteAudioUrl = finalAudioUrl ? 
      (finalAudioUrl.startsWith('http://') || finalAudioUrl.startsWith('https://')) : 
      false;
    
    // Réponse avec toutes les infos
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
    res.status(500).json({ 
      error: 'Failed to render video', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// === HEALTH CHECK ===
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok',
    elevenLabsConfigured: !!elevenLabsApiKey,
    googleDriveConfigured: !!process.env.GOOGLE_CREDENTIALS,
  });
});

// === DÉMARRAGE SERVEUR ===
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🎵 ElevenLabs configured: ${!!elevenLabsApiKey}`);
  console.log(`📁 Google Drive configured: ${!!process.env.GOOGLE_CREDENTIALS}`);
});
