import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { initializeApp as initializeClientApp } from 'firebase/app';
import { getFirestore as getClientFirestore, collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';

// Initialize Firebase Admin
const firebaseConfig = JSON.parse(readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf-8'));

if (admin.apps.length === 0) {
  try {
    admin.initializeApp();
    console.log('Firebase Admin initialized with default credentials');
  } catch (err) {
    console.warn('Default initialization failed, trying with explicit projectId:', err);
    try {
      admin.initializeApp({
        projectId: firebaseConfig.projectId,
      });
      console.log('Firebase Admin initialized with explicit projectId:', firebaseConfig.projectId);
    } catch (err2) {
      console.error('Error initializing Firebase Admin:', err2);
    }
  }
}

// Admin DB
const db = getFirestore(firebaseConfig.firestoreDatabaseId || '(default)');

// Client DB (for fallback/logging)
const clientApp = initializeClientApp(firebaseConfig);
const clientDb = getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId || '(default)');

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Global Debug Variable for Webhooks
  let lastWebhookRequest: any = { status: 'No request received yet', time: new Date().toISOString() };

  app.use(express.json());

  // Global Logger to catch ANY hit to the server for debugging
  app.use(async (req, res, next) => {
    // Skip logging for the debug route itself to avoid infinite loops/clutter
    if (req.originalUrl === '/api/facebook/debug') {
      return next();
    }

    const logData: any = {
      method: req.method,
      url: req.originalUrl,
      query: req.query,
      headers: req.headers,
      time: new Date().toISOString()
    };

    if (req.body !== undefined && Object.keys(req.body).length > 0) {
      logData.body = req.body;
    }

    console.log(`DEBUG LOG: ${req.method} ${req.originalUrl}`);
    
    // Log every hit to Firestore using CLIENT SDK
    try {
      await addDoc(collection(clientDb, 'webhookRawLogs'), logData);
    } catch (err) {
      console.error('Error logging raw hit with Client SDK:', err);
    }
    next();
  });

  // 1. Facebook Webhook Verification (Priority)
  app.get(['/api/facebook/webhook', '/api/facebook/webhook/'], async (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const VERIFY_TOKEN = (process.env.FB_VERIFY_TOKEN || 'shishir_verify_token').trim();
    
    lastWebhookRequest = {
      method: 'GET',
      query: req.query,
      time: new Date().toISOString(),
      headers: req.headers
    };

    console.log('--- FB VERIFICATION ATTEMPT ---', req.query);

    // Log to Firestore for persistent debugging
    try {
      await db.collection('webhookLogs').add({
        type: 'verification',
        timestamp: new Date().toISOString(),
        query: req.query,
        headers: req.headers,
        expectedToken: VERIFY_TOKEN,
        match: token === VERIFY_TOKEN
      });
    } catch (err) {
      console.error('Error logging to Firestore:', err);
    }

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('--- FB VERIFICATION SUCCESS ---');
      res.set('Content-Type', 'text/plain');
      res.status(200).send(String(challenge));
    } else {
      console.log('--- FB VERIFICATION FAILED ---', { received: token, expected: VERIFY_TOKEN });
      res.status(403).send('Verification failed');
    }
  });

  // Debug Route to see what Facebook sent
  app.get('/api/facebook/debug', async (req, res) => {
    try {
      console.log('Fetching logs from webhookRawLogs using Client SDK...');
      const snapshot = await getDocs(collection(clientDb, 'webhookRawLogs'));
      
      console.log(`Found ${snapshot.size} logs`);
      const logs = snapshot.docs.map(doc => doc.data());
      
      const sortedLogs = logs.sort((a: any, b: any) => 
        new Date(b.time).getTime() - new Date(a.time).getTime()
      ).slice(0, 10);

      res.json({
        last_10_hits: sortedLogs,
        total_logs: snapshot.size,
        current_server_time: new Date().toISOString(),
        source: 'Client SDK'
      });
    } catch (err: any) {
      console.warn('Error in /api/facebook/debug with Client SDK, trying Admin SDK:', err.message);
      try {
        const snapshot = await db.collection('webhookRawLogs').get();
        const logs = snapshot.docs.map(doc => doc.data());
        const sortedLogs = logs.sort((a: any, b: any) => 
          new Date(b.time).getTime() - new Date(a.time).getTime()
        ).slice(0, 10);

        res.json({
          last_10_hits: sortedLogs,
          total_logs: snapshot.size,
          current_server_time: new Date().toISOString(),
          source: 'Admin SDK'
        });
      } catch (adminErr: any) {
        console.error('Error in /api/facebook/debug with both SDKs:', adminErr);
        res.status(500).json({ 
          error: 'Failed to fetch logs with both SDKs', 
          details: {
            clientError: err.message,
            adminError: adminErr.message,
            code: adminErr.code
          }
        });
      }
    }
  });

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Test Route to verify API accessibility
  app.get('/api/test', (req, res) => {
    res.send('API is working');
  });

  // Helper to get SMTP transporter
  async function getTransporter() {
    try {
      const smtpSnap = await db.collection('settings').doc('smtpConfig').get();
      const config = smtpSnap.exists ? smtpSnap.data() : null;

      if (config && config.host && config.user && config.pass) {
        console.log('Using SMTP config from Firestore');
        return nodemailer.createTransport({
          host: config.host,
          port: parseInt(config.port || '587'),
          secure: config.secure === true,
          auth: {
            user: config.user,
            pass: config.pass,
          },
        });
      }
    } catch (error) {
      console.error('Error fetching SMTP config from Firestore:', error);
    }

    console.log('Using SMTP config from environment variables');
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Facebook Webhook Message Handling
  app.post('/api/facebook/webhook', async (req, res) => {
    const body = req.body;
    
    // Log incoming messages for debugging
    console.log('Incoming FB Message:', JSON.stringify(body, null, 2));

    if (body.object === 'page') {
      try {
        for (const entry of body.entry) {
          if (!entry.messaging) continue;
          
          for (const webhook_event of entry.messaging) {
            const sender_psid = webhook_event.sender.id;
            
            // Handle postback (button click)
            if (webhook_event.postback) {
              const payload = webhook_event.postback.payload;
              
              // Check if it's a blood request button
              // The user specifically asked for "Blood Request Button"
              if (payload === 'BLOOD_REQUEST' || payload === 'GET_STARTED_BLOOD_REQUEST') {
                await db.collection('facebookRequests').add({
                  facebookId: sender_psid,
                  senderName: 'Facebook User',
                  timestamp: new Date().toISOString(),
                  status: 'new',
                  payload: payload,
                  message: webhook_event.postback.title || 'Blood Request Button Clicked'
                });
              }
            }
          }
        }
        res.status(200).send('EVENT_RECEIVED');
      } catch (error) {
        console.error('Error processing Facebook Webhook:', error);
        res.status(500).send('INTERNAL_SERVER_ERROR');
      }
    } else {
      res.sendStatus(404);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
