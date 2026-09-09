const fs = require('fs');
const { createClient, createAccount } = require('genlayer-js');
const { testnetBradbury } = require('genlayer-js/chains');
const { CalldataAddress } = require('genlayer-js/types');

const lines = fs.readFileSync('../.env', 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
const acc1 = createAccount(lines[0]);
const acc2 = createAccount(lines[1]);
const client1 = createClient({ chain: testnetBradbury, account: acc1 });
const client2 = createClient({ chain: testnetBradbury, account: acc2 });
const contractAddr = '0x24eaC7acef492257bfA171FcA7c55F8A98DEA4A4';

function toCalldataAddress(hexStr) {
  const clean = hexStr.startsWith('0x') ? hexStr.slice(2) : hexStr;
  return new CalldataAddress(Buffer.from(clean, 'hex'));
}

async function waitForTx(client, txHash, action) {
  console.log(`Waiting for ${action} (${txHash})...`);
  for (let i = 0; i < 35; i++) {
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

async function testFlow() {
  console.log('--- TEST 1: Contractor applies for Task #1 ---');
  const applyTx = await client2.writeContract({
    address: contractAddr,
    functionName: 'apply_for_task',
    args: [BigInt(1), 'I have 5 years full-stack experience and can build this cleanly.'],
    value: BigInt(0)
  });
  await waitForTx(client2, applyTx, 'Apply for Task');

  console.log('--- TEST 2: Buyer assigns Contractor ---');
  const assignTx = await client1.writeContract({
    address: contractAddr,
    functionName: 'assign_contractor',
    args: [BigInt(1), toCalldataAddress(acc2.address)],
    value: BigInt(0)
  });
  await waitForTx(client1, assignTx, 'Assign Contractor');

  console.log('--- TEST 3: Contractor submits deliverables ---');
  const submitTx = await client2.writeContract({
    address: contractAddr,
    functionName: 'submit_work',
    args: [BigInt(1), 'Delivered: https://github.com/sinascorpion/genlayer-agentic-escrow with full atomic custody.'],
    value: BigInt(0)
  });
  await waitForTx(client2, submitTx, 'Submit Work');

  console.log('--- TEST 4: Buyer approves and releases funds ---');
  const approveTx = await client1.writeContract({
    address: contractAddr,
    functionName: 'approve_and_release',
    args: [BigInt(1)],
    value: BigInt(0)
  });
  await waitForTx(client1, approveTx, 'Approve and Release');

  console.log('--- TEST 5: Verify Contractor Claimable Balance ---');
  const bal = await client2.readContract({
    address: contractAddr,
    functionName: 'get_claimable_balance',
    args: [acc2.address]
  });
  console.log('Contractor claimable balance:', bal.toString());

  console.log('--- TEST 6: Contractor withdraws funds (Native payout) ---');
  const withdrawTx = await client2.writeContract({
    address: contractAddr,
    functionName: 'withdraw_funds',
    args: [toCalldataAddress(acc2.address)],
    value: BigInt(0)
  });
  await waitForTx(client2, withdrawTx, 'Withdraw Funds');

  const balAfter = await client2.readContract({
    address: contractAddr,
    functionName: 'get_claimable_balance',
    args: [acc2.address]
  });
  console.log('Contractor claimable balance after withdrawal:', balAfter.toString());
  console.log('=== ALL TESTS COMPLETED SUCCESSFULLY ===');
}

testFlow().catch(e => {
  console.error('FLOW FAILED:', e);
  process.exit(1);
});
