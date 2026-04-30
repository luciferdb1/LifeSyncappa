package com.example.shishir;

import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;
import java.util.HashMap;
import java.util.Map;

public class AdminConfigActivity extends AppCompatActivity {

    private EditText etSipServerIp, etSipPort, etSipUsername, etSipPassword;
    private EditText etSmtpHost, etSmtpPort, etSmtpEmail, etSmtpPassword;
    private EditText etFbAppId, etFbClientToken;
    private Button btnSave;

    private DatabaseReference adminConfigsRef;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_admin_config); // Ensure you create this XML layout

        // Initialize Firebase
        adminConfigsRef = FirebaseDatabase.getInstance().getReference("admin_configs");

        // Initialize Views
        etSipServerIp = findViewById(R.id.etSipServerIp);
        etSipPort = findViewById(R.id.etSipPort);
        etSipUsername = findViewById(R.id.etSipUsername);
        etSipPassword = findViewById(R.id.etSipPassword);
        
        etSmtpHost = findViewById(R.id.etSmtpHost);
        etSmtpPort = findViewById(R.id.etSmtpPort);
        etSmtpEmail = findViewById(R.id.etSmtpEmail);
        etSmtpPassword = findViewById(R.id.etSmtpPassword);
        
        etFbAppId = findViewById(R.id.etFbAppId);
        etFbClientToken = findViewById(R.id.etFbClientToken);
        
        btnSave = findViewById(R.id.btnSave);

        loadCurrentSettings();

        btnSave.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                saveSettings();
            }
        });
    }

    private void loadCurrentSettings() {
        adminConfigsRef.addListenerForSingleValueEvent(new ValueEventListener() {
            @Override
            public void onDataChange(@NonNull DataSnapshot snapshot) {
                if (snapshot.exists()) {
                    // Load SIP
                    if (snapshot.child("sip_config").exists()) {
                        etSipServerIp.setText(snapshot.child("sip_config/server_ip").getValue(String.class));
                        if (snapshot.child("sip_config/port").getValue() != null) {
                            etSipPort.setText(String.valueOf(snapshot.child("sip_config/port").getValue(Long.class)));
                        }
                        etSipUsername.setText(snapshot.child("sip_config/username").getValue(String.class));
                        etSipPassword.setText(snapshot.child("sip_config/password").getValue(String.class));
                    }
                    // Load SMTP
                    if (snapshot.child("smtp_config").exists()) {
                        etSmtpHost.setText(snapshot.child("smtp_config/host").getValue(String.class));
                        if (snapshot.child("smtp_config/port").getValue() != null) {
                            etSmtpPort.setText(String.valueOf(snapshot.child("smtp_config/port").getValue(Long.class)));
                        }
                        etSmtpEmail.setText(snapshot.child("smtp_config/email").getValue(String.class));
                        etSmtpPassword.setText(snapshot.child("smtp_config/app_password").getValue(String.class));
                    }
                    // Load Facebook
                    if (snapshot.child("facebook_config").exists()) {
                        etFbAppId.setText(snapshot.child("facebook_config/app_id").getValue(String.class));
                        etFbClientToken.setText(snapshot.child("facebook_config/client_token").getValue(String.class));
                    }
                }
            }

            @Override
            public void onCancelled(@NonNull DatabaseError error) {
                Toast.makeText(AdminConfigActivity.this, "Failed to load settings", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void saveSettings() {
        Map<String, Object> updates = new HashMap<>();

        // SIP Map
        Map<String, Object> sipConfig = new HashMap<>();
        sipConfig.put("server_ip", etSipServerIp.getText().toString().trim());
        try {
            sipConfig.put("port", Integer.parseInt(etSipPort.getText().toString().trim()));
        } catch (NumberFormatException e) {
            sipConfig.put("port", 5060); // Default
        }
        sipConfig.put("username", etSipUsername.getText().toString().trim());
        sipConfig.put("password", etSipPassword.getText().toString().trim());
        updates.put("sip_config", sipConfig);

        // SMTP Map
        Map<String, Object> smtpConfig = new HashMap<>();
        smtpConfig.put("host", etSmtpHost.getText().toString().trim());
        try {
            smtpConfig.put("port", Integer.parseInt(etSmtpPort.getText().toString().trim()));
        } catch (NumberFormatException e) {
            smtpConfig.put("port", 587); // Default
        }
        smtpConfig.put("email", etSmtpEmail.getText().toString().trim());
        smtpConfig.put("app_password", etSmtpPassword.getText().toString().trim());
        smtpConfig.put("secure", true);
        updates.put("smtp_config", smtpConfig);

        // Facebook Map
        Map<String, Object> fbConfig = new HashMap<>();
        fbConfig.put("app_id", etFbAppId.getText().toString().trim());
        fbConfig.put("client_token", etFbClientToken.getText().toString().trim());
        updates.put("facebook_config", fbConfig);

        adminConfigsRef.updateChildren(updates)
                .addOnSuccessListener(aVoid -> Toast.makeText(AdminConfigActivity.this, "Settings Saved Successfully", Toast.LENGTH_SHORT).show())
                .addOnFailureListener(e -> Toast.makeText(AdminConfigActivity.this, "Error saving settings", Toast.LENGTH_SHORT).show());
    }
}
