import { ethers } from 'ethers';
import QRCode from 'qrcode';
import { MerkleTree } from 'merkletreejs';
import './style.css';

export const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
export const contractABI = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"string","name":"batchId","type":"string"},{"indexed":false,"internalType":"bytes32","name":"merkleRoot","type":"bytes32"}],"name":"BatchRootRegistered","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"string","name":"certificateId","type":"string"},{"indexed":false,"internalType":"string","name":"certificateHash","type":"string"}],"name":"CertificateIssued","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"string","name":"certificateId","type":"string"}],"name":"CertificateRevoked","type":"event"},{"inputs":[],"name":"admin","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string[]","name":"_ids","type":"string[]"},{"internalType":"string[]","name":"_names","type":"string[]"},{"internalType":"string[]","name":"_courses","type":"string[]"},{"internalType":"string[]","name":"_institutions","type":"string[]"},{"internalType":"string[]","name":"_hashes","type":"string[]"}],"name":"batchIssueCertificates","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"","type":"string"}],"name":"batchRoots","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"_id","type":"string"}],"name":"getCertificate","outputs":[{"internalType":"string","name":"studentName","type":"string"},{"internalType":"string","name":"course","type":"string"},{"internalType":"string","name":"institution","type":"string"},{"internalType":"string","name":"certificateHash","type":"string"},{"internalType":"uint256","name":"issueDate","type":"uint256"},{"internalType":"bool","name":"valid","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"_id","type":"string"},{"internalType":"string","name":"_name","type":"string"},{"internalType":"string","name":"_course","type":"string"},{"internalType":"string","name":"_institution","type":"string"},{"internalType":"string","name":"_hash","type":"string"}],"name":"issueCertificate","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"_batchId","type":"string"},{"internalType":"bytes32","name":"_merkleRoot","type":"bytes32"}],"name":"registerBatchRoot","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"_id","type":"string"}],"name":"revokeCertificate","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"_id","type":"string"},{"internalType":"string","name":"_hash","type":"string"}],"name":"verifyCertificate","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"_batchId","type":"string"},{"internalType":"string","name":"_hash","type":"string"},{"internalType":"bytes32[]","name":"_proof","type":"bytes32[]"}],"name":"verifyMerkleCertificate","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"}];

let provider;
let signer;
let contract;

// Helper: Generate Hash
async function generateHash(dataString) {
  const encoder = new TextEncoder();
  const data = encoder.encode(dataString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return "0x" + hashHex;
}

// =======================================================
// GLOBAL NAVIGATION (V3.1)
// =======================================================
const views = ['view-landing', 'view-admin', 'view-student', 'view-verifier'];
function switchView(targetId) {
  views.forEach(v => {
    const el = document.getElementById(v);
    if(el) el.classList.add('hidden');
  });
  const target = document.getElementById(targetId);
  if(target) target.classList.remove('hidden');
  
  window.scrollTo(0, 0);
  
  // Update nav highlights
  const navIds = ['nav-btn-home', 'nav-btn-admin', 'nav-btn-student', 'nav-btn-verifier'];
  navIds.forEach(id => {
    const btn = document.getElementById(id);
    if(btn) btn.classList.remove('active-nav');
  });
  
  if (targetId === 'view-landing') document.getElementById('nav-btn-home')?.classList.add('active-nav');
  if (targetId === 'view-admin') document.getElementById('nav-btn-admin')?.classList.add('active-nav');
  if (targetId === 'view-student') document.getElementById('nav-btn-student')?.classList.add('active-nav');
  if (targetId === 'view-verifier') document.getElementById('nav-btn-verifier')?.classList.add('active-nav');
}

// Topbar listeners
document.getElementById('nav-btn-home')?.addEventListener('click', () => switchView('view-landing'));
document.getElementById('nav-brand')?.addEventListener('click', () => switchView('view-landing'));
document.getElementById('nav-btn-admin')?.addEventListener('click', () => switchView('view-admin'));
document.getElementById('nav-btn-student')?.addEventListener('click', () => switchView('view-student'));
document.getElementById('nav-btn-verifier')?.addEventListener('click', () => switchView('view-verifier'));

// Gateway listeners (from landing page)
document.getElementById('enter-admin')?.addEventListener('click', () => switchView('view-admin'));
document.getElementById('enter-student')?.addEventListener('click', () => switchView('view-student'));
document.getElementById('enter-verifier')?.addEventListener('click', () => switchView('view-verifier'));

// =======================================================
// INTERACTIVE MERKLE DEMO (V3.1)
// =======================================================
let demoTree = null;
let demoLeaves = [];
let demoRecords = [];

async function initMerkleDemo() {
  const canvas = document.getElementById('merkle-tree-canvas');
  if (!canvas) return;
  
  demoRecords = [
    { id: 'CERT-2026-001', name: 'Student 1', course: 'CS', inst: 'Edu' },
    { id: 'CERT-2026-002', name: 'Student 2', course: 'CS', inst: 'Edu' },
    { id: 'CERT-2026-003', name: 'Student 3', course: 'CS', inst: 'Edu' },
    { id: 'CERT-2026-004', name: 'Student 4', course: 'CS', inst: 'Edu' },
    { id: 'CERT-2026-005', name: 'Student 5', course: 'CS', inst: 'Edu' },
    { id: 'CERT-2026-006', name: 'Student 6', course: 'CS', inst: 'Edu' },
    { id: 'CERT-2026-007', name: 'Student 7', course: 'CS', inst: 'Edu' },
    { id: 'CERT-2026-008', name: 'Student 8', course: 'CS', inst: 'Edu' }
  ];

  const hashes = [];
  for(let rec of demoRecords) {
    const dataString = rec.id + rec.name + rec.course + rec.inst;
    const h = await generateHash(dataString);
    hashes.push(h);
  }

  // Use identical configuration to actual batch processing
  demoLeaves = hashes.map(h => ethers.keccak256(ethers.toUtf8Bytes(h)));
  demoTree = new MerkleTree(demoLeaves, ethers.keccak256, { sortPairs: true });
  
  renderMerkleCanvas();
}

function renderMerkleCanvas() {
  const canvas = document.getElementById('merkle-tree-canvas');
  if (!canvas) return;
  
  canvas.innerHTML = '<svg id="merkle-svg" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:1; pointer-events:none;"></svg>';
  const svg = document.getElementById('merkle-svg');
  
  const layers = demoTree.getHexLayers();
  
  // Height = 500. Layers: Root (y=60), L2 (y=160), L1 (y=280), Leaves (y=420)
  const yCoords = [];
  const totalLayers = layers.length;
  for(let i=0; i<totalLayers; i++) {
    yCoords.push(420 - (i * 120)); // Leaves at bottom
  }
  
  const nodesHtml = [];
  const leafCount = Math.pow(2, totalLayers - 1);
  const slotWidth = 100 / leafCount;
  
  layers.forEach((layer, i) => {
    const y = yCoords[i];
    const nodeSpacing = Math.pow(2, i) * slotWidth;
    const startOffset = (Math.pow(2, i) / 2) * slotWidth;
    
    layer.forEach((hex, j) => {
      const x = startOffset + (j * nodeSpacing);
      
      let isLeaf = (i === 0);
      let isRoot = (i === totalLayers - 1);
      
      let label = hex.substring(0,6) + '...' + hex.substring(hex.length-4);
      if (isLeaf) label = demoRecords[j].id;
      if (isRoot) label = "MERKLE ROOT";
      
      nodesHtml.push(`
        <div class="m-node ${isLeaf ? 'leaf' : ''} ${isRoot ? 'root' : ''}" 
             data-hex="${hex}" data-layer="${i}" data-index="${j}"
             style="left: ${x}%; top: ${y}px;">
          ${label}
        </div>
      `);
    });
  });
  
  canvas.insertAdjacentHTML('beforeend', nodesHtml.join(''));
  
  // Draw SVG lines sequentially (j and j+1 combine to j/2)
  requestAnimationFrame(() => {
    let linesHtml = '';
    for (let i = 0; i < totalLayers - 1; i++) {
      const currentLayer = layers[i];
      for (let j = 0; j < currentLayer.length; j++) {
        const parentIndex = Math.floor(j/2);
        
        const childNode = canvas.querySelector(`.m-node[data-layer="${i}"][data-index="${j}"]`);
        const parentNode = canvas.querySelector(`.m-node[data-layer="${i+1}"][data-index="${parentIndex}"]`);
        
        if (childNode && parentNode) {
          const cRect = childNode.getBoundingClientRect();
          const pRect = parentNode.getBoundingClientRect();
          const canvasRect = canvas.getBoundingClientRect();
          
          const cx = cRect.left - canvasRect.left + (cRect.width/2);
          const cy = cRect.top - canvasRect.top + (cRect.height/2);
          const px = pRect.left - canvasRect.left + (pRect.width/2);
          const py = pRect.top - canvasRect.top + (pRect.height/2);
          
          linesHtml += `<line x1="${cx}" y1="${cy}" x2="${px}" y2="${py}" stroke="rgba(255,255,255,0.05)" stroke-width="2" class="m-edge" data-child="${currentLayer[j]}" data-parent="${layers[i+1][parentIndex]}" />`;
        }
      }
    }
    svg.innerHTML = linesHtml;
    
    // Bind click events to leaves
    document.querySelectorAll('.m-node.leaf').forEach(node => {
      node.addEventListener('click', (e) => {
        const hex = e.target.getAttribute('data-hex');
        const idx = parseInt(e.target.getAttribute('data-index'));
        selectDemoLeaf(hex, idx);
      });
    });
  });
}

function selectDemoLeaf(leafHex, index) {
  // Clear previous highlights
  document.querySelectorAll('.m-node').forEach(n => n.classList.remove('active-leaf', 'active-path', 'verified'));
  document.querySelectorAll('.m-edge').forEach(e => {
    e.setAttribute('stroke', 'rgba(255,255,255,0.05)');
    e.classList.remove('active-path');
  });
  
  const selectedNode = document.querySelector(`.m-node.leaf[data-hex="${leafHex}"]`);
  if(selectedNode) selectedNode.classList.add('active-leaf');
  
  // Real cryptographic proof computation
  const proof = demoTree.getHexProof(leafHex);
  const isValid = demoTree.verify(proof, leafHex, demoTree.getHexRoot());
  
  // To visually highlight the path, we can trace it upward
  let currentHash = leafHex;
  let activeNodes = [leafHex];
  
  const layers = demoTree.getHexLayers();
  for (let i = 0; i < layers.length - 1; i++) {
    // Find index of currentHash in this layer
    const j = layers[i].indexOf(currentHash);
    if (j === -1) break;
    
    // The sibling is at j+1 (if j is even) or j-1 (if j is odd)
    const isLeft = j % 2 === 0;
    const siblingIdx = isLeft ? j + 1 : j - 1;
    const siblingHash = layers[i][siblingIdx]; // could be undefined if odd number of leaves
    
    if (siblingHash) activeNodes.push(siblingHash);
    
    // Parent
    const parentIndex = Math.floor(j/2);
    const parentHash = layers[i+1][parentIndex];
    activeNodes.push(parentHash);
    
    // Highlight lines
    const lineToParent = document.querySelector(`line[data-child="${currentHash}"][data-parent="${parentHash}"]`);
    if(lineToParent) {
       lineToParent.setAttribute('stroke', 'var(--accent-violet)');
       lineToParent.classList.add('active-path');
    }
    if (siblingHash) {
       const lineFromSibling = document.querySelector(`line[data-child="${siblingHash}"][data-parent="${parentHash}"]`);
       if(lineFromSibling) {
          lineFromSibling.setAttribute('stroke', 'var(--accent-violet)');
       }
    }
    
    currentHash = parentHash;
  }
  
  // Apply glowing classes
  activeNodes.forEach(h => {
    const node = document.querySelector(`.m-node[data-hex="${h}"]`);
    if(node && node !== selectedNode) node.classList.add('active-path');
  });
  
  const rootNode = document.querySelector('.m-node.root');
  if(rootNode && isValid) rootNode.classList.add('verified');

  // Update Proof Panel
  document.getElementById('proof-empty-state').classList.add('hidden');
  document.getElementById('proof-active-state').classList.remove('hidden');
  
  document.getElementById('demo-selected-id').innerText = demoRecords[index].id;
  document.getElementById('demo-leaf-hash').innerText = leafHex;
  
  // Filter proof elements from activeNodes (which includes parents). 
  // We can just use the actual 'proof' array returned by getHexProof.
  document.getElementById('demo-proof-hashes').innerHTML = proof.map(p => `<div style="margin-bottom:0.25rem;">${p}</div>`).join('');
  document.getElementById('demo-root-hash').innerText = demoTree.getHexRoot();
}

// Initialize Demo on load
document.addEventListener('DOMContentLoaded', () => {
  initMerkleDemo();
});


// =======================================================
// ADMIN SIDEBAR
// =======================================================
const adminNavBtns = [
  { btn: 'nav-overview', sec: 'sec-overview' },
  { btn: 'nav-issue', sec: 'sec-issue' },
  { btn: 'nav-batch', sec: 'sec-batch' },
  { btn: 'nav-revoke', sec: 'sec-revoke' }
];
function switchAdminView(targetBtnId) {
  adminNavBtns.forEach(item => {
    const btn = document.getElementById(item.btn);
    const sec = document.getElementById(item.sec);
    if (!btn || !sec) return;
    if (item.btn === targetBtnId) {
      btn.classList.add('active');
      sec.classList.remove('hidden');
    } else {
      btn.classList.remove('active');
      sec.classList.add('hidden');
    }
  });
}
adminNavBtns.forEach(item => {
  const btn = document.getElementById(item.btn);
  if (btn) btn.addEventListener('click', () => switchAdminView(item.btn));
});
document.getElementById('qa-issue')?.addEventListener('click', () => switchAdminView('nav-issue'));
document.getElementById('qa-batch')?.addEventListener('click', () => switchAdminView('nav-batch'));
document.getElementById('qa-revoke')?.addEventListener('click', () => switchAdminView('nav-revoke'));


// =======================================================
// VERIFIER SEGMENTS
// =======================================================
const segBtns = [
  { btn: 'seg-single', sec: 'verify-sec-single' },
  { btn: 'seg-batch', sec: 'verify-sec-batch' },
  { btn: 'seg-auto', sec: 'verify-sec-auto' }
];
function switchVerifySegment(targetBtnId) {
  segBtns.forEach(item => {
    const btn = document.getElementById(item.btn);
    const sec = document.getElementById(item.sec);
    if (!btn || !sec) return;
    if (item.btn === targetBtnId) {
      btn.classList.add('active');
      sec.classList.remove('hidden');
    } else {
      btn.classList.remove('active');
      sec.classList.add('hidden');
    }
  });
}
segBtns.forEach(item => {
  const btn = document.getElementById(item.btn);
  if (btn) btn.addEventListener('click', () => switchVerifySegment(item.btn));
});


// =======================================================
// UTILS & STATUS
// =======================================================
function showStatus(elementId, msg, isSuccess) {
  const el = document.getElementById(elementId);
  el.classList.add('active'); 

  let icon = isSuccess ? '✓' : '❌';
  let rowClass = isSuccess ? 'tx-step success' : 'tx-step error';
  
  if (msg.toLowerCase().includes('pending') || msg.toLowerCase().includes('building')) {
    icon = '⏳';
    rowClass = 'tx-step active';
    el.innerHTML = '';
  }

  const row = document.createElement('div');
  row.className = rowClass;
  
  if (msg.includes('Hash:')) {
    const parts = msg.split('Hash:');
    row.innerHTML = `<span>${icon}</span> <span>${parts[0]}</span>`;
    const hashBox = document.createElement('div');
    hashBox.className = 'tx-box';
    hashBox.innerHTML = `<span class="mono" style="color: var(--accent-blue); word-break: break-all;">${parts[1].trim()}</span> <span class="status-badge valid">CONFIRMED</span>`;
    el.appendChild(row);
    el.appendChild(hashBox);
  } else {
    row.innerHTML = `<span>${icon}</span> <span>${msg}</span>`;
    el.appendChild(row);
  }
  
  if (!msg.toLowerCase().includes('pending')) {
    if(el.hideTimeout) clearTimeout(el.hideTimeout);
    el.hideTimeout = setTimeout(() => {
      el.classList.remove('active');
    }, 20000); 
  }
}


// =======================================================
// FORMS & LIVE PREVIEW
// =======================================================
async function updateLivePreview() {
  const id = document.getElementById('cert-id')?.value || 'CERT-2026-XXX';
  const name = document.getElementById('student-name')?.value || 'Student Name';
  const course = document.getElementById('course-name')?.value || 'Degree / Course';
  const inst = document.getElementById('institution-name')?.value || 'Institution Name';

  document.getElementById('preview-id').innerText = id;
  document.getElementById('preview-name').innerText = name;
  document.getElementById('preview-course').innerText = course;
  document.getElementById('preview-inst').innerText = inst;

  if (id !== 'CERT-2026-XXX' && name !== 'Student Name') {
    const dataString = id + name + course + inst;
    const hash = await generateHash(dataString);
    document.getElementById('preview-hash').innerText = hash;
  } else {
    document.getElementById('preview-hash').innerText = 'Awaiting input...';
  }
}
['cert-id', 'student-name', 'course-name', 'institution-name'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', updateLivePreview);
});


// =======================================================
// BLOCKCHAIN BINDINGS
// =======================================================
document.getElementById('connect-btn').addEventListener('click', async () => {
  if (typeof window.ethereum !== 'undefined') {
    try {
      provider = new ethers.BrowserProvider(window.ethereum);
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x7a69' }],
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{ chainId: '0x7a69', chainName: 'EduChain Local', rpcUrls: ['http://127.0.0.1:8545'], nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 } }],
            });
          } catch (addError) {
            console.error(addError);
          }
        }
      }
      
      // Force MetaMask to open permission popup so user can select the Admin wallet
      await window.ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }]
      });
      
      await provider.send("eth_requestAccounts", []);
      signer = await provider.getSigner();
      contract = new ethers.Contract(contractAddress, contractABI, signer);
      
      const address = await signer.getAddress();
      document.getElementById('connect-btn').innerText = `${address.slice(0,6)}...${address.slice(-4)}`;
      
      const adminAddress = await contract.admin();
      const roleText = address.toLowerCase() === adminAddress.toLowerCase() ? "ADMIN" : "VIEWER";
      const roleEl = document.getElementById('overview-wallet-role');
      if (roleEl) {
        roleEl.innerText = roleText;
        roleEl.style.color = roleText === "ADMIN" ? "var(--success)" : "var(--text-secondary)";
      }
    } catch (err) {
      console.error(err);
      alert('Failed to connect wallet or user rejected permissions.');
    }
  } else {
    alert('Please install MetaMask!');
  }
});

// Admin: Issue
document.getElementById('issue-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!contract) return alert('Please connect wallet first.');

  const id = document.getElementById('cert-id').value;
  const name = document.getElementById('student-name').value;
  const course = document.getElementById('course-name').value;
  const inst = document.getElementById('institution-name').value;

  const dataString = id + name + course + inst;
  const hash = await generateHash(dataString);

  try {
    showStatus('issue-status', 'Transaction pending...', true);
    document.getElementById('issue-status').style.display = 'block';

    const tx = await contract.issueCertificate(id, name, course, inst, hash);
    await tx.wait();

    showStatus('issue-status', `Certificate Issued successfully! Hash: ${hash}`, true);
    document.getElementById('issue-form').reset();
  } catch (err) {
    console.error(err);
    showStatus('issue-status', err.reason || 'Failed to issue certificate.', false);
  }
});

// Admin: Revoke
document.getElementById('revoke-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!contract) return alert('Please connect wallet first.');
  const id = document.getElementById('revoke-id').value;
  try {
    showStatus('revoke-status', 'Transaction pending...', true);
    document.getElementById('revoke-status').style.display = 'block';
    const tx = await contract.revokeCertificate(id);
    await tx.wait();
    showStatus('revoke-status', `Certificate ${id} revoked successfully!`, true);
    document.getElementById('revoke-form').reset();
  } catch (err) {
    console.error(err);
    showStatus('revoke-status', err.reason || 'Failed to revoke certificate.', false);
  }
});

// Admin: Batch Issue (Merkle)
document.getElementById('batch-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!contract) return alert('Please connect wallet first.');

  const fileInput = document.getElementById('csv-file');
  if (fileInput.files.length === 0) return alert('Please select a CSV file.');

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async function(event) {
    const text = event.target.result;
    const lines = text.split('\n').filter(line => line.trim() !== '');
    
    const ids = [];
    const names = [];
    const courses = [];
    const insts = [];
    const hashes = [];

    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(',').map(s => s.trim());
      if (parts.length >= 4) {
        const id = parts[0];
        const name = parts[1];
        const course = parts[2];
        const inst = parts[3];
        
        const dataString = id + name + course + inst;
        const hash = await generateHash(dataString);

        ids.push(id);
        names.push(name);
        courses.push(course);
        insts.push(inst);
        hashes.push(hash);
      }
    }

    if (ids.length === 0) {
      showStatus('batch-status', 'No valid rows found in CSV.', false);
      return;
    }

    try {
      showStatus('batch-status', `Batch processing ${ids.length} certificates. Building Merkle Tree...`, true);
      document.getElementById('batch-status').style.display = 'block';

      const leafNodes = hashes.map(h => ethers.keccak256(ethers.toUtf8Bytes(h)));
      const tree = new MerkleTree(leafNodes, ethers.keccak256, { sortPairs: true });
      const root = tree.getHexRoot();
      const batchId = "BATCH-" + Date.now();

      const tx = await contract.registerBatchRoot(batchId, root);
      await tx.wait();

      const output = { batchId: batchId, certificates: {} };
      for (let i = 0; i < ids.length; i++) {
        output.certificates[ids[i]] = {
          name: names[i],
          course: courses[i],
          inst: insts[i],
          hash: hashes[i],
          proof: tree.getHexProof(leafNodes[i])
        };
      }

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(output, null, 2));
      const dlNode = document.createElement('a');
      dlNode.setAttribute("href", dataStr);
      dlNode.setAttribute("download", `batch_proofs_${batchId}.json`);
      document.body.appendChild(dlNode);
      dlNode.click();
      dlNode.remove();

      showStatus('batch-status', `Batch Issue successful! Batch ID: ${batchId}. Proofs downloaded.`, true);
      document.getElementById('batch-form').reset();
    } catch (err) {
      console.error(err);
      showStatus('batch-status', err.reason || 'Failed to batch issue certificates.', false);
    }
  };
  reader.readAsText(file);
});

// Student: Fetch
document.getElementById('btn-student-back')?.addEventListener('click', () => {
  document.getElementById('cert-display').classList.add('hidden');
  document.getElementById('student-search-box').classList.remove('hidden');
});

document.getElementById('fetch-cert-btn').addEventListener('click', async () => {
  if (!contract) return alert('Please connect wallet first.');
  const id = document.getElementById('student-cert-id').value;
  try {
    const cert = await contract.getCertificate(id);
    if (cert[0] === '') {
      showStatus('student-status', 'Certificate not found.', false);
      return;
    }
    document.getElementById('display-id').innerText = cert[0];
    document.getElementById('display-name').innerText = cert[1];
    document.getElementById('display-course').innerText = cert[2];
    document.getElementById('display-inst').innerText = cert[3];
    document.getElementById('display-date').innerText = new Date(Number(cert[4]) * 1000).toLocaleDateString();

    const dataString = cert[0] + cert[1] + cert[2] + cert[3];
    const hash = await generateHash(dataString);
    
    const qrPayload = JSON.stringify({ id: cert[0], hash: hash });
    const canvas = document.getElementById('qrcode');
    QRCode.toCanvas(canvas, qrPayload, function (error) {
      if (error) console.error(error);
    });

    document.getElementById('student-search-box').classList.add('hidden');
    document.getElementById('cert-display').classList.remove('hidden');
    document.getElementById('student-status').style.display = 'none';
  } catch (err) {
    console.error(err);
    document.getElementById('cert-display').classList.add('hidden');
    showStatus('student-status', 'Certificate not found or invalid.', false);
  }
});

// Verifier: Spectacular Success State
async function triggerSpectacularSuccess(id, hash, certData = null) {
  try {
    let name = 'Unknown', course = 'Unknown', inst = 'Unknown';
    
    if (certData && certData.name) {
      name = certData.name;
      course = certData.course;
      inst = certData.inst;
    } else {
      try {
        const cert = await contract.getCertificate(id);
        name = cert[1];
        course = cert[2];
        inst = cert[3];
      } catch (err) {
        // Fallback for batch certificates if metadata wasn't provided in JSON
        name = 'Batch Record';
        course = 'Verified via Merkle Proof';
        inst = 'Blockchain Validated';
      }
    }

    document.getElementById('verify-display-name').innerText = name || 'Unknown';
    document.getElementById('verify-display-course').innerText = course || 'Unknown';
    document.getElementById('verify-display-inst').innerText = inst || 'Unknown';
    document.getElementById('verify-display-id').innerText = id;
    document.getElementById('verify-display-hash').innerText = hash;
    
    document.getElementById('verify-sec-single').classList.add('hidden');
    document.getElementById('verify-sec-batch').classList.add('hidden');
    document.getElementById('verify-sec-auto').classList.add('hidden');
    document.querySelector('.segmented-control').classList.add('hidden');
    
    document.getElementById('verifier-success-state').classList.remove('hidden');
  } catch (err) {
    console.error(err);
  }
}

document.getElementById('btn-verifier-back')?.addEventListener('click', () => {
  document.getElementById('verifier-success-state').classList.add('hidden');
  document.querySelector('.segmented-control').classList.remove('hidden');
  document.getElementById('verify-sec-single').classList.remove('hidden');
  document.getElementById('seg-single').classList.add('active');
  document.getElementById('seg-batch').classList.remove('active');
  document.getElementById('seg-auto').classList.remove('active');
});

// Verifier: Single
document.getElementById('verify-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!contract) return alert('Please connect wallet first.');
  const id = document.getElementById('verify-id').value;
  const hash = document.getElementById('verify-hash').value;
  try {
    const isValid = await contract.verifyCertificate(id, hash);
    if (isValid) {
      await triggerSpectacularSuccess(id, hash);
    } else {
      showStatus('verify-result', 'Invalid Certificate - Hash mismatch or certificate revoked.', false);
    }
  } catch (err) {
    console.error(err);
    showStatus('verify-result', 'Certificate not found in the registry.', false);
  }
});

// Verifier: Batch Manual
document.getElementById('verify-batch-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!contract) return alert('Please connect wallet first.');
  const batchId = document.getElementById('batch-verify-id').value;
  const hash = document.getElementById('batch-verify-hash').value;
  let proof;
  try { proof = JSON.parse(document.getElementById('batch-verify-proof').value); }
  catch(err) { return alert('Invalid Proof JSON array'); }
  try {
    const isValid = await contract.verifyMerkleCertificate(batchId, hash, proof);
    if (isValid) showStatus('verify-batch-result', 'Valid Certificate - Merkle Proof Verified.', true);
    else showStatus('verify-batch-result', 'Invalid Certificate - Proof failed.', false);
  } catch (err) {
    console.error(err);
    showStatus('verify-batch-result', 'Batch ID not found or error verifying.', false);
  }
});

// Verifier: Auto-JSON
document.getElementById('verify-json-file')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  const label = document.getElementById('verify-json-label');
  if (label && file) {
    label.innerText = file.name;
    label.style.color = "var(--accent-blue)";
  }
});

document.getElementById('btn-auto-verify').addEventListener('click', async () => {
  if (!contract) return alert("Connect Wallet first!");
  const fileInput = document.getElementById('verify-json-file');
  const certId = document.getElementById('verify-json-id').value.trim();
  if (!fileInput.files.length || !certId) {
    showStatus('verify-auto-result', 'Please upload the JSON file and enter a Certificate ID.', false);
    return;
  }
  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.batchId || !data.certificates || !data.certificates[certId]) {
        showStatus('verify-auto-result', `ID ${certId} not found in this JSON file.`, false);
        return;
      }
      const batchId = data.batchId;
      const certNode = data.certificates[certId];
      const hash = certNode.hash;
      const proof = certNode.proof;
      
      document.getElementById('batch-verify-id').value = batchId;
      document.getElementById('batch-verify-hash').value = hash;
      document.getElementById('batch-verify-proof').value = JSON.stringify(proof);
      
      showStatus('verify-auto-result', 'Checking blockchain... pending', true);
      const isValid = await contract.verifyMerkleCertificate(batchId, hash, proof);
      if (isValid) {
        await triggerSpectacularSuccess(certId, hash, {
          name: certNode.name,
          course: certNode.course,
          inst: certNode.inst
        });
      } else {
        showStatus('verify-auto-result', 'Invalid! Batch Certificate NOT Verified.', false);
      }
    } catch (err) {
      console.error(err);
      showStatus('verify-auto-result', 'Failed to read JSON or verify.', false);
    }
  };
  reader.readAsText(file);
});
