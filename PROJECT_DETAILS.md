EduChain - Detailed Project Working and Architecture

EduChain is a premium, blockchain-based academic credential platform. It replaces traditional paper and PDF certificates with undeniable cryptographic truth by issuing, presenting, and verifying academic credentials directly on-chain.

This document provides a highly detailed, comprehensive breakdown of every component, workflow, and technical decision within the project.

---

 1. High-Level Architecture

The project is divided into two main components:

 Backend (Blockchain Layer): Built with Hardhat, utilizing a Solidity smart contract (`CertificateRegistry.sol`) deployed on a Ganache local blockchain network (`http://127.0.0.1:8545` with Chain ID: 31337). Ganache is configured as the default network in `hardhat.config.js` to handle fast, local RPC calls during development and testing.
 Frontend (Application Layer): A modern, responsive web application built with Vanilla JS, HTML, CSS, and Vite. It interacts with the blockchain using `ethers.js` and implements cryptographic functions using `crypto.subtle` (SHA-256) and `merkletreejs`.

 The Core Concept: "The Architecture of Trust"

Instead of storing heavy data (like images or full PDFs) on the blockchain, which is prohibitively expensive, EduChain operates on cryptographic hashes.

1. Credential data (ID, Name, Course, Institution) is combined into a single string.
2. This string is hashed using the SHA-256 algorithm to produce a unique, deterministic fingerprint (Hash).
3. Only this Hash (and minimal metadata for single issuance) or a Merkle Root (for bulk issuance) is stored on the Ethereum/Ganache blockchain.
4. Any alteration to the original credential data changes the hash entirely, making the system tamper-proof.

---

 2. Smart Contract Details (`CertificateRegistry.sol`)

The contract is the source of truth for the platform. It is written in Solidity `^0.8.20` and uses OpenZeppelin's `MerkleProof` library.

 State Variables

* `address public admin;`: Stores the address of the wallet that deployed the contract. Only this address can issue or revoke certificates.
* `mapping(string => Certificate) private certificates;`: Maps a Certificate ID (string) to its full metadata (struct).
* `mapping(string => bool) private certificateExists;`: A boolean registry to quickly check if a Certificate ID has been used.
* `mapping(string => bytes32) public batchRoots;`: Maps a Batch ID (string) to a Merkle Root (bytes32). Used for bulk issuance.

 Core Data Structure

```solidity
struct Certificate {
    string certificateId;
    string studentName;
    string course;
    string institution;
    string certificateHash;
    uint256 issueDate;
    bool valid;
}
```

# Key Functions

1. `issueCertificate(...)`: Allows the admin to issue a single certificate. It stores the metadata and the cryptographic hash on-chain, setting `valid` to `true`. Emits a `CertificateIssued` event.

2. `batchIssueCertificates(...)`: An alternative bulk issuance that takes arrays of IDs, names, courses, institutions, and hashes. It iterates and stores them all on-chain.

3. `registerBatchRoot(string _batchId, bytes32 _merkleRoot)`: The highly optimized Merkle Tree bulk issuance. Instead of storing 1,000 certificates directly, it stores just ONE Merkle Root associated with a `_batchId`. Emits `BatchRootRegistered`.

4. `revokeCertificate(string _id)`: Allows the admin to mark an existing certificate's `valid` boolean as `false`.

5. `verifyCertificate(string _id, string _hash)`: Compares a provided hash against the stored `certificateHash`. Also checks if `valid` is `true`. Returns a boolean.

6. `verifyMerkleCertificate(string _batchId, string _hash, bytes32[] _proof)`: The core of the Merkle verification. It fetches the Root for the `_batchId` from the contract, hashes the provided `_hash` to create a leaf node, and uses OpenZeppelin's `MerkleProof.verify` to mathematically prove the leaf is part of the Root using the provided `_proof` array.

---

3. Frontend Architecture (`main.js` & `index.html`)

The frontend is a single-page application that dynamically toggles visibility between four main "views" based on user interaction.

 Views (Gateways)

1. Landing Page (`view-landing`): Educational hero sections, interactive Merkle Tree visualizer demo, and persona gateways.
2. Admin Console (`view-admin`): The dashboard for the institution to issue and revoke credentials.
3. Student Wallet (`view-student`): Where a student retrieves their credential and displays their verification QR code.
4. Verifier Portal (`view-verifier`): Where third parties cryptographically verify a credential.

Blockchain Connectivity (Ganache & MetaMask Integration)

When the user clicks "Connect Wallet":

* The system uses `ethers.BrowserProvider(window.ethereum)`.
* It attempts to switch to the Ganache network (Chain ID: `0x7a69` / 31337). If the network isn't configured in MetaMask, the JS script seamlessly adds it using `wallet_addEthereumChain` pointing to `http://127.0.0.1:8545`.
* It prompts MetaMask to request permissions, allowing the user to select their specific account. This is crucial for distinguishing between the Admin wallet and a Verifier wallet.
* It instantiates the `ethers.Contract` object, allowing the JS to call Solidity functions on Ganache.

---

 4. In-Depth Workflows

A. The Admin Workflow (Issuance & Revocation)

The Admin connects via MetaMask using the deployment address.

Single Issuance

1. Admin fills out: ID, Name, Course, Institution.
2. The frontend triggers `updateLivePreview()`, combining the 4 inputs into a single string (`id + name + course + inst`) and hashing it locally using `crypto.subtle` (SHA-256).
3. On submit, the JS calls `contract.issueCertificate(...)`, passing the plain text and the computed hash to the Ganache blockchain.

 Batch Issuance (The Merkle Tree Method)

1. Admin uploads a CSV file containing rows of `ID, Name, Course, Institution` (e.g., `sample_students_15.csv`).
2. The JS parses the CSV. For every row, it concatenates the data and generates a SHA-256 hash.
3. Using `merkletreejs`, it converts these hashes into `ethers.keccak256` buffer leaves and dynamically builds a Merkle Tree (`new MerkleTree(...)`).
4. It extracts the absolute Root of this tree.
5. It generates a unique `batchId` (e.g., `BATCH-1698239012`).
6. It sends a transaction to `contract.registerBatchRoot(batchId, root)`. By using Merkle Trees, writing 1,000 certificates costs the exact same amount of gas as writing just 1 certificate.
7. Crucial Step: The frontend automatically triggers a download of a `batch_proofs_BATCH-XXXX.json` file. This JSON contains the metadata, the individual hash, and the specific cryptographic `proof` array required for every single certificate in that batch.
Revocation

1. Admin enters an ID.
2. JS calls `contract.revokeCertificate(id)`.
3. The contract sets `valid = false`. Future verifications will fail.

 B. The Student Workflow

1. The student navigates to the Student Portal.
2. They enter their unique Certificate ID.
3. The JS calls the read-only function `contract.getCertificate(id)`.
4. If found, the frontend visually constructs the premium certificate UI.
5. It re-computes the hash locally to generate a QR Code. The QR code's payload is a JSON object containing `{ id: "...", hash: "..." }`, making it easy to scan and verify.

 C. The Verifier Workflow

The Verifier portal has three distinct modes depending on how the certificate was issued.

 1. Single Verify

* Requires manual input of the Certificate ID and the Cryptographic Hash.
* Calls `contract.verifyCertificate(id, hash)`.
* If the hash matches the on-chain hash and the certificate is not revoked, it triggers a "Spectacular Success" UI state.

#### 2. Batch Merkle Verify (Manual)

* Used if a student provides their Merkle Proof manually.
* Requires Batch ID, Leaf Hash, and the Proof Array (e.g., `["0xabc...", "0xdef..."]`).
* Calls `contract.verifyMerkleCertificate(...)`.

#### 3. Auto JSON Verify (Merkle JSON Upload)

* The most seamless batch verification method for Merkle Trees.
* The verifier uploads the `batch_proofs.json` file and enters the specific Certificate ID they wish to verify.
* The JS parses the JSON, extracts the `batchId`, `hash`, and Merkle `proof` specific to that ID.
* It automatically calls `contract.verifyMerkleCertificate(...)` against the Ganache chain.
* If valid, it extracts the name and course from the JSON to display the "Spectacular Success" UI, proving that the local JSON data accurately represents the data authorized by the Merkle Root on the blockchain.

---

## 5. UI/UX & Design Details

* Vanilla CSS: The project uses deep, custom CSS without frameworks to achieve a highly premium, "wow" aesthetic.
* Glassmorphism & Depth: Heavy use of subtle borders, deep shadows (`box-shadow`), and layered backgrounds.
* Interactive Merkle Visualizer: The landing page features a custom-built, interactive SVG canvas that draws a real Merkle tree structure in the DOM. Clicking a leaf node dynamically traces the cryptographic proof path up to the root, visually teaching the user how the cryptographic proof works.
* Auto Network Switching: If the user doesn't have Ganache configured in their wallet, the frontend handles adding and switching to the `http://127.0.0.1:8545` RPC URL automatically.
