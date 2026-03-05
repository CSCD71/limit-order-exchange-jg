import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  getAddress,
  http,
  parseUnits
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

// ai generates these edge case tests

const rpc = http("http://127.0.0.1:8545");
const client = createPublicClient({ chain: foundry, transport: rpc });

const privateKeys = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"
];

const ORDER_TYPES = {
  Order: [
    { name: "seller", type: "address" },
    { name: "tokenSell", type: "address" },
    { name: "tokenBuy", type: "address" },
    { name: "amountSell", type: "uint256" },
    { name: "amountBuy", type: "uint256" },
    { name: "expiry", type: "uint256" },
    { name: "nonce", type: "uint256" }
  ]
};

function loadContract(contract, source = `${contract}.sol`) {
  const content = readFileSync(join("out", source, `${contract}.json`), "utf8");
  const artifact = JSON.parse(content);
  return { abi: artifact.abi, bytecode: artifact.bytecode.object };
}

function futureExpiry(seconds = 3600) {
  return BigInt(Math.floor(Date.now() / 1000) + seconds);
}

// use ai assistant for these test cases
describe("LimitOrderExchange – edge cases & failure conditions", () => {
  let seller, buyer, third, other;
  let exchange, tokenA, tokenB;

  function makeDomain() {
    return {
      name: "SellOnlyLimitOrderExchange",
      version: "1",
      chainId: foundry.id,
      verifyingContract: exchange.address
    };
  }

  function makeOrder({ nonce, amountSell, amountBuy, expiry }) {
    return {
      seller: seller.account.address,
      tokenSell: tokenA.address,
      tokenBuy: tokenB.address,
      amountSell,
      amountBuy,
      expiry,
      nonce
    };
  }

  async function signOrder(order) {
    return seller.signTypedData({
      domain: makeDomain(),
      primaryType: "Order",
      types: ORDER_TYPES,
      message: order
    });
  }

  async function deployFixture() {
    const exchangeArtifact = loadContract("LimitOrderExchange");
    const mockArtifact = loadContract("MockERC20");

    const exchangeHash = await seller.deployContract({
      abi: exchangeArtifact.abi,
      bytecode: exchangeArtifact.bytecode
    });
    const exchangeReceipt = await client.waitForTransactionReceipt({ hash: exchangeHash });
    exchange = {
      address: getAddress(exchangeReceipt.contractAddress),
      abi: exchangeArtifact.abi
    };

    const tokenAHash = await seller.deployContract({
      abi: mockArtifact.abi,
      bytecode: mockArtifact.bytecode,
      args: ["Token A", "TKNA"]
    });
    const tokenAReceipt = await client.waitForTransactionReceipt({ hash: tokenAHash });
    tokenA = { address: getAddress(tokenAReceipt.contractAddress), abi: mockArtifact.abi };

    const tokenBHash = await seller.deployContract({
      abi: mockArtifact.abi,
      bytecode: mockArtifact.bytecode,
      args: ["Token B", "TKNB"]
    });
    const tokenBReceipt = await client.waitForTransactionReceipt({ hash: tokenBHash });
    tokenB = { address: getAddress(tokenBReceipt.contractAddress), abi: mockArtifact.abi };

    // Mint balances
    await client.waitForTransactionReceipt({
      hash: await seller.writeContract({
        ...tokenA,
        functionName: "mint",
        args: [seller.account.address, parseUnits("1000", 18)]
      })
    });
    await client.waitForTransactionReceipt({
      hash: await seller.writeContract({
        ...tokenB,
        functionName: "mint",
        args: [buyer.account.address, parseUnits("1000", 18)]
      })
    });

    // Approve
    const approveAmount = parseUnits("1000000", 18);
    await client.waitForTransactionReceipt({
      hash: await seller.writeContract({
        ...tokenA,
        functionName: "approve",
        args: [exchange.address, approveAmount]
      })
    });
    await client.waitForTransactionReceipt({
      hash: await buyer.writeContract({
        ...tokenB,
        functionName: "approve",
        args: [exchange.address, approveAmount]
      })
    });
  }

  beforeAll(async () => {
    [seller, buyer, third, other] = privateKeys.map((pk) =>
      createWalletClient({
        chain: foundry,
        transport: rpc,
        account: privateKeyToAccount(pk)
      })
    );
  });

  beforeEach(async () => {
    await deployFixture();
  });

  // ═══════════════════════════════════════════
  //  Full fill & sequential partial fills
  // ═══════════════════════════════════════════

  it("fills an entire order in one transaction", async () => {
    const order = makeOrder({
      nonce: 1n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: futureExpiry()
    });
    const signature = await signOrder(order);

    await client.waitForTransactionReceipt({
      hash: await buyer.writeContract({
        ...exchange,
        functionName: "fillOrder",
        args: [order, signature, parseUnits("10", 18)]
      })
    });

    const remaining = await client.readContract({
      ...exchange,
      functionName: "remainingAmountSell",
      args: [order]
    });
    expect(remaining).toBe(0n);
  });

  it("supports multiple sequential partial fills on the same order", async () => {
    const order = makeOrder({
      nonce: 2n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: futureExpiry()
    });
    const signature = await signOrder(order);

    await client.waitForTransactionReceipt({
      hash: await buyer.writeContract({
        ...exchange,
        functionName: "fillOrder",
        args: [order, signature, parseUnits("6", 18)]
      })
    });
    expect(
      await client.readContract({ ...exchange, functionName: "remainingAmountSell", args: [order] })
    ).toBe(parseUnits("4", 18));

    await client.waitForTransactionReceipt({
      hash: await buyer.writeContract({
        ...exchange,
        functionName: "fillOrder",
        args: [order, signature, parseUnits("4", 18)]
      })
    });
    expect(
      await client.readContract({ ...exchange, functionName: "remainingAmountSell", args: [order] })
    ).toBe(0n);
  });

  // ═══════════════════════════════════════════
  //  publishOrder – access control
  // ═══════════════════════════════════════════

  it("rejects publishOrder called by non-seller", async () => {
    const order = makeOrder({
      nonce: 3n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: futureExpiry()
    });
    const signature = await signOrder(order);

    await expect(
      buyer.writeContract({
        ...exchange,
        functionName: "publishOrder",
        args: [order, signature]
      })
    ).rejects.toThrow();
  });

  // ═══════════════════════════════════════════
  //  cancelOrder – event & access control
  // ═══════════════════════════════════════════

  it("cancelOrder emits OrderCanceled event", async () => {
    const order = makeOrder({
      nonce: 4n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: futureExpiry()
    });

    const txHash = await seller.writeContract({
      ...exchange,
      functionName: "cancelOrder",
      args: [order]
    });
    const receipt = await client.waitForTransactionReceipt({ hash: txHash });

    const log = receipt.logs.find(
      (x) => x.address.toLowerCase() === exchange.address.toLowerCase()
    );
    expect(log).toBeTruthy();

    const parsed = decodeEventLog({ abi: exchange.abi, data: log.data, topics: log.topics });
    expect(parsed.eventName).toBe("OrderCanceled");
  });

  // ═══════════════════════════════════════════
  //  fillOrder – rejection cases
  // ═══════════════════════════════════════════

  it("rejects fillOrder with fillAmountSell of zero", async () => {
    const order = makeOrder({
      nonce: 5n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: futureExpiry()
    });
    const signature = await signOrder(order);

    await expect(
      buyer.writeContract({
        ...exchange,
        functionName: "fillOrder",
        args: [order, signature, 0n]
      })
    ).rejects.toThrow();
  });

  it("rejects fillOrder when seller has no allowance", async () => {
    await client.waitForTransactionReceipt({
      hash: await seller.writeContract({
        ...tokenA,
        functionName: "approve",
        args: [exchange.address, 0n]
      })
    });

    const order = makeOrder({
      nonce: 6n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: futureExpiry()
    });
    const signature = await signOrder(order);

    await expect(
      buyer.writeContract({
        ...exchange,
        functionName: "fillOrder",
        args: [order, signature, parseUnits("1", 18)]
      })
    ).rejects.toThrow();
  });

  it("rejects fillOrder when buyer has no allowance", async () => {
    await client.waitForTransactionReceipt({
      hash: await buyer.writeContract({
        ...tokenB,
        functionName: "approve",
        args: [exchange.address, 0n]
      })
    });

    const order = makeOrder({
      nonce: 7n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: futureExpiry()
    });
    const signature = await signOrder(order);

    await expect(
      buyer.writeContract({
        ...exchange,
        functionName: "fillOrder",
        args: [order, signature, parseUnits("1", 18)]
      })
    ).rejects.toThrow();
  });

  // ═══════════════════════════════════════════
  //  Order validation – invalid parameters
  // ═══════════════════════════════════════════

  it("rejects order where tokenSell equals tokenBuy", async () => {
    const order = {
      seller: seller.account.address,
      tokenSell: tokenA.address,
      tokenBuy: tokenA.address,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: futureExpiry(),
      nonce: 8n
    };
    const signature = await seller.signTypedData({
      domain: makeDomain(),
      primaryType: "Order",
      types: ORDER_TYPES,
      message: order
    });

    await expect(
      buyer.writeContract({
        ...exchange,
        functionName: "fillOrder",
        args: [order, signature, parseUnits("1", 18)]
      })
    ).rejects.toThrow();
  });

  it("rejects order with zero amountSell", async () => {
    const order = {
      seller: seller.account.address,
      tokenSell: tokenA.address,
      tokenBuy: tokenB.address,
      amountSell: 0n,
      amountBuy: parseUnits("20", 18),
      expiry: futureExpiry(),
      nonce: 9n
    };
    const signature = await seller.signTypedData({
      domain: makeDomain(),
      primaryType: "Order",
      types: ORDER_TYPES,
      message: order
    });

    await expect(
      buyer.writeContract({
        ...exchange,
        functionName: "fillOrder",
        args: [order, signature, 0n]
      })
    ).rejects.toThrow();
  });

  // ═══════════════════════════════════════════
  //  fillOrders – batch failure conditions
  // ═══════════════════════════════════════════

  it("rejects fillOrders with mismatched array lengths", async () => {
    const order = makeOrder({
      nonce: 10n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: futureExpiry()
    });
    const signature = await signOrder(order);

    await expect(
      buyer.writeContract({
        ...exchange,
        functionName: "fillOrders",
        args: [[order], [signature, signature], [parseUnits("1", 18)]]
      })
    ).rejects.toThrow();
  });

  it("fillOrders reverts atomically if any order in the batch fails", async () => {
    const goodOrder = makeOrder({
      nonce: 11n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: futureExpiry()
    });
    const goodSig = await signOrder(goodOrder);

    const nowBlock = await client.getBlock();
    const badOrder = makeOrder({
      nonce: 12n,
      amountSell: parseUnits("5", 18),
      amountBuy: parseUnits("10", 18),
      expiry: nowBlock.timestamp + 1n
    });
    const badSig = await signOrder(badOrder);

    await client.request({ method: "anvil_increaseTime", params: [2] });
    await client.request({ method: "anvil_mine", params: [1] });

    await expect(
      buyer.writeContract({
        ...exchange,
        functionName: "fillOrders",
        args: [
          [goodOrder, badOrder],
          [goodSig, badSig],
          [parseUnits("2", 18), parseUnits("2", 18)]
        ]
      })
    ).rejects.toThrow();

    // Good order must NOT have been filled (atomic revert)
    const remaining = await client.readContract({
      ...exchange,
      functionName: "remainingAmountSell",
      args: [goodOrder]
    });
    expect(remaining).toBe(parseUnits("10", 18));
  });

  // ═══════════════════════════════════════════
  //  Partial fill → cancel → re-fill blocked
  // ═══════════════════════════════════════════

  it("partial fill then cancel prevents subsequent fills", async () => {
    const order = makeOrder({
      nonce: 13n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: futureExpiry()
    });
    const signature = await signOrder(order);

    await client.waitForTransactionReceipt({
      hash: await buyer.writeContract({
        ...exchange,
        functionName: "fillOrder",
        args: [order, signature, parseUnits("4", 18)]
      })
    });

    await client.waitForTransactionReceipt({
      hash: await seller.writeContract({
        ...exchange,
        functionName: "cancelOrder",
        args: [order]
      })
    });

    await expect(
      buyer.writeContract({
        ...exchange,
        functionName: "fillOrder",
        args: [order, signature, parseUnits("2", 18)]
      })
    ).rejects.toThrow();
  });

  // ═══════════════════════════════════════════
  //  isFillable – all false-return conditions
  // ═══════════════════════════════════════════

  it("isFillable returns false for invalid signature", async () => {
    const order = makeOrder({
      nonce: 20n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: futureExpiry()
    });
    const wrongSig = await buyer.signTypedData({
      domain: makeDomain(),
      primaryType: "Order",
      types: ORDER_TYPES,
      message: order
    });

    const ok = await client.readContract({
      ...exchange,
      functionName: "isFillable",
      args: [order, wrongSig, parseUnits("1", 18), buyer.account.address]
    });
    expect(ok).toBe(false);
  });

  it("isFillable returns false for invalid order core (tokenSell == tokenBuy)", async () => {
    const badOrder = {
      seller: seller.account.address,
      tokenSell: tokenA.address,
      tokenBuy: tokenA.address,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: futureExpiry(),
      nonce: 21n
    };
    const signature = await seller.signTypedData({
      domain: makeDomain(),
      primaryType: "Order",
      types: ORDER_TYPES,
      message: badOrder
    });

    const ok = await client.readContract({
      ...exchange,
      functionName: "isFillable",
      args: [badOrder, signature, parseUnits("1", 18), buyer.account.address]
    });
    expect(ok).toBe(false);
  });

  it("isFillable returns false for canceled order", async () => {
    const order = makeOrder({
      nonce: 22n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: futureExpiry()
    });
    const signature = await signOrder(order);

    await client.waitForTransactionReceipt({
      hash: await seller.writeContract({
        ...exchange,
        functionName: "cancelOrder",
        args: [order]
      })
    });

    const ok = await client.readContract({
      ...exchange,
      functionName: "isFillable",
      args: [order, signature, parseUnits("1", 18), buyer.account.address]
    });
    expect(ok).toBe(false);
  });

  it("isFillable returns false for expired order", async () => {
    const nowBlock = await client.getBlock();
    const order = makeOrder({
      nonce: 23n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: nowBlock.timestamp + 1n
    });
    const signature = await signOrder(order);

    await client.request({ method: "anvil_increaseTime", params: [2] });
    await client.request({ method: "anvil_mine", params: [1] });

    const ok = await client.readContract({
      ...exchange,
      functionName: "isFillable",
      args: [order, signature, parseUnits("1", 18), buyer.account.address]
    });
    expect(ok).toBe(false);
  });

  it("isFillable returns false for fully filled order", async () => {
    const order = makeOrder({
      nonce: 24n,
      amountSell: parseUnits("2", 18),
      amountBuy: parseUnits("4", 18),
      expiry: futureExpiry()
    });
    const signature = await signOrder(order);

    await client.waitForTransactionReceipt({
      hash: await buyer.writeContract({
        ...exchange,
        functionName: "fillOrder",
        args: [order, signature, parseUnits("2", 18)]
      })
    });

    const ok = await client.readContract({
      ...exchange,
      functionName: "isFillable",
      args: [order, signature, parseUnits("1", 18), buyer.account.address]
    });
    expect(ok).toBe(false);
  });

  it("isFillable returns false when fillAmountSell is zero", async () => {
    const order = makeOrder({
      nonce: 25n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: futureExpiry()
    });
    const signature = await signOrder(order);

    const ok = await client.readContract({
      ...exchange,
      functionName: "isFillable",
      args: [order, signature, 0n, buyer.account.address]
    });
    expect(ok).toBe(false);
  });

  it("isFillable returns false when fillAmountSell exceeds remaining", async () => {
    const order = makeOrder({
      nonce: 26n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: futureExpiry()
    });
    const signature = await signOrder(order);

    const ok = await client.readContract({
      ...exchange,
      functionName: "isFillable",
      args: [order, signature, parseUnits("11", 18), buyer.account.address]
    });
    expect(ok).toBe(false);
  });

  it("isFillable returns false for non-integral fill ratio", async () => {
    const order = makeOrder({
      nonce: 27n,
      amountSell: 3n,
      amountBuy: 10n,
      expiry: futureExpiry()
    });
    const signature = await signOrder(order);

    const ok = await client.readContract({
      ...exchange,
      functionName: "isFillable",
      args: [order, signature, 1n, buyer.account.address]
    });
    expect(ok).toBe(false);
  });

  it("isFillable returns false when seller has no allowance", async () => {
    await client.waitForTransactionReceipt({
      hash: await seller.writeContract({
        ...tokenA,
        functionName: "approve",
        args: [exchange.address, 0n]
      })
    });

    const order = makeOrder({
      nonce: 28n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: futureExpiry()
    });
    const signature = await signOrder(order);

    const ok = await client.readContract({
      ...exchange,
      functionName: "isFillable",
      args: [order, signature, parseUnits("1", 18), buyer.account.address]
    });
    expect(ok).toBe(false);
  });

  it("isFillable returns false when buyer has no approval", async () => {
    const order = makeOrder({
      nonce: 29n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: futureExpiry()
    });
    const signature = await signOrder(order);

    await client.waitForTransactionReceipt({
      hash: await buyer.writeContract({
        ...tokenB,
        functionName: "approve",
        args: [exchange.address, 0n]
      })
    });

    const ok = await client.readContract({
      ...exchange,
      functionName: "isFillable",
      args: [order, signature, parseUnits("4", 18), buyer.account.address]
    });
    expect(ok).toBe(false);
  });

  it("isFillable with buyer address(0) skips buyer balance/allowance checks", async () => {
    const order = makeOrder({
      nonce: 30n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: futureExpiry()
    });
    const signature = await signOrder(order);

    const ok = await client.readContract({
      ...exchange,
      functionName: "isFillable",
      args: [order, signature, parseUnits("1", 18), "0x0000000000000000000000000000000000000000"]
    });
    expect(ok).toBe(true);
  });
});
