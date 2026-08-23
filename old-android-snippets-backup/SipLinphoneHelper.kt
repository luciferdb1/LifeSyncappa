package com.example.blooddonation.helper

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.google.firebase.firestore.FirebaseFirestore
import org.linphone.core.*

/**
 * Android Helper Class for SIP Calling via Linphone SDK and Firebase Firestore.
 * 
 * Prerequisites:
 * 1. Add Linphone SDK to your app's build.gradle:
 *    implementation "org.linphone:linphone-sdk-android:5.2.+"
 * 2. Add Firebase Firestore to your app's build.gradle.
 * 3. Ensure you have INTERNET, RECORD_AUDIO, and USE_SIP permissions in AndroidManifest.xml.
 * 4. Add this interface to your WebView:
 *    webView.addJavascriptInterface(SipLinphoneHelper(context, webView), "Android")
 */
class SipLinphoneHelper(private val context: Context, private val webView: WebView? = null) {

    private var core: Core? = null
    private val db = FirebaseFirestore.getInstance()
    private val mainHandler = Handler(Looper.getMainLooper())

    init {
        initLinphoneCore()
    }

    private fun initLinphoneCore() {
        try {
            val factory = Factory.instance()
            factory.setDebugMode(true, "SipLinphoneHelper")
            
            core = factory.createCore(null, null, context)
            core?.start()
            Log.d("SipLinphoneHelper", "Linphone Core initialized successfully.")
            updateWebStatus("disconnected")
        } catch (e: Exception) {
            Log.e("SipLinphoneHelper", "Error initializing Linphone Core: ${e.message}")
        }
    }

    private fun updateWebStatus(status: String) {
        mainHandler.post {
            webView?.evaluateJavascript("if(window.updateSipStatus) window.updateSipStatus('$status');", null)
        }
    }

    /**
     * Fetches SIP configuration from Firestore and registers the user.
     * The admin sets this configuration in the Web Admin Panel.
     */
    fun fetchConfigAndRegister() {
        updateWebStatus("connecting")
        db.collection("settings").document("sipConfig")
            .get()
            .addOnSuccessListener { document ->
                if (document != null && document.exists()) {
                    val domain = document.getString("domain") ?: ""
                    val proxy = document.getString("proxy") ?: ""
                    val port = document.getString("port") ?: "5060"
                    val username = document.getString("username") ?: ""
                    val password = document.getString("password") ?: ""

                    if (domain.isNotEmpty() && username.isNotEmpty() && password.isNotEmpty()) {
                        registerSipAccount(username, password, domain, proxy, port)
                    } else {
                        Log.e("SipLinphoneHelper", "Incomplete SIP configuration found in Firestore.")
                        updateWebStatus("disconnected")
                    }
                } else {
                    Log.e("SipLinphoneHelper", "No SIP configuration found in Firestore.")
                    updateWebStatus("disconnected")
                }
            }
            .addOnFailureListener { exception ->
                Log.e("SipLinphoneHelper", "Error fetching SIP config: ", exception)
                updateWebStatus("disconnected")
            }
    }

    private fun registerSipAccount(username: String, password: String, domain: String, proxy: String, port: String) {
        val core = this.core ?: return

        try {
            val factory = Factory.instance()
            
            // Create Auth Info
            val authInfo = factory.createAuthInfo(username, null, password, null, null, domain)
            core.addAuthInfo(authInfo)

            // Create Account Params
            val accountParams = core.createAccountParams()
            
            // Set Identity
            val identityAddress = factory.createAddress("sip:$username@$domain")
            accountParams.identityAddress = identityAddress

            // Set Proxy/Server address
            val serverAddress = if (proxy.isNotEmpty()) {
                "sip:$proxy:$port;transport=udp"
            } else {
                "sip:$domain:$port;transport=udp"
            }
            accountParams.serverAddress = factory.createAddress(serverAddress)
            accountParams.registerEnabled = true

            // Create and add account
            val account = core.createAccount(accountParams)
            core.addAccount(account)
            core.defaultAccount = account

            Log.d("SipLinphoneHelper", "SIP Account configuration added. Registration in progress...")
            
            // Add listener to monitor registration state
            core.addListener(object : CoreListenerStub() {
                override fun onAccountRegistrationStateChanged(
                    core: Core,
                    account: Account,
                    state: RegistrationState,
                    message: String
                ) {
                    Log.d("SipLinphoneHelper", "Registration state: $state - $message")
                    if (state == RegistrationState.Ok) {
                        Log.d("SipLinphoneHelper", "Successfully registered to SIP server!")
                        updateWebStatus("connected")
                    } else if (state == RegistrationState.Failed || state == RegistrationState.Cleared) {
                        Log.e("SipLinphoneHelper", "Failed to register to SIP server.")
                        updateWebStatus("disconnected")
                    } else if (state == RegistrationState.Progress) {
                        updateWebStatus("connecting")
                    }
                }
            })

        } catch (e: Exception) {
            Log.e("SipLinphoneHelper", "Error registering SIP account: ${e.message}")
            updateWebStatus("disconnected")
        }
    }

    /**
     * Make an outgoing SIP call.
     * Exposed to WebView via JavascriptInterface.
     */
    @JavascriptInterface
    fun makeSipCall(targetNumber: String, donorName: String, callerUid: String, callerName: String) {
        val core = this.core ?: return
        val defaultAccount = core.defaultAccount

        if (defaultAccount == null) {
            Log.e("SipLinphoneHelper", "No default account configured. Cannot make call.")
            return
        }

        try {
            val domain = defaultAccount.params.identityAddress?.domain
            val addressToCall = Factory.instance().createAddress("sip:$targetNumber@$domain")
            
            if (addressToCall != null) {
                // Configure Call Params for Recording
                val callParams = core.createCallParams(null)
                val recordFile = "${context.cacheDir.absolutePath}/record_${System.currentTimeMillis()}.wav"
                callParams?.recordFile = recordFile
                
                val call = core.inviteAddressWithParams(addressToCall, callParams)
                Log.d("SipLinphoneHelper", "Calling $targetNumber...")
                
                // Start recording when connected
                core.addListener(object : CoreListenerStub() {
                    override fun onCallStateChanged(
                        core: Core,
                        call: Call,
                        state: Call.State,
                        message: String
                    ) {
                        if (state == Call.State.Connected) {
                            call.startRecording()
                            Log.d("SipLinphoneHelper", "Started recording call to $recordFile")
                        } else if (state == Call.State.End || state == Call.State.Error) {
                            call.stopRecording()
                            Log.d("SipLinphoneHelper", "Stopped recording call")
                            
                            // Upload to Firebase Storage
                            uploadRecordToFirebase(recordFile, targetNumber, donorName, callerUid, callerName, call.duration)
                        }
                    }
                })
            }
        } catch (e: Exception) {
            Log.e("SipLinphoneHelper", "Error making call: ${e.message}")
        }
    }

    private fun uploadRecordToFirebase(filePath: String, donorPhone: String, donorName: String, callerUid: String, callerName: String, duration: Int) {
        // Implementation for uploading to Firebase Storage and saving metadata to Firestore
        // 1. Upload file to Firebase Storage (e.g., "call_records/${System.currentTimeMillis()}.wav")
        // 2. Get Download URL
        // 3. Save to Firestore 'callRecords' collection
        Log.d("SipLinphoneHelper", "Uploading record to Firebase... (Implementation required in Android app)")
    }

    /**
     * Clean up resources when done.
     */
    fun destroy() {
        core?.stop()
        core = null
    }
}
