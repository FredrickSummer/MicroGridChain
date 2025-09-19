;; BillingContract.clar

(define-trait production-tracker-trait
  (
    (get-production (principal uint) (response uint uint))
    (get-production-history (principal uint uint) (response (list 100 uint) uint))
  )
)

(define-trait consumption-tracker-trait
  (
    (get-consumption (principal uint) (response uint uint))
    (get-consumption-history (principal uint uint) (response (list 100 uint) uint))
  )
)

(define-trait energy-token-trait
  (
    (transfer (principal principal uint) (response bool uint))
    (get-balance (principal) (response uint uint))
    (mint (principal uint) (response bool uint))
    (burn (principal uint) (response bool uint))
  )
)

(define-trait user-registry-trait
  (
    (get-user-role (principal) (response (string-ascii 32) uint))
    (is-registered (principal) (response bool uint))
  )
)

(define-trait governance-trait
  (
    (get-rate () (response uint uint))
    (propose-rate-change (uint) (response bool uint))
    (vote-on-proposal (uint bool) (response bool uint))
  )
)

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-USER u101)
(define-constant ERR-INVALID-PERIOD u102)
(define-constant ERR-INVALID-AMOUNT u103)
(define-constant ERR-INVALID-RATE u104)
(define-constant ERR-BILL-ALREADY-GENERATED u105)
(define-constant ERR-BILL-NOT-FOUND u106)
(define-constant ERR-INSUFFICIENT-BALANCE u107)
(define-constant ERR-DISPUTE-ALREADY-SETTLED u108)
(define-constant ERR-INVALID-DISPUTE u109)
(define-constant ERR-GOVERNANCE-NOT-SET u110)
(define-constant ERR-TOKEN-NOT-SET u111)
(define-constant ERR-TRACKER-NOT-SET u112)
(define-constant ERR-INVALID-ROLE u113)
(define-constant ERR-PAYMENT-FAILED u114)
(define-constant ERR-MINT-FAILED u115)
(define-constant ERR-BURN-FAILED u116)
(define-constant ERR-HISTORY-NOT-FOUND u117)
(define-constant ERR-INVALID-TIMESTAMP u118)
(define-constant ERR-RATE-CHANGE-PENDING u119)
(define-constant ERR-VOTE-ALREADY-CAST u120)
(define-constant ERR-PROPOSAL-NOT-FOUND u121)
(define-constant ERR-INVALID-PROPOSAL u122)
(define-constant ERR-OVERFLOW u123)
(define-constant ERR-UNDERFLOW u124)
(define-constant ERR-DIVISION-BY-ZERO u125)

(define-data-var admin principal tx-sender)
(define-data-var billing-rate uint u10)
(define-data-var period-duration uint u144)
(define-data-var grace-period uint u10)
(define-data-var penalty-rate uint u5)
(define-data-var production-tracker-contract principal 'SP000000000000000000002Q6VF78)
(define-data-var consumption-tracker-contract principal 'SP000000000000000000002Q6VF78)
(define-data-var energy-token-contract principal 'SP000000000000000000002Q6VF78)
(define-data-var user-registry-contract principal 'SP000000000000000000002Q6VF78)
(define-data-var governance-contract principal 'SP000000000000000000002Q6VF78)

(define-map bills
  { user: principal, period: uint }
  { amount: uint, paid: bool, disputed: bool, timestamp: uint }
)

(define-map disputes
  { user: principal, period: uint }
  { reason: (string-utf8 256), evidence: (buff 1024), resolved: bool, resolution: (optional bool) }
)

(define-map payments
  { user: principal, period: uint }
  { amount: uint, timestamp: uint, method: (string-ascii 32) }
)

(define-map proposals
  uint
  { new-rate: uint, votes-for: uint, votes-against: uint, end-time: uint, proposer: principal }
)

(define-data-var next-proposal-id uint u0)

(define-read-only (get-bill (user principal) (period uint))
  (map-get? bills { user: user, period: period })
)

(define-read-only (get-dispute (user principal) (period uint))
  (map-get? disputes { user: user, period: period })
)

(define-read-only (get-payment (user principal) (period uint))
  (map-get? payments { user: user, period: period })
)

(define-read-only (get-proposal (id uint))
  (map-get? proposals id)
)

(define-read-only (get-current-rate)
  (ok (var-get billing-rate))
)

(define-read-only (calculate-net-energy (user principal) (period uint))
  (let
    (
      (prod (unwrap! (contract-call? .production-tracker-trait get-production user period) (err ERR-TRACKER-NOT-SET)))
      (cons (unwrap! (contract-call? .consumption-tracker-trait get-consumption user period) (err ERR-TRACKER-NOT-SET)))
    )
    (if (>= prod cons)
      (ok { surplus: (- prod cons), deficit: u0 })
      (ok { surplus: u0, deficit: (- cons prod) })
    )
  )
)

(define-private (validate-user (user principal))
  (let ((role (unwrap! (contract-call? .user-registry-trait get-user-role user) (err ERR-INVALID-USER))))
    (if (or (is-eq role "producer") (is-eq role "consumer"))
      (ok true)
      (err ERR-INVALID-ROLE)
    )
  )
)

(define-private (validate-period (period uint))
  (if (> period u0)
    (ok true)
    (err ERR-INVALID-PERIOD)
  )
)

(define-private (validate-amount (amount uint))
  (if (> amount u0)
    (ok true)
    (err ERR-INVALID-AMOUNT)
  )
)

(define-private (validate-rate (rate uint))
  (if (and (> rate u0) (<= rate u100))
    (ok true)
    (err ERR-INVALID-RATE)
  )
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
    (ok true)
    (err ERR-INVALID-TIMESTAMP)
  )
)

(define-public (set-production-tracker (contract principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err ERR-NOT-AUTHORIZED))
    (var-set production-tracker-contract contract)
    (ok true)
  )
)

(define-public (set-consumption-tracker (contract principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err ERR-NOT-AUTHORIZED))
    (var-set consumption-tracker-contract contract)
    (ok true)
  )
)

(define-public (set-energy-token (contract principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err ERR-NOT-AUTHORIZED))
    (var-set energy-token-contract contract)
    (ok true)
  )
)

(define-public (set-user-registry (contract principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err ERR-NOT-AUTHORIZED))
    (var-set user-registry-contract contract)
    (ok true)
  )
)

(define-public (set-governance (contract principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err ERR-NOT-AUTHORIZED))
    (var-set governance-contract contract)
    (ok true)
  )
)

(define-public (set-billing-rate (new-rate uint))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err ERR-NOT-AUTHORIZED))
    (try! (validate-rate new-rate))
    (var-set billing-rate new-rate)
    (ok true)
  )
)

(define-public (generate-bill (user principal) (period uint))
  (let
    (
      (net (unwrap! (calculate-net-energy user period) (err ERR-TRACKER-NOT-SET)))
      (deficit (get deficit net))
      (rate (var-get billing-rate))
      (amount (/ (* deficit rate) u100))
    )
    (try! (validate-user user))
    (try! (validate-period period))
    (asserts! (is-none (map-get? bills { user: user, period: period })) (err ERR-BILL-ALREADY-GENERATED))
    (if (> deficit u0)
      (begin
        (map-set bills { user: user, period: period }
          { amount: amount, paid: false, disputed: false, timestamp: block-height }
        )
        (print { event: "bill-generated", user: user, period: period, amount: amount })
        (ok amount)
      )
      (begin
        (try! (contract-call? .energy-token-trait mint user (get surplus net)))
        (ok u0)
      )
    )
  )
)

(define-public (pay-bill (user principal) (period uint) (use-token bool))
  (let
    (
      (bill (unwrap! (map-get? bills { user: user, period: period }) (err ERR-BILL-NOT-FOUND)))
      (amount (get amount bill))
      (admin (var-get admin))
    )
    (asserts! (is-eq tx-sender user) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (get paid bill)) (err ERR-PAYMENT-FAILED))
    (asserts! (not (get disputed bill)) (err ERR-INVALID-DISPUTE))
    (try! (validate-amount amount))
    (if use-token
      (begin
        (try! (contract-call? .energy-token-trait transfer user admin amount))
      )
      (try! (stx-transfer? amount tx-sender admin))
    )
    (map-set bills { user: user, period: period }
      (merge bill { paid: true })
    )
    (map-set payments { user: user, period: period }
      { amount: amount, timestamp: block-height, method: (if use-token "token" "stx") }
    )
    (print { event: "bill-paid", user: user, period: period, amount: amount })
    (ok true)
  )
)

(define-public (dispute-bill (user principal) (period uint) (reason (string-utf8 256)) (evidence (buff 1024)))
  (let
    (
      (bill (unwrap! (map-get? bills { user: user, period: period }) (err ERR-BILL-NOT-FOUND)))
    )
    (asserts! (is-eq tx-sender user) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (get disputed bill)) (err ERR-INVALID-DISPUTE))
    (asserts! (not (get paid bill)) (err ERR-PAYMENT-FAILED))
    (map-set bills { user: user, period: period }
      (merge bill { disputed: true })
    )
    (map-set disputes { user: user, period: period }
      { reason: reason, evidence: evidence, resolved: false, resolution: none }
    )
    (print { event: "bill-disputed", user: user, period: period })
    (ok true)
  )
)

(define-public (settle-dispute (user principal) (period uint) (accept bool))
  (let
    (
      (dispute (unwrap! (map-get? disputes { user: user, period: period }) (err ERR-INVALID-DISPUTE)))
      (bill (unwrap! (map-get? bills { user: user, period: period }) (err ERR-BILL-NOT-FOUND)))
    )
    (asserts! (is-eq tx-sender (var-get admin)) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (get resolved dispute)) (err ERR-DISPUTE-ALREADY-SETTLED))
    (map-set disputes { user: user, period: period }
      (merge dispute { resolved: true, resolution: (some accept) })
    )
    (if accept
      (map-set bills { user: user, period: period }
        (merge bill { amount: u0, disputed: false })
      )
      (map-set bills { user: user, period: period }
        (merge bill { disputed: false })
      )
    )
    (print { event: "dispute-settled", user: user, period: period, accepted: accept })
    (ok true)
  )
)

(define-public (propose-rate-change (new-rate uint))
  (let
    (
      (id (var-get next-proposal-id))
      (end-time (+ block-height u100))
    )
    (try! (validate-rate new-rate))
    (asserts! (is-eq tx-sender (var-get admin)) (err ERR-NOT-AUTHORIZED))
    (map-set proposals id
      { new-rate: new-rate, votes-for: u0, votes-against: u0, end-time: end-time, proposer: tx-sender }
    )
    (var-set next-proposal-id (+ id u1))
    (print { event: "rate-proposal", id: id, new-rate: new-rate })
    (ok id)
  )
)

(define-public (vote-on-rate (id uint) (support bool))
  (let
    (
      (proposal (unwrap! (map-get? proposals id) (err ERR-PROPOSAL-NOT-FOUND)))
    )
    (asserts! (< block-height (get end-time proposal)) (err ERR-INVALID-PROPOSAL))
    (asserts! (is-ok (contract-call? .user-registry-trait is-registered tx-sender)) (err ERR-INVALID-USER))
    (if support
      (map-set proposals id
        (merge proposal { votes-for: (+ (get votes-for proposal) u1) })
      )
      (map-set proposals id
        (merge proposal { votes-against: (+ (get votes-against proposal) u1) })
      )
    )
    (print { event: "vote-cast", id: id, support: support })
    (ok true)
  )
)

(define-public (execute-proposal (id uint))
  (let
    (
      (proposal (unwrap! (map-get? proposals id) (err ERR-PROPOSAL-NOT-FOUND)))
      (for (get votes-for proposal))
      (against (get votes-against proposal))
    )
    (asserts! (>= block-height (get end-time proposal)) (err ERR-INVALID-PROPOSAL))
    (asserts! (> for against) (err ERR-INVALID_PROPOSAL))
    (var-set billing-rate (get new-rate proposal))
    (map-delete proposals id)
    (print { event: "proposal-executed", id: id, new-rate: (get new-rate proposal) })
    (ok true)
  )
)

(define-public (get-history-summary (user principal) (start-period uint) (end-period uint))
  (let
    (
      (periods (fold range start-period end-period (list)))
    )
    (map (lambda (p) (get-bill user p)) periods)
  )
)

(define-private (range (acc (list 100 uint)) (next uint))
  (append acc next)
)