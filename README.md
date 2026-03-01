[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/pau2dqk-)
# Sell-Only Limit-Order Exchange

A **sell-only limit-order exchange** is a simplified trading system in which only sellers create orders and buyers directly execute them. Contrary to a traditional limit-order exchange, there is no bid side and no order matching between buyers.

Each order represents an explicit offer:

> "I sell a fixed amount of token A at a fixed price denominated in
> token B."

The exchange will be implemented as a smart contract that allows buyers to execute these orders to swap arbitrary ERC20 tokens.

------------------------------------------------------------------------

## Requirements

### Sell Orders

When a seller wants to sell token *A* in exchange for token *B*, the seller must:

1.  Allow the **Exchange** smart contract to transfer `x` amount of token *A* on the seller's behalf (via ERC20 `approve`).

2.  Create an **Order** specifying:
    -   the seller's address
    -   the token *A* being sold
    -   the token *B* requested in exchange
    -   the `x` amount of token *A* for sale
    -   the `y` amount of token *B* to receive
    -   an expiration time
    -   a random nonce
    -   a signature (also called a *witness*) proving that the order was
        created by the seller

3.  Make the sell order available to buyers. Orders may be:
    -   emitted on-chain via an event,
    -   shared through social media or messaging platforms,
    -   or stored in a dedicated backend application (which out of the scope of this assignment)

For this assignment, sellers may publish orders on-chain  as a convenience. However, publishing orders on-chain is **not required** for the protocol to function.

An order can be used by buyers until it is:

-   fully filled (all tokens exchanged),
-   canceled by the seller,
-   or expired.

The ratio between token A and token B is called the **exchange ratio**.

------------------------------------------------------------------------

## Simple Order Execution

A buyer who wants to acquire token *A* by paying token *B* must:

1.  Select an order offering `x` token *A* for `y` token *B*. By doing so, the buyer agrees to the order's exchange ratio.

2.  Allow the **Exchange** contract to transfer `y` token *B* on the buyer's behalf. 

3.  Submit a transaction to the **Exchange** contract that:
    -   transfers `x` token *A* from the seller to the buyer,
    -   transfers `y` token *B* from the buyer to the seller.

------------------------------------------------------------------------

## Partial Order Execution

Orders must support partial fills.

Example:

If a seller offers **10 A** in exchange for **20 B**, a buyer should be able to:

-   Purchase **6 A** by paying **12 B** (respecting the exchange ratio).
-   The order then remains open with **4 A** available for **8 B**.

Only once the entire **10 A** has been exchanged is the order considered fully filled.

------------------------------------------------------------------------

## Bulk Order Execution

A buyer must be able to fill multiple orders (possibly with different exchange ratios) in a single transaction to save gas.

------------------------------------------------------------------------

## Contract Specification

The **Exchange** smart contract must:

-   Allow sellers to publish orders as events (orders should *not* be stored in contract state for gas efficiency).
-   Allow sellers to cancel their own orders.
-   Allow buyers to fill orders (fully, partially, or in bulk).
-   Check whether an order is **fillable**, meaning it satisfies all required conditions (e.g., not expired, not fully filled, sufficient allowance, valid signature, etc.).

------------------------------------------------------------------------

## dApp Specification

You must build and deploy (over HTTPS with a public URL) a decentralized application (dApp) that enables users to exchange tokens.

The dApp must allow users to:

-   Connect and disconnect using **MetaMask**.
-   View a link to the deployed **Exchange** contract on Sepolia Etherscan.
-   Create sell orders and sign them. After signing, the app must display the order so it can be shared
    off-chain. The app must offer the option to publish the order on-chain through the *Exchange* smart contract. 
-   Execute trades "at market price" meaning the dApp selects the best available exchange ratios among fillable orders that were published on-chain.
-   Allow buyers to manually input and execute specific orders.

The application must support arbitrary ERC20 tokens. Common examples include:

- Stablecoins: [Tether (USDT)](https://sepolia.etherscan.io/address/0x7169D38820dfd117C3FA1F22A697dBA58d90BA06), [USD Coin (USDC)](https://sepolia.etherscan.io/address/0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238), and [Dai (DAI)](https://sepolia.etherscan.io/address/0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6)
- DeFi Governance/Utility: Chainlink (LINK), Aave (AAVE), Maker (MKR), and Uniswap (UNI)
- Staking Assets: Lido Staked ETH (stETH)
- Wrapped Assets: Wrapped Bitcoin (WBTC), Wrapped eEthereum (weWETH)

------------------------------------------------------------------------

## Challenges

### Signing Orders with EIP-712

The dApp must prompt users to sign orders with their browser wallet. 

The dApp could invoke the wallet method `personal_sign` to sign raw bytes. However, this is discouraged because users cannot easily verify what they are signing.

Instead, use **EIP-712 typed structured data signatures** via the method `eth_signTypedData_v4`. This enables wallets to display human-readable fields before signing.

Helpful references:

- [EIP-712 Explained: Secure Off-Chain Signatures for Real-World Ethereum Apps](https://medium.com/@andrey_obruchkov/eip-712-explained-secure-off-chain-signatures-for-real-world-ethereum-apps-d2823c45227d)
- `ERC-20-with-permit` example developed in week 6 of the CSCD21 course. 

------------------------------------------------------------------------

### Fixed-Point Arithmetic

Solidity does not support floating-point numbers. All token calculations must use [fixed-point arithmetics](https://rareskills.io/post/solidity-fixed-point).

Carefully handle: 

- Token decimals
- Partial fills
- Rounding behavior

------------------------------------------------------------------------

## Security

Most of the security of a dApp relies on the correctness of the smart contract.

Part of the work is about  identifying how users might attempt to compromise the integrity of the exchange.

Assume that users can interact directly with the contract without using your dApp.

------------------------------------------------------------------------

## Development Guidelines

For developing your smart contract and dApp, you may use:

- **JavaScript** or **TypeScript**
- the [OpenZeppelin Library](https://www.openzeppelin.com/)
- the **[Foundry](https://www.getfoundry.sh/)** framework for Ethereum (**Hardhat** and **Ganache** are *not* allowed)
- **[Viem](https://viem.sh/)** as the Ethereum JavaScript library (**Ethers.js** and **Web3.js** are *not* allowed)
- **[Vitest](https://vitest.dev/)** (if needed) for unit testing (**Mocha** is *not* allowed)
- any frontend technology of your choice to develop the dApp

We are going to adopt the same strategy as the **Auction House** example used in class:

- **Phase 1:** Smart contract implementation and testing on a local development chain. For tests, feel free to write them in **Solidity** (as recommended by the Foundry framework) or in **JavaScript/TypeScript** (as done in class).
- **Phase 2:** Deployment to the **Sepolia** chain with **contract verification**.
- **Phase 3:** Frontend implementation and deployment over **HTTPS** on a publicly accessible URL.

------------------------------------------------------------------------


## Deliverables

1. All of your smart contract code, unit tests, and frontend code must be in the **same repository**.

2. At the root of your assignment repository on GitHub, include a `README.md` file with:

   - a working link to your deployed dApp
   - a working link to your deployed smart contract on the **[Sepolia Etherscan block explorer](https://sepolia.etherscan.io/)**. Make sure your contract is **verified**, meaning the Solidity source code has been published on Etherscan.
   - a detailed, step-by-step guide explaining how to:
     - install all dependencies,
     - run your unit tests,
     - deploy your contract to Sepolia,
     - and run your dApp frontend locally.