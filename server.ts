import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { readFileSync } from 'fs';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global Error Handlers to prevent server crashes
process.on('uncaughtException', (error) => {
  console.error('CRITICAL: Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

import { initializeApp as initializeClientApp } from 'firebase/app';
import { getFirestore as getClientFirestore, collection, addDoc, getDocs, query, orderBy, limit, doc, getDoc, updateDoc, writeBatch, where, setDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

// Initialize Firebase Client
const firebaseConfig = JSON.parse(readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf-8'));

const clientApp = initializeClientApp(firebaseConfig);
const db = getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId || '(default)');
const auth = getAuth(clientApp);

// Authenticate Backend
const BACKEND_EMAIL = 'backend@lifesync.local';
const BACKEND_PASSWORD = 'SecureBackendPassword123!';

async function authenticateBackend() {
  try {
    await signInWithEmailAndPassword(auth, BACKEND_EMAIL, BACKEND_PASSWORD);
    console.log('Backend authenticated successfully');
  } catch (error: any) {
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
      try {
        await createUserWithEmailAndPassword(auth, BACKEND_EMAIL, BACKEND_PASSWORD);
        console.log('Backend user created and authenticated');
      } catch (createError) {
        console.error('Failed to create backend user. Please enable Email/Password authentication in Firebase Console.', createError);
      }
    } else {
      console.error('Failed to authenticate backend. Please enable Email/Password authentication in Firebase Console.', error);
    }
  }
}
authenticateBackend();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Test Route to verify API accessibility
  app.get('/api/test', (req, res) => {
    res.send('API is working');
  });

  // Helper to get SMTP transporter
  async function getTransporter() {
    try {
      const smtpSnap = await getDoc(doc(db, 'settings', 'smtpConfig'));
      const config = smtpSnap.exists() ? smtpSnap.data() : null;

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

  // Function to send messages back to Facebook
  async function sendFacebookMessage(sender_psid: string, message_payload: any) {
    let PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
    
    try {
      const configDoc = await getDoc(doc(db, 'settings', 'facebookConfig'));
      if (configDoc.exists() && configDoc.data()?.pageAccessToken) {
        PAGE_ACCESS_TOKEN = configDoc.data()?.pageAccessToken;
      }
    } catch (e) {
      console.error("Error fetching facebook config from firestore:", e);
    }

    if (!PAGE_ACCESS_TOKEN) {
      throw new Error("PAGE_ACCESS_TOKEN is not set in environment variables or Firestore.");
    }

    const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
    const requestBody = {
      recipient: { id: sender_psid },
      message: message_payload
    };

    try {
      const response = await axios.post(url, requestBody);
      console.log("Message sent successfully to PSID:", sender_psid);
      return response.data;
    } catch (error: any) {
      console.error("Error sending Facebook message:", error.response?.data || error.message);
      throw error;
    }
  }

  // Endpoint to setup Facebook Messenger Profile (Get Started button & Persistent Menu)
  app.get('/api/facebook/setup-profile', async (req, res) => {
    let PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
    
    try {
      const configDoc = await getDoc(doc(db, 'settings', 'facebookConfig'));
      if (configDoc.exists() && configDoc.data()?.pageAccessToken) {
        PAGE_ACCESS_TOKEN = configDoc.data()?.pageAccessToken;
      }
    } catch (e) {
      console.error("Error fetching facebook config from firestore:", e);
    }

    if (!PAGE_ACCESS_TOKEN) {
      return res.status(500).send("PAGE_ACCESS_TOKEN is not set.");
    }

    const url = `https://graph.facebook.com/v19.0/me/messenger_profile?access_token=${PAGE_ACCESS_TOKEN}`;
    const requestBody = {
      get_started: {
        payload: "GET_STARTED_PAYLOAD"
      },
      persistent_menu: [
        {
          locale: "default",
          composer_input_disabled: false,
          call_to_actions: [
            {
              type: "postback",
              title: "🩸 রক্তের জন্য আবেদন",
              payload: "BLOOD_REQUEST"
            },
            {
              type: "postback",
              title: "🤝 রক্তদাতা নিবন্ধন",
              payload: "DONOR_REGISTRATION"
            },
            {
              type: "postback",
              title: "❓ অন্যান্য জিজ্ঞাসা",
              payload: "OTHER_INQUIRY"
            }
          ]
        }
      ]
    };

    try {
      const response = await axios.post(url, requestBody);
      res.json(response.data);
    } catch (error: any) {
      console.error("Error setting up profile:", error.response?.data || error.message);
      res.status(500).send("Error setting up profile");
    }
  });

  // Endpoint to send a direct message to a user
  app.post('/api/facebook/messages', async (req, res) => {
    const { recipientId, message } = req.body;
    if (!recipientId || !message) {
      return res.status(400).json({ error: 'Recipient ID and message are required' });
    }

    try {
      const result = await sendFacebookMessage(recipientId, { text: message });
      res.json({ success: true, result });
    } catch (error: any) {
      console.error('Error sending message:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.error?.message || error.message;
      res.status(500).json({ error: errorMessage });
    }
  });

  // Endpoint to get all conversations for the page
  app.get('/api/facebook/conversations', async (req, res) => {
    let PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
    let PAGE_ID = process.env.PAGE_ID;
    
    try {
      const configDoc = await getDoc(doc(db, 'settings', 'facebookConfig'));
      if (configDoc.exists()) {
        const data = configDoc.data();
        if (data?.pageAccessToken) PAGE_ACCESS_TOKEN = data.pageAccessToken;
        if (data?.pageId) PAGE_ID = data.pageId;
      }
    } catch (e) {
      console.error("Error fetching facebook config from firestore:", e);
    }

    if (!PAGE_ACCESS_TOKEN || !PAGE_ID) {
      return res.status(400).json({ error: 'Page Access Token or Page ID not configured' });
    }

    try {
      // Use a more standard set of fields for conversations
      const url = `https://graph.facebook.com/v19.0/${PAGE_ID}/conversations?fields=participants{id,name,picture},updated_time,unread_count,snippet&access_token=${PAGE_ACCESS_TOKEN}`;
      console.log('Fetching Facebook conversations for Page ID:', PAGE_ID);
      const response = await axios.get(url);
      const data = response.data;
      
      if (data.error) {
        console.error('Facebook API Error in response data:', data.error);
        throw new Error(data.error.message);
      }
      
      res.json({ ...data, pageId: PAGE_ID });
    } catch (error: any) {
      const errorData = error.response?.data || error.message;
      console.error('Error fetching conversations:', JSON.stringify(errorData, null, 2));
      const errorMessage = error.response?.data?.error?.message || error.message;
      res.status(500).json({ error: errorMessage });
    }
  });

  // Endpoint to get messages for a specific conversation
  app.get('/api/facebook/messages/:psid', async (req, res) => {
    const { psid } = req.params;
    let PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
    let PAGE_ID = process.env.PAGE_ID;
    
    try {
      const configDoc = await getDoc(doc(db, 'settings', 'facebookConfig'));
      if (configDoc.exists()) {
        const data = configDoc.data();
        if (data?.pageAccessToken) PAGE_ACCESS_TOKEN = data.pageAccessToken;
        if (data?.pageId) PAGE_ID = data.pageId;
      }
    } catch (e) {
      console.error("Error fetching facebook config from firestore:", e);
    }

    if (!PAGE_ACCESS_TOKEN || !PAGE_ID) {
      return res.status(400).json({ error: 'Page Access Token or Page ID not configured' });
    }

    try {
      // First find the conversation ID for this PSID
      const convUrl = `https://graph.facebook.com/v19.0/${PAGE_ID}/conversations?fields=participants&access_token=${PAGE_ACCESS_TOKEN}`;
      const convResponse = await axios.get(convUrl);
      const convData = convResponse.data;
      
      if (convData.error) throw new Error(convData.error.message);
      
      const conversation = convData.data.find((c: any) => 
        c.participants.data.some((p: any) => p.id === psid)
      );
      
      if (!conversation) {
        return res.json({ data: [] });
      }
      
      const msgUrl = `https://graph.facebook.com/v19.0/${conversation.id}/messages?fields=message,created_time,from,to&access_token=${PAGE_ACCESS_TOKEN}`;
      const msgResponse = await axios.get(msgUrl);
      const msgData = msgResponse.data;
      
      if (msgData.error) throw new Error(msgData.error.message);
      
      res.json(msgData);
    } catch (error: any) {
      console.error('Error fetching messages:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.error?.message || error.message;
      res.status(500).json({ error: errorMessage });
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
