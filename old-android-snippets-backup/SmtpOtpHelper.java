package com.example.shishir;

import android.os.AsyncTask;
import android.util.Log;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;
import java.util.Properties;
import java.util.Random;
import javax.mail.Message;
import javax.mail.MessagingException;
import javax.mail.PasswordAuthentication;
import javax.mail.Session;
import javax.mail.Transport;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeMessage;

/**
 * WARNING: Sending emails directly from Android using JavaMail API requires you to 
 * fetch the SMTP password to the client device. This is a SECURITY RISK if the app 
 * is decompiled or if the Firebase rules are not strictly secured.
 * 
 * It is highly recommended to use a Backend (Node.js/Cloud Functions) to send the email.
 * 
 * Dependencies required in build.gradle:
 * implementation 'com.sun.mail:android-mail:1.6.7'
 * implementation 'com.sun.mail:android-activation:1.6.7'
 */
public class SmtpOtpHelper {

    public interface OtpCallback {
        void onOtpSent(String generatedOtp);
        void onError(String error);
    }

    public static void generateAndSendOtp(String recipientEmail, OtpCallback callback) {
        // Generate 6-digit OTP
        Random random = new Random();
        int otp = 100000 + random.nextInt(900000);
        String otpString = String.valueOf(otp);

        // Fetch SMTP settings from Firebase Realtime Database
        DatabaseReference smtpRef = FirebaseDatabase.getInstance().getReference("admin_configs/smtp_config");
        smtpRef.addListenerForSingleValueEvent(new ValueEventListener() {
            @Override
            public void onDataChange(DataSnapshot snapshot) {
                if (snapshot.exists()) {
                    String host = snapshot.child("host").getValue(String.class);
                    String port = String.valueOf(snapshot.child("port").getValue(Long.class));
                    String email = snapshot.child("email").getValue(String.class);
                    String password = snapshot.child("app_password").getValue(String.class);

                    // Send email in background thread
                    new SendEmailTask(host, port, email, password, recipientEmail, otpString, callback).execute();
                } else {
                    callback.onError("SMTP settings not found in database.");
                }
            }

            @Override
            public void onCancelled(DatabaseError error) {
                callback.onError(error.getMessage());
            }
        });
    }

    private static class SendEmailTask extends AsyncTask<Void, Void, Boolean> {
        private String host, port, senderEmail, senderPassword, recipientEmail, otp;
        private OtpCallback callback;
        private String errorMessage = "";

        public SendEmailTask(String host, String port, String senderEmail, String senderPassword, String recipientEmail, String otp, OtpCallback callback) {
            this.host = host;
            this.port = port;
            this.senderEmail = senderEmail;
            this.senderPassword = senderPassword;
            this.recipientEmail = recipientEmail;
            this.otp = otp;
            this.callback = callback;
        }

        @Override
        protected Boolean doInBackground(Void... voids) {
            Properties props = new Properties();
            props.put("mail.smtp.host", host);
            props.put("mail.smtp.socketFactory.port", port);
            props.put("mail.smtp.socketFactory.class", "javax.net.ssl.SSLSocketFactory");
            props.put("mail.smtp.auth", "true");
            props.put("mail.smtp.port", port);

            Session session = Session.getDefaultInstance(props, new javax.mail.Authenticator() {
                protected PasswordAuthentication getPasswordAuthentication() {
                    return new PasswordAuthentication(senderEmail, senderPassword);
                }
            });

            try {
                Message message = new MimeMessage(session);
                // Set the sender name to "Shishir Voluntary Organization" and email to shishirvolunteer24@gmail.com
                message.setFrom(new InternetAddress("shishirvolunteer24@gmail.com", "Shishir Voluntary Organization"));
                message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(recipientEmail));
                message.setSubject("Shishir App - Your Verification Code");
                message.setText("Dear User,\n\nYour OTP for verification is: " + otp + "\n\nPlease do not share this code with anyone.");

                Transport.send(message);
                return true;

            } catch (MessagingException | java.io.UnsupportedEncodingException e) {
                e.printStackTrace();
                errorMessage = e.getMessage();
                return false;
            }
        }

        @Override
        protected void onPostExecute(Boolean success) {
            if (success) {
                callback.onOtpSent(otp); // Return the OTP to the activity to verify later
            } else {
                callback.onError("Failed to send email: " + errorMessage);
            }
        }
    }
}
