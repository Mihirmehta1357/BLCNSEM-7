const hre = require("hardhat");

async function main() {
    const Contract = await hre.ethers.getContractFactory("CertificateRegistry");
    const contract = Contract.attach("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");
    
    console.log("Calling issueCertificate...");
    try {
        const tx = await contract.issueCertificate(
            "CERT-2026-006",
            "Aditi Dubey",
            "B.E. Computer Engineering",
            "APSHIT UNIVERSITY",
            "0x1234567890123456789012345678901234567890123456789012345678901234"
        );
        const receipt = await tx.wait();
        console.log("Success! Tx hash:", receipt.hash);
    } catch (e) {
        console.error("Reverted:", e);
    }
}

main().catch(console.error);
