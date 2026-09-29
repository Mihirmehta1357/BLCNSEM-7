const fs = require('fs');
const artifact = require('./backend/artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json');
const mainPath = './frontend/src/main.js';
let mainJs = fs.readFileSync(mainPath, 'utf8');

// Replace address
mainJs = mainJs.replace(/export const contractAddress = ".*";/, 'export const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";');

// Replace ABI by finding export const contractABI = [ ... ];
mainJs = mainJs.replace(/export const contractABI = .*?;/, 'export const contractABI = ' + JSON.stringify(artifact.abi) + ';');

fs.writeFileSync(mainPath, mainJs);
console.log('main.js updated with ABI and address');
