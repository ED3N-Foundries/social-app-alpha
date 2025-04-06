# 🎉 ED3N // Social — Open Source Blockchain Event Hosting System

ED3N is a next-generation SocialFi platform that incentivises the hosting and attending of events via platform-native token staking. When a new user signs up, the metal.build API-based platform generates a custodial wallet for the new account. The platform native token can be earned/bought by users. Event hosts can set a threshold for native-token staking for their events. The higher the total stake, the higher-ranked and better-promoted the event. Attendees stake the native token to gain entry to events. If they don't show up, 100% of the staked platform is burned; if attendees do attend the event, then 45% of the staked token is distributed to the host, 45% is returned to the attendee, and 10% is burned. When sign-up is approved by the host, the platform auto-mints an NFT on Polygon and sends it to the user's custodial wallet, which contains an encrypted QR code (to prevent platform fraud) that acts as entry-ticket to the event. After the event, the NFT acts as commemorative memorabilia for attendance of that (and other prior) events.

## 📺 Video Demo
https://www.youtube.com/watch?v=KyAoFX_uQq0

## ✨ Features

- 📝 Create events with on-chain metadata
- 🎟️ Mint event tickets as NFTs (ERC-721 or ERC-1155)
- 🔐 Wallet-based event registration and check-in
- 🔎 Public event discovery
- 🌐 Multi-chain support (Ethereum, Polygon, Base, etc.)
- 🧩 Easily extendable smart contracts + UI

## 🛠 Tech Stack

- **Frontend**: Vue + Vuetify + Vite + Bun.sh
- **Backend**: Bun.sh + SQLite
- **Smart Contracts**: Solidity (ERC-721 / ERC-1155)
- **Blockchain**: metal.build for all token/staking/buy ops, Polygon for all NFT/ticket ops
- **Wallet Support**: MetaMask, WalletConnect (via RainbowKit)

## 👥 Team Social Handles

Ed3n Organization https://x.com/ED3N_Foundries
- Michael Seebarn: https://github.com/digisomni
- Paddy Jow: https://x.com/bricshq
- Robin Fischer:  https://x.com/robin_fischer7

## 🚀 Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/ED3N-Foundries/social-app-alpha
cd social-app-alpha

# 2. Install dependencies
bun install

# 3. Start local dev server
bun run dev
```

ED3N // social - Alpha Demo for ETH Taipei 2025 @ Taiwan.
https://github.com/ED3N-Foundries/social-app-alpha
