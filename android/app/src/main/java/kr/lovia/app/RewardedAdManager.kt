package kr.lovia.app

import android.app.Activity
import android.util.Log
import com.applovin.mediation.MaxAd
import com.applovin.mediation.MaxError
import com.applovin.mediation.MaxReward
import com.applovin.mediation.ads.MaxRewardedAd
import com.applovin.mediation.MaxRewardedAdListener
import com.applovin.sdk.AppLovinSdk

// 테스트용 Ad Unit ID. 배포 전 AppLovin 대시보드에서 발급받은 실제 ID로 교체
private const val AD_UNIT_ID = "YOUR_REWARDED_AD_UNIT_ID"
private const val TAG = "RewardedAdManager"

class RewardedAdManager(
    private val activity: Activity,
    private val onEvent: (event: String, transactionId: String?) -> Unit
) : MaxRewardedAdListener {

    private var rewardedAd: MaxRewardedAd? = null
    private var pendingTransactionId: String? = null
    private var rewardGranted = false

    // AppLovin SDK 초기화 + 광고 프리로드
    fun initialize() {
        AppLovinSdk.getInstance(activity).apply {
            settings.setVerboseLogging(false)
        }
        AppLovinSdk.initializeSdk(activity) {
            Log.d(TAG, "AppLovin SDK 초기화 완료")
            createAd()
        }
    }

    private fun createAd() {
        rewardedAd = MaxRewardedAd.getInstance(AD_UNIT_ID, activity).apply {
            setListener(this@RewardedAdManager)
            loadAd()
        }
    }

    // JS 브릿지에서 호출 — 광고 로드 시작
    fun loadRewardedAd() {
        rewardedAd?.loadAd() ?: run {
            createAd()
        }
    }

    // JS 브릿지에서 호출 — 준비 여부 확인
    fun isAdReady(): Boolean = rewardedAd?.isReady == true

    // JS 브릿지에서 호출 — 광고 표시
    // transactionId: 프론트에서 생성한 UUID (중복 방지용)
    fun showRewardedAd(transactionId: String) {
        if (rewardedAd?.isReady == true) {
            pendingTransactionId = transactionId
            rewardGranted = false
            rewardedAd!!.showAd(activity)
        } else {
            onEvent("ad_not_ready", transactionId)
            loadRewardedAd()
        }
    }

    // ──── MaxRewardedAdListener 콜백 ────────────────────────────

    override fun onAdLoaded(ad: MaxAd) {
        Log.d(TAG, "광고 로드 완료")
        onEvent("ad_loaded", null)
    }

    override fun onAdLoadFailed(adUnitId: String, error: MaxError) {
        Log.w(TAG, "광고 로드 실패: ${error.message}")
        onEvent("ad_load_failed", null)
        // 3초 후 자동 재시도
        activity.window.decorView.postDelayed({ loadRewardedAd() }, 3_000)
    }

    override fun onAdDisplayFailed(ad: MaxAd, error: MaxError) {
        Log.w(TAG, "광고 표시 실패: ${error.message}")
        onEvent("ad_display_failed", pendingTransactionId)
        loadRewardedAd()
    }

    override fun onUserRewarded(ad: MaxAd, reward: MaxReward) {
        // 리워드 지급 — 완전 시청 완료
        rewardGranted = true
        Log.d(TAG, "리워드 지급: ${reward.amount} ${reward.label}")
        onEvent("ad_reward_granted", pendingTransactionId)
    }

    override fun onAdHidden(ad: MaxAd) {
        // 광고 닫힘 — 리워드가 없으면 미완료 시청
        if (!rewardGranted) {
            onEvent("ad_dismissed_incomplete", pendingTransactionId)
        }
        pendingTransactionId = null
        rewardGranted = false
        // 다음 시청을 위해 즉시 프리로드
        loadRewardedAd()
    }

    override fun onAdDisplayed(ad: MaxAd) {}
    override fun onAdClicked(ad: MaxAd) {}
}
