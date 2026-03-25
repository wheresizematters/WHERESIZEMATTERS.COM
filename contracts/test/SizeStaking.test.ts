import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { SizeStaking } from "../typechain-types";

// Helper: parse $SIZE amounts (18 decimals)
const SIZE = (n: number) => ethers.parseEther(n.toString());

describe("SizeStaking", function () {
  async function deployFixture() {
    const [owner, alice, bob, charlie, depositor] = await ethers.getSigners();

    // Deploy mock ERC-20 token
    const MockToken = await ethers.getContractFactory("MockERC20");
    const token = await MockToken.deploy("SIZE", "SIZE", ethers.parseEther("100000000000")); // 100B
    await token.waitForDeployment();

    // Deploy staking contract
    const SizeStaking = await ethers.getContractFactory("SizeStaking");
    const staking = await SizeStaking.deploy(await token.getAddress());
    await staking.waitForDeployment();

    // Fund test accounts with $SIZE
    const stakingAddr = await staking.getAddress();
    for (const user of [alice, bob, charlie, depositor]) {
      await token.transfer(user.address, SIZE(500_000_000)); // 500M each
    }

    // Approve staking contract for all users
    for (const user of [alice, bob, charlie, depositor]) {
      await token.connect(user).approve(stakingAddr, ethers.MaxUint256);
    }
    await token.approve(stakingAddr, ethers.MaxUint256); // owner too

    // Add depositor role
    await staking.setDepositor(depositor.address, true);

    return { staking, token, owner, alice, bob, charlie, depositor };
  }

  // ── Staking ──────────────────────────────────────────────────────

  describe("stake()", function () {
    it("reverts on zero amount", async function () {
      const { staking, alice } = await loadFixture(deployFixture);
      await expect(staking.connect(alice).stake(0)).to.be.revertedWithCustomError(staking, "ZeroAmount");
    });

    it("reverts below Grower minimum", async function () {
      const { staking, alice } = await loadFixture(deployFixture);
      await expect(staking.connect(alice).stake(SIZE(50_000)))
        .to.be.revertedWithCustomError(staking, "BelowMinimumTier");
    });

    it("stakes at Grower tier", async function () {
      const { staking, alice } = await loadFixture(deployFixture);
      await staking.connect(alice).stake(SIZE(100_000));

      const info = await staking.getStakeInfo(alice.address);
      expect(info.stakedAmount).to.equal(SIZE(100_000));
      expect(info.tier).to.equal(1n); // Grower
      expect(info.boost).to.equal(10_000n); // 1x
    });

    it("stakes at Shower tier", async function () {
      const { staking, alice } = await loadFixture(deployFixture);
      await staking.connect(alice).stake(SIZE(1_000_000));

      const info = await staking.getStakeInfo(alice.address);
      expect(info.tier).to.equal(2n); // Shower
      expect(info.boost).to.equal(20_000n); // 2x
    });

    it("stakes at Shlong tier", async function () {
      const { staking, alice } = await loadFixture(deployFixture);
      await staking.connect(alice).stake(SIZE(10_000_000));

      const info = await staking.getStakeInfo(alice.address);
      expect(info.tier).to.equal(3n); // Shlong
      expect(info.boost).to.equal(50_000n); // 5x
    });

    it("stakes at Whale tier", async function () {
      const { staking, alice } = await loadFixture(deployFixture);
      await staking.connect(alice).stake(SIZE(100_000_000));

      const info = await staking.getStakeInfo(alice.address);
      expect(info.tier).to.equal(4n); // Whale
      expect(info.boost).to.equal(120_000n); // 12x
    });

    it("upgrades tier on additional stake", async function () {
      const { staking, alice } = await loadFixture(deployFixture);
      await staking.connect(alice).stake(SIZE(100_000)); // Grower
      expect((await staking.getStakeInfo(alice.address)).tier).to.equal(1n);

      await staking.connect(alice).stake(SIZE(900_000)); // Now 1M = Shower
      expect((await staking.getStakeInfo(alice.address)).tier).to.equal(2n);
    });

    it("updates totalStaked and totalEffectiveStaked", async function () {
      const { staking, alice, bob } = await loadFixture(deployFixture);
      await staking.connect(alice).stake(SIZE(1_000_000)); // Shower: 2x
      await staking.connect(bob).stake(SIZE(100_000_000)); // Whale: 12x

      expect(await staking.totalStaked()).to.equal(SIZE(101_000_000));
      // effective: 1M*2 + 100M*12 = 2M + 1.2B = 1.202B
      expect(await staking.totalEffectiveStaked()).to.equal(SIZE(1_202_000_000));
    });

    it("emits Staked event", async function () {
      const { staking, alice } = await loadFixture(deployFixture);
      await expect(staking.connect(alice).stake(SIZE(100_000)))
        .to.emit(staking, "Staked")
        .withArgs(alice.address, SIZE(100_000), 1n);
    });

    it("reverts when paused", async function () {
      const { staking, alice, owner } = await loadFixture(deployFixture);
      await staking.connect(owner).pause();
      await expect(staking.connect(alice).stake(SIZE(100_000))).to.be.revertedWithCustomError(staking, "EnforcedPause");
    });
  });

  // ── Unstaking ────────────────────────────────────────────────────

  describe("unstake()", function () {
    it("reverts on zero amount", async function () {
      const { staking, alice } = await loadFixture(deployFixture);
      await staking.connect(alice).stake(SIZE(1_000_000));
      await expect(staking.connect(alice).unstake(0)).to.be.revertedWithCustomError(staking, "ZeroAmount");
    });

    it("reverts if exceeds staked amount", async function () {
      const { staking, alice } = await loadFixture(deployFixture);
      await staking.connect(alice).stake(SIZE(1_000_000));
      await expect(staking.connect(alice).unstake(SIZE(2_000_000)))
        .to.be.revertedWithCustomError(staking, "ExceedsStake");
    });

    it("forces full unstake if remaining drops below Grower min", async function () {
      const { staking, token, alice } = await loadFixture(deployFixture);
      await staking.connect(alice).stake(SIZE(200_000));

      const balBefore = await token.balanceOf(alice.address);
      // Try to unstake 150K — remaining would be 50K < 100K, so full unstake
      await staking.connect(alice).unstake(SIZE(150_000));
      const balAfter = await token.balanceOf(alice.address);

      // Should get all 200K back (forced full unstake)
      expect(balAfter - balBefore).to.equal(SIZE(200_000));
      expect((await staking.getStakeInfo(alice.address)).stakedAmount).to.equal(0n);
    });

    it("partial unstake within tier works", async function () {
      const { staking, alice } = await loadFixture(deployFixture);
      await staking.connect(alice).stake(SIZE(5_000_000)); // Shower
      await staking.connect(alice).unstake(SIZE(2_000_000)); // Still 3M = Shower

      const info = await staking.getStakeInfo(alice.address);
      expect(info.stakedAmount).to.equal(SIZE(3_000_000));
      expect(info.tier).to.equal(2n); // Still Shower
    });

    it("emits Unstaked event", async function () {
      const { staking, alice } = await loadFixture(deployFixture);
      await staking.connect(alice).stake(SIZE(1_000_000));
      await expect(staking.connect(alice).unstake(SIZE(500_000)))
        .to.emit(staking, "Unstaked");
    });
  });

  // ── Rewards ──────────────────────────────────────────────────────

  describe("rewards", function () {
    it("distributes proportionally to effective stake", async function () {
      const { staking, alice, bob, depositor } = await loadFixture(deployFixture);

      // Alice: 1M (Shower, 2x) — effective = 2M
      await staking.connect(alice).stake(SIZE(1_000_000));
      // Bob: 100M (Whale, 12x) — effective = 1.2B
      await staking.connect(bob).stake(SIZE(100_000_000));

      // Deposit 1,202,000 rewards (easy math: 1 per effective token)
      await staking.connect(depositor).depositRewards(SIZE(1_202_000));

      const aliceInfo = await staking.getStakeInfo(alice.address);
      const bobInfo = await staking.getStakeInfo(bob.address);

      // Alice effective = 2M / 1.202B total = ~0.166% → ~2000 tokens
      // Bob effective = 1.2B / 1.202B total = ~99.83% → ~1,200,000 tokens
      // Allow 1 token rounding tolerance
      expect(aliceInfo.pendingRewards).to.be.closeTo(SIZE(2_000), SIZE(1));
      expect(bobInfo.pendingRewards).to.be.closeTo(SIZE(1_200_000), SIZE(1));
    });

    it("whales get disproportionately more than growers", async function () {
      const { staking, alice, bob, depositor } = await loadFixture(deployFixture);

      // Alice: Grower (100K, 1x boost) — effective 100K
      await staking.connect(alice).stake(SIZE(100_000));
      // Bob: Whale (100M, 12x boost) — effective 1.2B
      await staking.connect(bob).stake(SIZE(100_000_000));

      await staking.connect(depositor).depositRewards(SIZE(1_000_000));

      const aliceInfo = await staking.getStakeInfo(alice.address);
      const bobInfo = await staking.getStakeInfo(bob.address);

      // Bob should get ~12,000x more rewards than Alice
      // (1.2B / 100K = 12,000 ratio)
      expect(bobInfo.pendingRewards).to.be.gt(aliceInfo.pendingRewards * 10_000n);
    });

    it("claim transfers rewards and resets pending", async function () {
      const { staking, token, alice, depositor } = await loadFixture(deployFixture);
      await staking.connect(alice).stake(SIZE(1_000_000));
      await staking.connect(depositor).depositRewards(SIZE(100_000));

      const balBefore = await token.balanceOf(alice.address);
      await staking.connect(alice).claimRewards();
      const balAfter = await token.balanceOf(alice.address);

      expect(balAfter - balBefore).to.equal(SIZE(100_000));
      expect((await staking.getStakeInfo(alice.address)).pendingRewards).to.equal(0n);
    });

    it("reverts claim when nothing to claim", async function () {
      const { staking, alice } = await loadFixture(deployFixture);
      await staking.connect(alice).stake(SIZE(1_000_000));
      await expect(staking.connect(alice).claimRewards())
        .to.be.revertedWithCustomError(staking, "NothingToClaim");
    });

    it("buffers rewards when no stakers, distributes when first staker arrives", async function () {
      const { staking, depositor, alice } = await loadFixture(deployFixture);

      // Deposit with no stakers
      await staking.connect(depositor).depositRewards(SIZE(500_000));
      expect(await staking.bufferedRewards()).to.equal(SIZE(500_000));

      // First staker gets the buffered rewards
      await staking.connect(alice).stake(SIZE(1_000_000));
      expect(await staking.bufferedRewards()).to.equal(0n);

      const info = await staking.getStakeInfo(alice.address);
      expect(info.pendingRewards).to.equal(SIZE(500_000));
    });

    it("multiple deposits accumulate correctly", async function () {
      const { staking, alice, depositor } = await loadFixture(deployFixture);
      await staking.connect(alice).stake(SIZE(1_000_000));

      await staking.connect(depositor).depositRewards(SIZE(100_000));
      await staking.connect(depositor).depositRewards(SIZE(200_000));
      await staking.connect(depositor).depositRewards(SIZE(300_000));

      const info = await staking.getStakeInfo(alice.address);
      expect(info.pendingRewards).to.equal(SIZE(600_000));
    });
  });

  // ── Depositor Access ─────────────────────────────────────────────

  describe("depositor role", function () {
    it("non-depositor cannot deposit", async function () {
      const { staking, charlie } = await loadFixture(deployFixture);
      await expect(staking.connect(charlie).depositRewards(SIZE(100)))
        .to.be.revertedWithCustomError(staking, "NotDepositor");
    });

    it("owner can always deposit", async function () {
      const { staking, owner, alice } = await loadFixture(deployFixture);
      await staking.connect(alice).stake(SIZE(100_000));
      await expect(staking.connect(owner).depositRewards(SIZE(100))).to.not.be.reverted;
    });

    it("owner can add/remove depositors", async function () {
      const { staking, owner, charlie, alice } = await loadFixture(deployFixture);
      await staking.connect(alice).stake(SIZE(100_000));

      await staking.connect(owner).setDepositor(charlie.address, true);
      await expect(staking.connect(charlie).depositRewards(SIZE(100))).to.not.be.reverted;

      await staking.connect(owner).setDepositor(charlie.address, false);
      await expect(staking.connect(charlie).depositRewards(SIZE(100)))
        .to.be.revertedWithCustomError(staking, "NotDepositor");
    });
  });

  // ── Emergency ────────────────────────────────────────────────────

  describe("emergencyWithdraw()", function () {
    it("returns staked tokens and forfeits rewards", async function () {
      const { staking, token, alice, depositor } = await loadFixture(deployFixture);
      await staking.connect(alice).stake(SIZE(1_000_000));
      await staking.connect(depositor).depositRewards(SIZE(100_000));

      const balBefore = await token.balanceOf(alice.address);
      await staking.connect(alice).emergencyWithdraw();
      const balAfter = await token.balanceOf(alice.address);

      // Got staked amount back, but NOT the 100K rewards
      expect(balAfter - balBefore).to.equal(SIZE(1_000_000));
      const info = await staking.getStakeInfo(alice.address);
      expect(info.stakedAmount).to.equal(0n);
      expect(info.pendingRewards).to.equal(0n);
    });

    it("works even when paused", async function () {
      const { staking, alice, owner } = await loadFixture(deployFixture);
      await staking.connect(alice).stake(SIZE(1_000_000));
      await staking.connect(owner).pause();

      // Regular unstake blocked
      await expect(staking.connect(alice).unstake(SIZE(1_000_000)))
        .to.be.revertedWithCustomError(staking, "EnforcedPause");

      // Emergency withdraw still works
      await expect(staking.connect(alice).emergencyWithdraw()).to.not.be.reverted;
    });
  });

  // ── Pause ────────────────────────────────────────────────────────

  describe("pause", function () {
    it("only owner can pause/unpause", async function () {
      const { staking, alice } = await loadFixture(deployFixture);
      await expect(staking.connect(alice).pause()).to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount");
    });

    it("blocks stake/unstake/claim when paused", async function () {
      const { staking, alice, owner } = await loadFixture(deployFixture);
      await staking.connect(alice).stake(SIZE(1_000_000));
      await staking.connect(owner).pause();

      await expect(staking.connect(alice).stake(SIZE(100_000))).to.be.revertedWithCustomError(staking, "EnforcedPause");
      await expect(staking.connect(alice).unstake(SIZE(100_000))).to.be.revertedWithCustomError(staking, "EnforcedPause");
      await expect(staking.connect(alice).claimRewards()).to.be.revertedWithCustomError(staking, "EnforcedPause");
    });
  });
});
