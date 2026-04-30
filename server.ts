import express from 'express';
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

async function startServer() {
  await authenticateBackend();
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
        const port = parseInt(config.port || '587');
        // Port 465 is for implicit TLS (secure: true), Port 587 is for STARTTLS (secure: false)
        const isSecure = port === 465 ? true : (port === 587 ? false : config.secure === true);
        
        return nodemailer.createTransport({
          host: config.host,
          port: port,
          secure: isSecure,
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
    const envPort = parseInt(process.env.SMTP_PORT || '587');
    const envSecure = envPort === 465 ? true : (envPort === 587 ? false : process.env.SMTP_SECURE === 'true');
    
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: envPort,
      secure: envSecure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Endpoint to test SMTP connection
  app.post('/api/test-smtp', async (req, res) => {
    const { host, port, user, pass, secure } = req.body;
    
    if (!host || !port || !user || !pass) {
      return res.status(400).json({ error: 'All SMTP fields are required for testing' });
    }

    try {
      const parsedPort = parseInt(port);
      // Port 465 is for implicit TLS (secure: true), Port 587 is for STARTTLS (secure: false)
      const isSecure = parsedPort === 465 ? true : (parsedPort === 587 ? false : (secure === true || secure === 'true'));

      const transporter = nodemailer.createTransport({
        host,
        port: parsedPort,
        secure: isSecure,
        auth: {
          user,
          pass,
        },
      });

      await transporter.verify();
      res.json({ success: true, message: 'SMTP connection successful!' });
    } catch (error: any) {
      console.error('SMTP test error:', error);
      res.status(500).json({ error: error.message || 'Failed to connect to SMTP server' });
    }
  });

  // Google Sheets Webhook Proxy
  app.post('/api/sheets-sync', async (req, res) => {
    try {
      const { action, donorData, webhookUrl } = req.body;
      if (!webhookUrl) {
        return res.status(400).json({ error: 'Missing webhook URL' });
      }

      await axios.post(webhookUrl, { action, donorData }, {
        headers: { 'Content-Type': 'application/json' },
        // Important: Many Google Apps Script deployments return redirects instead of direct JSON.
        // Axios handles redirects by default but if there's an issue we just log it.
      });
      res.json({ success: true });
    } catch (error) {
      console.error('Error proxying to Google Sheets:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Endpoint to send OTP
  app.post('/api/send-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!auth.currentUser) {
      console.log('Backend not authenticated, attempting to authenticate...');
      await authenticateBackend();
    }

    try {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store OTP in Firestore with 5 minutes expiration
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      await setDoc(doc(db, 'otps', email), {
        otp,
        expiresAt: expiresAt.toISOString()
      });

      const transporter = await getTransporter();
      if (!transporter) {
        throw new Error('SMTP configuration is missing');
      }

      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const appUrl = req.headers.origin || `${protocol}://${host}`;
      const logoUrl = `${appUrl}/logo.png`;

      const mailOptions = {
        from: '"Shishir Voluntary Organization" <shishirvolunteer24@gmail.com>',
        to: email,
        subject: 'Shishir App - Your Verification Code',
        html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden; }
            .header { text-align: center; padding: 30px 20px; background-color: #059669; color: white; }
            .header img { max-width: 80px; margin-bottom: 15px; border-radius: 50%; object-fit: contain; background-color: #ffffff; padding: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header h1 { margin: 0; font-size: 24px; font-weight: bold; }
            .content { padding: 40px 30px; text-align: center; color: #3f3f46; }
            .otp-box { background-color: #f0fdf4; border: 2px dashed #10b981; border-radius: 8px; padding: 20px; margin: 30px auto; font-size: 32px; font-weight: bold; color: #059669; letter-spacing: 5px; max-width: 200px; }
            .note { font-size: 13px; color: #71717a; margin-top: 10px; }
            .footer { background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e4e4e7; }
            .social-links { margin-bottom: 15px; }
            .social-links img { width: 30px; height: 30px; background-color: transparent; padding: 0; box-shadow: none; border-radius: 0; }
            .contact-info { font-size: 14px; color: #52525b; margin-bottom: 10px; line-height: 1.6; }
            .disclaimer { font-size: 12px; color: #a1a1aa; font-style: italic; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="cid:shishirlogo" alt="Shishir Logo" />
              <h1>Shishir Voluntary Organization</h1>
            </div>
            <div class="content">
              <h2>Your Verification Code</h2>
              <p>Dear user, please use the following code to verify your account:</p>
              <div class="otp-box">${otp}</div>
              <p class="note">This code will be valid for the next 5 minutes. Please do not share this code with anyone.</p>
            </div>
            <div class="footer">
              <div class="social-links">
                <a href="https://facebook.com/your-page-link" target="_blank">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/2021_Facebook_icon.svg/512px-2021_Facebook_icon.svg.png" alt="Facebook" />
                </a>
              </div>
              <div class="contact-info">
                Email: shishirvolunteer24@gmail.com<br/>
                Helpline: +880 1XXX-XXXXXX
              </div>
              <div class="disclaimer">
                This is a system generated email, please do not reply.
              </div>
            </div>
          </div>
        </body>
        </html>
        `,
        attachments: [
          {
            filename: 'logo.png',
            path: `${appUrl}/logo.png`,
            cid: 'shishirlogo'
          }
        ]
      };

      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: 'OTP sent successfully' });
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      res.status(500).json({ error: 'Failed to send OTP' });
    }
  });

  // Endpoint to verify OTP
  app.post('/api/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    if (!auth.currentUser) {
      console.log('Backend not authenticated, attempting to authenticate...');
      await authenticateBackend();
    }

    try {
      const otpDoc = await getDoc(doc(db, 'otps', email));
      if (!otpDoc.exists()) {
        return res.status(400).json({ error: 'OTP not found or expired' });
      }

      const data = otpDoc.data();
      if (data.otp !== otp) {
        return res.status(400).json({ error: 'Invalid OTP' });
      }

      if (new Date(data.expiresAt) < new Date()) {
        return res.status(400).json({ error: 'OTP has expired' });
      }

      // OTP is valid, delete it so it can't be reused
      // Note: we can't easily delete with just client SDK if we don't have permission, 
      // but backend has full access.
      await setDoc(doc(db, 'otps', email), { used: true }, { merge: true });

      res.json({ success: true, message: 'OTP verified successfully' });
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      res.status(500).json({ error: 'Failed to verify OTP' });
    }
  });

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
      messaging_type: "RESPONSE",
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
  app.get('/api/messenger/setup-profile', async (req, res) => {
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
              title: "🩸 Blood Request",
              payload: "BLOOD_REQUEST"
            },
            {
              type: "postback",
              title: "🤝 Donor Registration",
              payload: "DONOR_REGISTRATION"
            },
            {
              type: "postback",
              title: "❓ Other Inquiry",
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
  app.post('/api/messenger/messages', async (req, res) => {
    const { recipientId, message } = req.body;
    if (!recipientId || !message) {
      return res.status(400).json({ error: 'Recipient ID and message are required' });
    }

    try {
      const result = await sendFacebookMessage(recipientId, { text: message });
      res.json({ success: true, result });
    } catch (error: any) {
      console.error('Error sending message:', error.response?.data || error.message);
      const errorPayload = error.response?.data?.error || error.message;
      res.status(500).json({ error: errorPayload });
    }
  });

  // Endpoint to get all conversations for the page
  app.get('/api/messenger/conversations', async (req, res) => {
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
      console.error('Error fetching conversations:', errorData);
      const errorPayload = error.response?.data?.error || error.message;
      res.status(500).json({ error: errorPayload });
    }
  });

  // Endpoint to get messages for a specific conversation
  app.get('/api/messenger/messages/:psid', async (req, res) => {
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
      const errorPayload = error.response?.data?.error || error.message;
      res.status(500).json({ error: errorPayload });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
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
