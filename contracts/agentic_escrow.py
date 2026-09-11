# v0.3.3
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json


@gl.evm.contract_interface
class _Recipient:
    class View:
        pass
    class Write:
        pass


class AgenticEscrow(gl.Contract):
    owner: Address
    escrow_counter: u64

    # Core Escrow State (keys are string escrow_id for GenVM Comparable key compatibility)
    buyers: TreeMap[str, Address]
    sellers: TreeMap[str, Address]
    amounts: TreeMap[str, u256]
    titles: TreeMap[str, str]
    specifications: TreeMap[str, str]
    # status: 0=PENDING_SUBMISSION, 1=SUBMITTED, 2=RELEASED_TO_SELLER, 3=REFUNDED_TO_BUYER, 4=SPLIT_50_50, 5=OPEN_FOR_APPLICANTS
    statuses: TreeMap[str, u8]

    # Dispute / Delivery State
    deliveries: TreeMap[str, str]
    verdict_summaries: TreeMap[str, str]
    confidence_scores: TreeMap[str, u8]

    # Open Bounty Applicants State (escrow_id -> JSON serialized list of applicants)
    applicants: TreeMap[str, str]

    # Custody & Balance Management: Track contract-controlled escrowed funds and settled balances
    escrow_locked_funds: TreeMap[str, u256]
    claimable_balances: TreeMap[str, u256]

    def __init__(self):
        self.owner = gl.message.sender_address
        self.escrow_counter = 0

    @gl.public.write.payable
    def create_escrow(
        self,
        seller: Address,
        title: str,
        specifications: str,
        amount: u256,
    ) -> u64:
        buyer = gl.message.sender_address
        attached_value = gl.message.value

        assert amount > 0, "Escrow deposit amount must be greater than zero"
        # Atomically enforce that native attached value matches or covers the escrow amount
        assert attached_value >= amount, f"Attached value {attached_value} is less than required escrow amount {amount}"

        self.escrow_counter += 1
        escrow_id = self.escrow_counter
        key = str(escrow_id)

        self.buyers[key] = buyer
        self.sellers[key] = seller
        self.amounts[key] = amount
        self.titles[key] = title
        self.specifications[key] = specifications
        self.deliveries[key] = ""
        self.applicants[key] = "[]"
        self.confidence_scores[key] = 0

        # Custody: Atomically lock backed funds under contract control
        self.escrow_locked_funds[key] = amount

        zero_addr = Address("0x0000000000000000000000000000000000000000")
        if seller == zero_addr:
            self.statuses[key] = 5  # OPEN_FOR_APPLICANTS
            self.verdict_summaries[key] = f"Open bounty created with {amount} backed in contract custody. Awaiting applicants."
        else:
            self.statuses[key] = 0  # PENDING_SUBMISSION
            self.verdict_summaries[key] = f"Direct escrow created with {amount} backed in contract custody. Awaiting deliverable."

        return escrow_id

    @gl.public.write
    def apply_for_task(self, escrow_id: u64, proposal: str) -> None:
        applicant = gl.message.sender_address
        key = str(escrow_id)
        current_status = self.statuses.get(key, 255)
        assert current_status == 5, "Escrow is not open for applications"

        buyer = self.buyers.get(key)
        assert applicant != buyer, "Buyer cannot apply for own escrow"

        raw_apps = self.applicants.get(key, "[]")
        apps_list = json.loads(raw_apps) if raw_apps else []

        applicant_str = str(applicant)
        for app in apps_list:
            if app.get("address", "").lower() == applicant_str.lower():
                raise gl.UserError("Already applied for this task")

        apps_list.append({
            "address": applicant_str,
            "proposal": proposal
        })
        self.applicants[key] = json.dumps(apps_list)

    @gl.public.write
    def assign_contractor(self, escrow_id: u64, selected_contractor: Address) -> None:
        sender = gl.message.sender_address
        key = str(escrow_id)
        buyer = self.buyers.get(key)

        assert sender == buyer, "Unauthorized: only buyer can assign contractor"

        current_status = self.statuses.get(key, 255)
        assert current_status == 5, "Escrow is not in open application state"

        zero_addr = Address("0x0000000000000000000000000000000000000000")
        assert selected_contractor != zero_addr, "Invalid contractor address"

        self.sellers[key] = selected_contractor
        self.statuses[key] = 0  # PENDING_SUBMISSION
        self.verdict_summaries[key] = "Contractor assigned by buyer. Awaiting work submission."

    @gl.public.write
    def submit_work(self, escrow_id: u64, delivery_details: str) -> None:
        sender = gl.message.sender_address
        key = str(escrow_id)
        seller = self.sellers.get(key)

        assert sender == seller, "Unauthorized: only assigned seller can submit work"

        current_status = self.statuses.get(key, 255)
        assert current_status == 0, "Escrow not in pending submission state"
        assert len(delivery_details.strip()) > 0, "Delivery details cannot be empty"

        self.deliveries[key] = delivery_details
        self.statuses[key] = 1  # SUBMITTED
        self.verdict_summaries[key] = "Work submitted. Ready for buyer approval or AI judicial dispute resolution."

    @gl.public.write
    def approve_and_release(self, escrow_id: u64) -> None:
        """Buyer manually verifies work and approves release of locked custody funds to seller."""
        sender = gl.message.sender_address
        key = str(escrow_id)
        buyer = self.buyers.get(key)

        assert sender == buyer, "Unauthorized: only buyer can approve delivery and release funds"

        current_status = self.statuses.get(key, 255)
        assert current_status == 1, "Escrow must be in SUBMITTED state to approve"

        seller = self.sellers.get(key)
        locked = self.escrow_locked_funds.get(key, 0)
        assert locked > 0, "No locked funds remaining in escrow"

        # Contract Settlement: atomically release 100% of locked funds to seller claimable balance
        self.escrow_locked_funds[key] = 0
        current_seller_bal = self.claimable_balances.get(str(seller), 0)
        self.claimable_balances[str(seller)] = current_seller_bal + locked

        self.statuses[key] = 2  # RELEASED_TO_SELLER
        self.verdict_summaries[key] = f"Buyer verified delivery. Contract settlement: {locked} released to seller claimable balance."

    @gl.public.write
    def resolve_dispute_with_ai(self, escrow_id: u64, buyer_complaint: str) -> None:
        """
        Multi-validator non-deterministic LLM consensus judicial dispute arbitration.
        Validators independently evaluate delivery evidence against specifications and dispute reason.
        Validators fail closed if consensus on verdict decision cannot be verified.
        """
        sender = gl.message.sender_address
        key = str(escrow_id)
        buyer = self.buyers.get(key)
        seller = self.sellers.get(key)

        assert sender == buyer or sender == seller, "Unauthorized: only buyer or contractor can initiate dispute"

        current_status = self.statuses.get(key, 255)
        assert current_status == 1, "Dispute can only be raised on submitted work"

        locked = self.escrow_locked_funds.get(key, 0)
        assert locked > 0, "No locked funds available for settlement"

        title = self.titles.get(key, "")
        spec = self.specifications.get(key, "")
        delivery = self.deliveries.get(key, "")

        prompt = f"""You are an unbiased on-chain judicial AI dispute arbiter for decentralized escrows.
Review the agreed specification, the contractor's submitted proof/work, and the buyer's complaint.

Agreed Project Title: {title}
Original Specification: {spec}
Seller Submission / Work: {delivery}
Buyer Complaint / Dispute Reason: {buyer_complaint}

Task:
Determine whether the seller fulfilled the core specifications or if the buyer's complaint is valid.
Decide one of three verdict actions:
1. "RELEASE" - Seller delivered satisfactorily according to spec.
2. "REFUND" - Seller failed to deliver or delivered fraudulent/unusable work.
3. "SPLIT" - Partial delivery or genuine ambiguity where both parties share equal responsibility.

Provide your output ONLY in valid JSON format:
{{
    "decision": "RELEASE" or "REFUND" or "SPLIT",
    "confidence": integer between 50 and 100,
    "summary": "Brief 1-2 sentence judicial reasoning"
}}
"""

        def leader_fn():
            res = gl.nondet.exec_prompt(prompt, response_format="json")
            if not isinstance(res, dict):
                raise gl.UserError(f"LLM returned invalid format: {type(res)}")
            return res

        def validator_fn(leader_result) -> bool:
            """
            Independent Substantive Validator Execution:
            Validators independently verify the delivery evidence and settlement decision by executing
            the LLM prompt themselves and asserting judicial decision equivalence.
            FAILS CLOSED: Never accepts format-only fallbacks. If validator execution fails or disagrees, returns False.
            """
            if not isinstance(leader_result, gl.vm.Return):
                return False
            lead_data = leader_result.calldata
            if not isinstance(lead_data, dict):
                return False

            lead_decision = str(lead_data.get("decision", "")).strip().upper()
            if lead_decision not in ("RELEASE", "REFUND", "SPLIT"):
                return False

            lead_summary = str(lead_data.get("summary", "")).strip()
            if len(lead_summary) < 5:
                return False

            # Independent validation: execute prompt independently on validator node
            try:
                val_res = gl.nondet.exec_prompt(prompt, response_format="json")
                if isinstance(val_res, dict):
                    val_decision = str(val_res.get("decision", "")).strip().upper()
                    # Substantive equivalence check: decision must strictly match
                    return lead_decision == val_decision
                return False
            except Exception:
                # Fail-closed security rule: reject rather than accepting format-only fallback
                return False

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        decision = str(result.get("decision", "")).strip().upper()
        confidence = int(result.get("confidence", 80))
        summary = str(result.get("summary", "AI consensus achieved."))

        # ── Contract-Controlled Financial Settlement ──────────────────────────
        self.escrow_locked_funds[key] = 0

        if decision == "RELEASE":
            # 100% to seller
            self.statuses[key] = 2  # RELEASED_TO_SELLER
            cur_seller_bal = self.claimable_balances.get(str(seller), 0)
            self.claimable_balances[str(seller)] = cur_seller_bal + locked
            settlement_note = f"100% of escrowed funds ({locked}) settled and credited to contractor."
        elif decision == "REFUND":
            # 100% refund to buyer
            self.statuses[key] = 3  # REFUNDED_TO_BUYER
            cur_buyer_bal = self.claimable_balances.get(str(buyer), 0)
            self.claimable_balances[str(buyer)] = cur_buyer_bal + locked
            settlement_note = f"100% of escrowed funds ({locked}) refunded and credited to buyer."
        else:
            # 50/50 Split
            self.statuses[key] = 4  # SPLIT_50_50
            half = locked // 2
            rem = locked - half
            cur_seller_bal = self.claimable_balances.get(str(seller), 0)
            cur_buyer_bal = self.claimable_balances.get(str(buyer), 0)
            self.claimable_balances[str(seller)] = cur_seller_bal + half
            self.claimable_balances[str(buyer)] = cur_buyer_bal + rem
            settlement_note = f"Split 50/50 settlement: {half} to contractor, {rem} refunded to buyer."

        self.verdict_summaries[key] = f"[{decision}] {summary} | Contract Settlement: {settlement_note}"
        self.confidence_scores[key] = u8(min(100, max(0, confidence)))

    @gl.public.write
    def reopen_task(self, escrow_id: u64) -> None:
        """
        Allows buyer to re-open a refunded task for new applicants without attaching new external funds.
        Conservation of funds check: STRICTLY verifies buyer has unwithdrawn claimable balance >= amount.
        """
        sender = gl.message.sender_address
        key = str(escrow_id)
        buyer = self.buyers.get(key)

        assert sender == buyer, "Unauthorized: only buyer can re-open task"

        current_status = self.statuses.get(key, 255)
        assert current_status == 3, "Only refunded/disputed tasks can be re-opened"

        amount = self.amounts.get(key, 0)
        assert amount > 0, "Invalid escrow amount"

        # Conservation of funds: Buyer MUST have unwithdrawn claimable balance covering the amount
        cur_buyer_bal = self.claimable_balances.get(str(buyer), 0)
        assert cur_buyer_bal >= amount, f"Insufficient unwithdrawn balance to reopen: available {cur_buyer_bal}, required {amount}"

        # Deduct from claimable balance and re-lock into escrow custody
        self.claimable_balances[str(buyer)] = cur_buyer_bal - amount
        self.escrow_locked_funds[key] = amount

        self.sellers[key] = Address("0x0000000000000000000000000000000000000000")
        self.statuses[key] = 5  # OPEN_FOR_APPLICANTS
        self.deliveries[key] = ""
        self.applicants[key] = "[]"
        self.confidence_scores[key] = 0
        self.verdict_summaries[key] = f"Task re-opened after dispute. {amount} re-locked from buyer claimable balance into escrow custody. Accepting new applications."

    @gl.public.write
    def withdraw_funds(self, beneficiary: Address) -> u256:
        """
        Beneficiary claims and withdraws their settled funds.
        Strict authorization: Only the beneficiary can withdraw their own settled funds.
        Executes contract-native payout via emit_transfer to transfer native GEN to the beneficiary wallet.
        """
        sender = gl.message.sender_address
        assert sender == beneficiary, "Unauthorized: caller can only withdraw their own settled funds"

        balance = self.claimable_balances.get(str(beneficiary), 0)
        assert balance > 0, "No claimable balance available for withdrawal"

        self.claimable_balances[str(beneficiary)] = 0

        # Contract-native payout to EOA via documented EVM contract interface external message
        _Recipient(beneficiary).emit_transfer(value=balance)
        return balance

    @gl.public.view
    def get_claimable_balance(self, user: Address) -> str:
        """Returns the current settled claimable balance for an account."""
        return str(self.claimable_balances.get(str(user), 0))

    @gl.public.view
    def get_escrow(self, escrow_id: u64) -> dict:
        key = str(escrow_id)
        zero_addr = Address("0x0000000000000000000000000000000000000000")
        return {
            "id": escrow_id,
            "buyer": str(self.buyers.get(key, zero_addr)),
            "seller": str(self.sellers.get(key, zero_addr)),
            "amount": str(self.amounts.get(key, 0)),
            "locked_funds": str(self.escrow_locked_funds.get(key, 0)),
            "title": self.titles.get(key, ""),
            "specifications": self.specifications.get(key, ""),
            "status": self.statuses.get(key, 0),
            "delivery": self.deliveries.get(key, ""),
            "verdict_summary": self.verdict_summaries.get(key, ""),
            "confidence": self.confidence_scores.get(key, 0),
            "applicants": self.applicants.get(key, "[]"),
        }

    @gl.public.view
    def get_total_escrows(self) -> u64:
        return self.escrow_counter
