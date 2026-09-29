// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract CertificateRegistry {
    address public admin;

    struct Certificate {
        string certificateId;
        string studentName;
        string course;
        string institution;
        string certificateHash;
        uint256 issueDate;
        bool valid;
    }

    mapping(string => Certificate) private certificates;
    mapping(string => bool) private certificateExists;
    mapping(string => bytes32) public batchRoots;

    event CertificateIssued(string certificateId, string certificateHash);
    event CertificateRevoked(string certificateId);
    event BatchRootRegistered(string batchId, bytes32 merkleRoot);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function issueCertificate(
        string memory _id,
        string memory _name,
        string memory _course,
        string memory _institution,
        string memory _hash
    ) public onlyAdmin {
        require(!certificateExists[_id], "Certificate ID already exists");

        certificates[_id] = Certificate({
            certificateId: _id,
            studentName: _name,
            course: _course,
            institution: _institution,
            certificateHash: _hash,
            issueDate: block.timestamp,
            valid: true
        });

        certificateExists[_id] = true;
        emit CertificateIssued(_id, _hash);
    }

    function verifyCertificate(string memory _id, string memory _hash) public view returns (bool) {
        require(certificateExists[_id], "Certificate does not exist");
        Certificate memory cert = certificates[_id];
        
        if (!cert.valid) {
            return false;
        }

        // Compare the stored hash with the provided hash
        return (keccak256(abi.encodePacked(cert.certificateHash)) == keccak256(abi.encodePacked(_hash)));
    }

    function revokeCertificate(string memory _id) public onlyAdmin {
        require(certificateExists[_id], "Certificate does not exist");
        certificates[_id].valid = false;
        emit CertificateRevoked(_id);
    }

    function getCertificate(string memory _id) public view returns (
        string memory studentName,
        string memory course,
        string memory institution,
        string memory certificateHash,
        uint256 issueDate,
        bool valid
    ) {
        require(certificateExists[_id], "Certificate does not exist");
        Certificate memory cert = certificates[_id];
        return (
            cert.studentName,
            cert.course,
            cert.institution,
            cert.certificateHash,
            cert.issueDate,
            cert.valid
        );
    }

    function batchIssueCertificates(
        string[] memory _ids,
        string[] memory _names,
        string[] memory _courses,
        string[] memory _institutions,
        string[] memory _hashes
    ) public onlyAdmin {
        require(
            _ids.length == _names.length &&
            _ids.length == _courses.length &&
            _ids.length == _institutions.length &&
            _ids.length == _hashes.length,
            "Array lengths must match"
        );

        for (uint256 i = 0; i < _ids.length; i++) {
            string memory id = _ids[i];
            if (!certificateExists[id]) {
                certificates[id] = Certificate({
                    certificateId: id,
                    studentName: _names[i],
                    course: _courses[i],
                    institution: _institutions[i],
                    certificateHash: _hashes[i],
                    issueDate: block.timestamp,
                    valid: true
                });
                certificateExists[id] = true;
                emit CertificateIssued(id, _hashes[i]);
            }
        }
    }

    function registerBatchRoot(string memory _batchId, bytes32 _merkleRoot) public onlyAdmin {
        require(batchRoots[_batchId] == bytes32(0), "Batch ID already exists");
        batchRoots[_batchId] = _merkleRoot;
        emit BatchRootRegistered(_batchId, _merkleRoot);
    }

    function verifyMerkleCertificate(
        string memory _batchId, 
        string memory _hash, 
        bytes32[] calldata _proof
    ) public view returns (bool) {
        bytes32 root = batchRoots[_batchId];
        require(root != bytes32(0), "Batch ID not found");
        
        // Ensure leaf hash matches what the JS merkletree generates
        bytes32 leaf = keccak256(abi.encodePacked(_hash));
        
        return MerkleProof.verify(_proof, root, leaf);
    }
}
