// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title TwinyCampaign
 * @notice Manages campaigns and reward claims for the Twiny MVP.
 *         Deploy to Monad testnet with Foundry.
 *
 * Key design decisions (matching the architecture plan):
 *   - Owner registers campaigns with a reward pool and deadline.
 *   - Users claim once per campaign; contract verifies and pays.
 *   - Every successful claim emits RewardClaimed — Twiny UI listens for this.
 *   - No upgradability for MVP; keep it simple and auditable.
 */
contract TwinyCampaign {

    // ── Types ────────────────────────────────────────────────────
    struct Campaign {
        uint256 id;
        string  name;
        string  description;
        uint256 rewardPerUser;   // in wei (MON)
        uint256 maxClaims;
        uint256 claimCount;
        uint256 deadline;        // unix timestamp
        address owner;
        bool    active;
        string  riskLevel;       // "low" | "medium" | "high"
        uint256 estimatedMinutes;
    }

    // ── State ─────────────────────────────────────────────────────
    address public contractOwner;
    uint256 public campaignCount;

    mapping(uint256 => Campaign) public campaigns;
    // campaignId => userAddress => hasClaimed
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    // ── Events ────────────────────────────────────────────────────
    event CampaignRegistered(
        uint256 indexed campaignId,
        string  name,
        uint256 rewardPerUser,
        uint256 deadline
    );

    event RewardClaimed(
        uint256 indexed campaignId,
        address indexed user,
        uint256 amount,
        uint256 timestamp
    );

    event CampaignDeactivated(uint256 indexed campaignId);

    // ── Errors ────────────────────────────────────────────────────
    error NotOwner();
    error CampaignNotActive();
    error DeadlinePassed();
    error AlreadyClaimed();
    error MaxClaimsReached();
    error InsufficientFunds();
    error InvalidCampaign();
    error ZeroReward();

    // ── Modifiers ─────────────────────────────────────────────────
    modifier onlyOwner() {
        if (msg.sender != contractOwner) revert NotOwner();
        _;
    }

    // ── Constructor ───────────────────────────────────────────────
    constructor() {
        contractOwner = msg.sender;
    }

    // ── Owner functions ───────────────────────────────────────────

    /**
     * @notice Register a new campaign. Send MON along with the call
     *         to fund the reward pool (rewardPerUser * maxClaims).
     */
    function registerCampaign(
        string  calldata name,
        string  calldata description,
        uint256 rewardPerUser,
        uint256 maxClaims,
        uint256 deadline,
        string  calldata riskLevel,
        uint256 estimatedMinutes
    ) external payable returns (uint256 campaignId) {
        if (rewardPerUser == 0)                      revert ZeroReward();
        if (deadline <= block.timestamp)             revert DeadlinePassed();
        if (msg.value < rewardPerUser * maxClaims)   revert InsufficientFunds();

        campaignId = ++campaignCount;

        campaigns[campaignId] = Campaign({
            id:               campaignId,
            name:             name,
            description:      description,
            rewardPerUser:    rewardPerUser,
            maxClaims:        maxClaims,
            claimCount:       0,
            deadline:         deadline,
            owner:            msg.sender,
            active:           true,
            riskLevel:        riskLevel,
            estimatedMinutes: estimatedMinutes
        });

        emit CampaignRegistered(campaignId, name, rewardPerUser, deadline);
    }

    /**
     * @notice Deactivate a campaign and withdraw remaining funds.
     */
    function deactivateCampaign(uint256 campaignId) external {
        Campaign storage c = campaigns[campaignId];
        if (msg.sender != c.owner && msg.sender != contractOwner) revert NotOwner();
        c.active = false;

        uint256 remaining = c.rewardPerUser * (c.maxClaims - c.claimCount);
        if (remaining > 0) {
            (bool ok,) = payable(msg.sender).call{value: remaining}("");
            require(ok, "Transfer failed");
        }

        emit CampaignDeactivated(campaignId);
    }

    // ── User functions ────────────────────────────────────────────

    /**
     * @notice Claim the reward for a campaign.
     *         This is the function Twiny prepares and the user approves.
     *         Emits RewardClaimed — the UI listens for this event.
     */
    function claimReward(uint256 campaignId) external {
        if (campaignId == 0 || campaignId > campaignCount) revert InvalidCampaign();

        Campaign storage c = campaigns[campaignId];

        if (!c.active)                          revert CampaignNotActive();
        if (block.timestamp > c.deadline)       revert DeadlinePassed();
        if (hasClaimed[campaignId][msg.sender]) revert AlreadyClaimed();
        if (c.claimCount >= c.maxClaims)        revert MaxClaimsReached();

        hasClaimed[campaignId][msg.sender] = true;
        c.claimCount++;

        (bool ok,) = payable(msg.sender).call{value: c.rewardPerUser}("");
        require(ok, "Transfer failed");

        emit RewardClaimed(campaignId, msg.sender, c.rewardPerUser, block.timestamp);
    }

    // ── View functions ────────────────────────────────────────────

    /**
     * @notice Return all active campaigns.
     *         Twiny Opportunity Agent calls this to build the campaign list.
     */
    function getCampaigns() external view returns (Campaign[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 1; i <= campaignCount; i++) {
            if (campaigns[i].active && block.timestamp <= campaigns[i].deadline) {
                activeCount++;
            }
        }

        Campaign[] memory result = new Campaign[](activeCount);
        uint256 idx = 0;
        for (uint256 i = 1; i <= campaignCount; i++) {
            if (campaigns[i].active && block.timestamp <= campaigns[i].deadline) {
                result[idx++] = campaigns[i];
            }
        }
        return result;
    }

    /**
     * @notice Check if a user has already claimed a specific campaign.
     */
    function canClaim(uint256 campaignId, address user) external view returns (bool) {
        if (campaignId == 0 || campaignId > campaignCount) return false;
        Campaign storage c = campaigns[campaignId];
        return (
            c.active &&
            block.timestamp <= c.deadline &&
            !hasClaimed[campaignId][user] &&
            c.claimCount < c.maxClaims
        );
    }

    /**
     * @notice Contract balance (total reward pool remaining).
     */
    function poolBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
