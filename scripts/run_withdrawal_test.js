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

async function waitForTx(client, txHash, action) {
  console.log(Waiting for  ()...);
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 4000));
    try {
      const tx = await client.getTransaction({ hash: txHash });
      console.log([] Status: , Result: );
      if (tx.statusName === 'ACCEPTED') {
        if (tx.txExecutionResultName === 'FINISHED_WITH_ERROR') {
          throw new Error(${action} failed on-chain with revert/error!);
        }
        return tx;
      }
    } catch (e) {
      if (e.message.includes('failed on-chain')) throw e;
    }
  }
  throw new Error(Timeout waiting for );
}

async function run() {
  console.log('Deployer / Buyer (Wallet 1):', acc1.address);
  console.log('Contractor / Beneficiary (Wallet 2):', acc2.address);
  console.log('Contract Address:', contractAddr);

  const depositAmount = BigInt('50000000000000000'); // 0.05 GEN
  console.log('\n--- Step 1: Creating Open Escrow (Deposit 0.05 GEN) ---');
  const createTx = await client1.writeContract({
    address: contractAddr,
    functionName: 'create_open_escrow',
    args: ['Full-Stack Website Audit', 'Comprehensive audit and deliverable verification', depositAmount],
    value: depositAmount
  });
  await waitForTx(client1, createTx, 'Create Open Escrow');

  console.log('\n--- Step 2: Contractor applies for Escrow #1 ---');
  const applyTx = await client2.writeContract({
    address: contractAddr,
    functionName: 'apply_for_task',
    args: [BigInt(1), 'Ready to conduct full security & architectural audit.'],
    value: BigInt(0)
  });
  await waitForTx(client2, applyTx, 'Apply for Task');

  console.log('\n--- Step 3: Buyer assigns contractor ---');
  const assignTx = await client1.writeContract({
    address: contractAddr,
    functionName: 'assign_contractor',
    args: [BigInt(1), toCalldataAddress(acc2.address)],
    value: BigInt(0)
  });
  await waitForTx(client1, assignTx, 'Assign Contractor');

  console.log('\n--- Step 4: Contractor submits work ---');
  const submitTx = await client2.writeContract({
    address: contractAddr,
    functionName: 'submit_work',
    args: [BigInt(1), 'Audit report completed and submitted to production repo.'],
    value: BigInt(0)
  });
  await waitForTx(client2, submitTx, 'Submit Work');

  console.log('\n--- Step 5: Buyer approves and releases funds ---');
  const approveTx = await client1.writeContract({
    address: contractAddr,
    functionName: 'approve_and_release',
    args: [BigInt(1)],
    value: BigInt(0)
  });
  await waitForTx(client1, approveTx, 'Approve and Release');

  const claimable = await client2.readContract({
    address: contractAddr,
    functionName: 'get_claimable_balance',
    args: [acc2.address]
  });
  console.log('Contractor claimable balance before withdrawal:', claimable.toString());

  console.log('\n--- Step 6: Contractor calls withdraw_funds (Native Payout to EOA) ---');
  const withdrawTx = await client2.writeContract({
    address: contractAddr,
    functionName: 'withdraw_funds',
    args: [toCalldataAddress(acc2.address)],
    value: BigInt(0)
  });
  console.log('Submitted withdraw TX:', withdrawTx);
  const txReceipt = await waitForTx(client2, withdrawTx, 'Withdraw Funds');
  console.log('Withdrawal successful! TX Hash:', withdrawTx);

  const claimableAfter = await client2.readContract({
    address: contractAddr,
    functionName: 'get_claimable_balance',
    args: [acc2.address]
  });
  console.log('Contractor claimable balance after withdrawal:', claimableAfter.toString());
  console.log('\n=== ON-CHAIN LIFECYCLE & WITHDRAWAL FULLY VERIFIED ===');
}

run().catch(err => {
  console.error('Execution error:', err);
  process.exit(1);
});
