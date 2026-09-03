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
    # status: 0=PENDING_SUBMISSION, 1=SUBMITTED, 2=RELEASED_TO_SELLER, 3=REFUNDED_TO_BUYER, 4=SPLIT_50_50
    statuses: TreeMap[u64, u8]

    # Dispute / Delivery State
    deliveries: TreeMap[u64, str]
    verdict_summaries: TreeMap[u64, str]
    confidence_scores: TreeMap[u64, u8]

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
        self.escrow_counter += 1
        escrow_id = self.escrow_counter

        self.buyers[escrow_id] = buyer
        self.sellers[escrow_id] = seller
        self.amounts[escrow_id] = amount
        self.titles[escrow_id] = title
        self.specifications[escrow_id] = specifications
        self.statuses[escrow_id] = 0  # PENDING_SUBMISSION
        self.deliveries[escrow_id] = ""
        self.verdict_summaries[escrow_id] = "Escrow created, awaiting seller work submission."
        self.confidence_scores[escrow_id] = 0
        return escrow_id

    @gl.public.write
    def submit_work(self, escrow_id: u64, delivery_details: str) -> None:
        sender = gl.message.sender_address
        seller = self.sellers.get(escrow_id)
        assert sender == seller, "Only assigned seller can submit work"
        current_status = self.statuses.get(escrow_id, 255)
        assert current_status == 0, "Escrow not in pending submission state"

        self.deliveries[escrow_id] = delivery_details
        self.statuses[escrow_id] = 1  # SUBMITTED
        self.verdict_summaries[escrow_id] = "Work submitted. Ready for buyer approval or AI dispute resolution."

    @gl.public.write
    def approve_and_release(self, escrow_id: u64) -> None:
        sender = gl.message.sender_address
        buyer = self.buyers.get(escrow_id)
        assert sender == buyer, "Only buyer can approve directly"
        current_status = self.statuses.get(escrow_id, 255)
        assert current_status == 1, "Escrow must be submitted to approve"

        self.statuses[escrow_id] = 2  # RELEASED_TO_SELLER
        self.verdict_summaries[escrow_id] = "Buyer manually approved delivery. Funds released to seller."

    @gl.public.write
    def resolve_dispute_with_ai(self, escrow_id: u64, buyer_complaint: str) -> None:
        sender = gl.message.sender_address
        buyer = self.buyers.get(escrow_id)
        seller = self.sellers.get(escrow_id)
        assert sender == buyer or sender == seller or sender == self.owner, "Unauthorized caller"

        current_status = self.statuses.get(escrow_id, 255)
        assert current_status == 1, "Dispute can only be raised on submitted work"

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

        if decision == "RELEASE":
            self.statuses[escrow_id] = 2  # RELEASED_TO_SELLER
        elif decision == "REFUND":
            self.statuses[escrow_id] = 3  # REFUNDED_TO_BUYER
        else:
            self.statuses[escrow_id] = 4  # SPLIT_50_50

        self.verdict_summaries[escrow_id] = f"[{decision}] {summary}"
        self.confidence_scores[escrow_id] = u8(min(100, max(0, confidence)))

    @gl.public.view
    def get_escrow(self, escrow_id: u64) -> dict:
        return {
            "id": escrow_id,
            "buyer": str(self.buyers.get(escrow_id, Address("0x0000000000000000000000000000000000000000"))),
            "seller": str(self.sellers.get(escrow_id, Address("0x0000000000000000000000000000000000000000"))),
            "amount": str(self.amounts.get(escrow_id, 0)),
            "title": self.titles.get(escrow_id, ""),
            "specifications": self.specifications.get(escrow_id, ""),
            "status": self.statuses.get(escrow_id, 0),
            "delivery": self.deliveries.get(escrow_id, ""),
            "verdict_summary": self.verdict_summaries.get(escrow_id, ""),
            "confidence": self.confidence_scores.get(escrow_id, 0),
        }

    @gl.public.view
    def get_total_escrows(self) -> u64:
        return self.escrow_counter
