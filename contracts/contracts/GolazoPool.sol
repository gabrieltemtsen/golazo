// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─── OpenZeppelin v5 ──────────────────────────────────────────────────────────
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title  GolazoPool
 * @notice On-chain PARIMUTUEL prediction pools for the FIFA World Cup 2026
 *         knockout rounds, settled in Circles (CRC) on Gnosis Chain.
 *
 * Why parimutuel?
 * ───────────────
 * There is no house and no fixed odds. Every stake on a match flows into one
 * shared pool. When the match resolves, the entire pool is divided pro-rata
 * among everyone who backed the winning outcome. Odds are emergent — they are
 * just the live distribution of money across HOME / DRAW / AWAY — so the UI can
 * show "implied %" that moves in real time as the crowd bets. This is the
 * fairest design for a peer-to-peer crowd and needs no liquidity provider.
 *
 * Lifecycle of one match
 * ──────────────────────
 *  1. owner/oracle calls openMatch(matchId, kickoffTime).
 *  2. Fans call stake(matchId, outcome, amount, referrer) until kickoffTime.
 *     • amount CRC is pulled from the fan's wallet (ERC-20 transferFrom).
 *     • The fan's referrer is recorded on their FIRST EVER stake. If that fan
 *       is a brand-new wallet, the referrer earns an instant on-chain bounty
 *       from the sponsor pool (see "Referrals" below).
 *  3. After full time the oracle signs the result; anyone calls
 *     resolveMatch(matchId, result, signature).
 *  4. Winners call claim(matchId) to withdraw: their stake back + their
 *     pro-rata share of the losing side, minus a small protocol rake.
 *     If NOBODY backed the winning outcome (or the match is voided) every
 *     staker can withdraw their original stake in full.
 *
 * Circles primitives used
 * ───────────────────────
 * • Personal CRC tokens are the unit of account for every pool — the app is
 *   denominated entirely in Circles money, not a wrapper coin.
 * • Stakes are pulled from the user's Safe via the Circles trust graph
 *   (the miniapp builds the transfer with the Circles pathfinder, so a fan can
 *   pay even if they don't directly hold the pool's token).
 * • The referral system rewards exactly the action Circles cares about:
 *   an invite that lands a NEW wallet that becomes active in the app.
 *
 * Referrals (the viral loop, fully on-chain)
 * ──────────────────────────────────────────
 * • referrerOf[fan] is set once, on the fan's first stake.
 * • If the referred fan is new to Golazo, the referrer is immediately credited
 *   `newWalletBounty` CRC from `sponsorPool` and `referralCount[referrer]`
 *   increments — a verifiable "this invite landed a new active wallet" event.
 * • On every resolution, a slice of the protocol rake (`referralRakeBps`) is
 *   streamed to the referrers of the winners who generated it, so inviting
 *   active friends keeps paying out. Referrers withdraw via claimReferral().
 *
 * Security
 * ────────
 * • Result authenticity: ECDSA signature from `oracleSigner` over
 *   (matchId, result, chainId, address(this)) — domain-separated so a
 *   signature can't be replayed on another match, outcome, chain or contract.
 * • Re-entrancy: checks-effects-interactions everywhere + ReentrancyGuard.
 * • Pull payments: winnings and referral rewards are withdrawn by the
 *   beneficiary, never pushed in a loop, so one griefer can't block a pool.
 */
contract GolazoPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Types ──────────────────────────────────────────────────────────────────

    /// Outcome of a knockout match. Knockouts can't end level after ET, but a
    /// pool may settle DRAW if the bettable market is "result after 90'".
    enum Outcome { None, Home, Draw, Away }

    enum Status { None, Open, Resolved, Voided }

    struct Match {
        Status   status;
        Outcome  result;
        uint64   kickoffTime;            // staking closes at this timestamp
        uint256  totalPool;              // CRC staked across all outcomes
        uint256[4] outcomeTotal;         // CRC staked per Outcome (index by enum)
    }

    // ── Storage ────────────────────────────────────────────────────────────────

    /// The Circles ERC-20 (CRC) token every pool is denominated in.
    IERC20 public immutable crc;

    /// Backend wallet whose signature authenticates match results.
    address public oracleSigner;

    /// Wallet / Circles group that receives the protocol rake.
    address public feeRecipient;

    /// Protocol rake on the losing pool, in basis points (100 = 1%). Default 5%.
    uint256 public rakeBps = 500;
    uint256 public constant MAX_RAKE_BPS = 1000; // 10% hard cap

    /// Of the rake, the share streamed to winners' referrers (bps of the rake).
    uint256 public referralRakeBps = 2000; // 20% of the rake
    uint256 public constant MAX_REFERRAL_RAKE_BPS = 5000;

    /// Bounty paid to a referrer when their invite lands a brand-new wallet.
    uint256 public newWalletBounty;

    /// Sponsor-funded pot that pays new-wallet bounties.
    uint256 public sponsorPool;

    mapping(bytes32 => Match) private _matches;

    /// stake[matchId][user][outcome] = CRC the user has on that outcome.
    mapping(bytes32 => mapping(address => uint256[4])) private _stake;

    /// Has the user already claimed this match?
    mapping(bytes32 => mapping(address => bool)) public claimed;

    /// First-touch referrer of each fan (set once, immutable thereafter).
    mapping(address => address) public referrerOf;

    /// Has this wallet ever staked? Used to detect "new wallet" for bounties.
    mapping(address => bool) public hasPlayed;

    /// Verified invites that landed a new wallet, per referrer (leaderboard).
    mapping(address => uint256) public referralCount;

    /// Withdrawable referral earnings (bounties + rake stream), per referrer.
    mapping(address => uint256) public referralCredits;

    // ── Events ─────────────────────────────────────────────────────────────────

    event MatchOpened(bytes32 indexed matchId, uint64 kickoffTime);
    event Staked(
        bytes32 indexed matchId,
        address indexed user,
        Outcome outcome,
        uint256 amount,
        address indexed referrer
    );
    event MatchResolved(
        bytes32 indexed matchId,
        Outcome result,
        uint256 totalPool,
        uint256 winningPool
    );
    event MatchVoided(bytes32 indexed matchId);
    event Claimed(bytes32 indexed matchId, address indexed user, uint256 payout);
    event ReferralLanded(
        address indexed referrer,
        address indexed newWallet,
        uint256 bounty
    );
    event ReferralRakeAccrued(address indexed referrer, uint256 amount);
    event ReferralWithdrawn(address indexed referrer, uint256 amount);
    event SponsorDeposited(address indexed from, uint256 amount);

    event OracleSignerUpdated(address indexed previous, address indexed next);
    event FeeRecipientUpdated(address indexed previous, address indexed next);
    event RakeBpsUpdated(uint256 previous, uint256 next);
    event ReferralRakeBpsUpdated(uint256 previous, uint256 next);
    event NewWalletBountyUpdated(uint256 previous, uint256 next);

    // ── Errors ─────────────────────────────────────────────────────────────────

    error MatchExists(bytes32 matchId);
    error MatchNotFound(bytes32 matchId);
    error MatchNotOpen(bytes32 matchId);
    error MatchNotResolvable(bytes32 matchId);
    error StakingClosed(bytes32 matchId);
    error InvalidOutcome();
    error InvalidResult();
    error InvalidSignature();
    error ZeroStake();
    error ZeroAddress();
    error NothingToClaim();
    error AlreadyClaimed();
    error RakeTooHigh(uint256 requested, uint256 max);
    error ReferralRakeTooHigh(uint256 requested, uint256 max);
    error KickoffInPast();

    // ── Constructor ──────────────────────────────────────────────────────────────

    constructor(address _crc, address _oracleSigner, address _feeRecipient)
        Ownable(msg.sender)
    {
        if (_crc == address(0)) revert ZeroAddress();
        if (_oracleSigner == address(0)) revert ZeroAddress();
        if (_feeRecipient == address(0)) revert ZeroAddress();
        crc          = IERC20(_crc);
        oracleSigner = _oracleSigner;
        feeRecipient = _feeRecipient;
    }

    // ── Match lifecycle (oracle / owner) ─────────────────────────────────────────

    /**
     * @notice Open a new knockout match for staking.
     * @param matchId      keccak256 of your fixture id, e.g. keccak256("WC2026-R32-M01")
     * @param kickoffTime  Unix time at which staking closes (match kickoff).
     */
    function openMatch(bytes32 matchId, uint64 kickoffTime) external onlyOwner {
        if (_matches[matchId].status != Status.None) revert MatchExists(matchId);
        if (kickoffTime <= block.timestamp) revert KickoffInPast();

        Match storage m = _matches[matchId];
        m.status      = Status.Open;
        m.kickoffTime = kickoffTime;

        emit MatchOpened(matchId, kickoffTime);
    }

    /**
     * @notice Resolve a match with an oracle-signed result. Anyone may submit
     *         the signature once the backend has issued it.
     * @param matchId   The match to resolve.
     * @param result    Home, Draw or Away (the winning outcome).
     * @param signature ECDSA signature from oracleSigner over
     *                  keccak256(abi.encodePacked(matchId, uint8(result),
     *                  block.chainid, address(this))).
     *
     * If no CRC backed the winning outcome, the match is VOIDED and everyone
     * is refunded their stake (use resolveVoid for explicit cancellation).
     */
    function resolveMatch(bytes32 matchId, Outcome result, bytes calldata signature)
        external
        nonReentrant
    {
        Match storage m = _matches[matchId];
        if (m.status != Status.Open) revert MatchNotResolvable(matchId);
        if (result == Outcome.None) revert InvalidResult();

        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(
            keccak256(abi.encodePacked(matchId, uint8(result), block.chainid, address(this)))
        );
        if (ECDSA.recover(digest, signature) != oracleSigner) revert InvalidSignature();

        uint256 winningPool = m.outcomeTotal[uint8(result)];

        if (winningPool == 0) {
            // No winners — void the match so everyone can reclaim their stake.
            m.status = Status.Voided;
            emit MatchVoided(matchId);
            return;
        }

        m.status = Status.Resolved;
        m.result = result;

        emit MatchResolved(matchId, result, m.totalPool, winningPool);
    }

    /**
     * @notice Oracle/owner escape hatch: void a match (e.g. abandoned game).
     *         Everyone reclaims their original stake via claim().
     */
    function voidMatch(bytes32 matchId) external onlyOwner {
        Match storage m = _matches[matchId];
        if (m.status != Status.Open) revert MatchNotOpen(matchId);
        m.status = Status.Voided;
        emit MatchVoided(matchId);
    }

    // ── Fan actions ──────────────────────────────────────────────────────────────

    /**
     * @notice Stake CRC on an outcome of an open match.
     * @param matchId  The match.
     * @param outcome  Home, Draw or Away.
     * @param amount   CRC to stake (pulled from msg.sender).
     * @param referrer Who invited you. Recorded on your FIRST EVER stake only;
     *                 pass address(0) if none. Self-referral is ignored.
     */
    function stake(bytes32 matchId, Outcome outcome, uint256 amount, address referrer)
        external
        nonReentrant
    {
        Match storage m = _matches[matchId];
        if (m.status != Status.Open) revert MatchNotOpen(matchId);
        if (block.timestamp >= m.kickoffTime) revert StakingClosed(matchId);
        if (outcome == Outcome.None) revert InvalidOutcome();
        if (amount == 0) revert ZeroStake();

        // Pull the stake first; revert on failure keeps accounting honest.
        crc.safeTransferFrom(msg.sender, address(this), amount);

        // ── Referral attribution + new-wallet bounty (first stake only) ─────────
        bool isNewWallet = !hasPlayed[msg.sender];
        if (isNewWallet) {
            hasPlayed[msg.sender] = true;
            address ref = referrer;
            if (ref != address(0) && ref != msg.sender && referrerOf[msg.sender] == address(0)) {
                referrerOf[msg.sender] = ref;
                referralCount[ref] += 1;
                uint256 bounty = newWalletBounty;
                if (bounty > 0 && sponsorPool >= bounty) {
                    sponsorPool -= bounty;
                    referralCredits[ref] += bounty;
                    emit ReferralLanded(ref, msg.sender, bounty);
                } else {
                    emit ReferralLanded(ref, msg.sender, 0);
                }
            }
        }

        // ── Record the stake ────────────────────────────────────────────────────
        _stake[matchId][msg.sender][uint8(outcome)] += amount;
        m.outcomeTotal[uint8(outcome)] += amount;
        m.totalPool += amount;

        emit Staked(matchId, msg.sender, outcome, amount, referrerOf[msg.sender]);
    }

    /**
     * @notice Withdraw your payout for a resolved (or voided) match.
     *
     * Resolved: payout = yourWinningStake
     *                  + yourWinningStake / winningPool * (losingPool − rake)
     *           where rake = losingPool * rakeBps / 10000. A slice of the rake
     *           (referralRakeBps) is streamed to YOUR referrer; the remainder
     *           goes to feeRecipient.
     * Voided:   payout = sum of your stakes on every outcome (full refund).
     */
    function claim(bytes32 matchId) external nonReentrant {
        Match storage m = _matches[matchId];
        if (m.status != Status.Resolved && m.status != Status.Voided) {
            revert NothingToClaim();
        }
        if (claimed[matchId][msg.sender]) revert AlreadyClaimed();
        claimed[matchId][msg.sender] = true;

        uint256 payout;

        if (m.status == Status.Voided) {
            uint256[4] storage s = _stake[matchId][msg.sender];
            payout = s[1] + s[2] + s[3];
            if (payout == 0) revert NothingToClaim();
        } else {
            uint256 mine = _stake[matchId][msg.sender][uint8(m.result)];
            if (mine == 0) revert NothingToClaim();

            uint256 winningPool = m.outcomeTotal[uint8(m.result)];
            uint256 losingPool  = m.totalPool - winningPool;

            uint256 rake    = (losingPool * rakeBps) / 10_000;
            uint256 profit  = losingPool - rake;            // shared among winners
            uint256 myShare = (profit * mine) / winningPool; // pro-rata
            payout = mine + myShare;

            // Stream part of the rake this winner generated to their referrer.
            if (rake > 0) {
                uint256 myRakeContribution = (rake * mine) / winningPool;
                uint256 toReferrer = (myRakeContribution * referralRakeBps) / 10_000;
                address ref = referrerOf[msg.sender];
                if (toReferrer > 0 && ref != address(0)) {
                    referralCredits[ref] += toReferrer;
                    emit ReferralRakeAccrued(ref, toReferrer);
                    uint256 toProtocol = myRakeContribution - toReferrer;
                    if (toProtocol > 0) crc.safeTransfer(feeRecipient, toProtocol);
                } else {
                    crc.safeTransfer(feeRecipient, myRakeContribution);
                }
            }
        }

        crc.safeTransfer(msg.sender, payout);
        emit Claimed(matchId, msg.sender, payout);
    }

    // ── Referral / sponsor ─────────────────────────────────────────────────────

    /**
     * @notice Fund the sponsor pool that pays new-wallet referral bounties.
     *         Anyone (a sponsor, a DAO, the team) can top it up.
     */
    function depositSponsor(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroStake();
        crc.safeTransferFrom(msg.sender, address(this), amount);
        sponsorPool += amount;
        emit SponsorDeposited(msg.sender, amount);
    }

    /// @notice Withdraw your accumulated referral earnings.
    function claimReferral() external nonReentrant {
        uint256 amount = referralCredits[msg.sender];
        if (amount == 0) revert NothingToClaim();
        referralCredits[msg.sender] = 0;
        crc.safeTransfer(msg.sender, amount);
        emit ReferralWithdrawn(msg.sender, amount);
    }

    // ── Views ──────────────────────────────────────────────────────────────────

    function getMatch(bytes32 matchId)
        external
        view
        returns (
            Status status,
            Outcome result,
            uint64 kickoffTime,
            uint256 totalPool,
            uint256 homeTotal,
            uint256 drawTotal,
            uint256 awayTotal
        )
    {
        Match storage m = _matches[matchId];
        return (
            m.status,
            m.result,
            m.kickoffTime,
            m.totalPool,
            m.outcomeTotal[uint8(Outcome.Home)],
            m.outcomeTotal[uint8(Outcome.Draw)],
            m.outcomeTotal[uint8(Outcome.Away)]
        );
    }

    /// @notice A user's stake on each outcome of a match: [home, draw, away].
    function getUserStake(bytes32 matchId, address user)
        external
        view
        returns (uint256 home, uint256 draw, uint256 away)
    {
        uint256[4] storage s = _stake[matchId][user];
        return (s[uint8(Outcome.Home)], s[uint8(Outcome.Draw)], s[uint8(Outcome.Away)]);
    }

    /**
     * @notice Preview a winner's payout for a resolved match without claiming.
     *         Returns 0 if the match isn't resolved or the user didn't win.
     */
    function previewPayout(bytes32 matchId, address user)
        external
        view
        returns (uint256)
    {
        Match storage m = _matches[matchId];
        if (m.status == Status.Voided) {
            uint256[4] storage sv = _stake[matchId][user];
            return sv[1] + sv[2] + sv[3];
        }
        if (m.status != Status.Resolved) return 0;
        uint256 mine = _stake[matchId][user][uint8(m.result)];
        if (mine == 0) return 0;
        uint256 winningPool = m.outcomeTotal[uint8(m.result)];
        uint256 losingPool  = m.totalPool - winningPool;
        uint256 rake    = (losingPool * rakeBps) / 10_000;
        uint256 profit  = losingPool - rake;
        return mine + (profit * mine) / winningPool;
    }

    /// @notice Reconstruct the digest oracleSigner must sign for a result.
    function resultDigest(bytes32 matchId, Outcome result)
        external
        view
        returns (bytes32)
    {
        return MessageHashUtils.toEthSignedMessageHash(
            keccak256(abi.encodePacked(matchId, uint8(result), block.chainid, address(this)))
        );
    }

    // ── Admin ──────────────────────────────────────────────────────────────────

    function setOracleSigner(address _oracleSigner) external onlyOwner {
        if (_oracleSigner == address(0)) revert ZeroAddress();
        emit OracleSignerUpdated(oracleSigner, _oracleSigner);
        oracleSigner = _oracleSigner;
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        if (_feeRecipient == address(0)) revert ZeroAddress();
        emit FeeRecipientUpdated(feeRecipient, _feeRecipient);
        feeRecipient = _feeRecipient;
    }

    function setRakeBps(uint256 _rakeBps) external onlyOwner {
        if (_rakeBps > MAX_RAKE_BPS) revert RakeTooHigh(_rakeBps, MAX_RAKE_BPS);
        emit RakeBpsUpdated(rakeBps, _rakeBps);
        rakeBps = _rakeBps;
    }

    function setReferralRakeBps(uint256 _bps) external onlyOwner {
        if (_bps > MAX_REFERRAL_RAKE_BPS) revert ReferralRakeTooHigh(_bps, MAX_REFERRAL_RAKE_BPS);
        emit ReferralRakeBpsUpdated(referralRakeBps, _bps);
        referralRakeBps = _bps;
    }

    function setNewWalletBounty(uint256 _bounty) external onlyOwner {
        emit NewWalletBountyUpdated(newWalletBounty, _bounty);
        newWalletBounty = _bounty;
    }
}
