import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { GolazoPool, MockCRC } from "../typechain-types";

// Outcome enum mirror
const HOME = 1;
const DRAW = 2;
const AWAY = 3;

const MATCH = ethers.keccak256(ethers.toUtf8Bytes("WC2026-R32-M01"));

/** Sign a result the way the off-chain oracle does. */
async function signResult(
  signer: HardhatEthersSigner,
  pool: GolazoPool,
  matchId: string,
  outcome: number
): Promise<string> {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const inner = ethers.solidityPackedKeccak256(
    ["bytes32", "uint8", "uint256", "address"],
    [matchId, outcome, chainId, await pool.getAddress()]
  );
  return signer.signMessage(ethers.getBytes(inner));
}

describe("GolazoPool", () => {
  let pool: GolazoPool;
  let crc: MockCRC;
  let owner: HardhatEthersSigner;
  let oracle: HardhatEthersSigner;
  let fee: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let carol: HardhatEthersSigner;
  let dave: HardhatEthersSigner;

  const ONE = ethers.parseEther("1");

  beforeEach(async () => {
    [owner, oracle, fee, alice, bob, carol, dave] = await ethers.getSigners();

    const Crc = await ethers.getContractFactory("MockCRC");
    crc = (await Crc.deploy()) as unknown as MockCRC;

    const Pool = await ethers.getContractFactory("GolazoPool");
    pool = (await Pool.deploy(
      await crc.getAddress(),
      oracle.address,
      fee.address
    )) as unknown as GolazoPool;

    // Fund players and approve the pool.
    for (const p of [alice, bob, carol, dave]) {
      await crc.mint(p.address, ethers.parseEther("1000"));
      await crc.connect(p).approve(await pool.getAddress(), ethers.MaxUint256);
    }
  });

  async function openDefaultMatch(secondsAhead = 3600) {
    const kickoff = (await time.latest()) + secondsAhead;
    await pool.openMatch(MATCH, kickoff);
    return kickoff;
  }

  describe("deployment", () => {
    it("wires constructor args", async () => {
      expect(await pool.crc()).to.equal(await crc.getAddress());
      expect(await pool.oracleSigner()).to.equal(oracle.address);
      expect(await pool.feeRecipient()).to.equal(fee.address);
      expect(await pool.rakeBps()).to.equal(500);
    });

    it("rejects zero addresses", async () => {
      const Pool = await ethers.getContractFactory("GolazoPool");
      await expect(
        Pool.deploy(ethers.ZeroAddress, oracle.address, fee.address)
      ).to.be.revertedWithCustomError(pool, "ZeroAddress");
    });
  });

  describe("openMatch", () => {
    it("opens a match (owner only)", async () => {
      const kickoff = (await time.latest()) + 3600;
      await expect(pool.openMatch(MATCH, kickoff))
        .to.emit(pool, "MatchOpened")
        .withArgs(MATCH, kickoff);
      const m = await pool.getMatch(MATCH);
      expect(m.status).to.equal(1); // Open
    });

    it("rejects non-owner", async () => {
      const kickoff = (await time.latest()) + 3600;
      await expect(
        pool.connect(alice).openMatch(MATCH, kickoff)
      ).to.be.revertedWithCustomError(pool, "OwnableUnauthorizedAccount");
    });

    it("rejects duplicate and past kickoff", async () => {
      const kickoff = (await time.latest()) + 3600;
      await pool.openMatch(MATCH, kickoff);
      await expect(pool.openMatch(MATCH, kickoff)).to.be.revertedWithCustomError(
        pool,
        "MatchExists"
      );
      await expect(
        pool.openMatch(ethers.keccak256(ethers.toUtf8Bytes("X")), 1)
      ).to.be.revertedWithCustomError(pool, "KickoffInPast");
    });
  });

  describe("staking", () => {
    it("records stake, pool totals and live odds", async () => {
      await openDefaultMatch();
      await pool.connect(alice).stake(MATCH, HOME, ONE * 3n, ethers.ZeroAddress);
      await pool.connect(bob).stake(MATCH, AWAY, ONE, ethers.ZeroAddress);

      const m = await pool.getMatch(MATCH);
      expect(m.totalPool).to.equal(ONE * 4n);
      expect(m.homeTotal).to.equal(ONE * 3n);
      expect(m.awayTotal).to.equal(ONE);

      const s = await pool.getUserStake(MATCH, alice.address);
      expect(s.home).to.equal(ONE * 3n);
    });

    it("pulls CRC from the staker", async () => {
      await openDefaultMatch();
      const before = await crc.balanceOf(alice.address);
      await pool.connect(alice).stake(MATCH, HOME, ONE * 10n, ethers.ZeroAddress);
      expect(before - (await crc.balanceOf(alice.address))).to.equal(ONE * 10n);
      expect(await crc.balanceOf(await pool.getAddress())).to.equal(ONE * 10n);
    });

    it("rejects zero stake, bad outcome, and closed staking", async () => {
      await openDefaultMatch();
      await expect(
        pool.connect(alice).stake(MATCH, HOME, 0, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(pool, "ZeroStake");
      await expect(
        pool.connect(alice).stake(MATCH, 0, ONE, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(pool, "InvalidOutcome");
    });

    it("rejects stake after kickoff", async () => {
      const kickoff = await openDefaultMatch(100);
      await time.increaseTo(kickoff + 1);
      await expect(
        pool.connect(alice).stake(MATCH, HOME, ONE, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(pool, "StakingClosed");
    });
  });

  describe("resolve + parimutuel payout", () => {
    it("pays winners pro-rata, takes rake, returns stake", async () => {
      await openDefaultMatch();
      // Home pool: alice 3, carol 1 (total 4). Away pool: bob 6 (the losers).
      await pool.connect(alice).stake(MATCH, HOME, ONE * 3n, ethers.ZeroAddress);
      await pool.connect(carol).stake(MATCH, HOME, ONE, ethers.ZeroAddress);
      await pool.connect(bob).stake(MATCH, AWAY, ONE * 6n, ethers.ZeroAddress);

      const sig = await signResult(oracle, pool, MATCH, HOME);
      await expect(pool.resolveMatch(MATCH, HOME, sig))
        .to.emit(pool, "MatchResolved")
        .withArgs(MATCH, HOME, ONE * 10n, ONE * 4n);

      // losingPool = 6, rake = 5% = 0.3, profit = 5.7 shared by home stakers.
      // alice share = 5.7 * 3/4 = 4.275; payout = 3 + 4.275 = 7.275
      const aBefore = await crc.balanceOf(alice.address);
      await pool.connect(alice).claim(MATCH);
      const aGain = (await crc.balanceOf(alice.address)) - aBefore;
      expect(aGain).to.equal(ethers.parseEther("7.275"));

      // carol share = 5.7 * 1/4 = 1.425; payout = 1 + 1.425 = 2.425
      const cBefore = await crc.balanceOf(carol.address);
      await pool.connect(carol).claim(MATCH);
      expect((await crc.balanceOf(carol.address)) - cBefore).to.equal(
        ethers.parseEther("2.425")
      );

      // feeRecipient got the whole rake (no referrers here) = 0.3
      expect(await crc.balanceOf(fee.address)).to.equal(ethers.parseEther("0.3"));
    });

    it("loser cannot claim", async () => {
      await openDefaultMatch();
      await pool.connect(alice).stake(MATCH, HOME, ONE, ethers.ZeroAddress);
      await pool.connect(bob).stake(MATCH, AWAY, ONE, ethers.ZeroAddress);
      const sig = await signResult(oracle, pool, MATCH, HOME);
      await pool.resolveMatch(MATCH, HOME, sig);
      await expect(pool.connect(bob).claim(MATCH)).to.be.revertedWithCustomError(
        pool,
        "NothingToClaim"
      );
    });

    it("prevents double claim", async () => {
      await openDefaultMatch();
      await pool.connect(alice).stake(MATCH, HOME, ONE, ethers.ZeroAddress);
      await pool.connect(bob).stake(MATCH, AWAY, ONE, ethers.ZeroAddress);
      await pool.resolveMatch(MATCH, HOME, await signResult(oracle, pool, MATCH, HOME));
      await pool.connect(alice).claim(MATCH);
      await expect(pool.connect(alice).claim(MATCH)).to.be.revertedWithCustomError(
        pool,
        "AlreadyClaimed"
      );
    });

    it("previewPayout matches the real claim", async () => {
      await openDefaultMatch();
      await pool.connect(alice).stake(MATCH, HOME, ONE * 2n, ethers.ZeroAddress);
      await pool.connect(bob).stake(MATCH, AWAY, ONE * 5n, ethers.ZeroAddress);
      await pool.resolveMatch(MATCH, HOME, await signResult(oracle, pool, MATCH, HOME));
      const preview = await pool.previewPayout(MATCH, alice.address);
      const before = await crc.balanceOf(alice.address);
      await pool.connect(alice).claim(MATCH);
      expect((await crc.balanceOf(alice.address)) - before).to.equal(preview);
    });
  });

  describe("oracle signature security", () => {
    it("rejects a forged (non-oracle) signature", async () => {
      await openDefaultMatch();
      await pool.connect(alice).stake(MATCH, HOME, ONE, ethers.ZeroAddress);
      const forged = await signResult(alice, pool, MATCH, HOME); // not the oracle
      await expect(
        pool.resolveMatch(MATCH, HOME, forged)
      ).to.be.revertedWithCustomError(pool, "InvalidSignature");
    });

    it("rejects a signature for a different outcome (no replay)", async () => {
      await openDefaultMatch();
      await pool.connect(alice).stake(MATCH, HOME, ONE, ethers.ZeroAddress);
      const sigForAway = await signResult(oracle, pool, MATCH, AWAY);
      await expect(
        pool.resolveMatch(MATCH, HOME, sigForAway)
      ).to.be.revertedWithCustomError(pool, "InvalidSignature");
    });

    it("rejects a signature from another match", async () => {
      await openDefaultMatch();
      await pool.connect(alice).stake(MATCH, HOME, ONE, ethers.ZeroAddress);
      const otherMatch = ethers.keccak256(ethers.toUtf8Bytes("WC2026-R32-M02"));
      const sig = await signResult(oracle, pool, otherMatch, HOME);
      await expect(
        pool.resolveMatch(MATCH, HOME, sig)
      ).to.be.revertedWithCustomError(pool, "InvalidSignature");
    });
  });

  describe("void / no-winner refunds", () => {
    it("auto-voids when nobody backed the winning outcome", async () => {
      await openDefaultMatch();
      await pool.connect(alice).stake(MATCH, HOME, ONE, ethers.ZeroAddress);
      await pool.connect(bob).stake(MATCH, DRAW, ONE, ethers.ZeroAddress);
      // Result AWAY — nobody picked it.
      await expect(
        pool.resolveMatch(MATCH, AWAY, await signResult(oracle, pool, MATCH, AWAY))
      ).to.emit(pool, "MatchVoided");

      const before = await crc.balanceOf(alice.address);
      await pool.connect(alice).claim(MATCH);
      expect((await crc.balanceOf(alice.address)) - before).to.equal(ONE);
    });

    it("owner can void and everyone is refunded their full stake", async () => {
      await openDefaultMatch();
      await pool.connect(alice).stake(MATCH, HOME, ONE * 2n, ethers.ZeroAddress);
      await pool.connect(alice).stake(MATCH, AWAY, ONE, ethers.ZeroAddress);
      await pool.voidMatch(MATCH);
      const before = await crc.balanceOf(alice.address);
      await pool.connect(alice).claim(MATCH);
      expect((await crc.balanceOf(alice.address)) - before).to.equal(ONE * 3n);
    });
  });

  describe("referrals", () => {
    beforeEach(async () => {
      // Sponsor funds the bounty pool and owner sets the bounty.
      await crc.mint(owner.address, ethers.parseEther("100"));
      await crc.connect(owner).approve(await pool.getAddress(), ethers.MaxUint256);
      await pool.connect(owner).depositSponsor(ethers.parseEther("100"));
      await pool.setNewWalletBounty(ethers.parseEther("5"));
    });

    it("pays a bounty + counts the referral when an invite lands a NEW wallet", async () => {
      await openDefaultMatch();
      // alice (referrer) invites bob (new wallet) who makes his first stake.
      await expect(
        pool.connect(bob).stake(MATCH, HOME, ONE, alice.address)
      )
        .to.emit(pool, "ReferralLanded")
        .withArgs(alice.address, bob.address, ethers.parseEther("5"));

      expect(await pool.referrerOf(bob.address)).to.equal(alice.address);
      expect(await pool.referralCount(alice.address)).to.equal(1);
      expect(await pool.referralCredits(alice.address)).to.equal(ethers.parseEther("5"));
      expect(await pool.sponsorPool()).to.equal(ethers.parseEther("95"));

      // alice withdraws the bounty.
      const before = await crc.balanceOf(alice.address);
      await pool.connect(alice).claimReferral();
      expect((await crc.balanceOf(alice.address)) - before).to.equal(ethers.parseEther("5"));
    });

    it("only the FIRST stake sets the referrer; later refs are ignored", async () => {
      await openDefaultMatch();
      await pool.connect(bob).stake(MATCH, HOME, ONE, alice.address);
      // bob stakes again naming carol — should not change anything.
      await pool.connect(bob).stake(MATCH, AWAY, ONE, carol.address);
      expect(await pool.referrerOf(bob.address)).to.equal(alice.address);
      expect(await pool.referralCount(carol.address)).to.equal(0);
    });

    it("ignores self-referral and zero referrer", async () => {
      await openDefaultMatch();
      await pool.connect(bob).stake(MATCH, HOME, ONE, bob.address);
      expect(await pool.referrerOf(bob.address)).to.equal(ethers.ZeroAddress);
      expect(await pool.referralCount(bob.address)).to.equal(0);
    });

    it("streams part of the rake to the referrer when a referee wins", async () => {
      await openDefaultMatch();
      // bob referred by alice. bob backs HOME (winner), dave backs AWAY (loser).
      await pool.connect(bob).stake(MATCH, HOME, ONE * 4n, alice.address);
      await pool.connect(dave).stake(MATCH, AWAY, ONE * 10n, ethers.ZeroAddress);

      await pool.resolveMatch(MATCH, HOME, await signResult(oracle, pool, MATCH, HOME));

      // losingPool = 10, rake = 5% = 0.5. bob is the only winner so his
      // rake contribution = 0.5. referralRakeBps = 20% -> 0.1 to alice.
      const refCreditsBefore = await pool.referralCredits(alice.address); // = bounty 5
      await pool.connect(bob).claim(MATCH);
      const accrued = (await pool.referralCredits(alice.address)) - refCreditsBefore;
      expect(accrued).to.equal(ethers.parseEther("0.1"));
      // feeRecipient got the remaining 0.4 of the rake.
      expect(await crc.balanceOf(fee.address)).to.equal(ethers.parseEther("0.4"));
    });

    it("emits a zero bounty when the sponsor pool is empty but still counts", async () => {
      // Drain bounty: set bounty above sponsor pool.
      await pool.setNewWalletBounty(ethers.parseEther("1000"));
      await openDefaultMatch();
      await expect(pool.connect(bob).stake(MATCH, HOME, ONE, alice.address))
        .to.emit(pool, "ReferralLanded")
        .withArgs(alice.address, bob.address, 0);
      expect(await pool.referralCount(alice.address)).to.equal(1);
    });
  });

  describe("admin", () => {
    it("enforces rake caps", async () => {
      await expect(pool.setRakeBps(1001)).to.be.revertedWithCustomError(
        pool,
        "RakeTooHigh"
      );
      await pool.setRakeBps(800);
      expect(await pool.rakeBps()).to.equal(800);
    });

    it("rotates oracle signer", async () => {
      await pool.setOracleSigner(dave.address);
      expect(await pool.oracleSigner()).to.equal(dave.address);
    });

    it("gates admin behind owner", async () => {
      await expect(
        pool.connect(alice).setRakeBps(100)
      ).to.be.revertedWithCustomError(pool, "OwnableUnauthorizedAccount");
    });
  });
});
