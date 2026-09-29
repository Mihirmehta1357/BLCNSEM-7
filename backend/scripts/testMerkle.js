import { MerkleTree } from 'merkletreejs';
import { ethers } from 'ethers';

const hashes = [
    "0x5bb691e6a587bee44e90c8999fc0ea3dff02fae18f29de38e8d0f564b831100a",
    "0x11410214dae02bc0cdf4bb79de14060248042a3745750281dc2f003bd336b429"
];

const leafNodes = hashes.map(h => ethers.keccak256(ethers.toUtf8Bytes(h)));
console.log("Leaf nodes:", leafNodes);

const tree = new MerkleTree(leafNodes, ethers.keccak256, { sortPairs: true });
console.log("Root:", tree.getHexRoot());
console.log("Proof 0:", tree.getHexProof(leafNodes[0]));
