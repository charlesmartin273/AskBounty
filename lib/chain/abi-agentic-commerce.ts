// Minimal ABI for the ERC-8183 AgenticCommerce contract - only what AskBounty
// calls. Extracted from the verified implementation on Arcscan
// (0xA316fd02827242D537F84730F8a37D0BA5fd351a behind proxy 0x0747…4583).
// Note: complete/reject take a bytes32 reason (NOT string); setBudget, fund,
// submit and complete all take a trailing `bytes optParams` (pass "0x").
export const agenticCommerceAbi = [
  {
    type: "function",
    name: "createJob",
    stateMutability: "nonpayable",
    inputs: [
      { name: "provider", type: "address" },
      { name: "evaluator", type: "address" },
      { name: "expiredAt", type: "uint256" },
      { name: "description", type: "string" },
      { name: "hook", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "setBudget",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "fund",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "submit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "deliverable", type: "bytes32" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "complete",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "reason", type: "bytes32" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claimRefund",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "platformFeeBP",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "evaluatorFeeBP",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getJob",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "client", type: "address" },
          { name: "provider", type: "address" },
          { name: "evaluator", type: "address" },
          { name: "description", type: "string" },
          { name: "budget", type: "uint256" },
          { name: "expiredAt", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "hook", type: "address" },
        ],
      },
    ],
  },
  {
    type: "event",
    name: "JobCreated",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "provider", type: "address", indexed: true },
      { name: "evaluator", type: "address", indexed: false },
      { name: "expiredAt", type: "uint256", indexed: false },
      { name: "hook", type: "address", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PaymentReleased",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "provider", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

// JobStatus enum mirror (uint8 in `getJob().status`).
export const JOB_STATUS = {
  Open: 0,
  Funded: 1,
  Submitted: 2,
  Completed: 3,
  Rejected: 4,
  Expired: 5,
} as const;
