// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract SimpleGovernance is ReentrancyGuard {
    IERC20 public governanceToken;
    uint256 public mintTokensToParticipate = 1;
    address owner;

    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 startTime;
        uint256 endTime;
        bool executed;
        uint256 targetMintTokens;
        mapping(address => bool) hasVoted;
    }

    struct ProposalSummary {
        uint256 id;
        address proposer;
        string description;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 startTime;
        uint256 endTime;
        bool executed;
        uint256 targetMintTokens;
    }

    struct ActiveProposalTrack {
        uint256 id;
        uint256 endTime;
    }

    uint256 private minTime;

    address[] allowedUsers;

    mapping(uint256 => Proposal) private activeProposals; // For unexecuted proposals
    mapping(uint256 => ProposalSummary) private executedProposals; // For executed proposals

    uint256 private proposalCount; // Tracks total proposals created
    ActiveProposalTrack[] private activeProposalTracks;

    mapping(address => mapping(uint256 => uint256)) public holdings;
    mapping(address => uint256) public holdingsToRelease;

    event ProposalCreated(
        uint256 id,
        address proposer,
        string description,
        uint256 startTime,
        uint256 endTime,
        uint256 targetMintTokens
    );

    event VoteCast(
        address voter,
        uint256 proposalId,
        bool support,
        uint256 votes
    );
    event ProposalExecuted(
        uint256 id,
        bool passed,
        uint256 newMintTokensToParticipate
    );

    modifier onlyAllowedUser(address _user) {
        require(isAllowed(_user), "You are not permitted to create proposal");
        _;
    }
    modifier onlyOwner(address _user) {
        require(owner == _user, "Only Owner is allowed");
        _;
    }

    function transferOwnerShip(address _user) external  onlyOwner(msg.sender) {
        require(isAllowed(_user), "User is not allowed to be owner");
        owner = _user;
    }

    function addAllowedUser(address _user) external onlyOwner(msg.sender){
        allowedUsers.push(_user);
    }

    function removeAllowedUser(address _user) external onlyOwner(msg.sender){
        uint256 index = allowedUsers.length; // Start with an invalid index

        // Find the index of the proposal with the given ID
        for (uint256 i = 0; i < allowedUsers.length; i++) {
            if (allowedUsers[i] == _user) {
                index = i;
                break;
            }
        }

        if (index > allowedUsers.length) {
            return;
        }

        // Shift elements left to overwrite the deleted proposal
        if (index != allowedUsers.length) {
            for (uint256 j = index; j < allowedUsers.length - 1; j++) {
                allowedUsers[j] = allowedUsers[j + 1];
            }
        }

        allowedUsers.pop();
    }

    constructor(address _governanceToken) {
        governanceToken = IERC20(_governanceToken);
        allowedUsers.push(msg.sender);
        owner = msg.sender;
    }

    function isAllowed(address _user) internal view returns (bool) {
        for (uint256 i = 0; i < allowedUsers.length; i++) {
            address user = allowedUsers[i];
            if (user == _user) {
                return true;
            }
        }
        return false;
    }

    function tokenToRelease() external view returns (uint256){
        return holdingsToRelease[msg.sender];
    }

    function _addTokensToHolding(
        uint256 _amount,
        uint256 _proposalId,
        address _user
    ) internal {
        holdings[_user][_proposalId] = holdings[_user][_proposalId] == 0
            ? _amount
            : holdings[_user][_proposalId] + _amount;
    }

    function _addTokensToHoldingRelease(address _user, uint256 _proposalId)
        internal
    {
        holdingsToRelease[_user] = holdingsToRelease[_user] == 0
            ? holdings[_user][_proposalId]
            : holdingsToRelease[_user] + holdings[_user][_proposalId];
        holdings[_user][_proposalId] = 0;
    }

    function createProposal(
        string memory _description,
        uint256 _durationInMinutes,
        uint256 _targetMintTokens
    ) external onlyAllowedUser(msg.sender) nonReentrant {
        require(
            governanceToken.balanceOf(msg.sender) >= mintTokensToParticipate,
            "Insufficient tokens to create proposal"
        );

        // _autoExecuteExpiredProposals(); // Execute any expired proposals
        IERC20(governanceToken).transferFrom(
            msg.sender,
            address(this),
            mintTokensToParticipate
        );
        proposalCount++;
        uint256 endTime = block.timestamp + (_durationInMinutes * 1 minutes);

        Proposal storage newProposal = activeProposals[proposalCount];
        newProposal.id = proposalCount;
        newProposal.proposer = msg.sender;
        newProposal.description = _description;
        newProposal.startTime = block.timestamp;
        newProposal.endTime = endTime;
        newProposal.targetMintTokens = _targetMintTokens;

        _addProposalTrack(
            ActiveProposalTrack({id: proposalCount, endTime: endTime})
        );
        _addTokensToHolding(mintTokensToParticipate, proposalCount, msg.sender);
        if (minTime == 0 || minTime > endTime) {
            minTime = endTime;
        }
        emit ProposalCreated(
            proposalCount,
            msg.sender,
            _description,
            block.timestamp,
            endTime,
            _targetMintTokens
        );
    }

    function vote(
        uint256 _proposalId,
        bool _support,
        uint256 _amount
    ) external nonReentrant {
        Proposal storage proposal = activeProposals[_proposalId];
        require(
            block.timestamp >= proposal.startTime,
            "Voting has not started"
        );
        require(block.timestamp <= proposal.endTime, "Voting has ended");
        require(
            _amount >= proposal.targetMintTokens,
            "Insufficient tokens to vote"
        );
        require(!proposal.hasVoted[msg.sender], "You have already voted");

        uint256 voterWeight = _amount;
        IERC20(governanceToken).transferFrom(
            msg.sender,
            address(this),
            _amount
        );
        if (_support) {
            proposal.votesFor += voterWeight;
        } else {
            proposal.votesAgainst += voterWeight;
        }

        _addTokensToHolding(voterWeight, proposal.id, msg.sender);
        proposal.hasVoted[msg.sender] = true;
        emit VoteCast(msg.sender, _proposalId, _support, voterWeight);
    }

    function releaseTokens() external nonReentrant {
        require(holdingsToRelease[msg.sender] > 0, "No tokens to release");
        IERC20(governanceToken).transfer(
            msg.sender,
            holdingsToRelease[msg.sender]
        );
        delete holdingsToRelease[msg.sender];
    }

    function autoExecuteExpiredProposals() external nonReentrant {
        if (block.timestamp >= minTime) {
            _autoExecuteExpiredProposals(msg.sender); // Execute any expired proposals
            if (activeProposalTracks.length > 1) {
                minTime = activeProposalTracks[0].endTime;
            }
        }
    }

    function _autoExecuteExpiredProposals(address _user) public {
        for (uint256 i = 0; i < activeProposalTracks.length; i++) {
            ActiveProposalTrack storage proposalTrack = activeProposalTracks[i];
            if (proposalTrack.endTime <= block.timestamp) {
                Proposal storage proposal = activeProposals[proposalTrack.id];
                proposal.executed = true;
                bool passed = proposal.votesFor > proposal.votesAgainst;
                if (passed) {
                    mintTokensToParticipate = proposal.targetMintTokens;
                }

                executedProposals[proposal.id] = ProposalSummary({
                    id: proposal.id,
                    proposer: proposal.proposer,
                    description: proposal.description,
                    votesFor: proposal.votesFor,
                    votesAgainst: proposal.votesAgainst,
                    startTime: proposal.startTime,
                    endTime: proposal.endTime,
                    executed: proposal.executed,
                    targetMintTokens: proposal.targetMintTokens
                });

                _addTokensToHoldingRelease(_user, proposal.id);
                _deleteProposalTrack(proposal.id);

                delete activeProposals[proposal.id];
                emit ProposalExecuted(
                    proposal.id,
                    passed,
                    passed ? proposal.targetMintTokens : mintTokensToParticipate
                );
            } else {
                break;
            }
        }
    }

    function getAllowance() external view returns (uint256) {
        return IERC20(governanceToken).allowance(msg.sender, address(this));
    }

    function _addProposalTrack(ActiveProposalTrack memory newProposal)
        internal
    {
        uint256 index = activeProposalTracks.length;

        // Find the correct position to insert newProposal
        for (uint256 i = 0; i < activeProposalTracks.length; i++) {
            if (newProposal.endTime < activeProposalTracks[i].endTime) {
                index = i;
                break;
            }
        }

        // Insert the new proposal at the found index and shift the array elements
        activeProposalTracks.push(newProposal); // Add a temporary element to expand the array

        // Shift elements to the right to make space for the new proposal
        for (uint256 j = activeProposalTracks.length - 1; j > index; j--) {
            activeProposalTracks[j] = activeProposalTracks[j - 1];
        }

        activeProposalTracks[index] = newProposal; // Insert the new proposal at the correct position
    }

    function _deleteProposalTrack(uint256 proposalId) internal {
        uint256 index = activeProposalTracks.length; // Start with an invalid index

        // Find the index of the proposal with the given ID
        for (uint256 i = 0; i < activeProposalTracks.length; i++) {
            if (activeProposalTracks[i].id == proposalId) {
                index = i;
                break;
            }
        }

        if (index > activeProposalTracks.length) {
            return;
        }

        // Shift elements left to overwrite the deleted proposal
        if (index != activeProposalTracks.length) {
            for (uint256 j = index; j < activeProposalTracks.length - 1; j++) {
                activeProposalTracks[j] = activeProposalTracks[j + 1];
            }
        }

        activeProposalTracks.pop(); // Remove the last element which is now a duplicate
    }

    function getActiveProposals() external view returns (ProposalDTO[] memory) {
        ProposalDTO[] memory result = new ProposalDTO[](
            activeProposalTracks.length
        );

        for (uint256 i = 0; i < activeProposalTracks.length; i++) {
            uint256 proposalId = activeProposalTracks[i].id;
            if (proposalId == 0) {
                continue;
            }
            Proposal storage proposal = activeProposals[proposalId];
            result[i] = _toProposalDTO(proposal);
        }

        return result;
    }

    function _toProposalDTO(Proposal storage proposal)
        internal
        view
        returns (ProposalDTO memory)
    {
        return
            ProposalDTO({
                id: proposal.id,
                proposer: proposal.proposer,
                description: proposal.description,
                votesFor: proposal.votesFor,
                votesAgainst: proposal.votesAgainst,
                startTime: proposal.startTime,
                endTime: proposal.endTime,
                executed: proposal.executed,
                targetMintTokens: proposal.targetMintTokens,
                hasVoted: proposal.hasVoted[msg.sender]
            });
    }

    struct ProposalDTO {
        uint256 id;
        address proposer;
        string description;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 startTime;
        uint256 endTime;
        bool executed;
        uint256 targetMintTokens;
        bool hasVoted;
    }
}
