# MicroGridChain

## Overview

MicroGridChain is a Web3 project built on the Stacks blockchain using Clarity smart contracts. It enables the management of small-scale energy microgrids in remote or underserved areas, such as rural villages, islands, or off-grid communities. By leveraging blockchain technology, the platform ensures transparent, tamper-proof record-keeping for energy production, consumption, and billing. This solves real-world problems like unreliable energy access, opaque billing practices, corruption in centralized records, and lack of trust in energy transactions.

In remote locations, traditional energy grids are often infeasible due to high infrastructure costs and logistical challenges. Microgrids powered by renewables (e.g., solar, wind) can provide localized energy, but they suffer from issues like manual metering errors, disputed bills, and inefficient payments. MicroGridChain uses blockchain to automate fair billing, track energy flows in real-time (via oracles), and facilitate peer-to-peer energy trading with a native token. This promotes energy equity, reduces fraud, and empowers communities with decentralized governance.

The project involves 6 core smart contracts written in Clarity, focusing on security, clarity (pun intended), and minimalism to avoid vulnerabilities common in complex systems.

## Key Features

- **Decentralized Energy Tracking**: Producers (e.g., solar panel owners) log energy generation, and consumers log usage via integrated IoT devices or manual inputs verified by oracles.
- **Transparent Billing**: Automated calculations ensure bills are based on verifiable on-chain data, with payments in STX or a custom energy token.
- **Fair Record-Keeping**: All transactions are immutable on the Stacks blockchain, which settles on Bitcoin for added security.
- **Peer-to-Peer Trading**: Users can trade excess energy credits directly.
- **Community Governance**: Token holders vote on grid parameters, like pricing models or dispute resolutions.
- **Oracle Integration**: For real-world data feeds (e.g., meter readings) to bridge off-chain energy data to the blockchain.

## Real-World Problems Solved

- **Access in Remote Areas**: Enables microgrids without relying on centralized utilities, reducing blackouts and promoting renewable adoption.
- **Billing Transparency**: Eliminates overcharging or underpayment disputes by making all records public and auditable.
- **Fraud Prevention**: Blockchain's immutability prevents tampering with production/consumption logs, common in manual systems.
- **Financial Inclusion**: Allows unbanked users to participate via crypto payments, fostering economic activity in far-off places.
- **Sustainability**: Encourages efficient energy use through tokenized incentives, aiding climate goals in underserved regions.

## Architecture

The system integrates with IoT devices for automated data input, but supports manual submissions for low-tech setups. Oracles (e.g., via Stacks' native capabilities or external services like Chainlink on Stacks) feed real-time data. Users interact via a dApp frontend (not included in this repo; can be built with React/STX wallets).

### Smart Contracts

The project consists of 6 Clarity smart contracts, each designed to be "solid" – secure, auditable, and focused on a single responsibility. Contracts use traits for modularity and error-handling with `err` types.

1. **UserRegistry.clar**: Manages user registration and roles (producers, consumers, admins). Stores user profiles with public keys for verification.
   - Key Functions: `register-user`, `update-role`, `get-user-info`.
   - Traits: Implements a basic registry trait for extensibility.

2. **EnergyToken.clar**: A SIP-010 compliant fungible token representing energy credits (e.g., 1 token = 1 kWh).
   - Key Functions: `mint`, `transfer`, `burn`, `get-balance`.
   - Ensures tokenized energy can be traded or used for payments.

3. **ProductionTracker.clar**: Records energy production from registered producers, timestamped and verified.
   - Key Functions: `log-production`, `verify-production` (via oracle), `get-production-history`.
   - Integrates with oracles to prevent false reporting.

4. **ConsumptionTracker.clar**: Tracks energy usage by consumers, linking to billing.
   - Key Functions: `log-consumption`, `get-consumption-history`, `dispute-log`.
   - Allows disputes with on-chain evidence submission.

5. **BillingContract.clar**: Calculates bills based on production/consumption diffs, handles payments in STX or tokens.
   - Key Functions: `generate-bill`, `pay-bill`, `settle-dispute`.
   - Uses fixed pricing models (e.g., per kWh) with governance-updatable rates.

6. **Governance.clar**: Enables token-based voting for grid decisions, like rate changes or oracle approvals.
   - Key Functions: `propose-vote`, `vote`, `execute-proposal`.
   - Uses quadratic voting to ensure fairness in small communities.

Contracts interact via traits (e.g., BillingContract calls ProductionTracker). All use `post-condition` for safety and avoid reentrancy risks.

## Installation

### Prerequisites

- Stacks CLI (install via `cargo install stacks-cli`).
- A Stacks wallet (e.g., Hiro Wallet) for deployment.
- Node.js for any frontend integration (optional).

### Setup

1. Clone the repo:
   ```
   git clone `git clone <repo-url>`
   cd MicroGridChain
   ```

2. Install dependencies (if any; Clarity is lightweight).

3. Deploy contracts to Stacks testnet:
   - Update `Clarinet.toml` with your wallet details.
   - Run `clarinet deploy` for each contract in sequence (UserRegistry first).

4. Test locally:
   ```
   clarinet test
   ```

## Usage

1. **Deploy Contracts**: Use Clarinet or Stacks CLI to deploy to testnet/mainnet.
2. **Register Users**: Call `register-user` on UserRegistry with role and public key.
3. **Log Energy Data**: Producers call `log-production`; consumers call `log-consumption`.
4. **Bill and Pay**: Invoke `generate-bill` periodically (e.g., via cron-like oracle), then `pay-bill`.
5. **Govern**: Propose and vote on changes via Governance contract.
6. **Integrate Oracles**: Use Stacks' oracle patterns to feed real data (e.g., from IoT APIs).

## Development

- **Testing**: Each contract has unit tests in `/tests`. Run with `clarinet test`.
- **Security**: Contracts audited for common pitfalls (e.g., no unbounded loops, proper access controls).
- **Extensions**: Add a frontend dApp for user-friendly interactions.

## Contributing

Pull requests welcome! Focus on improving security or adding features like multi-grid support.

## License

MIT License. See LICENSE file for details.