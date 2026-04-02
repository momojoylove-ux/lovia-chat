import StoreKit
import Foundation

// MARK: - IAP Product IDs
// These must match the product identifiers registered in App Store Connect
enum IAPProduct: String, CaseIterable {
    case credits1200  = "kr.lovia.credits.1200"
    case credits5500  = "kr.lovia.credits.5500"
    case credits11000 = "kr.lovia.credits.11000"
    case credits33000 = "kr.lovia.credits.33000"
    case credits55000 = "kr.lovia.credits.55000"

    var credits: Int {
        switch self {
        case .credits1200:  return 200
        case .credits5500:  return 550
        case .credits11000: return 1200
        case .credits33000: return 3500
        case .credits55000: return 6500
        }
    }

    var bonusCredits: Int {
        switch self {
        case .credits1200:  return 0
        case .credits5500:  return 50
        case .credits11000: return 200
        case .credits33000: return 500
        case .credits55000: return 1500
        }
    }
}

// MARK: - IAPManager using StoreKit 2
@MainActor
final class IAPManager: ObservableObject {
    static let shared = IAPManager()

    @Published var products: [Product] = []
    @Published var purchasedTransactions: [Transaction] = []

    private var updateListenerTask: Task<Void, Error>?

    private init() {
        updateListenerTask = listenForTransactions()
    }

    deinit {
        updateListenerTask?.cancel()
    }

    // MARK: - Load Products
    func loadProducts() async {
        do {
            let productIds = IAPProduct.allCases.map { $0.rawValue }
            let storeProducts = try await Product.products(for: productIds)
            // Sort by price
            products = storeProducts.sorted { $0.price < $1.price }
        } catch {
            print("[IAPManager] Failed to load products: \(error)")
        }
    }

    // MARK: - Purchase
    func purchase(_ product: Product) async throws -> Transaction? {
        let result = try await product.purchase()

        switch result {
        case .success(let verification):
            let transaction = try checkVerified(verification)
            await transaction.finish()
            return transaction

        case .userCancelled:
            throw IAPError.userCancelled

        case .pending:
            throw IAPError.pending

        @unknown default:
            throw IAPError.unknown
        }
    }

    // MARK: - Restore Purchases
    func restorePurchases() async throws {
        try await AppStore.sync()
    }

    // MARK: - Transaction Listener
    private func listenForTransactions() -> Task<Void, Error> {
        return Task.detached {
            for await result in Transaction.updates {
                do {
                    let transaction = try await self.checkVerified(result)
                    await transaction.finish()
                } catch {
                    print("[IAPManager] Transaction verification failed: \(error)")
                }
            }
        }
    }

    // MARK: - Verification
    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified:
            throw IAPError.failedVerification
        case .verified(let payload):
            return payload
        }
    }

    // MARK: - Serialize Transaction for JS bridge
    func serializeTransaction(_ transaction: Transaction) -> [String: Any] {
        return [
            "transactionId": transaction.id,
            "productId": transaction.productID,
            "purchaseDate": ISO8601DateFormatter().string(from: transaction.purchaseDate),
            "environment": transaction.environment == .production ? "production" : "sandbox",
        ]
    }
}

// MARK: - Errors
enum IAPError: LocalizedError {
    case userCancelled
    case pending
    case failedVerification
    case unknown

    var errorDescription: String? {
        switch self {
        case .userCancelled:   return "구매가 취소되었습니다."
        case .pending:         return "결제 대기 중입니다."
        case .failedVerification: return "영수증 검증에 실패했습니다."
        case .unknown:         return "알 수 없는 오류가 발생했습니다."
        }
    }
}
