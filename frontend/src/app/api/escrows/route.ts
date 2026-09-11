import { NextResponse } from "next/server";
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { CalldataAddress } from "genlayer-js/types";

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x08909F12f0a008d09de35c5432b2cD67E0898972") as `0x${string}`;

function addressToCalldataAddress(addr: string) {
  const clean = addr.startsWith("0x") ? addr.slice(2) : addr;
  return new CalldataAddress(Buffer.from(clean, "hex"));
}

async function executeWithRetry<T>(fn: () => Promise<T>, maxRetries = 10, baseDelayMs = 2500): Promise<T> {
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
        await new Promise((r) => setTimeout(r, waitTime));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// GET /api/escrows -> Reads all escrows and claimable balances directly from on-chain contract
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

        escrows.push({
          id: Number(item.id),
          buyer: item.buyer,
          seller: item.seller,
          title: item.title,
          specifications: item.specifications || "",
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
        const userCalldata = addressToCalldataAddress(user);
        const bal: any = await executeWithRetry(() =>
          readClient.readContract({
            address: CONTRACT_ADDRESS,
            functionName: "get_claimable_balance",
            args: [userCalldata],
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
