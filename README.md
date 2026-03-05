[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/pau2dqk-)
# Sell-Only Limit-Order Exchange

This project implements a sell-only limit-order exchange on Ethereum 

## Required Links

- **Deployed dApp (HTTPS):** `<ADD_YOUR_PUBLIC_HTTPS_URL_HERE>`
- **Verified Sepolia Contract:** https://sepolia.etherscan.io/address/0x129cAEE09d999749c397C20eF067cb9907A18b7c

---

## Local Development (Phase 1)

### 1) Install dependencies

```bash
npm install
```

### 2) Compile contracts

```bash
forge build
```

### 3) Start local chain (new terminal)

```bash
anvil
```

### 4) Run unit tests

```bash
npm test
```

Tests are written in JavaScript using [viem](https://viem.sh/) and [vitest](https://vitest.dev/).

---

## Deploy to Sepolia (Phase 2)

## Prerequisites


- A wallet private key with Sepolia ETH (e.g., MetaMask wallet)
- Ensure the deployer account has enough Sepolia ETH to pay gas fees.
- A Sepolia RPC URL (e.g., Alchemy)
- An Etherscan API key for verification

### 1) Create `.env`

Create `.env` at repository root:

```bash
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<ALCHEMY_API_KEY>
PRIVATE_KEY=<YOUR_PRIVATE_KEY>
ETHERSCAN_API_KEY=<YOUR_ETHERSCAN_API_KEY>
```

Notes:

- `PRIVATE_KEY` can be with or without `0x` prefix.
- Keep `.env` private.

### 2) Verify RPC chain id

```bash
cast chain-id --rpc-url "$SEPOLIA_RPC_URL"
```

Expected output:

```bash
11155111
```

### 3) Deploy contract

Load `.env` first:

```bash
source .env
```

Check private key format (optional):

```bash
PK="$PRIVATE_KEY"
if [[ "$PK" != 0x* ]]; then
  PK="0x$PK"
fi
```

Deploy manually with Foundry:

```bash
forge create contracts/LimitOrderExchange.sol:LimitOrderExchange \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --private-key "$PK" \
  --broadcast
```

You should see output like:

```bash
Deployer: <ACCOUNT_ADDRESS>
Deployed to: <DEPLOYED_ADDRESS>
Transaction hash: <TX_HASH>
```

Open on Etherscan:

```bash
https://sepolia.etherscan.io/address/<DEPLOYED_ADDRESS>
https://sepolia.etherscan.io/tx/<TX_HASH>
```

Then update `config.json` for Sepolia (`11155111`):

```json
{
  "11155111": {
    "address": "<DEPLOYED_ADDRESS>",
    "hash": "<TX_HASH>"
  }
}
```

### 4)  Verify on Etherscan

```bash
forge verify-contract \
  --chain sepolia \
  --etherscan-api-key "$ETHERSCAN_API_KEY" \
  0x129cAEE09d999749c397C20eF067cb9907A18b7c \
  contracts/LimitOrderExchange.sol:LimitOrderExchange
```

If you redeploy, replace the address with your new deployment.

---

## Run Frontend Locally (Phase 3)

The frontend is a static app using:

- `index.html`
- `static/app.js`
- `static/styles.css`


### `browser-sync`

```bash
npm install -g browser-sync
browser-sync start --server --files "**/*"
```

Then open the printed local URL (commonly `http://localhost:3000`).

---


