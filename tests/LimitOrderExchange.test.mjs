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

const rpc = http("http://127.0.0.1:8545");
const client = createPublicClient({ chain: foundry, transport: rpc });

const privateKeys = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"
];

function loadContract(contract, source = `${contract}.sol`) {
  const content = readFileSync(join("out", source, `${contract}.json`), "utf8");
  const artifact = JSON.parse(content);
  return { abi: artifact.abi, bytecode: artifact.bytecode.object };
}

describe("LimitOrderExchange scaffold", () => {
  let seller;
  let buyer;
  let third;
  let other;

  let exchange;
  let tokenA;
  let tokenB;

  const one = parseUnits("1", 18);

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
      domain: {
        name: "SellOnlyLimitOrderExchange",
        version: "1",
        chainId: foundry.id,
        verifyingContract: exchange.address
      },
      primaryType: "Order",
      types: {
        Order: [
          { name: "seller", type: "address" },
          { name: "tokenSell", type: "address" },
          { name: "tokenBuy", type: "address" },
          { name: "amountSell", type: "uint256" },
          { name: "amountBuy", type: "uint256" },
          { name: "expiry", type: "uint256" },
          { name: "nonce", type: "uint256" }
        ]
      },
      message: order
    });
  }

  async function approveBaseAllowances() {
    const amount = parseUnits("1000000", 18);

    await client.waitForTransactionReceipt({
      hash: await seller.writeContract({
        ...tokenA,
        functionName: "approve",
        args: [exchange.address, amount]
      })
    });

    await client.waitForTransactionReceipt({
      hash: await buyer.writeContract({
        ...tokenB,
        functionName: "approve",
        args: [exchange.address, amount]
      })
    });
  }

  async function mintBaseBalances() {
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

    await mintBaseBalances();
    await approveBaseAllowances();
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
    await client.request({ method: "anvil_reset", params: [] });
    await deployFixture();
  }, 30_000);

  // EIP-712
  it("deploys with EIP-712 domain name", async () => {
    const domainName = await client.readContract({
      ...exchange,
      functionName: "eip712Domain"
    });

    expect(domainName[1]).toBe("SellOnlyLimitOrderExchange");
  });

  // [Feature] Publish Signed Order
  it("publishes signed order as event", async () => {
    const order = makeOrder({
      nonce: 1n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: BigInt(Math.floor(Date.now() / 1000) + 3600)
    });
    const signature = await signOrder(order);

    const txHash = await seller.writeContract({
      ...exchange,
      functionName: "publishOrder",
      args: [order, signature]
    });
    const receipt = await client.waitForTransactionReceipt({ hash: txHash });

    const log = receipt.logs.find((x) => x.address.toLowerCase() === exchange.address.toLowerCase());
    expect(log).toBeTruthy();

    const parsed = decodeEventLog({ abi: exchange.abi, data: log.data, topics: log.topics });
    expect(parsed.eventName).toBe("OrderPublished");
  });

  // Partial Fill 
  it("fills a signed order partially and updates balances", async () => {
    const order = makeOrder({
      nonce: 2n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: BigInt(Math.floor(Date.now() / 1000) + 3600)
    });
    const signature = await signOrder(order);

    const fillAmountSell = parseUnits("6", 18);
    const fillHash = await buyer.writeContract({
      ...exchange,
      functionName: "fillOrder",
      args: [order, signature, fillAmountSell]
    });

    const fillReceipt = await client.waitForTransactionReceipt({ hash: fillHash });

    const fillLog = fillReceipt.logs.find((log) => log.address.toLowerCase() === exchange.address.toLowerCase());
    expect(fillLog).toBeTruthy();

    const parsed = decodeEventLog({
      abi: exchange.abi,
      data: fillLog.data,
      topics: fillLog.topics
    });

    expect(parsed.eventName).toBe("OrderFilled");

    expect(parsed.args.fillAmountSell).toBe(fillAmountSell);
    expect(parsed.args.fillAmountBuy).toBe(parseUnits("12", 18));
    expect(parsed.args.remainingAmountSell).toBe(parseUnits("4", 18));

    const sellerTokenAAfter = await client.readContract({
      ...tokenA,
      functionName: "balanceOf",
      args: [seller.account.address]
    });
    const buyerTokenAAfter = await client.readContract({
      ...tokenA,
      functionName: "balanceOf",
      args: [buyer.account.address]
    });

    const sellerTokenBAfter = await client.readContract({
      ...tokenB,
      functionName: "balanceOf",
      args: [seller.account.address]
    });
    const buyerTokenBAfter = await client.readContract({
      ...tokenB,
      functionName: "balanceOf",
      args: [buyer.account.address]
    });

    expect(sellerTokenAAfter).toBe(parseUnits("994", 18));
    expect(buyerTokenAAfter).toBe(parseUnits("6", 18));
    expect(sellerTokenBAfter).toBe(parseUnits("12", 18));
    expect(buyerTokenBAfter).toBe(parseUnits("988", 18));

    const remaining = await client.readContract({
      ...exchange,
      functionName: "remainingAmountSell",
      args: [order]
    });
    expect(remaining).toBe(parseUnits("4", 18));
  });

  // Bulk Fill Orders
  it("supports bulk fill across multiple orders", async () => {
    const order1 = makeOrder({
      nonce: 3n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: BigInt(Math.floor(Date.now() / 1000) + 3600)
    });
    const order2 = makeOrder({
      nonce: 4n,
      amountSell: parseUnits("5", 18),
      amountBuy: parseUnits("15", 18),
      expiry: BigInt(Math.floor(Date.now() / 1000) + 3600)
    });

    const sig1 = await signOrder(order1);
    const sig2 = await signOrder(order2);

    const hash = await buyer.writeContract({
      ...exchange,
      functionName: "fillOrders",
      args: [[order1, order2], [sig1, sig2], [parseUnits("6", 18), parseUnits("5", 18)]]
    });
    await client.waitForTransactionReceipt({ hash });

    const buyerTokenAAfter = await client.readContract({
      ...tokenA,
      functionName: "balanceOf",
      args: [buyer.account.address]
    });
    expect(buyerTokenAAfter).toBe(parseUnits("11", 18));

    const sellerTokenBAfter = await client.readContract({
      ...tokenB,
      functionName: "balanceOf",
      args: [seller.account.address]
    });
    expect(sellerTokenBAfter).toBe(parseUnits("27", 18));
  });

  // Signature Validation
  it("rejects invalid signature", async () => {
    const order = makeOrder({
      nonce: 5n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: BigInt(Math.floor(Date.now() / 1000) + 3600)
    });
    const wrongSignature = await buyer.signTypedData({
      domain: {
        name: "SellOnlyLimitOrderExchange",
        version: "1",
        chainId: foundry.id,
        verifyingContract: exchange.address
      },
      primaryType: "Order",
      types: {
        Order: [
          { name: "seller", type: "address" },
          { name: "tokenSell", type: "address" },
          { name: "tokenBuy", type: "address" },
          { name: "amountSell", type: "uint256" },
          { name: "amountBuy", type: "uint256" },
          { name: "expiry", type: "uint256" },
          { name: "nonce", type: "uint256" }
        ]
      },
      message: order
    });

    await expect(
      buyer.writeContract({
        ...exchange,
        functionName: "fillOrder",
        args: [order, wrongSignature, parseUnits("1", 18)]
      })
    ).rejects.toThrow();
  });

  // Cancelled Order Rejection
  it("rejects canceled order", async () => {
    const order = makeOrder({
      nonce: 6n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: BigInt(Math.floor(Date.now() / 1000) + 3600)
    });
    const signature = await signOrder(order);

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
        args: [order, signature, parseUnits("1", 18)]
      })
    ).rejects.toThrow();
  });

  // Expiry Validation
  it("rejects expired order", async () => {
    const nowBlock = await client.getBlock();
    const order = makeOrder({
      nonce: 7n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: nowBlock.timestamp + 1n
    });
    const signature = await signOrder(order);

    await client.request({ method: "anvil_increaseTime", params: [2] });
    await client.request({ method: "anvil_mine", params: [1] });

    await expect(
      buyer.writeContract({
        ...exchange,
        functionName: "fillOrder",
        args: [order, signature, parseUnits("1", 18)]
      })
    ).rejects.toThrow();
  });

  // Partial Fill Ratio Integrity
  it("rejects non-integral partial fill ratio", async () => {
    const order = makeOrder({
      nonce: 8n,
      amountSell: 3n,
      amountBuy: 10n,
      expiry: BigInt(Math.floor(Date.now() / 1000) + 3600)
    });
    const signature = await signOrder(order);

    await expect(
      buyer.writeContract({
        ...exchange,
        functionName: "fillOrder",
        args: [order, signature, 1n]
      })
    ).rejects.toThrow();
  });

  // isFillable Check
  it("isFillable returns true for a valid candidate", async () => {
    const order = makeOrder({
      nonce: 9n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: BigInt(Math.floor(Date.now() / 1000) + 3600)
    });
    const signature = await signOrder(order);

    const ok = await client.readContract({
      ...exchange,
      functionName: "isFillable",
      args: [order, signature, parseUnits("4", 18), buyer.account.address]
    });
    expect(ok).toBe(true);
  });

  // isFillable Approval Check
  it("isFillable returns false when buyer has no approval", async () => {
    const order = makeOrder({
      nonce: 10n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: BigInt(Math.floor(Date.now() / 1000) + 3600)
    });
    const signature = await signOrder(order);

    await client.waitForTransactionReceipt({
      hash: await buyer.writeContract({
        ...tokenB,
        functionName: "approve",
        args: [exchange.address, 0n]
      })
    });

    const isFillable = await client.readContract({
      ...exchange,
      functionName: "isFillable",
      args: [order, signature, parseUnits("4", 18), buyer.account.address]
    });
    expect(isFillable).toBe(false);
  });

  // Overfill Protect
  it("prevents overfill after full fill", async () => {
    const order = makeOrder({
      nonce: 11n,
      amountSell: parseUnits("2", 18),
      amountBuy: parseUnits("4", 18),
      expiry: BigInt(Math.floor(Date.now() / 1000) + 3600)
    });
    const signature = await signOrder(order);

    await client.waitForTransactionReceipt({
      hash: await buyer.writeContract({
        ...exchange,
        functionName: "fillOrder",
        args: [order, signature, parseUnits("2", 18)]
      })
    });

    await expect(
      buyer.writeContract({
        ...exchange,
        functionName: "fillOrder",
        args: [order, signature, one]
      })
    ).rejects.toThrow();
  });

  // Cancel Authorization
  it("only seller can cancel their nonce", async () => {
    const order = makeOrder({
      nonce: 12n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: BigInt(Math.floor(Date.now() / 1000) + 3600)
    });

    await expect(
      other.writeContract({
        ...exchange,
        functionName: "cancelOrder",
        args: [order]
      })
    ).rejects.toThrow();
  });

  // Full Fill
  it("fills an entire order and marks it fully filled", async () => {
    const order = makeOrder({
      nonce: 50n,
      amountSell: parseUnits("10", 18),
      amountBuy: parseUnits("20", 18),
      expiry: BigInt(Math.floor(Date.now() / 1000) + 3600)
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

    expect(await client.readContract({ ...tokenA, functionName: "balanceOf", args: [seller.account.address] }))
      .toBe(parseUnits("990", 18));
    expect(await client.readContract({ ...tokenA, functionName: "balanceOf", args: [buyer.account.address] }))
      .toBe(parseUnits("10", 18));
    expect(await client.readContract({ ...tokenB, functionName: "balanceOf", args: [seller.account.address] }))
      .toBe(parseUnits("20", 18));
    expect(await client.readContract({ ...tokenB, functionName: "balanceOf", args: [buyer.account.address] }))
      .toBe(parseUnits("980", 18));
  });
});
