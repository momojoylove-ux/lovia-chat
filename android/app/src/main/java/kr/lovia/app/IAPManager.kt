package kr.lovia.app

import android.app.Activity
import android.util.Log
import com.android.billingclient.api.*
import kotlinx.coroutines.*

private const val TAG = "IAPManager"

// Product IDs — must match Google Play Console in-app products
object IAPProducts {
    const val CREDITS_1200  = "kr.lovia.credits.1200"
    const val CREDITS_5500  = "kr.lovia.credits.5500"
    const val CREDITS_11000 = "kr.lovia.credits.11000"
    const val CREDITS_33000 = "kr.lovia.credits.33000"
    const val CREDITS_55000 = "kr.lovia.credits.55000"

    val ALL = listOf(CREDITS_1200, CREDITS_5500, CREDITS_11000, CREDITS_33000, CREDITS_55000)

    fun creditsFor(productId: String): Int = when (productId) {
        CREDITS_1200  -> 200
        CREDITS_5500  -> 550
        CREDITS_11000 -> 1200
        CREDITS_33000 -> 3500
        CREDITS_55000 -> 6500
        else          -> 0
    }

    fun bonusFor(productId: String): Int = when (productId) {
        CREDITS_5500  -> 50
        CREDITS_11000 -> 200
        CREDITS_33000 -> 500
        CREDITS_55000 -> 1500
        else          -> 0
    }
}

class IAPManager(
    private val activity: Activity,
    private val onPurchaseResult: (result: PurchaseResult) -> Unit
) {
    sealed class PurchaseResult {
        data class Success(val productId: String, val purchaseToken: String, val orderId: String) : PurchaseResult()
        data class Cancelled(val productId: String) : PurchaseResult()
        data class Failed(val productId: String, val error: String) : PurchaseResult()
        data class ProductsLoaded(val products: List<ProductDetails>) : PurchaseResult()
    }

    private var billingClient: BillingClient? = null
    private var cachedProducts: List<ProductDetails> = emptyList()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    // MARK: - Setup
    fun connect() {
        billingClient = BillingClient.newBuilder(activity)
            .setListener { billingResult, purchases ->
                handlePurchaseUpdate(billingResult, purchases)
            }
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()
            )
            .build()

        billingClient?.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(billingResult: BillingResult) {
                if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                    Log.d(TAG, "Billing client connected")
                    scope.launch { loadProducts() }
                } else {
                    Log.e(TAG, "Billing setup failed: ${billingResult.debugMessage}")
                }
            }

            override fun onBillingServiceDisconnected() {
                Log.w(TAG, "Billing service disconnected — will reconnect on next purchase attempt")
            }
        })
    }

    fun disconnect() {
        billingClient?.endConnection()
        scope.cancel()
    }

    // MARK: - Load Products
    suspend fun loadProducts(): List<ProductDetails> {
        val client = billingClient ?: return emptyList()

        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(
                IAPProducts.ALL.map { id ->
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(id)
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build()
                }
            )
            .build()

        val result = withContext(Dispatchers.IO) {
            client.queryProductDetails(params)
        }

        return if (result.billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
            cachedProducts = result.productDetailsList ?: emptyList()
            onPurchaseResult(PurchaseResult.ProductsLoaded(cachedProducts))
            cachedProducts
        } else {
            Log.e(TAG, "Failed to load products: ${result.billingResult.debugMessage}")
            emptyList()
        }
    }

    // MARK: - Launch Purchase Flow
    fun launchPurchase(productId: String) {
        val client = billingClient
        if (client == null || !client.isReady) {
            onPurchaseResult(PurchaseResult.Failed(productId, "결제 서비스 연결 중입니다. 잠시 후 다시 시도해주세요."))
            // Attempt reconnect
            connect()
            return
        }

        val product = cachedProducts.firstOrNull { it.productId == productId }
        if (product == null) {
            // Try loading products first
            scope.launch {
                val products = loadProducts()
                val p = products.firstOrNull { it.productId == productId }
                if (p != null) {
                    withContext(Dispatchers.Main) { launchBillingFlow(client, p) }
                } else {
                    onPurchaseResult(PurchaseResult.Failed(productId, "상품을 찾을 수 없습니다."))
                }
            }
            return
        }

        launchBillingFlow(client, product)
    }

    private fun launchBillingFlow(client: BillingClient, product: ProductDetails) {
        val offerToken = product.subscriptionOfferDetails?.firstOrNull()?.offerToken ?: ""
        val productDetailsParamsList = listOf(
            BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(product)
                .apply { if (offerToken.isNotEmpty()) setOfferToken(offerToken) }
                .build()
        )
        val billingFlowParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(productDetailsParamsList)
            .build()

        activity.runOnUiThread {
            client.launchBillingFlow(activity, billingFlowParams)
        }
    }

    // MARK: - Handle Purchase Updates
    private fun handlePurchaseUpdate(billingResult: BillingResult, purchases: List<Purchase>?) {
        when (billingResult.responseCode) {
            BillingClient.BillingResponseCode.OK -> {
                purchases?.forEach { purchase ->
                    if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
                        val productId = purchase.products.firstOrNull() ?: return@forEach
                        onPurchaseResult(
                            PurchaseResult.Success(
                                productId = productId,
                                purchaseToken = purchase.purchaseToken,
                                orderId = purchase.orderId ?: ""
                            )
                        )
                    }
                }
            }
            BillingClient.BillingResponseCode.USER_CANCELED -> {
                val productId = purchases?.firstOrNull()?.products?.firstOrNull() ?: "unknown"
                onPurchaseResult(PurchaseResult.Cancelled(productId))
            }
            else -> {
                val productId = purchases?.firstOrNull()?.products?.firstOrNull() ?: "unknown"
                onPurchaseResult(
                    PurchaseResult.Failed(productId, billingResult.debugMessage)
                )
            }
        }
    }

    // MARK: - Consume (acknowledge) purchase after server grants credits
    suspend fun acknowledgePurchase(purchaseToken: String): Boolean {
        val client = billingClient ?: return false
        val params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchaseToken)
            .build()
        val result = withContext(Dispatchers.IO) {
            client.acknowledgePurchase(params)
        }
        return result.responseCode == BillingClient.BillingResponseCode.OK
    }

    // MARK: - Serialize for JS
    fun serializeProducts(): List<Map<String, Any>> {
        return cachedProducts.map { p ->
            val offer = p.oneTimePurchaseOfferDetails
            mapOf(
                "id" to p.productId,
                "title" to p.title,
                "description" to p.description,
                "formattedPrice" to (offer?.formattedPrice ?: ""),
                "priceAmountMicros" to (offer?.priceAmountMicros ?: 0L),
                "priceCurrencyCode" to (offer?.priceCurrencyCode ?: "KRW")
            )
        }
    }
}
