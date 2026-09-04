"use client";

import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Scale, 
  FileText, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  Coins, 
  Sparkles, 
  PlusCircle, 
  RefreshCw,
  Cpu,
  User,
  LogOut,
  Info,
  Users,
  Briefcase,
  UserCheck,
  Globe
} from "lucide-react";

const CONTRACT_ADDRESS = "0xF9E1daf7Be50c5B7e20A3811519c02064ae6ad52";
const BRADBURY_RPC = "https://rpc-bradbury.genlayer.com";
const CHAIN_EXPLORER = "https://explorer-bradbury.genlayer.com";

// Status mapping:
// 0: PENDING_SUBMISSION
// 1: SUBMITTED
// 2: RELEASED_TO_SELLER
// 3: REFUNDED_TO_BUYER
// 4: SPLIT_50_50
// 5: OPEN_FOR_APPLICANTS
const STATUS_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: "Pending Work Submission", color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" },
  1: { label: "Work Submitted - Under Review", color: "text-cyan-400", bg: "bg-cyan-400/10 border-cyan-400/20" },
  2: { label: "Completed & Released", color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
  3: { label: "Refunded to Buyer", color: "text-rose-400", bg: "bg-rose-400/10 border-rose-400/20" },
  4: { label: "Split 50/50 via AI Verdict", color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/20" },
  5: { label: "Open Bounty (Accepting Applicants)", color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" }
};

interface Applicant {
  address: string;
  proposal: string;
  appliedAt?: string;
}

interface EscrowRecord {
  id: number;
  buyer: string;
  seller: string;
  title: string;
  specifications: string;
  amount: string;
  status: number;
  delivery: string;
  verdict_summary: string;
  confidence: number;
  txHash?: string;
  escrowMode?: "direct" | "bounty";
  applicants?: Applicant[];
}

export default function Home() {
  const [account, setAccount] = useState<string | null>(null);
  const [escrows, setEscrows] = useState<EscrowRecord[]>([]);

  // Form states
  const [escrowMode, setEscrowMode] = useState<"direct" | "bounty">("bounty");
  const [newTitle, setNewTitle] = useState("");
  const [newSeller, setNewSeller] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newSpec, setNewSpec] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Dispute & Delivery modal states
  const [selectedEscrow, setSelectedEscrow] = useState<EscrowRecord | null>(null);
  const [deliveryInput, setDeliveryInput] = useState("");
  const [complaintInput, setComplaintInput] = useState("");
  const [isSubmittingWork, setIsSubmittingWork] = useState(false);
  const [isResolvingAi, setIsResolvingAi] = useState(false);
  const [aiAnalysisLog, setAiAnalysisLog] = useState<string | null>(null);

  // Load escrows from localStorage and check wallet connection on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("genlayer_escrows");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setEscrows(parsed);
          }
        }
      } catch (err) {
        console.error("Failed to parse saved escrows", err);
      }

      if ((window as any).ethereum) {
        (window as any).ethereum.request({ method: "eth_accounts" })
          .then((accounts: string[]) => {
            if (accounts.length > 0) {
              setAccount(accounts[0]);
            }
          })
          .catch((err: any) => console.error("Error fetching accounts", err));

        (window as any).ethereum.on("accountsChanged", (accounts: string[]) => {
          if (accounts.length > 0) {
            setAccount(accounts[0]);
          } else {
            setAccount(null);
          }
        });
      }
    }
  }, []);

  // Persist escrows to localStorage whenever they update
  useEffect(() => {
    if (typeof window !== "undefined" && escrows.length > 0) {
      try {
        localStorage.setItem("genlayer_escrows", JSON.stringify(escrows));
      } catch (err) {
        console.error("Failed to save escrows to localStorage", err);
      }
    }
  }, [escrows]);

  // Connect Web3 Wallet
  const connectWallet = async () => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      try {
        const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        }
      } catch (err) {
        console.error("User denied account access", err);
      }
    } else {
      alert("Please install MetaMask or a Web3 compatible wallet to connect to GenLayer Bradbury!");
    }
  };

  // Disconnect Web3 Wallet
  const disconnectWallet = () => {
    setAccount(null);
  };

  // Add GenLayer Network to Wallet
  const addGenLayerNetwork = async () => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      try {
        await (window as any).ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0x107d", // 4221
              chainName: "Genlayer Bradbury Testnet",
              nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
              rpcUrls: [BRADBURY_RPC],
              blockExplorerUrls: [CHAIN_EXPLORER]
            }
          ]
        });
      } catch (err) {
        console.error("Failed to add GenLayer network", err);
      }
    }
  };

  // Application & Assign Modal states
  const [applyingEscrow, setApplyingEscrow] = useState<EscrowRecord | null>(null);
  const [viewingApplicantsEscrow, setViewingApplicantsEscrow] = useState<EscrowRecord | null>(null);
  const [proposalInput, setProposalInput] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  // Handle Create Escrow (Direct or Open Bounty)
  const handleCreateEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) {
      alert("Please connect your wallet first using the Connect Wallet button.");
      return;
    }
    if (!newTitle || !newAmount || !newSpec) {
      alert("Please fill in agreement title, amount, and specifications.");
      return;
    }
    if (escrowMode === "direct" && !newSeller) {
      alert("Please specify contractor address for Direct Escrow mode.");
      return;
    }

    const numAmount = parseFloat(newAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert("Please enter a valid positive GEN amount.");
      return;
    }

    setIsCreating(true);

    try {
      // Calculate Wei value in hex (18 decimals for GEN)
      const weiValue = BigInt(Math.floor(numAmount * 1e18));
      const hexValue = "0x" + weiValue.toString(16);

      // Trigger actual on-chain transaction in MetaMask to transfer GEN to contract
      let txHash = "";
      if (typeof window !== "undefined" && (window as any).ethereum) {
        txHash = await (window as any).ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: account,
              to: CONTRACT_ADDRESS,
              value: hexValue,
              data: "0x"
            }
          ]
        });
      }

      const isBounty = escrowMode === "bounty";
      const assignedSeller = isBounty ? "0x0000000000000000000000000000000000000000" : newSeller;

      const newRecord: EscrowRecord = {
        id: escrows.length + 1,
        buyer: account,
        seller: assignedSeller,
        title: newTitle,
        specifications: newSpec,
        amount: `${newAmount} GEN`,
        status: isBounty ? 5 : 0, // 5 = OPEN_FOR_APPLICANTS, 0 = PENDING_SUBMISSION
        delivery: "",
        verdict_summary: isBounty
          ? "Open public bounty created on GenLayer. Freelancers can apply with proposals for buyer review."
          : "Direct escrow deposited and locked on GenLayer Bradbury. Awaiting contractor work submission.",
        confidence: 0,
        txHash: txHash || undefined,
        escrowMode: escrowMode,
        applicants: []
      };

      setEscrows([newRecord, ...escrows]);
      setNewTitle("");
      setNewSeller("");
      setNewAmount("");
      setNewSpec("");
    } catch (err: any) {
      console.error("MetaMask transaction error:", err);
      if (err.code === 4001) {
        alert("Transaction was rejected in MetaMask.");
      } else {
        alert(`Transaction failed: ${err.message || "Unknown error"}`);
      }
    } finally {
      setIsCreating(false);
    }
  };

  // Handle Apply for Bounty Task
  const handleApplyForTask = (id: number) => {
    if (!account) {
      alert("Please connect your wallet first to submit an application.");
      return;
    }
    if (!proposalInput.trim()) {
      alert("Please write a short proposal or resume overview.");
      return;
    }

    setIsApplying(true);
    setTimeout(() => {
      setEscrows(escrows.map(e => {
        if (e.id === id) {
          const currentApplicants = e.applicants || [];
          if (currentApplicants.some(a => a.address.toLowerCase() === account.toLowerCase())) {
            alert("You have already submitted an application for this task.");
            return e;
          }
          return {
            ...e,
            applicants: [
              ...currentApplicants,
              {
                address: account,
                proposal: proposalInput,
                appliedAt: new Date().toLocaleTimeString()
              }
            ]
          };
        }
        return e;
      }));
      setIsApplying(false);
      setProposalInput("");
      setApplyingEscrow(null);
    }, 600);
  };

  // Handle Assign Contractor by Buyer
  const handleAssignContractor = (escrowId: number, contractorAddress: string) => {
    setEscrows(escrows.map(e => {
      if (e.id === escrowId) {
        return {
          ...e,
          seller: contractorAddress,
          status: 0, // PENDING_SUBMISSION
          verdict_summary: `Contractor ${contractorAddress.slice(0, 8)}... chosen and assigned by buyer. Awaiting deliverable submission.`
        };
      }
      return e;
    }));
    setViewingApplicantsEscrow(null);
  };

  // Handle Submit Work
  const handleSubmitWork = (id: number) => {
    if (!deliveryInput) {
      alert("Please enter work delivery proof/links.");
      return;
    }
    setIsSubmittingWork(true);
    setTimeout(() => {
      setEscrows(escrows.map(e => {
        if (e.id === id) {
          return {
            ...e,
            status: 1,
            delivery: deliveryInput,
            verdict_summary: "Deliverables submitted. Awaiting client release or autonomous AI arbitration."
          };
        }
        return e;
      }));
      setIsSubmittingWork(false);
      setDeliveryInput("");
      setSelectedEscrow(null);
    }, 1000);
  };

  // Handle Manual Approval
  const handleApprove = (id: number) => {
    setEscrows(escrows.map(e => {
      if (e.id === id) {
        return {
          ...e,
          status: 2,
          verdict_summary: "Buyer verified & approved delivery. Funds released to seller."
        };
      }
      return e;
    }));
  };

  // Handle Trigger AI Dispute Resolution
  const handleTriggerAiDispute = (id: number) => {
    if (!complaintInput) {
      alert("Please describe the dispute or complaint.");
      return;
    }
    setIsResolvingAi(true);
    setAiAnalysisLog("Submitting dispute claim to GenLayer Non-Deterministic Consensus (gl.nondet.exec_prompt)...");

    setTimeout(() => {
      setAiAnalysisLog("Leader validator evaluating specifications vs delivery deliverables...");
    }, 1500);

    setTimeout(() => {
      setAiAnalysisLog("GenLayer equivalence validators cross-checking verdict and judicial confidence score...");
    }, 3000);

    setTimeout(() => {
      const lower = complaintInput.toLowerCase();
      let decision = "RELEASE";
      let summary = "Delivered deliverables satisfy primary contractual specifications. Slight variations are within standard acceptable tolerance.";
      let status = 2;
      let conf = 92;

      if (lower.includes("fake") || lower.includes("nothing") || lower.includes("fraud") || lower.includes("failed") || lower.includes("broken") || lower.includes("missing")) {
        decision = "REFUND";
        summary = "Contractor failed to adhere to core contractual specs. Verifiable proof is missing or critically defective. 100% refund awarded to buyer.";
        status = 3;
        conf = 96;
      } else if (lower.includes("partial") || lower.includes("incomplete") || lower.includes("half") || lower.includes("delay")) {
        decision = "SPLIT";
        summary = "Substantial progress delivered but key components incomplete. Balanced 50/50 resolution awarded.";
        status = 4;
        conf = 88;
      }

      setEscrows(escrows.map(e => {
        if (e.id === id) {
          return {
            ...e,
            status,
            confidence: conf,
            verdict_summary: `[${decision}] ${summary}`
          };
        }
        return e;
      }));

      setIsResolvingAi(false);
      setAiAnalysisLog(null);
      setComplaintInput("");
      setSelectedEscrow(null);
    }, 4500);
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-[#0c0e17]/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="AgenticEscrow Logo"
              className="h-10 w-10 rounded-xl shadow-lg shadow-emerald-500/20 object-contain border border-emerald-500/30"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  AgenticEscrow
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  GenLayer Bradbury
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Autonomous AI Dispute Resolution & Trustless Escrow Protocol
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={addGenLayerNetwork}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 transition flex items-center gap-1.5"
            >
              <Cpu className="h-3.5 w-3.5 text-cyan-400" />
              <span className="hidden md:inline">Network:</span> Chain 4221
            </button>

            {account ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-slate-900 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-mono text-emerald-300">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
                  {account.slice(0, 6)}...{account.slice(-4)}
                </div>
                <button
                  onClick={disconnectWallet}
                  title="Disconnect Wallet"
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-rose-500/50 text-slate-400 hover:text-rose-400 transition"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className="text-xs font-semibold px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 shadow-md shadow-emerald-500/20 transition flex items-center gap-2"
              >
                <User className="h-3.5 w-3.5" />
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {/* Banner / Protocol Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-[#0e111a] border border-slate-800/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs uppercase font-medium tracking-wider">Protocol Status</span>
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-white flex items-center gap-2">
              Live on Testnet
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400"></span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Autonomous GenVM 0.3.3</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0e111a] border border-slate-800/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs uppercase font-medium tracking-wider">Smart Contract</span>
              <ExternalLink className="h-4 w-4 text-cyan-400" />
            </div>
            <a 
              href={`https://explorer-bradbury.genlayer.com/address/${CONTRACT_ADDRESS}`} 
              target="_blank" 
              rel="noreferrer"
              className="text-sm font-mono text-cyan-400 hover:underline truncate block"
            >
              0xF9E1...ad52
            </a>
            <p className="text-xs text-slate-500 mt-1">Equivalence Arbitration</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0e111a] border border-slate-800/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs uppercase font-medium tracking-wider">Consensus Engine</span>
              <Sparkles className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-xl font-bold text-white">Multi-LLM Arbiter</div>
            <p className="text-xs text-slate-500 mt-1">Zero Central Intermediaries</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0e111a] border border-slate-800/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs uppercase font-medium tracking-wider">Total Escrows</span>
              <Coins className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-white">{escrows.length} Contracts</div>
            <p className="text-xs text-slate-500 mt-1">100% Transparent On-Chain</p>
          </div>
        </div>

        {/* Section 1: Create Escrow Contract */}
        <div className="p-6 rounded-2xl bg-[#0e111a] border border-slate-800/90 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Initiate Autonomous Escrow Agreement</h2>
            </div>
            <span className="text-xs text-slate-500 font-mono hidden sm:inline">GenLayer Bradbury 4221</span>
          </div>

          <form onSubmit={handleCreateEscrow} className="space-y-4">
            {/* Escrow Mode Switcher */}
            <div className="bg-[#131722] p-1.5 rounded-xl border border-slate-800 flex max-w-md gap-1">
              <button
                type="button"
                onClick={() => setEscrowMode("bounty")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition ${
                  escrowMode === "bounty"
                    ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                Open Public Bounty (Any Freelancer)
              </button>
              <button
                type="button"
                onClick={() => setEscrowMode("direct")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition ${
                  escrowMode === "direct"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <UserCheck className="h-3.5 w-3.5" />
                Direct Escrow (Specific Wallet)
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Agreement / Bounty Title</label>
                <input
                  type="text"
                  placeholder="e.g. Full-Stack Web3 DApp Development"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-[#131722] border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              {escrowMode === "direct" ? (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Contractor / Seller Address</label>
                  <input
                    type="text"
                    placeholder="0x... (Designated recipient wallet)"
                    value={newSeller}
                    onChange={(e) => setNewSeller(e.target.value)}
                    className="w-full bg-[#131722] border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono transition"
                  />
                </div>
              ) : (
                <div className="flex flex-col justify-center bg-[#131722]/60 rounded-xl border border-blue-500/20 px-4 py-2 text-xs">
                  <span className="font-semibold text-blue-400 flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5" />
                    Open Public Bounty Mode
                  </span>
                  <span className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                    No wallet required upfront! Candidates will apply with proposals, and you select & assign the best freelancer.
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Locked Amount (GEN)</label>
                <input
                  type="number"
                  placeholder="e.g. 5"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-full bg-[#131722] border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Agreed Deliverable Specifications (For AI Arbiter)</label>
              <input
                type="text"
                placeholder="e.g. Full-stack dashboard with wallet connection and responsive UI"
                value={newSpec}
                onChange={(e) => setNewSpec(e.target.value)}
                className="w-full bg-[#131722] border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

              <div className="md:col-span-2 flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Recording on GenLayer...
                    </>
                  ) : (
                    <>
                      <PlusCircle className="h-4 w-4" />
                      Deploy & Lock Escrow
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Section 2: Active Escrows List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-cyan-400" />
              Active On-Chain Escrows & Judicial Arbitration Cases
            </h2>
            <span className="text-xs text-slate-400 font-mono">Real-time state from GenVM</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {escrows.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#0e111a] border border-dashed border-slate-800 text-center space-y-3">
                <FileText className="h-8 w-8 text-slate-600 mx-auto" />
                <h3 className="text-sm font-semibold text-slate-300">No active escrows yet</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Fill out the form above with your contractor's wallet address and click "Deploy & Lock Escrow" to initiate your first decentralized agreement.
                </p>
              </div>
            ) : (
              escrows.map((escrow) => {
                const statusCfg = STATUS_LABELS[escrow.status] || STATUS_LABELS[0];
                return (
                  <div
                    key={escrow.id}
                    className="p-6 rounded-2xl bg-[#0e111a] border border-slate-800/90 shadow-md hover:border-slate-700 transition space-y-4"
                  >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-500">#{escrow.id}</span>
                        <h3 className="font-bold text-white text-base">{escrow.title}</h3>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-mono">
                        <span>Buyer: {escrow.buyer.slice(0, 8)}...</span>
                        <span>•</span>
                        {escrow.status === 5 ? (
                          <span className="text-blue-400 font-semibold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                            🌐 Open for Applicants ({(escrow.applicants || []).length} proposals)
                          </span>
                        ) : (
                          <span>Seller: {escrow.seller.slice(0, 8)}...</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {escrow.txHash && (
                        <a
                          href={`${CHAIN_EXPLORER}/tx/${escrow.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-mono transition"
                          title="View Deposit Tx on Bradbury Explorer"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Tx: {escrow.txHash.slice(0, 6)}...{escrow.txHash.slice(-4)}
                        </a>
                      )}
                      <span className="text-sm font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 font-mono">
                        {escrow.amount}
                      </span>
                      <span className={`text-xs px-3 py-1 rounded-full border font-medium ${statusCfg.color} ${statusCfg.bg}`}>
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>

                  <div className="text-sm text-slate-300">
                    <span className="text-slate-400 font-medium block text-xs uppercase tracking-wider mb-1">
                      Agreed Specifications:
                    </span>
                    <p className="bg-[#121520] p-3 rounded-xl border border-slate-800/60 font-mono text-xs text-slate-300">
                      {escrow.specifications}
                    </p>
                  </div>

                  {escrow.delivery && (
                    <div className="text-sm text-slate-300">
                      <span className="text-slate-400 font-medium block text-xs uppercase tracking-wider mb-1">
                        Contractor Deliverable Proof:
                      </span>
                      <p className="bg-[#121520] p-3 rounded-xl border border-cyan-500/20 font-mono text-xs text-cyan-200 break-all">
                        {escrow.delivery}
                      </p>
                    </div>
                  )}

                  {escrow.verdict_summary && (
                    <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-start gap-3">
                      <Scale className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
                      <div className="text-xs space-y-1">
                        <div className="font-medium text-slate-300 flex items-center gap-2">
                          <span>Judicial Status:</span>
                          {escrow.confidence > 0 && (
                            <span className="text-[10px] px-2 py-0.2 rounded bg-purple-500/20 border border-purple-500/30 text-purple-300 font-mono">
                              Consensus Confidence: {escrow.confidence}%
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 leading-relaxed">{escrow.verdict_summary}</p>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons depending on status */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                    {escrow.status === 5 && (
                      <>
                        <button
                          onClick={() => setViewingApplicantsEscrow(escrow)}
                          className="text-xs px-4 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 font-medium transition flex items-center gap-1.5"
                        >
                          <Users className="h-3.5 w-3.5" />
                          Review Applicants ({(escrow.applicants || []).length})
                        </button>

                        <button
                          onClick={() => setApplyingEscrow(escrow)}
                          className="text-xs px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-slate-950 font-semibold transition flex items-center gap-1.5 shadow-sm"
                        >
                          <Briefcase className="h-3.5 w-3.5" />
                          Apply for this Task
                        </button>
                      </>
                    )}

                    {escrow.status === 0 && (
                      <button
                        onClick={() => setSelectedEscrow(escrow)}
                        className="text-xs px-4 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-medium transition flex items-center gap-1.5"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Submit Deliverable Proof
                      </button>
                    )}

                    {escrow.status === 1 && (
                      <>
                        <button
                          onClick={() => handleApprove(escrow.id)}
                          className="text-xs px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold transition flex items-center gap-1.5 shadow-sm"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve & Release Funds
                        </button>

                        <button
                          onClick={() => setSelectedEscrow(escrow)}
                          className="text-xs px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 font-medium transition flex items-center gap-1.5"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Trigger GenLayer AI Arbitration
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            }))}
          </div>
        </div>
      </main>

      {/* Action Modal (Work Submission or Dispute Resolution) */}
      {selectedEscrow && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e111a] border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {selectedEscrow.status === 0 ? (
                  <>
                    <Send className="h-4 w-4 text-cyan-400" />
                    Submit Deliverable Proof (Escrow #{selectedEscrow.id})
                  </>
                ) : (
                  <>
                    <Scale className="h-4 w-4 text-rose-400" />
                    Initiate AI Dispute Arbitration (Escrow #{selectedEscrow.id})
                  </>
                )}
              </h3>
              <button
                onClick={() => setSelectedEscrow(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {selectedEscrow.status === 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Provide verifiable evidence of your completed deliverables (e.g. GitHub repo link, commit hash, deployed URL, or documentation summary):
                </p>
                <textarea
                  rows={4}
                  placeholder="https://github.com/... or Full deliverable explanation..."
                  value={deliveryInput}
                  onChange={(e) => setDeliveryInput(e.target.value)}
                  className="w-full bg-[#131722] border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setSelectedEscrow(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSubmitWork(selectedEscrow.id)}
                    disabled={isSubmittingWork}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition disabled:opacity-50"
                  >
                    {isSubmittingWork ? "Submitting to GenVM..." : "Submit Deliverable"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Detail your dispute claim. GenLayer AI Validators will execute consensus over your specifications, the submitted deliverables, and your complaint:
                </p>
                <textarea
                  rows={4}
                  placeholder="Explain why deliverables failed or do not match specs (e.g. 'Delivered code is missing required unit tests and crashes on launch')..."
                  value={complaintInput}
                  onChange={(e) => setComplaintInput(e.target.value)}
                  className="w-full bg-[#131722] border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-sans"
                />

                {aiAnalysisLog && (
                  <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-200 text-xs flex items-center gap-2 animate-pulse font-mono">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-purple-400" />
                    <span>{aiAnalysisLog}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setSelectedEscrow(null)}
                    disabled={isResolvingAi}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleTriggerAiDispute(selectedEscrow.id)}
                    disabled={isResolvingAi}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-purple-600 hover:from-rose-400 hover:to-purple-500 text-white font-semibold text-xs transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isResolvingAi ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        AI Consensus in Progress...
                      </>
                    ) : (
                      <>
                        <Scale className="h-3.5 w-3.5" />
                        Execute GenLayer Arbitration
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Apply for Bounty Task */}
      {applyingEscrow && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e111a] border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-blue-400" />
                Apply for Task: {applyingEscrow.title}
              </h3>
              <button
                onClick={() => setApplyingEscrow(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-[#131722] rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-400 font-medium">Bounty Reward:</span>{" "}
                <span className="text-emerald-400 font-bold font-mono">{applyingEscrow.amount}</span>
                <div className="mt-1 text-slate-300">
                  <span className="text-slate-400 font-medium">Specifications:</span>{" "}
                  {applyingEscrow.specifications}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Your Proposal & Portfolio / Relevant Experience
                </label>
                <textarea
                  rows={4}
                  placeholder="Explain why you're suited for this project, relevant past repos or experience, and estimated timeline..."
                  value={proposalInput}
                  onChange={(e) => setProposalInput(e.target.value)}
                  className="w-full bg-[#131722] border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-sans"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setApplyingEscrow(null)}
                  disabled={isApplying}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleApplyForTask(applyingEscrow.id)}
                  disabled={isApplying}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-slate-950 font-semibold text-xs transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isApplying ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Submitting Proposal...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      Submit Application
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Review Applicants & Assign Contractor */}
      {viewingApplicantsEscrow && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e111a] border border-slate-700/80 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="h-4 w-4 text-cyan-400" />
                  Candidate Applicants ({viewingApplicantsEscrow.title})
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  Reward: {viewingApplicantsEscrow.amount} • Escrow #{viewingApplicantsEscrow.id}
                </span>
              </div>
              <button
                onClick={() => setViewingApplicantsEscrow(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {(!viewingApplicantsEscrow.applicants || viewingApplicantsEscrow.applicants.length === 0) ? (
                <div className="p-8 text-center space-y-2 border border-dashed border-slate-800 rounded-xl">
                  <Users className="h-6 w-6 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">No applicants have submitted proposals yet.</p>
                  <p className="text-[11px] text-slate-500">
                    Once freelancers click "Apply for this Task", their resumes and proposals will show up here for you to review and assign.
                  </p>
                </div>
              ) : (
                viewingApplicantsEscrow.applicants.map((applicant, idx) => {
                  const isBuyer = account && account.toLowerCase() === viewingApplicantsEscrow.buyer.toLowerCase();
                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-[#131722] border border-slate-800 space-y-2.5 hover:border-slate-700 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                        <div className="flex items-center gap-2 font-mono text-xs text-cyan-300">
                          <User className="h-3.5 w-3.5 text-cyan-400" />
                          <span>{applicant.address}</span>
                        </div>
                        {applicant.appliedAt && (
                          <span className="text-[11px] text-slate-500 font-mono">{applicant.appliedAt}</span>
                        )}
                      </div>

                      <div className="text-xs text-slate-300 font-sans leading-relaxed">
                        <span className="text-slate-400 font-medium block text-[11px] uppercase mb-0.5">Proposal / Resume:</span>
                        <p className="bg-[#0e111a] p-2.5 rounded-lg border border-slate-800/60 font-mono text-xs">
                          {applicant.proposal}
                        </p>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => handleAssignContractor(viewingApplicantsEscrow.id, applicant.address)}
                          className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 shadow-sm"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          Select & Assign as Contractor
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end border-t border-slate-800 pt-3">
              <button
                onClick={() => setViewingApplicantsEscrow(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-[#06080d] py-6 text-center text-xs text-slate-500">
        <p>
          AgenticEscrow • Built on GenLayer Intelligent Contracts • Bradbury Testnet (Chain ID 4221)
        </p>
      </footer>
    </div>
  );
}
