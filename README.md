# AgenticEscrow

> **Autonomous AI-Powered Judicial Dispute Resolution and Trustless Escrow Protocol on GenLayer**

[![Live DApp](https://img.shields.io/badge/Live%20DApp-agenticescrow.vercel.app-10b981?style=for-the-badge&logo=vercel)](https://agenticescrow.vercel.app)
[![GenLayer Contract](https://img.shields.io/badge/GenLayer%20Contract-0xF9E1...ad52-06b6d4?style=for-the-badge&logo=ethereum)](https://explorer-bradbury.genlayer.com/address/0xF9E1daf7be50c5b7e20a3811519c02064ae6ad52)
[![Network](https://img.shields.io/badge/GenLayer-Bradbury%20Testnet%20(4221)-8b5cf6?style=for-the-badge)](https://genlayer.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

---

## Table of Contents
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

- Decentralized AI Judiciary: Independent GenLayer validators run Large Language Models to evaluate contractual agreements against submitted deliverables and dispute claims.
- Equivalence-Checked Consensus: Multiple validators independently analyze the evidence and reach consensus on a verdict (RELEASE, REFUND, or SPLIT) with confidence metrics.
- Autonomous On-Chain Execution: Once consensus is achieved, funds and state transitions are executed automatically on-chain with zero human intermediaries.

---

## Key Features

- End-to-End Escrow Lifecycle: Create agreements, lock native GEN funds, submit deliverables, release payment, or trigger arbitration.
- Natural Language Contract Specifications: Parties can define deliverables in plain English or code specifications.
- Automated Evidence Assessment: Evaluates URLs, commit hashes, documents, and technical requirements.
- Three-Way Judicial Verdicts:
  - `RELEASE`: Contractor successfully delivered according to specifications (100% payment to seller).
  - `REFUND`: Contractor failed to deliver or submitted fraudulent proof (100% refund to buyer).
  - `SPLIT`: Partial delivery with shared responsibility (50/50 balanced resolution).
- Consensus Confidence Scoring: Every judgment records a validator confidence score (0-100%) and a judicial reasoning summary on-chain.

---

## System Architecture and Workflow

```bmermaid
sequenceDiagram
    autonumber
    actor Buyer as Buyer
    participant Contract as AgenticEscrow Contract
    actor Seller as Seller
    participant Validators as GenLayer AI Validators

    Buyer->>Contract: create_escrow(seller, title, specifications, amount)
    Note over Contract: State: PENDING_SUBMISSION (0)
    
    Seller->>Contract: submit_work(escrow_id, delivery_details)
    Note over Contract: State: SUBMITTED (1)

    alt Standard Approval (No Dispute)
        Buyer->>Contract: approve_and_release(escrow_id)
        Note over Contract: State: RELEASED_TO_SELLER (2)
    else Dispute Raised
        Buyer->>Contract: resolve_dispute_with_ai(escrow_id, buyer_complaint)
        Contract->>Validators: gl.nondet.exec_prompt(judicial_prompt)
        Validators->>Validators: validator_fn() equivalence check
        Validators-->>Contract: Consensus Verdict (RELEASE / REFUND / SPLIT)
        Note over Contract: State: RESOLVED (2, 3, or 4) with Judicial Summary
    end
```

---

## Intelligent Contract Specification

The contract is written in Python for the **GenVM v0.3.3** runtime:

### Contract Methods

| Method | Type | Parameters | Description |
| :--- | :--- | :--- | :--- |
| `create_escrow` | `writ` | seller: Address, title: str, specifications: str, amount: u256 | Creates a new escrow agreement and locks state. |
| `submit_work` | `writ`" | escrow_id: u64, delivery_details: str | Contractor submits proof or deliverable links. |
| `approve_and_releas` | `writ` | escrow_id: u64 | Buyer manually approves and releases funds. |
| `resolve_dispute_with_ai` | `writ` | escrow_id: u64, buyer_complaint: str | Triggers multi-validator LLM arbitration and consensus. |
| `get_escrow` | `view` | escrow_id: u64 | Returns full escrow data, verdicts, and confidence scores. |
| `get_total_escrows` | `view` | None | Returns total number of escrows created. |

---

## Live Deployments and Network Details

| Parameter | Value |
| :--- | :--- |
| **Live Web App** | [https://agenticescrow.vercel.app](https://agenticescrow.vercel.app) |
| **Intelligent Contract Address** | [`0xF9E1daf7Be50c5B7e20A3811519c02064ae6ad52`](https://explorer-bradbury.genlayer.com/address/0xF9E1daf7Be50c5B7e20A3811519c02064ae6ad52) |
| **Deployment Transaction** | [`0x028dff8894e5f773db9a8108b155fc4e797f2d31f2df4cf74f48ba4825141b47`](https://explorer-bradbury.genlayer.com) |
| **Network Name** | GenLayer Bradbury Testnet |
| **Chain ID** | 4221 (0x107d) |
| **RPC Endpoint** | https://rpc-bradbury.genlayer.com |
| **Explorer** | [https://explorer-bradbury.genlayer.com/tx/0x028dff8894e5f773db9a8108b155fc4e797f2d31f2df4cf74f48ba4825141b47](https://explorer-bradbury.genlayer.com/tx/0x028dff8894e5f773db9a8108b155fc4e797f2d31f2df4cf74f48ba4825141b47) |
| **GitHub Repository** | [https://github.com/sinascorpion/genlayer-agentic-escrow](https://github.com/sinascorpion/genlayer-agentic-escrow) |

---

## Tech Stack

- Smart Contracts: Python (genlayer-py, GenVM v0.3.3)
- Frontend Framework: Next.js 16 (App Router), React 19, TypeScript
- Styling: Tailwind CSS and Modern GenLayer Dark Theme
- Icons: Lucide React
- Blockchain Connectivity: viem, genlayer-js
- Hosting and CI/CD: Vercel

---

## Local Development Guide

### Prerequisites
- Node.js 18+ or 20+
- Python 3.10+\n- GenLayer CLI (npm install -g genlayer)

### Step-by-Step Installation

```bash
# 1. Clone the repository
git clone https://github.com/sinascorpion/genlayer-agentic-escrow.git
cd genlayer-agentic-escrow
 
# 2. Enter frontend directory and install dependencies
cd frontend
npm install
 
# 3. Start local development server (Port 2052)
npm run dev -- -p 2052
```

Navigate to http://localhost:2052 in your browser.

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.
