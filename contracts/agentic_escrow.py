# v0.3.3
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json


class AgenticEscrow(gl.Contract):
    owner: Address
    escrow_counter: u64

    # Core Escrow State
    buyers: TreeMap[u64, Address]
    sellers: TreeMap[u64, Address]
    amounts: TreeMap[u64, u256]
    titles: TreeMap[u64, str]
    specifications: TreeMap[u64, str]
    # status: 0=PENDING_SUBMISSION, 1=SUBMITTED, 2=RELEASED_TO_SELLER, 3=REFUNDED_TO_BUYER, 4=SPLIT_50_50, 5=OPEN_FOR_APPLICANTS
    statuses: TreeMap[u64, u8]

    # Dispute / Delivery State
    deliveries: TreeMap[u64, str]
    verdict_summaries: TreeMap[u64, str]
    confidence_scores: TreeMap[u64, u8]

    # Open Bounty Applicants State (escrow_id -> JSON serialized list of applicants)
    applicants: TreeMap[u64, str]

    # Custody & Balance Management: Track contract-controlled escrowed funds and settled balances
    # escrow_locked_funds: amount locked in escrow_id
    escrow_locked_funds: TreeMap[u64, u256]
    # claimable_balances: settled funds credited to beneficiary address
    claimable_balances: TreeMap[Address, u256]

    def __init__(self, initial_owner: Address):
        self.owner = initial_owner
        self.escrow_counter = 0

    @gl.public.write
    def create_escrow(
        self,
        seller: Address,
        title: str,
        specifications: str,
        amount: u256,
    ) -> u64:
        buyer = gl.message.sender_address
        assert amount > 0, "Escrow deposit amount must be greater than zero"

        self.escrow_counter += 1
        escrow_id = self.escrow_counter

        self.buyers[escrow_id] = buyer
        self.sellers[escrow_id] = seller
        self.amounts[escrow_id] = amount
        self.titles[escrow_id] = title
        self.specifications[escrow_id] = specifications
        self.deliveries[escrow_id] = ""
        self.applicants[escrow_id] = "[]"
        self.confidence_scores[escrow_id] = 0

        # Custody: Lock the funds under contract control
        self.escrow_locked_funds[escrow_id] = amount

        # If seller address is zero address, mark as OPEN_FOR_APPLICANTS (status 5)
        zero_addr = Address("0x0000000000000000000000000000000000000000")
        if seller == zero_addr:
            self.statuses[escrow_id] = 5  # OPEN_FOR_APPLICANTS
            self.verdict_summaries[escrow_id] = f"Open bounty created with {amount} locked in contract custody. Awaiting applicants."
        else:
            self.statuses[escrow_id] = 0  # PENDING_SUBMISSION
            self.verdict_summaries[escrow_id] = f"Direct escrow created with {amount} locked in contract custody. Awaiting deliverable."

        return escrow_id

    @gl.public.write
    def apply_for_task(self, escrow_id: u64, proposal: str) -> None:
        applicant = gl.message.sender_address
        current_status = self.statuses.get(escrow_id, 255)
        assert current_status == 5, "Escrow is not open for applications"
        buyer = self.buyers.get(escrow_id)
        assert applicant != buyer, "Buyer cannot apply for own escrow"

        raw_apps = self.applicants.get(escrow_id, "[]")
        apps_list = json.loads(raw_apps) if raw_apps else []
        for app in apps_list:
            if app.get("address") == str(applicant):
                raise gl.UserError("Already applied for this task")

        apps_list.append({
            "address": str(applicant),
            "proposal": proposal
        })
        self.applicants[escrow_id] = json.dumps(apps_list)

    @gl.public.write
    def assign_contractor(self, escrow_id: u64, selected_contractor: Address) -> None:
        sender = gl.message.sender_address
        buyer = self.buyers.get(escrow_id)
        assert sender == buyer, "Only buyer can assign contractor"
        current_status = self.statuses.get(escrow_id, 255)
        assert current_status == 5, "Escrow is not in open application state"

        self.sellers[escrow_id] = selected_contractor
        self.statuses[escrow_id] = 0  # PENDING_SUBMISSION
        self.verdict_summaries[escrow_id] = f"Contractor {str(selected_contractor)[:8]}... assigned by buyer. Awaiting work submission."

    @gl.public.write
    def submit_work(self, escrow_id: u64, delivery_details: str) -> None:
        sender = gl.message.sender_address
        seller = self.sellers.get(escrow_id)
        assert sender == seller, "Only assigned seller can submit work"
        current_status = self.statuses.get(escrow_id, 255)
        assert current_status == 0, "Escrow not in pending submission state"

        self.deliveries[escrow_id] = delivery_details
        self.statuses[escrow_id] = 1  # SUBMITTED
        self.verdict_summaries[escrow_id] = "Work submitted. Ready for buyer approval or AI judicial dispute resolution."

    @gl.public.write
    def approve_and_release(self, escrow_id: u64) -> None:
        """Buyer manually verifies work and approves release of locked custody funds to seller."""
        sender = gl.message.sender_address
        buyer = self.buyers.get(escrow_id)
        assert sender == buyer, "Only buyer can approve directly"
        current_status = self.statuses.get(escrow_id, 255)
        assert current_status == 1, "Escrow must be submitted to approve"

        seller = self.sellers.get(escrow_id)
        locked = self.escrow_locked_funds.get(escrow_id, 0)
        assert locked > 0, "No locked funds remaining in escrow"

        # Contract Settlement: release 100% of locked funds to seller claimable balance
        self.escrow_locked_funds[escrow_id] = 0
        current_seller_bal = self.claimable_balances.get(seller, 0)
        self.claimable_balances[seller] = current_seller_bal + locked

        self.statuses[escrow_id] = 2  # RELEASED_TO_SELLER
        self.verdict_summaries[escrow_id] = f"Buyer verified delivery. Contract-controlled settlement: {locked} released to seller."

    @gl.public.write
    def resolve_dispute_with_ai(self, escrow_id: u64, buyer_complaint: str) -> None:
        """Multi-validator non-deterministic LLM consensus judicial dispute arbitration with contract-controlled settlement."""
        sender = gl.message.sender_address
        buyer = self.buyers.get(escrow_id)
        seller = self.sellers.get(escrow_id)
        assert sender == buyer or sender == seller or sender == self.owner, "Unauthorized caller"

        current_status = self.statuses.get(escrow_id, 255)
        assert current_status == 1, "Dispute can only be raised on submitted work"

        locked = self.escrow_locked_funds.get(escrow_id, 0)
        assert locked > 0, "No locked funds available for settlement"

        title = self.titles.get(escrow_id, "")
        spec = self.specifications.get(escrow_id, "")
        delivery = self.deliveries.get(escrow_id, "")

        prompt = f"""You are an unbiased on-chain judicial AI dispute arbiter for decentralized escrows.
Review the agreed specification, the seller's submitted proof/work, and the buyer's complaint.

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
            if not isinstance(leader_result, gl.vm.Return):
                return False
            data = leader_result.calldata
            if not isinstance(data, dict):
                return False
            decision = str(data.get("decision", "")).strip().upper()
            if decision not in ("RELEASE", "REFUND", "SPLIT"):
                return False
            try:
                conf = int(data.get("confidence", 0))
                if conf < 0 or conf > 100:
                    return False
            except Exception:
                return False
            summary = str(data.get("summary", "")).strip()
            if not summary:
                return False
            return True

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        decision = str(result.get("decision", "")).strip().upper()
        confidence = int(result.get("confidence", 80))
        summary = str(result.get("summary", "AI consensus achieved."))

        # ── Contract-Controlled Financial Settlement ──────────────────────────
        self.escrow_locked_funds[escrow_id] = 0

        if decision == "RELEASE":
            # 100% to seller
            self.statuses[escrow_id] = 2  # RELEASED_TO_SELLER
            cur_seller_bal = self.claimable_balances.get(seller, 0)
            self.claimable_balances[seller] = cur_seller_bal + locked
            settlement_note = f"100% of escrowed funds ({locked}) settled and credited to contractor."
        elif decision == "REFUND":
            # 100% refund to buyer
            self.statuses[escrow_id] = 3  # REFUNDED_TO_BUYER
            cur_buyer_bal = self.claimable_balances.get(buyer, 0)
            self.claimable_balances[buyer] = cur_buyer_bal + locked
            settlement_note = f"100% of escrowed funds ({locked}) refunded and credited to buyer."
        else:
            # 50/50 Split
            self.statuses[escrow_id] = 4  # SPLIT_50_50
            half = locked // 2
            rem = locked - half
            cur_seller_bal = self.claimable_balances.get(seller, 0)
            cur_buyer_bal = self.claimable_balances.get(buyer, 0)
            self.claimable_balances[seller] = cur_seller_bal + half
            self.claimable_balances[buyer] = cur_buyer_bal + rem
            settlement_note = f"Split 50/50 settlement: {half} to contractor, {rem} refunded to buyer."

        self.verdict_summaries[escrow_id] = f"[{decision}] {summary} | Contract Settlement: {settlement_note}"
        self.confidence_scores[escrow_id] = u8(min(100, max(0, confidence)))

    @gl.public.write
    def reopen_task(self, escrow_id: u64) -> None:
        """Allows buyer to re-open a refunded task for new applicants without locking additional funds."""
        sender = gl.message.sender_address
        buyer = self.buyers.get(escrow_id)
        assert sender == buyer, "Only buyer can re-open task"
        current_status = self.statuses.get(escrow_id, 255)
        assert current_status == 3, "Only refunded/disputed tasks can be re-opened"

        amount = self.amounts.get(escrow_id, 0)
        # Re-lock the refunded amount into escrow custody
        cur_buyer_bal = self.claimable_balances.get(buyer, 0)
        if cur_buyer_bal >= amount:
            self.claimable_balances[buyer] = cur_buyer_bal - amount
        self.escrow_locked_funds[escrow_id] = amount

        self.sellers[escrow_id] = Address("0x0000000000000000000000000000000000000000")
        self.statuses[escrow_id] = 5  # OPEN_FOR_APPLICANTS
        self.deliveries[escrow_id] = ""
        self.applicants[escrow_id] = "[]"
        self.confidence_scores[escrow_id] = 0
        self.verdict_summaries[escrow_id] = f"Task re-opened after dispute. {amount} re-locked in contract custody. Accepting new applications."

    @gl.public.write
    def withdraw_funds(self) -> u256:
        """Beneficiary claims and withdraws their settled funds."""
        beneficiary = gl.message.sender_address
        balance = self.claimable_balances.get(beneficiary, 0)
        assert balance > 0, "No claimable balance available for withdrawal"
        self.claimable_balances[beneficiary] = 0
        return balance

    @gl.public.view
    def get_claimable_balance(self, user: Address) -> str:
        """Returns the current settled claimable balance for an account."""
        return str(self.claimable_balances.get(user, 0))

    @gl.public.view
    def get_escrow(self, escrow_id: u64) -> dict:
        return {
            "id": escrow_id,
            "buyer": str(self.buyers.get(escrow_id, Address("0x0000000000000000000000000000000000000000"))),
            "seller": str(self.sellers.get(escrow_id, Address("0x0000000000000000000000000000000000000000"))),
            "amount": str(self.amounts.get(escrow_id, 0)),
            "locked_funds": str(self.escrow_locked_funds.get(escrow_id, 0)),
            "title": self.titles.get(escrow_id, ""),
            "specifications": self.specifications.get(escrow_id, ""),
            "status": self.statuses.get(escrow_id, 0),
            "delivery": self.deliveries.get(escrow_id, ""),
            "verdict_summary": self.verdict_summaries.get(escrow_id, ""),
            "confidence": self.confidence_scores.get(escrow_id, 0),
            "applicants": self.applicants.get(escrow_id, "[]"),
        }

    @gl.public.view
    def get_total_escrows(self) -> u64:
        return self.escrow_counter
