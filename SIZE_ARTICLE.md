# SIZE.

A verification platform. A SocialFi economy. A very serious project about a very specific question: how big are you, really?

---

## The Premise

Let's be blunt.

SIZE. is a platform built around one idea. That people can be measured. Not by their bio, not by their profile picture, not by how loud they are in a group chat. By verifiable numbers that mean something. Your net worth, on-chain. Your audience, on X. Your $SIZE holdings. And yes, if you want to go there, your dick size too.

The last one probably made you think twice. Good. But it's not the point. It's just the most honest expression of what CT, masculinity, and late-stage capitalism is actually about: the things men have always measured themselves by, pulled out of the shadows and verified on-chain.

## A Note on the Name

We called it SIZE. because size is the thing nobody in the space will shut up about and nobody will admit to caring about.

Crypto is, at its core, a circle jerk. Everyone thinks their group chat is alpha (they're washed). Everyone thinks their community is the one that matters (probably not). Everyone is competing to be the biggest, the richest, the most connected, and almost nobody is willing to say that out loud. The status games are real. The hierarchy is real. The measuring is constant. It just usually happens behind closed doors, dressed up in whitepapers and governance forums and TG/Discord channels with names that sound serious (or racist).

We just made it literal.

We didn't build a platform that pretends. We built one that says the quiet part out loud and then builds real infrastructure around it.

And it turns out women care too. The leaderboard gets looked at. The verified badges get noticed. The tiers mean something socially, not just economically. SIZE. is one of the few platforms in crypto that is genuinely interesting to people who aren't already deep in the ecosystem, because the premise is human before it's financial. That's rare. That might be the rarest thing about it.

---

## The Problem We're Actually Solving

Every social platform has a bot problem. Every crypto platform has a sybil problem. They're the same problem: you don't know if the person on the other side of the screen is real, or if the numbers on their profile mean anything at all.

SIZE. is a verification platform first. Everything else — the token, the staking, the DickCoins, the Circle Jerks, the leaderboard — runs on top of real verified identity. You can't participate in the economy without proving who you are and what you actually have.

### What You Verify

**Net Worth** — Connect your wallets across Ethereum, Base, Arbitrum, Optimism, Polygon, BSC, Solana. Arkham Intelligence scans your full portfolio — every token, every chain, every position. Displayed in USD on your profile. Not self-reported. Not estimated. Pulled from the chain and stamped with a checkmark.

**X Clout** — Connect your X account. Follower count verified and displayed. The audience you built is part of your SIZE. identity. No yapping necessary.

**$SIZE Holdings** — Your token balance is on-chain and visible. The more you hold, the more it says about your commitment to the protocol. Designed to incentivize consolidation and hoarding.

**Dick Size** — Upload a photo with a reference object: ruler, credit card, dollar bill. An abliterated Qwen vision model runs a two-pass analysis with girth cross-check. The AI has seen everything. It is not impressed. It just returns the number. No human reviews the photos. We don't want to.

Each verification earns you $SIZE tokens. The platform rewards you for every dimension of yourself you're willing to put on the table.

---

## The Leaderboard

Once you're verified, you're on the board. Five dimensions of ranking:

$$\begin{array}{|l|l|}
\hline
\textbf{Leaderboard} & \textbf{Ranked By} \\
\hline
\text{Global} & \text{Verified size} \\
\text{Net Worth} & \text{On-chain portfolio value (USD)} \\
\text{Clout} & \text{X followers} \\
\text{DickCoins} & \text{Token trading volume} \\
\text{Holdings} & \text{\$SIZE balance} \\
\hline
\end{array}$$

The top three hold gold, silver, and bronze. Proof, sitting right there on the page, of where they stand among every verified human on the platform.

Being on the leaderboard isn't vanity. It's yield. The top 10 share 75% of the daily reward pool. Getting ranked pays.

---

## $SIZE — The Token

100 billion supply. ERC-20 on Base. Deployed via Clanker into a Uniswap V4 pool.

100% fair launch. No team allocation. No presale. No insider round. No vesting cliff. This isn't a promise — it's a structural reality. Clanker doesn't support team allocations. Every token in circulation is bought or earned. That's the only way tokens exist here.

### Fee Flow

1% fee on every swap. Split on-chain by smart contract:

$$\boxed{\text{Trade Executes on Uniswap} \rightarrow 1\% \text{ Fee Collected}}$$

$$\begin{array}{|l|r|l|}
\hline
\textbf{Recipient} & \textbf{Share} & \textbf{Destination} \\
\hline
\text{Creator (DickCoin)} & 90.0\% & \text{Creator wallet (instant)} \\
\text{Protocol} & 9.9\% & \text{Staking + Epoch rewards} \\
\text{Gas Subsidy} & 0.1\% & \text{Transaction subsidies} \\
\hline
\end{array}$$

The protocol's 9.9% splits further:

$$R_{\text{stakers}} = F_{\text{protocol}} \times 0.75$$

$$R_{\text{epoch}} = F_{\text{protocol}} \times 0.25$$

These rewards aren't emissions. They're not printed. They're fees from real volume, returned to the people who believed early enough to lock their tokens. No governance vote. No multisig discretion. Volume in, rewards out.

### The Math

Given daily trading volume $V$, ETH price $P_E$, and $SIZE price $P_S$:

$$\text{staker\_pool} = \frac{V \times 0.01 \times 0.099 \times 0.75}{P_S}$$

$$\text{epoch\_pool} = \frac{V \times 0.01 \times 0.099 \times 0.25}{P_S}$$

Everything is deterministic. Simulate any scenario:

$$\begin{array}{|l|r|r|r|}
\hline
\textbf{Daily Volume} & \textbf{Total Fees} & \textbf{Staker Pool} & \textbf{\#1 Gets/Day} \\
\hline
10 \text{ ETH } (\$25\text{K}) & 0.1 \text{ ETH} & \sim\$15 & 867 \text{ \$SIZE} \\
100 \text{ ETH } (\$250\text{K}) & 1 \text{ ETH} & \sim\$150 & 8{,}671 \text{ \$SIZE} \\
1{,}000 \text{ ETH } (\$2.5\text{M}) & 10 \text{ ETH} & \sim\$1{,}500 & 86{,}705 \text{ \$SIZE} \\
10{,}000 \text{ ETH } (\$25\text{M}) & 100 \text{ ETH} & \sim\$15{,}000 & 867{,}052 \text{ \$SIZE} \\
\hline
\end{array}$$

---

## Staking

Stake $SIZE on Base via `SizeStaking.sol` and you enter a tier. Each tier multiplies your share of the fee pool.

$$\begin{array}{|l|r|r|r|l|}
\hline
\textbf{Tier} & \textbf{Min Stake} & \textbf{Supply \%} & \textbf{Boost} & \textbf{Meaning} \\
\hline
\text{Grower} & 10\text{M} & 0.01\% & 1\times & \text{Working with what you have} \\
\text{Shower} & 25\text{M} & 0.025\% & 2\times & \text{Moving with force} \\
\text{Shlong} & 100\text{M} & 0.1\% & 5\times & \text{Built for distance} \\
\text{Whale} & 250\text{M} & 0.25\% & 12\times & \text{Doesn't need to move} \\
\hline
\end{array}$$

Your effective stake and daily reward:

$$\text{effective\_stake} = S_{\text{you}} \times B_{\text{tier}}$$

$$\text{your\_daily\_yield} = \frac{S_{\text{you}} \times B_{\text{tier}}}{\displaystyle\sum_{i=1}^{n} S_i \times B_i} \times R_{\text{stakers}}$$

A Whale at minimum stake has 3 billion effective weight. A Grower has 10 million. The math rewards conviction, not timing.

There can only be 400 Whales maximum:

$$\frac{100{,}000{,}000{,}000 \text{ (supply)}}{250{,}000{,}000 \text{ (whale min)}} = 400 \text{ max Whales}$$

The top of the food chain is structurally scarce.

### The Exit Tax

Leave early, pay the price. Cubic decay — 69% at day zero, 0% at one year:

$$\text{penalty}(d) = 0.69 \times \left(\frac{365 - d}{365}\right)^3$$

$$\begin{array}{|l|r|r|}
\hline
\textbf{Time Staked} & \textbf{Penalty} & \textbf{You Keep} \\
\hline
\text{Day 0} & 69.0\% & 31.0\% \\
\text{1 month} & 53.1\% & 46.9\% \\
\text{3 months} & 29.2\% & 70.8\% \\
\text{6 months} & 8.6\% & 91.4\% \\
\text{9 months} & 1.1\% & 98.9\% \\
\text{12 months} & 0\% & 100\% \\
\hline
\end{array}$$

Where do the penalized tokens go?

$$\text{penalty\_tokens} \rightarrow \text{staking\_pool} \rightarrow \text{distributed to remaining stakers}$$

Paper hands directly subsidize diamond hands. It's a loyalty flywheel with teeth.

---

## Daily Rewards: Top 10 + Activity

The epoch pool splits deterministically every 24 hours.

**75% → Top 10 Leaderboard** by rank weight:

$$\begin{array}{|c|r|r|}
\hline
\textbf{Rank} & \textbf{Weight} & \textbf{Share of 75\%} \\
\hline
\#1 & 200 & 23.1\% \\
\#2 & 150 & 17.3\% \\
\#3 & 120 & 13.9\% \\
\#4 & 100 & 11.6\% \\
\#5 & 80 & 9.2\% \\
\#6 & 60 & 6.9\% \\
\#7 & 50 & 5.8\% \\
\#8 & 40 & 4.6\% \\
\#9 & 35 & 4.0\% \\
\#10 & 30 & 3.5\% \\
\hline
\Sigma & 865 & 100\% \\
\hline
\end{array}$$

**25% → All Active Users** by activity score:

$$\begin{array}{|l|r|r|}
\hline
\textbf{Action} & \textbf{Points} & \textbf{Daily Cap} \\
\hline
\text{Verified account} & 10 & 1\times \\
\text{Upvote received} & 5 & 20\times \\
\text{Referral} & 8 & \infty \\
\text{Post content} & 3 & 5\times \\
\text{Send message} & 1 & 10\times \\
\text{Daily login} & 1 & 1\times \\
\hline
\end{array}$$

Your daily activity reward:

$$\text{your\_reward} = \frac{w_{\text{you}}}{\displaystyle\sum_{j=1}^{m} w_j} \times 0.25 \times \text{epoch\_pool}$$

The leaderboard isn't a vanity metric. It's an income stream.

---

## DickCoins

Every verified user can launch a DickCoin — a personal ERC-20 — directly from the app. One tap. Clanker deploys it to Uniswap V4 on Base. Tradeable immediately.

This isn't a bonding curve inside a walled garden. It's a real token with a real market. Your community buys your coin. You earn 90% of the LP fees as ETH, every time they trade it, forever. The protocol takes 9.9%. A contract, not a promise.

$$\text{creator\_earnings} = V_{\text{coin}} \times 0.01 \times 0.90$$

AI logo generation is built in. Describe your coin, DALL-E generates it. Three tries. Pick one. Launch.

At 0.5 ETH in cumulative fees, a staking contract deploys automatically for your DickCoin. No manual action. The coin hits the threshold, the contract spins up, and your community can stake. The creator — the Daddy — now has a staking economy inside their Circle Jerk.

That's what makes DickCoins more than a memecoin launcher. They're community economies with automatic infrastructure that builds itself as the community grows.

---

## Circle Jerks

Every DickCoin spawns a Circle Jerk: a token-gated group chat inside SIZE. No setup. No configuration. The moment the DickCoin launches, the community exists.

The name isn't just a joke. Every group chat in crypto is already a circle jerk. Every Discord, every Telegram, every private channel where people share alpha and hype each other's bags. We just named it honestly and built real token-gated infrastructure around it.

How much you hold determines your role. Automatically. In real time.

$$\begin{array}{|l|l|l|}
\hline
\textbf{Role} & \textbf{Access} & \textbf{Requirement} \\
\hline
\text{Daddy} & \text{Full control. All channels.} & \text{Creator} \\
\text{Finisher} & \text{General + Bukake (write)} & \text{Top holders} \\
\text{Edger} & \text{General (write)} & \text{Mid holders} \\
\text{Stroker} & \text{General (write)} & \text{Above threshold} \\
\text{Cuck} & \text{Read only. See everything.} & \text{Min balance} \\
\hline
\end{array}$$

The **Bukake** is the broadcast layer — a high-signal channel where only Finishers and Daddies can post. All tiers can read it. The general chat is the conversation. The Bukake is the alpha.

As volume grows and the staking contract deploys, the Daddy's Circle Jerk becomes an actual economic community — not just a group chat with a funny name.

---

## The Architecture

$$\begin{array}{|l|l|}
\hline
\textbf{Layer} & \textbf{Stack} \\
\hline
\text{Frontend} & \text{Expo Web (React Native) on EC2} \\
\text{Backend} & \text{Express API + DynamoDB + S3} \\
\text{Chain} & \text{Base (Ethereum L2)} \\
\text{Token Launch} & \text{Clanker SDK} \rightarrow \text{Uniswap V4} \\
\text{Contracts} & \text{SizeStaking, SizeRewards} \\
& \text{SizeDickCoinFactory, SizeGifting} \\
\text{Verification} & \text{RunPod (abliterated Qwen 2.5 vision)} \\
\text{Wallet Intel} & \text{Arkham Intelligence API} \\
\text{Portfolio} & \text{Multi-chain: ETH/Base/Arb/OP/Poly/BSC} \\
\text{Custody} & \text{AWS KMS (FIPS 140-2 Level 2)} \\
\text{Auth} & \text{JWT + X OAuth 2.0 PKCE + wallet sig} \\
\hline
\end{array}$$

Contracts are Solidity 0.8.24 with OpenZeppelin. `ReentrancyGuard` on every state-changing function. `Pausable`. `Ownable2Step`. Pull-pattern on ETH transfers. Cubic penalty math in fixed-point $10^{18}$ precision. Early withdrawal penalties redistributed atomically in the same transaction as the unstake.

Custodial wallets encrypted with AWS KMS hardware security modules. Private keys never stored in plaintext, never logged, never in error messages. Decrypted in-memory only when signing, immediately zeroed. Users can export their key and take full custody at any time.

---

## Why This Is a Real Project

We know what this looks like from the outside. The name. The premise. The fact that one verification path involves uploading a photo of your genitals.

We know.

But here's the thing: the impulse to dismiss it is the same impulse that makes the premise work. Men have been comparing themselves to each other forever, and every platform that pretends otherwise is still quietly built on top of that reality. SIZE. just stopped pretending. And what we built underneath the honesty is genuinely serious.

A verification layer that covers net worth, social following, token holdings, and physical size. All on one profile. All verifiable. All ranked.

A staking economy where 75% of the protocol fee stream goes back to stakers. A personal memecoin launcher that auto-deploys staking infrastructure at volume thresholds. Token-gated communities with dynamic role systems enforced in real time by on-chain balance. A fair launch with zero insider allocation. A protocol that only makes money when the community trades.

friend.tech had one mechanic and a lot of hype. When the hype left there was nothing to stay for. SIZE. is built to still be here in three years because the people in it have real reasons to stay. Staking yield from actual volume. DickCoin communities with real economics. A leaderboard with real verified identity behind every entry. An earn system that rewards people who show up every day.

The premise is funny. The insight behind it is real. The infrastructure is not a joke.

---

## Links

[wheresizematters.com](https://wheresizematters.com) | [@wheresize](https://x.com/wheresize)

$SIZE on Base via Clanker. $10^{11}$ supply. 100% fair launch.

$$\text{Verify.} \quad \text{Stake.} \quad \text{Launch your coin.} \quad \text{Build your Circle Jerk.} \quad \text{Become the Daddy.}$$

*Where size matters.*
