"""
Deploy AgenticEscrow Intelligent Contract to GenLayer Bradbury Testnet
Usage: python scripts/deploy.py
"""
import os
import sys
import genlayer_py
from genlayer_py.client import create_client
from genlayer_py.accounts import create_account

# ── Config ────────────────────────────────────────────────────────────────────
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
try:
    with open(env_path, "r") as f:
        PRIVATE_KEY = f.read().strip()
except FileNotFoundError:
    print("ERROR: .env file not found. Create one with your private key.")
    sys.exit(1)

CONTRACT_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "contracts", "agentic_escrow.py")

# ── Deploy ────────────────────────────────────────────────────────────────────
def main():
    print("Connecting to GenLayer Bradbury Testnet (Chain ID 4221)...")
    client = create_client(genlayer_py.testnet_bradbury)
    account = create_account(PRIVATE_KEY)

    deployer_address = account.address
    print(f"Deployer wallet: {deployer_address}")

    balance = client.get_balance(deployer_address)
    print(f"Balance: {balance / 1e18:.4f} GEN")
    if balance == 0:
        print("WARNING: Balance is 0 GEN. Get testnet GEN from faucet first.")

    print(f"\nReading contract from: {CONTRACT_FILE}")
    with open(CONTRACT_FILE, "r") as f:
        contract_code = f.read()

    print("Deploying contract (this may take ~30-60 seconds on Bradbury)...")
    constructor_args = [deployer_address]  # initial_owner

    tx_hash = client.deploy_contract(
        code=contract_code,
        account=account,
        args=constructor_args,
    )
    tx_hex = tx_hash.hex() if hasattr(tx_hash, 'hex') else str(tx_hash)
    print(f"Deploy TX hash: {tx_hex}")

    print("Waiting for transaction receipt (this may take 1-2 minutes)...")
    receipt = client.wait_for_transaction_receipt(tx_hash)
    print(f"Raw receipt: {receipt}")

    contract_address = None
    if isinstance(receipt, dict):
        contract_address = (
            receipt.get("contractAddress") or
            receipt.get("contract_address") or
            receipt.get("to")
        )

    if contract_address:
        print(f"\n{'='*60}")
        print(f"CONTRACT DEPLOYED SUCCESSFULLY!")
        print(f"Contract Address: {contract_address}")
        print(f"Explorer: https://explorer-bradbury.genlayer.com/address/{contract_address}")
        print(f"{'='*60}")
        print(f"\nNext steps:")
        print(f"1. Update CONTRACT_ADDRESS in frontend/src/app/page.tsx:")
        print(f'   const CONTRACT_ADDRESS = "{contract_address}";')
        print(f"2. Update README.md with new contract address")
        print(f"3. Rebuild and push: npm run build && git push")
    else:
        print(f"\nReceipt received. Check explorer for contract address:")
        print(f"  TX: https://explorer-bradbury.genlayer.com/tx/{tx_hex}")

if __name__ == "__main__":
    main()
