# Firebase Realtime Database Structure

```json
{
  "admin_configs": {
    "sip_config": {
      "server_ip": "sip.example.com",
      "port": 5060,
      "username": "your-sip-username",
      "password": "your-sip-password"
    },
    "smtp_config": {
      "host": "smtp.gmail.com",
      "port": 587,
      "email": "your-email@gmail.com",
      "app_password": "your-app-password",
      "secure": true
    },
    "facebook_config": {
      "app_id": "your-app-id",
      "client_token": "your-client-token",
      "page_id": "your-page-id"
    }
  },
  "users": {
    "user_id_1": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "01700000000",
      "role": "admin"
    }
  }
}
```

## Security Rules (Realtime Database)
**CRITICAL SECURITY WARNING:** 
Allowing the Android app to read `smtp_config` directly means ANY user who can read that node can extract your Gmail App Password and use it to send spam or access your email.

**Secure Approach:**
Only allow `admin` to read/write `admin_configs`. Regular users should NOT have read access to `smtp_config`. Instead, the app should call a Backend API (like your Node.js server) to send the OTP.

If you must read it in the app, ensure strict rules:

```json
{
  "rules": {
    "admin_configs": {
      ".read": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'",
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'"
    },
    "users": {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid === $uid"
      }
    }
  }
}
```
