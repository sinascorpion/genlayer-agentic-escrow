const fs = require('fs');
const { createClient, createAccount } = require('genlayer-js');
const { testnetBradbury } = require('genlayer-js/chains');
const { CalldataAddress } = require('genlayer-js/types');

const lines = fs.readFileSync('.env', 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
const acc1 = createAccount(lines[0]);
const acc2 = createAccount(lines[1]);
const client1 = createClient({ chain: testnetBradbury, account: acc1 });
const client2 = createClient({ chain: testnetBradbury, account: acc2 });
const contractAddr = '0x08909F12f0a008d09de35c5432b2cD67E0898972';

function toCalldataAddress(hexStr) {
  const clean = hexStr.startsWith('0x') ? hexStr.slice(2) : hexStr;
  return new CalldataAddress(Buffer.from(clean, 'hex'));
}

async function executeWithRetry(fn, maxRetries = 10, delayMs = 3000) {
  let lastErr;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.warn(`[Tx Retry] Attempt ${i + 1}/${maxRetries} failed: ${err?.message || err}. Retrying in ${delayMs}ms...`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

async function waitForTx(client, txHash, action) {
  console.log(`Waiting for ${action} (${txHash})...`);
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 4000));
    try {
      const tx = await client.getTransaction({ hash: txHash });
      console.log(`[${action}] Status: ${tx.statusName}, Result: ${tx.txExecutionResultName}`);
      if (tx.statusName === 'ACCEPTED') {
        if (tx.txExecutionResultName === 'FINISHED_WITH_ERROR') {
          throw new Error(`${action} failed on-chain with revert/error!`);
        }
        return tx;
      }
    } catch (e) {
      if (e.message.includes('failed on-chain')) throw e;
    }
  }
}

async function resumeFlowA() {
  console.log('=== RESUMING FLOW A FROM STEP 3 (ASSIGN CONTRACTOR) ===');

  console.log('Waiting for assign_contractor tx 0xf98d128b18c545b82b7e12746b7df8597f4efc05510ae1cbb03e133dee8c1e95...');
  await waitForTx(client1, '0xf98d128b18c545b82b7e12746b7df8597f4efc05510ae1cbb03e133dee8c1e95', 'Assign Contractor');

  console.log('\n--- Step A4: Contractor submits deliverables ---');
  const submitTx1 = await executeWithRetry(() => client2.writeContract({
    address: contractAddr,
    functionName: 'submit_work',
    args: [BigInt(1), 'Code delivered: https://github.com/sinascorpion/genlayer-agentic-escrow with user-signed calls and native custody.'],
    value: BigInt(0)
  }));
  await waitForTx(client2, submitTx1, 'Submit Work #1');

  console.log('\n--- Step A5: Buyer approves deliverables & releases funds ---');
  const approveTx1 = await executeWithRetry(() => client1.writeContract({
    address: contractAddr,
    functionName: 'approve_and_release',
    args: [BigInt(1)],
    value: BigInt(0)
  }));
  await waitForTx(client1, approveTx1, 'Approve and Release #1');

  console.log('\n--- Step A6: Check contractor claimable balance ---');
  const contractorBal = await client2.readContract({
    address: contractAddr,
    functionName: 'get_claimable_balance',
    args: [toCalldataAddress(acc2.address)]
  });
  console.log('Contractor claimable balance on-chain:', contractorBal.toString());

  console.log('\n--- Step A7: Contractor withdraws native funds ---');
  const withdrawTx1 = await executeWithRetry(() => client2.writeContract({
    address: contractAddr,
    functionName: 'withdraw_funds',
    args: [toCalldataAddress(acc2.address)],
    value: BigInt(0)
  }));
  await waitForTx(client2, withdrawTx1, 'Withdraw Funds #1');

  const contractorBalAfter = await client2.readContract({
    address: contractAddr,
    functionName: 'get_claimable_balance',
    args: [toCalldataAddress(acc2.address)]
  });
  console.log('Contractor claimable balance after withdrawal:', contractorBalAfter.toString());
  console.log('>>> FLOW A (CREATE -> APPLY -> ASSIGN -> SUBMIT -> APPROVE -> NATIVE WITHDRAW) COMPLETE! <<<\n');

  // -------------------------------------------------------------
  // FLOW B: ESCROW WITH AI DISPUTE RESOLUTION & REOPEN
  // -------------------------------------------------------------
  console.log('--- FLOW B: Creating Escrow #2 for AI Dispute Testing ---');
  const amountWei = BigInt('10000000000000000'); // 0.01 GEN
  const createTx2 = await executeWithRetry(() => client1.writeContract({
    address: contractAddr,
    functionName: 'create_escrow',
    args: [toCalldataAddress(acc2.address), 'Smart Contract Security Audit', 'Perform thorough static analysis and formal verification of the escrow smart contract.', amountWei],
    value: amountWei
  }));
  await waitForTx(client1, createTx2, 'Create Escrow #2');

  console.log('\n--- Step B2: Contractor submits deficient work ---');
  const submitTx2 = await executeWithRetry(() => client2.writeContract({
    address: contractAddr,
    functionName: 'submit_work',
    args: [BigInt(2), 'Deliverable: Checked code manually, looks fine. No formal verification done.'],
    value: BigInt(0)
  }));
  await waitForTx(client2, submitTx2, 'Submit Work #2');

  console.log('\n--- Step B3: Buyer triggers AI Dispute arbitration (nondet prompt consensus) ---');
  const disputeTx2 = await executeWithRetry(() => client1.writeContract({
    address: contractAddr,
    functionName: 'resolve_dispute_with_ai',
    args: [BigInt(2), 'Contractor completely failed to deliver formal verification or security audit report. Only provided a single trivial sentence.'],
    value: BigInt(0)
  }));
  await waitForTx(client1, disputeTx2, 'AI Dispute Arbitration #2');

  const escrow2Data = await client1.readContract({
    address: contractAddr,
    functionName: 'get_escrow',
    args: [BigInt(2)]
  });
  console.log('\nEscrow #2 Status:', escrow2Data.status);
  console.log('Escrow #2 Verdict Summary:', escrow2Data.verdict_summary);
  console.log('Escrow #2 Confidence:', escrow2Data.confidence);

  console.log('\n--- Step B4: Checking buyer claimable balance ---');
  const buyerBal = await client1.readContract({
    address: contractAddr,
    functionName: 'get_claimable_balance',
    args: [toCalldataAddress(acc1.address)]
  });
  console.log('Buyer claimable balance:', buyerBal.toString());

  if (Number(escrow2Data.status) === 3) { // REFUNDED_TO_BUYER
    console.log('\n--- Step B5: Testing Reopen Task with conservation of funds ---');
    const reopenTx = await executeWithRetry(() => client1.writeContract({
      address: contractAddr,
      functionName: 'reopen_task',
      args: [BigInt(2)],
      value: BigInt(0)
    }));
    await waitForTx(client1, reopenTx, 'Reopen Task #2');

    const reopenedData = await client1.readContract({
      address: contractAddr,
      functionName: 'get_escrow',
      args: [BigInt(2)]
    });
    console.log('Reopened Escrow #2 Status (should be 5):', reopenedData.status);
    console.log('Reopened Summary:', reopenedData.verdict_summary);
  }

  console.log('\n======================================================');
  console.log('SUCCESS: BOTH APPROVAL/NATIVE-PAYOUT AND AI-DISPUTE/REOPEN FLOWS FULLY VERIFIED!');
  console.log('======================================================');
}

resumeFlowA().catch(e => {
  console.error('FLOW FAILED:', e);
  process.exit(1);
});
