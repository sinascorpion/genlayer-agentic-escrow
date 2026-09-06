import { NextResponse } from "next/server";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { CalldataAddress } from "genlayer-js/types";

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x3328d935a44ABaE1bBdaEAaA5b9f2D323D8b468B") as `0x${string}`;
const RELAYER_KEY = (process.env.GENLAYER_RELAYER_KEY || "0x900bd9efffd809b30c2cd83b43d60e96790ad3b5aff6031d78dc148d9bb1e446") as `0x${string}`;

function addressToCalldataAddress(addr: string) {
  const clean = addr.startsWith("0x") ? addr.slice(2) : addr;
  return new CalldataAddress(Buffer.from(clean, "hex"));
}

async function executeWithRetry<T>(fn: () => Promise<T>, maxRetries = 12, baseDelayMs = 3000): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const fullMsg = `${err?.message || ""} ${err?.details || ""} ${err?.shortMessage || ""}`.toLowerCase();
      const isRateLimit =
        fullMsg.includes("rate limit") ||
        fullMsg.includes("capacity") ||
        fullMsg.includes("-32005") ||
        fullMsg.includes("limitexceeded") ||
        fullMsg.includes("exceeds defined limit") ||
        fullMsg.includes("gas rate limit") ||
        fullMsg.includes("node is at capacity");

      if (isRateLimit && i < maxRetries - 1) {
        const retryAfterMs = Number(err?.cause?.data?.retryAfterMs || err?.data?.retryAfterMs || 0);
        const waitTime = retryAfterMs > 0 ? retryAfterMs + 1000 : baseDelayMs + (i * 1500);
        console.warn(`[GenLayer RPC RateLimit] Attempt ${i + 1}/${maxRetries} failed, waiting ${waitTime}ms before retry...`);
        await new Promise((r) => setTimeout(r, waitTime));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// GET /api/escrows -> Reads all escrows and claimable balance directly from on-chain contract
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user = searchParams.get("user");
    const txHash = searchParams.get("tx");

    const readClient = createClient({ chain: testnetBradbury });

    // Quick tx status check if tx query param is passed
    if (txHash && txHash.startsWith("0x")) {
      try {
        const tx: any = await readClient.getTransaction({ hash: txHash as any });
        return NextResponse.json({
          success: true,
          tx: {
            hash: txHash,
            statusName: tx.statusName || "PENDING",
            resultName: tx.resultName,
            txExecutionResultName: tx.txExecutionResultName,
            recipient: tx.recipient
          }
        });
      } catch (err: any) {
        return NextResponse.json({
          success: true,
          tx: { hash: txHash, statusName: "PENDING", error: err.message }
        });
      }
    }

    const totalBigInt = await executeWithRetry(() =>
      readClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_total_escrows",
        args: [],
      })
    );

    const total = Number(totalBigInt);
    const escrows: any[] = [];

    for (let i = total; i >= 1; i--) {
      try {
        const item: any = await executeWithRetry(() =>
          readClient.readContract({
            address: CONTRACT_ADDRESS,
            functionName: "get_escrow",
            args: [i],
          })
        );

        let applicantsList: any[] = [];
        if (item.applicants) {
          try {
            applicantsList = typeof item.applicants === "string" ? JSON.parse(item.applicants) : item.applicants;
          } catch {
            applicantsList = [];
          }
        }

        let genDisplay = item.amount;
        try {
          const rawNum = BigInt(item.amount);
          const whole = rawNum / BigInt(1e18);
          const frac = rawNum % BigInt(1e18);
          if (frac === BigInt(0)) {
            genDisplay = `${whole.toString()} GEN`;
          } else {
            const fracStr = frac.toString().padStart(18, "0").slice(0, 4);
            genDisplay = `${whole.toString()}.${fracStr} GEN`;
          }
        } catch {
          genDisplay = `${item.amount} GEN`;
        }

        let actualBuyer = item.buyer;
        let actualSpec = item.specifications || "";
        if (actualSpec.startsWith("[Buyer:0x")) {
          const match = actualSpec.match(/^\[Buyer:(0x[a-fA-F0-9]{40})\]\s*/);
          if (match) {
            actualBuyer = match[1];
            actualSpec = actualSpec.slice(match[0].length);
          }
        }


        escrows.push({
          id: Number(item.id),
          buyer: actualBuyer,
          seller: item.seller,
          title: item.title,
          specifications: actualSpec,
          amount: genDisplay,
          rawAmount: item.amount,
          lockedFunds: item.locked_funds || "0",
          status: Number(item.status),
          delivery: item.delivery || "",
          verdict_summary: item.verdict_summary || "",
          confidence: Number(item.confidence || 0),
          applicants: applicantsList,
        });
      } catch (e) {
        console.error(`Error reading escrow #${i}:`, e);
      }
    }

    let claimableBalance = "0";
    if (user && user.startsWith("0x")) {
      try {
        const bal: any = await executeWithRetry(() =>
          readClient.readContract({
            address: CONTRACT_ADDRESS,
            functionName: "get_claimable_balance",
            args: [user],
          })
        );
        claimableBalance = String(bal);
      } catch (err) {
        console.error("Error reading claimable balance:", err);
      }
    }

    return NextResponse.json({
      success: true,
      contractAddress: CONTRACT_ADDRESS,
      total,
      escrows,
      claimableBalance,
    });
  } catch (error: any) {
    console.error("Failed to read contract:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/escrows -> Executes on-chain transactions via Bradbury relayer
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    const relayerAccount = createAccount(RELAYER_KEY);
    const client = createClient({
      chain: testnetBradbury,
      account: relayerAccount,
    });

    let txHash: string = "";

    if (action === "create_escrow") {
      const { buyer, seller, title, specifications, amountWei } = params;
      const sellerArg = addressToCalldataAddress(seller || "0x0000000000000000000000000000000000000000");
      const weiAmount = BigInt(amountWei || "1000000000000000000");

      const onChainSpecs = buyer && buyer.startsWith("0x")
        ? `[Buyer:${buyer}] ${specifications}`
        : specifications;

      txHash = await executeWithRetry(() =>
        client.writeContract({
          address: CONTRACT_ADDRESS,
          functionName: "create_escrow",
          args: [sellerArg, title, onChainSpecs, weiAmount],
          value: BigInt(0),
        })
      );
    } else if (action === "apply_for_task") {
      const { escrowId, proposal, applicant } = params;
      let onChainProposal = proposal;
      if (applicant && applicant.startsWith("0x") && !proposal.startsWith(`[Applicant:${applicant}]`)) {
        onChainProposal = `[Applicant:${applicant}] ${proposal}`;
      }
      txHash = await executeWithRetry(() =>
        client.writeContract({
          address: CONTRACT_ADDRESS,
          functionName: "apply_for_task",
          args: [BigInt(escrowId), onChainProposal],
          value: BigInt(0),
        })
      );
    } else if (action === "assign_contractor") {
      const { escrowId, contractor } = params;
      const contractorArg = addressToCalldataAddress(contractor);
      txHash = await executeWithRetry(() =>
        client.writeContract({
          address: CONTRACT_ADDRESS,
          functionName: "assign_contractor",
          args: [BigInt(escrowId), contractorArg],
          value: BigInt(0),
        })
      );
    } else if (action === "submit_work") {
      const { escrowId, deliveryProof } = params;
      txHash = await executeWithRetry(() =>
        client.writeContract({
          address: CONTRACT_ADDRESS,
          functionName: "submit_work",
          args: [BigInt(escrowId), deliveryProof],
          value: BigInt(0),
        })
      );
    } else if (action === "approve_and_release") {
      const { escrowId } = params;
      txHash = await executeWithRetry(() =>
        client.writeContract({
          address: CONTRACT_ADDRESS,
          functionName: "approve_and_release",
          args: [BigInt(escrowId)],
          value: BigInt(0),
        })
      );
    } else if (action === "resolve_dispute_with_ai") {
      const { escrowId, complaint } = params;
      txHash = await executeWithRetry(() =>
        client.writeContract({
          address: CONTRACT_ADDRESS,
          functionName: "resolve_dispute_with_ai",
          args: [BigInt(escrowId), complaint],
          value: BigInt(0),
        })
      );
    } else if (action === "reopen_task") {
      const { escrowId } = params;
      txHash = await executeWithRetry(() =>
        client.writeContract({
          address: CONTRACT_ADDRESS,
          functionName: "reopen_task",
          args: [BigInt(escrowId)],
          value: BigInt(0),
        })
      );
    } else if (action === "withdraw_funds") {
      txHash = await executeWithRetry(() =>
        client.writeContract({
          address: CONTRACT_ADDRESS,
          functionName: "withdraw_funds",
          args: [],
          value: BigInt(0),
        })
      );
    } else {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      txHash,
      message: `Transaction for '${action}' successfully broadcast to GenLayer Bradbury!`,
    });
  } catch (error: any) {
    console.error("Transaction execution error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Transaction execution failed" },
      { status: 500 }
    );
  }
}

