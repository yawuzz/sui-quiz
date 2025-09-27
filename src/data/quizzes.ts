// src/data/quizzes.ts
export interface Question {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  points: number;
  durationSec: number;
}

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
}

export const QUIZZES: Quiz[] = [
  {
    id: "sui-basics",
    title: "Sui Basics",
    description: "Intro to Sui concepts",
    questions: [
      {
        id: "q1",
        text: "Which language is used to write smart contracts on Sui?",
        options: ["Solidity", "Move", "Rust", "Vyper"],
        correctIndex: 1,
        points: 200,
        durationSec: 20,
      },
      {
        id: "q2",
        text: "What is a key performance characteristic of Sui?",
        options: ["Single-threaded TX", "Object-centric model", "No parallelism", "Pow consensus"],
        correctIndex: 1,
        points: 200,
        durationSec: 20,
      },
      {
        id: "q3",
        text: "Which of the following is non-transferable by design?",
        options: ["NFT", "Coin", "SBT", "Package"],
        correctIndex: 2,
        points: 200,
        durationSec: 20,
      },
      {
        id: "q4",
        text: "zkLogin is mainly used for…",
        options: ["Private L2", "Gas abstraction", "OAuth-like login", "MEV protection"],
        correctIndex: 2,
        points: 200,
        durationSec: 20,
      },
      {
        id: "q5",
        text: "Sponsored Transactions let users…",
        options: [
          "Skip signatures",
          "Use another account’s gas",
          "Bypass validators",
          "Sign with EVM keys",
        ],
        correctIndex: 1,
        points: 200,
        durationSec: 20,
      },
    ],
  },
  {
    id: "web3-general",
    title: "Web3 General",
    description: "General blockchain concepts",
    questions: [
      {
        id: "w1",
        text: "What does ‘gas’ pay for?",
        options: ["Storage only", "Bandwidth", "Computation + storage", "Validator tips only"],
        correctIndex: 2,
        points: 150,
        durationSec: 20,
      },
      {
        id: "w2",
        text: "A ‘wallet’ primarily manages…",
        options: ["Tokens", "Private keys", "Nodes", "Bridges"],
        correctIndex: 1,
        points: 150,
        durationSec: 20,
      },
      {
        id: "w3",
        text: "Rollups are designed to…",
        options: ["Replace L1s", "Increase throughput", "Stop MEV", "Eliminate signatures"],
        correctIndex: 1,
        points: 150,
        durationSec: 20,
      },
      {
        id: "w4",
        text: "Which is a non-transferable credential?",
        options: ["POAP", "SBT", "ERC-20", "ERC-721"],
        correctIndex: 1,
        points: 150,
        durationSec: 20,
      },
      {
        id: "w5",
        text: "Merkle trees help mainly with…",
        options: ["Low gas", "Fast networking", "Data integrity proofs", "GPU mining"],
        correctIndex: 2,
        points: 150,
        durationSec: 20,
      },
    ],
  },
];
