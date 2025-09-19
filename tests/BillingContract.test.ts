// tests/BillingContract.test.ts

import { describe, it, expect, beforeEach } from "vitest";
import { cvToString, uintCV, principalCV, stringUtf8CV, boolCV, someCV, bufferCV } from "@stacks/transactions";
import { Buffer } from "node:buffer";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_USER = 101;
const ERR_INVALID_PERIOD = 102;
const ERR_INVALID_AMOUNT = 103;
const ERR_INVALID_RATE = 104;
const ERR_BILL_ALREADY_GENERATED = 105;
const ERR_BILL_NOT_FOUND = 106;
const ERR_INSUFFICIENT_BALANCE = 107;
const ERR_DISPUTE_ALREADY_SETTLED = 108;
const ERR_INVALID_DISPUTE = 109;
const ERR_INVALID_ROLE = 113;
const ERR_PAYMENT_FAILED = 114;
const ERR_PROPOSAL_NOT_FOUND = 121;
const ERR_INVALID_PROPOSAL = 122;

interface Bill {
  amount: number;
  paid: boolean;
  disputed: boolean;
  timestamp: number;
}

interface Dispute {
  reason: string;
  evidence: Buffer;
  resolved: boolean;
  resolution: boolean | null;
}

interface Payment {
  amount: number;
  timestamp: number;
  method: string;
}

interface Proposal {
  newRate: number;
  votesFor: number;
  votesAgainst: number;
  endTime: number;
  proposer: string;
}

interface Result<T> {
  ok: boolean;
  value: T | number;
}

class BillingContractMock {
  state: {
    admin: string;
    billingRate: number;
    periodDuration: number;
    gracePeriod: number;
    penaltyRate: number;
    productionTrackerContract: string;
    consumptionTrackerContract: string;
    energyTokenContract: string;
    userRegistryContract: string;
    governanceContract: string;
    bills: Map<string, Bill>;
    disputes: Map<string, Dispute>;
    payments: Map<string, Payment>;
    proposals: Map<number, Proposal>;
    nextProposalId: number;
  } = {
    admin: "ST1ADMIN",
    billingRate: 10,
    periodDuration: 144,
    gracePeriod: 10,
    penaltyRate: 5,
    productionTrackerContract: "SP000000000000000000002Q6VF78",
    consumptionTrackerContract: "SP000000000000000000002Q6VF78",
    energyTokenContract: "SP000000000000000000002Q6VF78",
    userRegistryContract: "SP000000000000000000002Q6VF78",
    governanceContract: "SP000000000000000000002Q6VF78",
    bills: new Map(),
    disputes: new Map(),
    payments: new Map(),
    proposals: new Map(),
    nextProposalId: 0,
  };
  blockHeight: number = 0;
  caller: string = "ST1USER";
  stxTransfers: Array<{ amount: number; from: string; to: string }> = [];
  tokenTransfers: Array<{ amount: number; from: string; to: string }> = [];
  mints: Array<{ to: string; amount: number }> = [];
  burns: Array<{ from: string; amount: number }> = [];
  userRoles: Map<string, string> = new Map([["ST1USER", "consumer"], ["ST2PROD", "producer"]]);
  userBalances: Map<string, number> = new Map([["ST1USER", 1000]]);
  productions: Map<string, number> = new Map();
  consumptions: Map<string, number> = new Map();

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      admin: "ST1ADMIN",
      billingRate: 10,
      periodDuration: 144,
      gracePeriod: 10,
      penaltyRate: 5,
      productionTrackerContract: "SP000000000000000000002Q6VF78",
      consumptionTrackerContract: "SP000000000000000000002Q6VF78",
      energyTokenContract: "SP000000000000000000002Q6VF78",
      userRegistryContract: "SP000000000000000000002Q6VF78",
      governanceContract: "SP000000000000000000002Q6VF78",
      bills: new Map(),
      disputes: new Map(),
      payments: new Map(),
      proposals: new Map(),
      nextProposalId: 0,
    };
    this.blockHeight = 0;
    this.caller = "ST1USER";
    this.stxTransfers = [];
    this.tokenTransfers = [];
    this.mints = [];
    this.burns = [];
    this.userRoles = new Map([["ST1USER", "consumer"], ["ST2PROD", "producer"]]);
    this.userBalances = new Map([["ST1USER", 1000]]);
    this.productions = new Map();
    this.consumptions = new Map();
  }

  getBill(user: string, period: number): Bill | undefined {
    return this.state.bills.get(`${user}-${period}`);
  }

  getDispute(user: string, period: number): Dispute | undefined {
    return this.state.disputes.get(`${user}-${period}`);
  }

  getPayment(user: string, period: number): Payment | undefined {
    return this.state.payments.get(`${user}-${period}`);
  }

  getProposal(id: number): Proposal | undefined {
    return this.state.proposals.get(id);
  }

  getCurrentRate(): Result<number> {
    return { ok: true, value: this.state.billingRate };
  }

  calculateNetEnergy(user: string, period: number): Result<{ surplus: number; deficit: number }> {
    const prod = this.productions.get(`${user}-${period}`) || 0;
    const cons = this.consumptions.get(`${user}-${period}`) || 0;
    if (prod >= cons) {
      return { ok: true, value: { surplus: prod - cons, deficit: 0 } };
    }
    return { ok: true, value: { surplus: 0, deficit: cons - prod } };
  }

  setProductionTracker(contract: string): Result<boolean> {
    if (this.caller !== this.state.admin) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.productionTrackerContract = contract;
    return { ok: true, value: true };
  }

  setConsumptionTracker(contract: string): Result<boolean> {
    if (this.caller !== this.state.admin) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.consumptionTrackerContract = contract;
    return { ok: true, value: true };
  }

  setEnergyToken(contract: string): Result<boolean> {
    if (this.caller !== this.state.admin) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.energyTokenContract = contract;
    return { ok: true, value: true };
  }

  setUserRegistry(contract: string): Result<boolean> {
    if (this.caller !== this.state.admin) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.userRegistryContract = contract;
    return { ok: true, value: true };
  }

  setGovernance(contract: string): Result<boolean> {
    if (this.caller !== this.state.admin) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.governanceContract = contract;
    return { ok: true, value: true };
  }

  setBillingRate(newRate: number): Result<boolean> {
    if (this.caller !== this.state.admin) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newRate <= 0 || newRate > 100) return { ok: false, value: ERR_INVALID_RATE };
    this.state.billingRate = newRate;
    return { ok: true, value: true };
  }

  generateBill(user: string, period: number): Result<number> {
    if (!this.userRoles.has(user)) return { ok: false, value: ERR_INVALID_USER };
    const role = this.userRoles.get(user);
    if (role !== "producer" && role !== "consumer") return { ok: false, value: ERR_INVALID_ROLE };
    if (period <= 0) return { ok: false, value: ERR_INVALID_PERIOD };
    if (this.state.bills.has(`${user}-${period}`)) return { ok: false, value: ERR_BILL_ALREADY_GENERATED };
    const net = this.calculateNetEnergy(user, period).value as { surplus: number; deficit: number };
    const deficit = net.deficit;
    const rate = this.state.billingRate;
    const amount = Math.floor((deficit * rate) / 100);
    if (deficit > 0) {
      this.state.bills.set(`${user}-${period}`, { amount, paid: false, disputed: false, timestamp: this.blockHeight });
      return { ok: true, value: amount };
    } else {
      this.mints.push({ to: user, amount: net.surplus });
      return { ok: true, value: 0 };
    }
  }

  payBill(user: string, period: number, useToken: boolean): Result<boolean> {
    if (this.caller !== user) return { ok: false, value: ERR_NOT_AUTHORIZED };
    const bill = this.state.bills.get(`${user}-${period}`);
    if (!bill) return { ok: false, value: ERR_BILL_NOT_FOUND };
    if (bill.paid) return { ok: false, value: ERR_PAYMENT_FAILED };
    if (bill.disputed) return { ok: false, value: ERR_INVALID_DISPUTE };
    if (bill.amount <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    const balance = this.userBalances.get(user) || 0;
    if (balance < bill.amount) return { ok: false, value: ERR_INSUFFICIENT_BALANCE };
    if (useToken) {
      this.tokenTransfers.push({ amount: bill.amount, from: user, to: this.state.admin });
    } else {
      this.stxTransfers.push({ amount: bill.amount, from: user, to: this.state.admin });
    }
    this.userBalances.set(user, balance - bill.amount);
    this.state.bills.set(`${user}-${period}`, { ...bill, paid: true });
    this.state.payments.set(`${user}-${period}`, { amount: bill.amount, timestamp: this.blockHeight, method: useToken ? "token" : "stx" });
    return { ok: true, value: true };
  }

  disputeBill(user: string, period: number, reason: string, evidence: Buffer): Result<boolean> {
    if (this.caller !== user) return { ok: false, value: ERR_NOT_AUTHORIZED };
    const bill = this.state.bills.get(`${user}-${period}`);
    if (!bill) return { ok: false, value: ERR_BILL_NOT_FOUND };
    if (bill.disputed) return { ok: false, value: ERR_INVALID_DISPUTE };
    if (bill.paid) return { ok: false, value: ERR_PAYMENT_FAILED };
    this.state.bills.set(`${user}-${period}`, { ...bill, disputed: true });
    this.state.disputes.set(`${user}-${period}`, { reason, evidence, resolved: false, resolution: null });
    return { ok: true, value: true };
  }

  settleDispute(user: string, period: number, accept: boolean): Result<boolean> {
    if (this.caller !== this.state.admin) return { ok: false, value: ERR_NOT_AUTHORIZED };
    const dispute = this.state.disputes.get(`${user}-${period}`);
    if (!dispute) return { ok: false, value: ERR_INVALID_DISPUTE };
    const bill = this.state.bills.get(`${user}-${period}`);
    if (!bill) return { ok: false, value: ERR_BILL_NOT_FOUND };
    if (dispute.resolved) return { ok: false, value: ERR_DISPUTE_ALREADY_SETTLED };
    this.state.disputes.set(`${user}-${period}`, { ...dispute, resolved: true, resolution: accept });
    if (accept) {
      this.state.bills.set(`${user}-${period}`, { ...bill, amount: 0, disputed: false });
    } else {
      this.state.bills.set(`${user}-${period}`, { ...bill, disputed: false });
    }
    return { ok: true, value: true };
  }

  proposeRateChange(newRate: number): Result<number> {
    if (this.caller !== this.state.admin) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newRate <= 0 || newRate > 100) return { ok: false, value: ERR_INVALID_RATE };
    const id = this.state.nextProposalId;
    const endTime = this.blockHeight + 100;
    this.state.proposals.set(id, { newRate, votesFor: 0, votesAgainst: 0, endTime, proposer: this.caller });
    this.state.nextProposalId++;
    return { ok: true, value: id };
  }

  voteOnRate(id: number, support: boolean): Result<boolean> {
    const proposal = this.state.proposals.get(id);
    if (!proposal) return { ok: false, value: ERR_PROPOSAL_NOT_FOUND };
    if (this.blockHeight >= proposal.endTime) return { ok: false, value: ERR_INVALID_PROPOSAL };
    if (!this.userRoles.has(this.caller)) return { ok: false, value: ERR_INVALID_USER };
    if (support) {
      this.state.proposals.set(id, { ...proposal, votesFor: proposal.votesFor + 1 });
    } else {
      this.state.proposals.set(id, { ...proposal, votesAgainst: proposal.votesAgainst + 1 });
    }
    return { ok: true, value: true };
  }

  executeProposal(id: number): Result<boolean> {
    const proposal = this.state.proposals.get(id);
    if (!proposal) return { ok: false, value: ERR_PROPOSAL_NOT_FOUND };
    if (this.blockHeight < proposal.endTime) return { ok: false, value: ERR_INVALID_PROPOSAL };
    if (proposal.votesFor <= proposal.votesAgainst) return { ok: false, value: ERR_INVALID_PROPOSAL };
    this.state.billingRate = proposal.newRate;
    this.state.proposals.delete(id);
    return { ok: true, value: true };
  }
}

describe("BillingContract", () => {
  let contract: BillingContractMock;

  beforeEach(() => {
    contract = new BillingContractMock();
    contract.reset();
  });

  it("sets billing rate successfully", () => {
    contract.caller = "ST1ADMIN";
    const result = contract.setBillingRate(15);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.billingRate).toBe(15);
  });

  it("rejects set billing rate by non-admin", () => {
    const result = contract.setBillingRate(15);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects invalid billing rate", () => {
    contract.caller = "ST1ADMIN";
    const result = contract.setBillingRate(101);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_RATE);
  });

  it("generates bill for deficit", () => {
    contract.productions.set("ST1USER-1", 50);
    contract.consumptions.set("ST1USER-1", 100);
    const result = contract.generateBill("ST1USER", 1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(5);
    const bill = contract.getBill("ST1USER", 1);
    expect(bill?.amount).toBe(5);
    expect(bill?.paid).toBe(false);
    expect(bill?.disputed).toBe(false);
  });

  it("mints tokens for surplus", () => {
    contract.productions.set("ST2PROD-1", 100);
    contract.consumptions.set("ST2PROD-1", 50);
    const result = contract.generateBill("ST2PROD", 1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    expect(contract.mints).toEqual([{ to: "ST2PROD", amount: 50 }]);
  });

  it("rejects bill generation for invalid user", () => {
    const result = contract.generateBill("ST3INVALID", 1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_USER);
  });

  it("rejects bill generation for invalid period", () => {
    const result = contract.generateBill("ST1USER", 0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PERIOD);
  });

  it("rejects duplicate bill generation", () => {
    contract.productions.set("ST1USER-1", 50);
    contract.consumptions.set("ST1USER-1", 100);
    contract.generateBill("ST1USER", 1);
    const result = contract.generateBill("ST1USER", 1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_BILL_ALREADY_GENERATED);
  });

  it("pays bill with STX", () => {
    contract.productions.set("ST1USER-1", 50);
    contract.consumptions.set("ST1USER-1", 100);
    contract.generateBill("ST1USER", 1);
    const result = contract.payBill("ST1USER", 1, false);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const bill = contract.getBill("ST1USER", 1);
    expect(bill?.paid).toBe(true);
    expect(contract.stxTransfers).toEqual([{ amount: 5, from: "ST1USER", to: "ST1ADMIN" }]);
    expect(contract.userBalances.get("ST1USER")).toBe(995);
    const payment = contract.getPayment("ST1USER", 1);
    expect(payment?.amount).toBe(5);
    expect(payment?.method).toBe("stx");
  });

  it("pays bill with token", () => {
    contract.productions.set("ST1USER-1", 50);
    contract.consumptions.set("ST1USER-1", 100);
    contract.generateBill("ST1USER", 1);
    const result = contract.payBill("ST1USER", 1, true);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const bill = contract.getBill("ST1USER", 1);
    expect(bill?.paid).toBe(true);
    expect(contract.tokenTransfers).toEqual([{ amount: 5, from: "ST1USER", to: "ST1ADMIN" }]);
    expect(contract.userBalances.get("ST1USER")).toBe(995);
    const payment = contract.getPayment("ST1USER", 1);
    expect(payment?.amount).toBe(5);
    expect(payment?.method).toBe("token");
  });

  it("rejects payment by non-user", () => {
    contract.productions.set("ST1USER-1", 50);
    contract.consumptions.set("ST1USER-1", 100);
    contract.generateBill("ST1USER", 1);
    contract.caller = "ST3OTHER";
    const result = contract.payBill("ST1USER", 1, false);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects payment for non-existent bill", () => {
    const result = contract.payBill("ST1USER", 1, false);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_BILL_NOT_FOUND);
  });

  it("rejects payment if already paid", () => {
    contract.productions.set("ST1USER-1", 50);
    contract.consumptions.set("ST1USER-1", 100);
    contract.generateBill("ST1USER", 1);
    contract.payBill("ST1USER", 1, false);
    const result = contract.payBill("ST1USER", 1, false);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PAYMENT_FAILED);
  });

  it("rejects payment if disputed", () => {
    contract.productions.set("ST1USER-1", 50);
    contract.consumptions.set("ST1USER-1", 100);
    contract.generateBill("ST1USER", 1);
    contract.disputeBill("ST1USER", 1, "Wrong amount", Buffer.from("evidence"));
    const result = contract.payBill("ST1USER", 1, false);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DISPUTE);
  });

  it("rejects payment with insufficient balance", () => {
    contract.productions.set("ST1USER-1", 50);
    contract.consumptions.set("ST1USER-1", 100);
    contract.generateBill("ST1USER", 1);
    contract.userBalances.set("ST1USER", 4);
    const result = contract.payBill("ST1USER", 1, false);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INSUFFICIENT_BALANCE);
  });

  it("disputes bill successfully", () => {
    contract.productions.set("ST1USER-1", 50);
    contract.consumptions.set("ST1USER-1", 100);
    contract.generateBill("ST1USER", 1);
    const evidence = Buffer.from("evidence");
    const result = contract.disputeBill("ST1USER", 1, "Wrong amount", evidence);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const bill = contract.getBill("ST1USER", 1);
    expect(bill?.disputed).toBe(true);
    const dispute = contract.getDispute("ST1USER", 1);
    expect(dispute?.reason).toBe("Wrong amount");
    expect(dispute?.evidence).toEqual(evidence);
    expect(dispute?.resolved).toBe(false);
    expect(dispute?.resolution).toBe(null);
  });

  it("rejects dispute by non-user", () => {
    contract.productions.set("ST1USER-1", 50);
    contract.consumptions.set("ST1USER-1", 100);
    contract.generateBill("ST1USER", 1);
    contract.caller = "ST3OTHER";
    const result = contract.disputeBill("ST1USER", 1, "Wrong amount", Buffer.from("evidence"));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects dispute for non-existent bill", () => {
    const result = contract.disputeBill("ST1USER", 1, "Wrong amount", Buffer.from("evidence"));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_BILL_NOT_FOUND);
  });

  it("rejects duplicate dispute", () => {
    contract.productions.set("ST1USER-1", 50);
    contract.consumptions.set("ST1USER-1", 100);
    contract.generateBill("ST1USER", 1);
    contract.disputeBill("ST1USER", 1, "Wrong amount", Buffer.from("evidence"));
    const result = contract.disputeBill("ST1USER", 1, "Another reason", Buffer.from("more evidence"));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DISPUTE);
  });

  it("rejects dispute if already paid", () => {
    contract.productions.set("ST1USER-1", 50);
    contract.consumptions.set("ST1USER-1", 100);
    contract.generateBill("ST1USER", 1);
    contract.payBill("ST1USER", 1, false);
    const result = contract.disputeBill("ST1USER", 1, "Wrong amount", Buffer.from("evidence"));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PAYMENT_FAILED);
  });

  it("settles dispute accepting", () => {
    contract.productions.set("ST1USER-1", 50);
    contract.consumptions.set("ST1USER-1", 100);
    contract.generateBill("ST1USER", 1);
    contract.disputeBill("ST1USER", 1, "Wrong amount", Buffer.from("evidence"));
    contract.caller = "ST1ADMIN";
    const result = contract.settleDispute("ST1USER", 1, true);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const dispute = contract.getDispute("ST1USER", 1);
    expect(dispute?.resolved).toBe(true);
    expect(dispute?.resolution).toBe(true);
    const bill = contract.getBill("ST1USER", 1);
    expect(bill?.amount).toBe(0);
    expect(bill?.disputed).toBe(false);
  });

  it("settles dispute rejecting", () => {
    contract.productions.set("ST1USER-1", 50);
    contract.consumptions.set("ST1USER-1", 100);
    contract.generateBill("ST1USER", 1);
    contract.disputeBill("ST1USER", 1, "Wrong amount", Buffer.from("evidence"));
    contract.caller = "ST1ADMIN";
    const result = contract.settleDispute("ST1USER", 1, false);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const dispute = contract.getDispute("ST1USER", 1);
    expect(dispute?.resolved).toBe(true);
    expect(dispute?.resolution).toBe(false);
    const bill = contract.getBill("ST1USER", 1);
    expect(bill?.amount).toBe(5);
    expect(bill?.disputed).toBe(false);
  });

  it("rejects settle by non-admin", () => {
    contract.productions.set("ST1USER-1", 50);
    contract.consumptions.set("ST1USER-1", 100);
    contract.generateBill("ST1USER", 1);
    contract.disputeBill("ST1USER", 1, "Wrong amount", Buffer.from("evidence"));
    const result = contract.settleDispute("ST1USER", 1, true);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects settle for non-existent dispute", () => {
    contract.caller = "ST1ADMIN";
    const result = contract.settleDispute("ST1USER", 1, true);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DISPUTE);
  });

  it("rejects settle if already resolved", () => {
    contract.productions.set("ST1USER-1", 50);
    contract.consumptions.set("ST1USER-1", 100);
    contract.generateBill("ST1USER", 1);
    contract.disputeBill("ST1USER", 1, "Wrong amount", Buffer.from("evidence"));
    contract.caller = "ST1ADMIN";
    contract.settleDispute("ST1USER", 1, true);
    const result = contract.settleDispute("ST1USER", 1, false);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_DISPUTE_ALREADY_SETTLED);
  });

  it("proposes rate change successfully", () => {
    contract.caller = "ST1ADMIN";
    const result = contract.proposeRateChange(20);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    const proposal = contract.getProposal(0);
    expect(proposal?.newRate).toBe(20);
    expect(proposal?.votesFor).toBe(0);
    expect(proposal?.votesAgainst).toBe(0);
    expect(proposal?.endTime).toBe(100);
    expect(proposal?.proposer).toBe("ST1ADMIN");
  });

  it("rejects propose by non-admin", () => {
    const result = contract.proposeRateChange(20);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects invalid propose rate", () => {
    contract.caller = "ST1ADMIN";
    const result = contract.proposeRateChange(101);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_RATE);
  });

  it("votes on proposal successfully", () => {
    contract.caller = "ST1ADMIN";
    contract.proposeRateChange(20);
    contract.caller = "ST1USER";
    const result = contract.voteOnRate(0, true);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const proposal = contract.getProposal(0);
    expect(proposal?.votesFor).toBe(1);
    expect(proposal?.votesAgainst).toBe(0);
  });

  it("rejects vote on non-existent proposal", () => {
    const result = contract.voteOnRate(0, true);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PROPOSAL_NOT_FOUND);
  });

  it("rejects vote after end time", () => {
    contract.caller = "ST1ADMIN";
    contract.proposeRateChange(20);
    contract.blockHeight = 101;
    const result = contract.voteOnRate(0, true);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PROPOSAL);
  });

  it("rejects vote by unregistered user", () => {
    contract.caller = "ST1ADMIN";
    contract.proposeRateChange(20);
    contract.caller = "ST3INVALID";
    const result = contract.voteOnRate(0, true);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_USER);
  });

  it("executes proposal successfully", () => {
    contract.caller = "ST1ADMIN";
    contract.proposeRateChange(20);
    contract.caller = "ST1USER";
    contract.voteOnRate(0, true);
    contract.blockHeight = 101;
    contract.caller = "ST1ADMIN";
    const result = contract.executeProposal(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.billingRate).toBe(20);
    expect(contract.getProposal(0)).toBeUndefined();
  });

  it("rejects execute non-existent proposal", () => {
    const result = contract.executeProposal(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PROPOSAL_NOT_FOUND);
  });

  it("rejects execute before end time", () => {
    contract.caller = "ST1ADMIN";
    contract.proposeRateChange(20);
    const result = contract.executeProposal(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PROPOSAL);
  });

  it("rejects execute if not enough votes for", () => {
    contract.caller = "ST1ADMIN";
    contract.proposeRateChange(20);
    contract.caller = "ST1USER";
    contract.voteOnRate(0, false);
    contract.blockHeight = 101;
    contract.caller = "ST1ADMIN";
    const result = contract.executeProposal(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PROPOSAL);
  });

  it("gets current rate", () => {
    const result = contract.getCurrentRate();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(10);
  });

  it("calculates net energy deficit", () => {
    contract.productions.set("ST1USER-1", 50);
    contract.consumptions.set("ST1USER-1", 100);
    const result = contract.calculateNetEnergy("ST1USER", 1);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ surplus: 0, deficit: 50 });
  });

  it("calculates net energy surplus", () => {
    contract.productions.set("ST1USER-1", 100);
    contract.consumptions.set("ST1USER-1", 50);
    const result = contract.calculateNetEnergy("ST1USER", 1);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ surplus: 50, deficit: 0 });
  });

  it("sets production tracker", () => {
    contract.caller = "ST1ADMIN";
    const result = contract.setProductionTracker("STNEWTRACKER");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.productionTrackerContract).toBe("STNEWTRACKER");
  });

  it("sets consumption tracker", () => {
    contract.caller = "ST1ADMIN";
    const result = contract.setConsumptionTracker("STNEWCONSUME");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.consumptionTrackerContract).toBe("STNEWCONSUME");
  });

  it("sets energy token", () => {
    contract.caller = "ST1ADMIN";
    const result = contract.setEnergyToken("STNEWTOKEN");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.energyTokenContract).toBe("STNEWTOKEN");
  });

  it("sets user registry", () => {
    contract.caller = "ST1ADMIN";
    const result = contract.setUserRegistry("STNEWREG");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.userRegistryContract).toBe("STNEWREG");
  });

  it("sets governance", () => {
    contract.caller = "ST1ADMIN";
    const result = contract.setGovernance("STNEWGOV");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.governanceContract).toBe("STNEWGOV");
  });
});