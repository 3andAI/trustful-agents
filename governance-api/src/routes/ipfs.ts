import { Router } from 'express';
import type { Request, Response } from 'express';
import { PINATA_API_KEY, PINATA_SECRET_KEY, IPFS_GATEWAY } from '../config/index.js';

const router = Router();

// ============================================================================
// Middleware: verify Pinata is configured
// ============================================================================

function requirePinataConfig(_req: Request, res: Response, next: () => void) {
  if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
    res.status(503).json({
      error: 'ipfs_not_configured',
      message: 'IPFS/Pinata is not configured on this server. Set PINATA_API_KEY and PINATA_SECRET_KEY.',
    });
    return;
  }
  next();
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /ipfs/test
 * Test Pinata authentication
 */
router.get('/test', requirePinataConfig, async (_req: Request, res: Response) => {
  try {
    const response = await fetch('https://api.pinata.cloud/data/testAuthentication', {
      headers: {
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_SECRET_KEY,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(response.status).json({
        error: 'pinata_auth_failed',
        message: `Pinata authentication failed: ${text}`,
      });
      return;
    }

    const data = await response.json();
    res.json({ status: 'ok', pinata: data });
  } catch (error) {
    console.error('Pinata test error:', error);
    res.status(500).json({ error: 'Failed to test Pinata authentication' });
  }
});

/**
 * POST /ipfs/upload-json
 * Pin JSON data to Pinata/IPFS
 * Body: { data: object, name?: string }
 */
router.post('/upload-json', requirePinataConfig, async (req: Request, res: Response) => {
  try {
    const { data, name } = req.body;

    if (!data) {
      res.status(400).json({ error: 'Missing "data" field in request body' });
      return;
    }

    const pinataBody = {
      pinataContent: data,
      pinataMetadata: {
        name: name || `trustful-${Date.now()}.json`,
      },
    };

    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_SECRET_KEY,
      },
      body: JSON.stringify(pinataBody),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Pinata pin JSON error:', text);
      res.status(response.status).json({
        error: 'pinata_upload_failed',
        message: `Failed to pin JSON: ${text}`,
      });
      return;
    }

    const result = await response.json() as { IpfsHash: string; PinSize: number; Timestamp: string };

    res.json({
      ipfsHash: result.IpfsHash,
      ipfsUrl: `${IPFS_GATEWAY}/${result.IpfsHash}`,
      pinSize: result.PinSize,
      timestamp: result.Timestamp,
    });
  } catch (error) {
    console.error('IPFS upload-json error:', error);
    res.status(500).json({ error: 'Failed to upload JSON to IPFS' });
  }
});

/**
 * POST /ipfs/upload
 * Pin a file to Pinata/IPFS
 * Expects multipart/form-data with a "file" field
 * Note: requires express-fileupload or multer middleware on the main app
 */
router.post('/upload', requirePinataConfig, async (req: Request, res: Response) => {
  try {
    // Check for file in request (requires multer or similar middleware)
    const file = (req as any).file || (req as any).files?.file;
    
    if (!file) {
      res.status(400).json({ error: 'No file provided. Send a file in the "file" field.' });
      return;
    }

    // Build FormData for Pinata
    const formData = new FormData();
    
    // Handle different file middleware formats
    const buffer = file.buffer || file.data;
    const filename = file.originalname || file.name || `upload-${Date.now()}`;
    
    const blob = new Blob([buffer]);
    formData.append('file', blob, filename);
    
    const metadata = JSON.stringify({
      name: filename,
    });
    formData.append('pinataMetadata', metadata);

    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_SECRET_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Pinata pin file error:', text);
      res.status(response.status).json({
        error: 'pinata_upload_failed',
        message: `Failed to pin file: ${text}`,
      });
      return;
    }

    const result = await response.json() as { IpfsHash: string; PinSize: number; Timestamp: string };

    res.json({
      ipfsHash: result.IpfsHash,
      ipfsUrl: `${IPFS_GATEWAY}/${result.IpfsHash}`,
      pinSize: result.PinSize,
      timestamp: result.Timestamp,
    });
  } catch (error) {
    console.error('IPFS upload error:', error);
    res.status(500).json({ error: 'Failed to upload file to IPFS' });
  }
});

export default router;
