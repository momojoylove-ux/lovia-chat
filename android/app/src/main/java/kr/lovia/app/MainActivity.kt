package kr.lovia.app

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.*
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.*
import org.json.JSONObject
import org.json.JSONArray

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var iapManager: IAPManager
    private lateinit var rewardedAdManager: RewardedAdManager
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    private val appUrl = "https://lovia.pages.dev"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setupWebView()
        setupIAP()
        setupRewardedAds()
        loadApp()

        setContentView(webView)
    }

    override fun onDestroy() {
        super.onDestroy()
        iapManager.disconnect()
        scope.cancel()
    }

    // MARK: - Rewarded Ad Setup
    private fun setupRewardedAds() {
        rewardedAdManager = RewardedAdManager(this) { event, transactionId ->
            sendAdEventToJS(event, transactionId)
        }
        rewardedAdManager.initialize()
    }

    private fun sendAdEventToJS(event: String, transactionId: String?) {
        val txPart = if (transactionId != null) ", transactionId: '${transactionId.replace("'", "\\'")}'" else ""
        val js = "window.dispatchEvent(new CustomEvent('loviaAd', { detail: { event: '$event'$txPart } }));"
        webView.post {
            webView.evaluateJavascript(js, null)
        }
    }

    // MARK: - WebView Setup
    private fun setupWebView() {
        webView = WebView(this).apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                allowFileAccess = false
                mediaPlaybackRequiresUserGesture = false
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            }
            webViewClient = LoviaWebViewClient()
            webChromeClient = WebChromeClient()

            // JS bridge
            addJavascriptInterface(LoviaJSBridge(), "LoviaAndroid")
        }
    }

    private fun loadApp() {
        webView.loadUrl(appUrl)
    }

    // MARK: - IAP Setup
    private fun setupIAP() {
        iapManager = IAPManager(this) { result ->
            handlePurchaseResult(result)
        }
        iapManager.connect()
    }

    // MARK: - Handle purchase results from IAPManager
    private fun handlePurchaseResult(result: IAPManager.PurchaseResult) {
        when (result) {
            is IAPManager.PurchaseResult.Success -> {
                // Verify with server, then acknowledge
                val authToken = webView.run {
                    // Read from localStorage via JS
                    // Token is stored in LoviaJSBridge.currentAuthToken
                    LoviaJSBridge.currentAuthToken
                }
                scope.launch {
                    verifyWithServer(
                        productId = result.productId,
                        purchaseToken = result.purchaseToken,
                        orderId = result.orderId,
                        authToken = authToken
                    )
                }
            }
            is IAPManager.PurchaseResult.Cancelled -> {
                sendToJS("purchase_cancelled", mapOf("productId" to result.productId))
            }
            is IAPManager.PurchaseResult.Failed -> {
                sendToJS("purchase_failed", mapOf(
                    "productId" to result.productId,
                    "error" to result.error
                ))
            }
            is IAPManager.PurchaseResult.ProductsLoaded -> {
                val productList = JSONArray(iapManager.serializeProducts().map { p ->
                    JSONObject(p)
                })
                sendToJS("products_loaded", mapOf("products" to productList.toString()))
            }
        }
    }

    // MARK: - Server verification
    private suspend fun verifyWithServer(
        productId: String,
        purchaseToken: String,
        orderId: String,
        authToken: String?
    ) {
        try {
            val body = JSONObject().apply {
                put("productId", productId)
                put("purchaseToken", purchaseToken)
                put("orderId", orderId)
            }

            val url = java.net.URL("$appUrl/api/payments/iap/google")
            val conn = (url.openConnection() as java.net.HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                if (!authToken.isNullOrBlank()) {
                    setRequestProperty("Authorization", "Bearer $authToken")
                }
                doOutput = true
                outputStream.write(body.toString().toByteArray())
            }

            val responseCode = conn.responseCode
            val responseBody = (if (responseCode == 200) conn.inputStream else conn.errorStream)
                ?.bufferedReader()?.readText() ?: ""
            val json = JSONObject(responseBody)

            withContext(Dispatchers.Main) {
                if (responseCode == 200 && json.optBoolean("ok")) {
                    // Acknowledge the purchase
                    scope.launch(Dispatchers.IO) {
                        iapManager.acknowledgePurchase(purchaseToken)
                    }
                    sendToJS("purchase_success", mapOf(
                        "productId" to productId,
                        "credits" to json.optInt("credits"),
                        "newTotal" to json.optInt("newTotal")
                    ))
                } else {
                    sendToJS("purchase_failed", mapOf(
                        "productId" to productId,
                        "error" to json.optString("error", "서버 검증 실패")
                    ))
                }
            }
        } catch (e: Exception) {
            withContext(Dispatchers.Main) {
                sendToJS("purchase_failed", mapOf(
                    "productId" to productId,
                    "error" to (e.message ?: "네트워크 오류")
                ))
            }
        }
    }

    // MARK: - Send event to JS
    private fun sendToJS(event: String, payload: Map<String, Any>) {
        val detail = JSONObject(mapOf("event" to event) + payload)
        val js = "window.dispatchEvent(new CustomEvent('loviaIAP', { detail: $detail }));"
        webView.post {
            webView.evaluateJavascript(js, null)
        }
    }

    // MARK: - JS Bridge
    inner class LoviaJSBridge {

        companion object {
            var currentAuthToken: String? = null
        }

        @JavascriptInterface
        fun requestPurchase(productId: String, authToken: String?) {
            currentAuthToken = authToken
            runOnUiThread {
                iapManager.launchPurchase(productId)
            }
        }

        @JavascriptInterface
        fun getProducts() {
            scope.launch(Dispatchers.IO) {
                iapManager.loadProducts()
            }
        }

        @JavascriptInterface
        fun setAuthToken(token: String?) {
            currentAuthToken = token
        }

        @JavascriptInterface
        fun getPlatform(): String = "android"

        // ──── 리워드 광고 브릿지 ────────────────────────────────

        @JavascriptInterface
        fun loadRewardedAd() {
            runOnUiThread {
                rewardedAdManager.loadRewardedAd()
            }
        }

        @JavascriptInterface
        fun isAdReady(): Boolean = rewardedAdManager.isAdReady()

        // transactionId: 프론트에서 생성한 UUID (서버 S2S callback과 매칭)
        @JavascriptInterface
        fun showRewardedAd(transactionId: String) {
            runOnUiThread {
                rewardedAdManager.showRewardedAd(transactionId)
            }
        }
    }

    // MARK: - WebViewClient
    inner class LoviaWebViewClient : WebViewClient() {
        override fun onPageFinished(view: WebView?, url: String?) {
            // Inject native environment flag
            val js = """
                window.LOVIA_NATIVE_ENV = 'android';
                window.LOVIA_IAP_AVAILABLE = true;
                window.LOVIA_REWARDED_AD_AVAILABLE = true;
            """.trimIndent()
            webView.evaluateJavascript(js, null)
        }

        override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
            // Allow all navigation within the app
            return false
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
