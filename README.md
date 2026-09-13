# AgenticEscrow

> **Autonomous AI-Powered Judicial Dispute Resolution and Trustless Escrow Protocol on GenLayer**

[![Live DApp](https://img.shields.io/badge/Live%20DApp-agenticescrow.vercel.app-10b981?style=for-the-badge&logo=vercel)](https://agenticescrow.vercel.app)
[![GenLayer Contract](https://img.shields.io/badge/GenLayer%20Contract-0x0890...8972-06b6d4?style=for-the-badge&logo=ethereum)](https://explorer-bradbury.genlayer.com/address/0x08909F12f0a008d09de35c5432b2cD67E0898972)
[![Network](https://img.shields.io/badge/GenLayer-Bradbury%20Testnet%20(4221)-8b5cf6?style=for-the-badge)](https://genlayer.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

---

## About

**AgenticEscrow** is a next-generation decentralized escrow protocol powered by GenLayer's non-deterministic Intelligent Contracts. It combines decentralized smart contract security with autonomous AI multi-validator arbitration to eliminate human intermediaries, unfair dispute resolutions, and excessive platform commissions in digital commerce, software contracting, and freelancing.

- 🌐 **Live Website / DApp**: [https://agenticescrow.vercel.app](https://agenticescrow.vercel.app)
- 📜 **Deployed Intelligent Contract**: [`0x08909F12f0a008d09de35c5432b2cD67E0898972`](https://explorer-bradbury.genlayer.com/address/0x08909F12f0a008d09de35c5432b2cD67E0898972)
- ⛓️ **Network**: GenLayer Bradbury Testnet (Chain ID: `4221` / `0x107d`)
- 🔍 **Block Explorer**: [https://explorer-bradbury.genlayer.com](https://explorer-bradbury.genlayer.com)

---

## Table of Contents
- [About](#about)
- [Problem and Motivation](#problem-and-motivation)
- [How AgenticEscrow Solves It](#how-agenticescrow-solves-it)
- [Key Features](#key-features)
- [System Architecture and Workflow](#system-architecture-and-workflow)
- [Intelligent Contract Specification](#intelligent-contract-specification)
- [Live Deployments and Network Details](#live-deployments-and-network-details)
- [Tech Stack](#tech-stack)
- [Local Development Guide](#local-development-guide)
- [License](#license)

---

## Problem and Motivation

In traditional commerce and freelance platforms (such as Upwork, Fiverr, and traditional escrow services), counterparties face three major bottlenecks:
01. **Steep Intermediary Fees**: Centralized intermediaries take between **5% to 20%** commission on transactions.
02. **Single Point of Failure and Human Bias**: Arbitrators are human, prone to fatigue, regional bias, or opaque decision-making processes.
03. **Smart Contract Inflexibility**: Standard Ethereum/EVM smart contracts cannot assess qualitative deliverables (for example: quality of software, test coverage, or compliance with specifications). Without AI consensus, smart contracts either require trusted third-party human oracles or freeze in multi-sig deadlocks.

---

## How AgenticEscrow Solves It

**AgenticEscrow** is a decentralized application built natively on **GenLayer**. By leveraging GenLayer's non-deterministic AI consensus and Intelligent Contracts (`gl.nondet.exec_prompt` combined with strict `validator_fn` equivalence checks):

- **Contract-Controlled Custody & Settlement**: The contract directly custodies locked funds upon creation (`escrow_locked_funds`) and settles funds upon manual buyer approval or AI judicial verdict (100% Release, 100% Refund, or 50/50 Split) into `claimable_balances`, with beneficiary withdrawal via `withdraw_funds()`.
- **Decentralized AI Judiciary**: Independent GenLayer validators run Large Language Models to evaluate contractual agreements against submitted deliverables and dispute claims.
- **Equivalence-Checked Consensus**: Multiple validators independently analyze the evidence and reach consensus on a verdict (RELEASE, REFUND, or SPLIT) with confidence metrics.
- **Autonomous On-Chain Execution**: Once consensus is achieved, funds and state transitions are executed automatically on-chain with zero human intermediaries.

---

## Key Features

- **Dual Escrow Modes**:
  - **Open Public Bounty**: Buyers post specifications with locked GEN rewards without needing a freelancer address upfront. Candidates apply with proposals and resumes. The buyer reviews and assigns the best candidate.
  - **Direct Private Escrow**: Buyers specify a designated contractor address upfront for bilateral agreements.
- **Direct Web3 Deposit & Contract Custody**: Buyers approve a MetaMask transaction directly locking native GEN funds under Intelligent Contract custody (`escrow_locked_funds`).
- **Real-Time On-Chain Transaction Tracking**: Visual progress bars directly inside each task card reporting validator status (`COMMITTING`, `REVEALING`, `ACCEPTED`) with live block explorer links.
- **Contract-Controlled Financial Custody & Settlement**: Complete on-chain fund lifecycle management (`escrow_locked_funds`, `claimable_balances`, `withdraw_funds`, `reopen_task`).
- **Instant Native GEN Payout**: Settled escrows automatically deliver native GEN payouts directly to the contractor wallet upon approval or judicial verdict.
- **Role-Based Status Badging**: Displays `Delivered` for the designated freelancer and `Completed` for the client and public observers.
- **End-to-End Escrow Lifecycle**: Create agreements, lock native GEN funds, review applicants, assign contractors, submit deliverables, release payment, or trigger arbitration.
- **Natural Language Contract Specifications**: Parties can define deliverables in plain English or code specifications.
- **Automated Evidence Assessment**: Evaluates URLs, commit hashes, documents, and technical requirements.
- **Three-Way Judicial Verdicts & Settlement**:
  - `RELEASE`: Contractor successfully delivered according to specifications (100% custody settled to contractor).
  - `REFUND`: Contractor failed to deliver or submitted fraudulent proof (100% custody refunded to buyer).
  - `SPLIT`: Partial delivery with shared responsibility (50/50 balanced custody split).
- **Consensus Confidence Scoring**: Every judgment records a validator confidence score (0-100%) and a judicial reasoning summary on-chain.

---

## System Architecture and Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Buyer as Buyer
    participant Contract as AgenticEscrow Contract
    actor Freelancer as Freelancers / Candidates
    participant Validators as GenLayer AI Validators

    alt Mode 1: Open Public Bounty
        Buyer->>Contract: create_escrow(address(0), title, specs, amount)
        Note over Contract: State: OPEN_FOR_APPLICANTS (5), locked_funds = amount
        Freelancer->>Contract: apply_for_task(escrow_id, proposal)
        Buyer->>Contract: assign_contractor(escrow_id, selected_freelancer)
        Note over Contract: State: PENDING_SUBMISSION (0)
    else Mode 2: Direct Escrow
        Buyer->>Contract: create_escrow(contractor, title, specs, amount)
        Note over Contract: State: PENDING_SUBMISSION (0), locked_funds = amount
    end
    
    Freelancer->>Contract: submit_work(escrow_id, delivery_details)
    Note over Contract: State: SUBMITTED (1)

    alt Standard Approval (No Dispute)
        Buyer->>Contract: approve_and_release(escrow_id)
        Note over Contract: State: RELEASED (2), 100% locked_funds -> contractor claimable_balance
    else Dispute Raised
        Buyer->>Contract: resolve_dispute_with_ai(escrow_id, buyer_complaint)
        Contract->>Validators: gl.nondet.exec_prompt(judicial_prompt)
        Validators->>Validators: validator_fn() equivalence check
        Validators-->>Contract: Consensus Verdict (RELEASE / REFUND / SPLIT)
        Note over Contract: State: RESOLVED (2, 3, or 4), locked_funds settled to claimable_balances
    end

    Freelancer->>Contract: withdraw_funds()
    Note over Contract: Transfers settled balance to caller
```

---

## Intelligent Contract Specification

The contract is written in Python for the **GenVM v0.3.3** runtime:

### Contract Methods

| Method | Type | Parameters | Description |
| :--- | :--- | :--- | :--- |
| `create_escrow` | `write.payable` | seller: Address, title: str, specifications: str, amount: u256 | Atomically binds native attached GEN deposit to escrow creation and locks custody. |
| `apply_for_task` | `write` | escrow_id: u64, proposal: str | Candidates apply for open bounties with proposals and portfolio details. |
| `assign_contractor` | `write` | escrow_id: u64, selected_contractor: Address | Buyer reviews candidate proposals and assigns chosen contractor. |
| `submit_work` | `write` | escrow_id: u64, delivery_details: str | Assigned contractor submits deliverable proof or work links. |
| `approve_and_release` | `write` | escrow_id: u64 | Buyer manually approves; contract settles 100% custody funds to seller claimable balance. |
| `resolve_dispute_with_ai` | `write` | escrow_id: u64, buyer_complaint: str | Multi-validator LLM judicial arbitration with fail-closed consensus and substantive verification. |
| `reopen_task` | `write` | escrow_id: u64 | Buyer reopens refunded task; enforces conservation of funds (`balance >= amount`). |
| `withdraw_funds` | `write` | beneficiary: Address | Beneficiary withdraws settled balance via native contract payout (`emit_transfer`). |
| `get_claimable_balance` | `view` | user: Address | Returns settled claimable balance for a given wallet address. |
| `get_escrow` | `view` | escrow_id: u64 | Returns full escrow state, locked custody funds, applicants, verdict, and confidence scores. |
| `get_total_escrows` | `view` | None | Returns total number of escrows created. |

---

## Live Deployments and Network Details

| Parameter | Value |
| :--- | :--- |
| **Live Web App** | [https://agenticescrow.vercel.app](https://agenticescrow.vercel.app) |
| **Intelligent Contract Address** | [`0x08909F12f0a008d09de35c5432b2cD67E0898972`](https://explorer-bradbury.genlayer.com/address/0x08909F12f0a008d09de35c5432b2cD67E0898972) |
| **Deployment Transaction** | [`0x05eea30a074644de7acd52b2a07b9d87bf0c7daeb7de95724d1398979bdd74e6`](https://explorer-bradbury.genlayer.com/tx/0x05eea30a074644de7acd52b2a07b9d87bf0c7daeb7de95724d1398979bdd74e6) |
| **Verified Native Withdrawal Tx** | [`0x8079856af9622b9bbac884308b1de13271b1136f7838a10aa3537cb5e9baf046`](https://explorer-bradbury.genlayer.com/tx/0x8079856af9622b9bbac884308b1de13271b1136f7838a10aa3537cb5e9baf046) |
| **Network Name** | GenLayer Bradbury Testnet |
| **Chain ID** | 4221 (0x107d) |
| **RPC Endpoint** | https://rpc-bradbury.genlayer.com |
| **Explorer** | [https://explorer-bradbury.genlayer.com](https://explorer-bradbury.genlayer.com) |
| **GitHub Repository** | [https://github.com/sinascorpion/genlayer-agentic-escrow](https://github.com/sinascorpion/genlayer-agentic-escrow) |

---

## Tech Stack

- Smart Contracts: Python (genlayer-py, GenVM v0.3.3)
- Frontend Framework: Next.js 16 (App Router), React 19, TypeScript
- Styling: Tailwind CSS and Modern GenLayer Dark Theme
- Icons: Lucide React
- Blockchain Connectivity: viem, genlayer-js
- Hosting and CI/CD: Vercel

## Security Architecture & Relayer Key Rotation

In compliance with GenLayer trustless smart contract guidelines:
- **Zero Server-Relayed Authority**: All write transactions (`create_escrow`, `apply_for_task`, `assign_contractor`, `submit_work`, `approve_and_release`, `resolve_dispute_with_ai`, `reopen_task`, and `withdraw_funds`) are cryptographically signed directly by the user's browser wallet (MetaMask) using `genlayer-js`. The frontend performs zero server-side state mutation.
- **Relayer Key Rotation & Complete Revocation**: All prior server fallback private keys have been permanently revoked and scrubbed from code, repositories, and environment variables. The smart contract contains zero owner/admin bypasses (`sender == self.owner` removed from agreement methods), guaranteeing trustless peer-to-peer execution.
- **Fail-Closed AI Arbitration**: The dispute resolution validator function (`validator_fn`) independently executes the LLM prompt and asserts strict decision equivalence (`lead_decision == val_decision`). Any validator disagreement or runtime exception immediately fails closed (`return False`), eliminating format-only validation risks.
- **Strict Conservation of Funds**: Native value must equal or exceed deposit amounts upon creation (`gl.message.value >= amount`), and `reopen_task` verifies unwithdrawn buyer claimable balance (`cur_buyer_bal >= amount`).

- **Documented EVM-Interface Native Payout**: In accordance with GenLayer value transfer specifications, transferring native GEN to an Externally Owned Account (EOA) utilizes the documented EVM contract interface external call form (`_Recipient(beneficiary).emit_transfer(value=balance)`), verified and confirmed on-chain in transaction `0x8079856af9622b9bbac884308b1de13271b1136f7838a10aa3537cb5e9baf046`.

---

## Clean Checkout Reproduction & Testing Guide

The repository is structured for clean, one-command reproducibility from any fresh checkout.

### Quick Start (Clean Checkout)

```bash
# 1. Clone repository
git clone https://github.com/sinascorpion/genlayer-agentic-escrow.git
cd genlayer-agentic-escrow

# 2. Install all dependencies (root & frontend workspaces automatically installed via npm install)
npm install

# 3. Setup environment configuration (optional - fallback accounts included for test suite)
cp .env.example .env

# 4. Run full security & regression test suite (8/8 tests pass on-chain)
npm test

# 5. Build frontend application
npm run build
```

### Verified Test Cases (8/8 Passed On-Chain):
1. `Conservation Failure: Zero Value Deposit`: Reverts with error upon 0 attached value.
2. `Conservation Failure: Underfunded Creation`: Reverts on-chain when attached value < escrow amount.
3. `Authorization Failure: Contractor Assignment`: Non-buyers blocked by `sender == buyer` assertion.
4. `Authorization Failure: Cross-Account Withdrawal`: Callers strictly prevented from draining third-party funds.
5. `Conservation Failure: Task Reopening`: Reopening with zero/depleted claimable balance strictly blocked.
6. `Authorization Failure: Work Submission`: Non-assigned sellers strictly blocked from submitting deliverables.
7. `Key Rotation & Role De-authorization`: Verified zero administrative backdoors or relayer roles in contract.
8. `Validator Fail-Closed Verification`: Substantive decision equivalence strictly verified on independent LLM execution.

---

## Local Development Guide

### Prerequisites
- Node.js 18+ or 20+
- Python 3.10+ (for contracts and deployment scripts)

### Running Local Development Server

```bash
cd frontend
npm run dev -- -p 2052
```

Navigate to http://localhost:2052 in your browser.

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.
