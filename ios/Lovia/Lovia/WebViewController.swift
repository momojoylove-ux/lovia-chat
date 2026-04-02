import UIKit
import WebKit
import StoreKit

// MARK: - WebViewController
// Main view controller: WKWebView with JS bridge for IAP
final class WebViewController: UIViewController {

    private var webView: WKWebView!
    private let appURL = URL(string: "https://lovia.pages.dev")!

    // MARK: - Lifecycle
    override func viewDidLoad() {
        super.viewDidLoad()
        setupWebView()
        loadApp()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        webView.frame = view.bounds
    }

    // MARK: - Setup
    private func setupWebView() {
        let config = WKWebViewConfiguration()
        let userContentController = WKUserContentController()

        // Register JS message handlers
        userContentController.add(self, name: "iap")
        userContentController.add(self, name: "iapRestore")

        // Inject native environment flag into page
        let envScript = WKUserScript(
            source: "window.LOVIA_NATIVE_ENV = 'ios'; window.LOVIA_IAP_AVAILABLE = true;",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        userContentController.addUserScript(envScript)

        config.userContentController = userContentController
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]

        view.addSubview(webView)
    }

    private func loadApp() {
        let request = URLRequest(url: appURL, cachePolicy: .useProtocolCachePolicy)
        webView.load(request)
    }

    // MARK: - Send result back to JS
    private func sendToJS(_ event: String, payload: [String: Any]) {
        var json: [String: Any] = ["event": event]
        json.merge(payload) { _, new in new }

        guard let data = try? JSONSerialization.data(withJSONObject: json),
              let str = String(data: data, encoding: .utf8) else { return }

        let js = "window.dispatchEvent(new CustomEvent('loviaIAP', { detail: \(str) }));"
        DispatchQueue.main.async {
            self.webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    // MARK: - Handle IAP purchase request from JS
    private func handlePurchase(productId: String) {
        Task { @MainActor in
            // Load products if not yet loaded
            if IAPManager.shared.products.isEmpty {
                await IAPManager.shared.loadProducts()
            }

            guard let product = IAPManager.shared.products.first(where: { $0.id == productId }) else {
                self.sendToJS("purchase_failed", payload: [
                    "productId": productId,
                    "error": "상품을 찾을 수 없습니다."
                ])
                return
            }

            do {
                if let transaction = try await IAPManager.shared.purchase(product) {
                    // Verify & grant credits via server
                    let txData = IAPManager.shared.serializeTransaction(transaction)
                    await self.verifyWithServer(productId: productId, transaction: txData)
                }
            } catch IAPError.userCancelled {
                self.sendToJS("purchase_cancelled", payload: ["productId": productId])
            } catch {
                self.sendToJS("purchase_failed", payload: [
                    "productId": productId,
                    "error": error.localizedDescription
                ])
            }
        }
    }

    // MARK: - Server-side verification & credit grant
    private func verifyWithServer(productId: String, transaction: [String: Any]) async {
        guard let token = getAuthToken() else {
            sendToJS("purchase_failed", payload: [
                "productId": productId,
                "error": "인증이 필요합니다."
            ])
            return
        }

        var body = transaction
        body["productId"] = productId

        guard let jsonData = try? JSONSerialization.data(withJSONObject: body) else { return }

        var request = URLRequest(url: URL(string: "\(appURL.absoluteString)/api/payments/iap/apple")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = jsonData

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                sendToJS("purchase_failed", payload: [
                    "productId": productId,
                    "error": "서버 응답 오류"
                ])
                return
            }

            if httpResponse.statusCode == 200, let ok = json["ok"] as? Bool, ok {
                sendToJS("purchase_success", payload: [
                    "productId": productId,
                    "credits": json["credits"] as? Int ?? 0,
                    "newTotal": json["newTotal"] as? Int ?? 0
                ])
            } else {
                let errorMsg = json["error"] as? String ?? "서버 검증 실패"
                sendToJS("purchase_failed", payload: [
                    "productId": productId,
                    "error": errorMsg
                ])
            }
        } catch {
            sendToJS("purchase_failed", payload: [
                "productId": productId,
                "error": error.localizedDescription
            ])
        }
    }

    // MARK: - Auth token from JS
    private func getAuthToken() -> String? {
        // Synchronously read from WKWebView's JS — must be called on main thread
        // We rely on the JS side injecting the token via the message payload instead
        return nil // Token is passed in the purchase message payload from JS
    }
}

// MARK: - WKScriptMessageHandler
extension WebViewController: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController,
                                didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any] else { return }

        switch message.name {
        case "iap":
            guard let action = body["action"] as? String else { return }
            switch action {
            case "purchase":
                guard let productId = body["productId"] as? String else { return }
                // Inject auth token into the manager for server verification
                if let token = body["authToken"] as? String {
                    UserDefaults.standard.set(token, forKey: "lovia_auth_token")
                }
                handlePurchase(productId: productId)

            case "getProducts":
                Task { @MainActor in
                    await IAPManager.shared.loadProducts()
                    let productList = IAPManager.shared.products.map { p -> [String: Any] in
                        return [
                            "id": p.id,
                            "displayName": p.displayName,
                            "description": p.description,
                            "displayPrice": p.displayPrice,
                            "price": (p.price as NSDecimalNumber).doubleValue
                        ]
                    }
                    self.sendToJS("products_loaded", payload: ["products": productList])
                }

            default:
                break
            }

        case "iapRestore":
            Task { @MainActor in
                do {
                    try await IAPManager.shared.restorePurchases()
                    self.sendToJS("restore_success", payload: [:])
                } catch {
                    self.sendToJS("restore_failed", payload: ["error": error.localizedDescription])
                }
            }

        default:
            break
        }
    }
}

// MARK: - WKNavigationDelegate
extension WebViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Inject persisted auth token into page if available
        if let token = UserDefaults.standard.string(forKey: "lovia_auth_token") {
            let js = "try { localStorage.setItem('lovia_auth_token', '\(token)'); } catch(e) {}"
            webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // Allow all navigation to keep PWA routing working
        decisionHandler(.allow)
    }
}

// MARK: - WKUIDelegate
extension WebViewController: WKUIDelegate {
    // Allow alert() / confirm() / prompt() from JS
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "확인", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }
}
