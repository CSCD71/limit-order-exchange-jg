import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";
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
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
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

  let exchange;
  let tokenA;
  let tokenB;

  beforeAll(async () => {
    [seller, buyer, third] = privateKeys.map((pk) =>
      createWalletClient({
        chain: foundry,
        transport: rpc,
        account: privateKeyToAccount(pk)
      })
    );

    const exchangeArtifact = loadContract("LimitOrderExchange");
    const mockArtifact = loadContract("MockERC20", "mocks/MockERC20.sol");

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

    const mintAHash = await seller.writeContract({
      ...tokenA,
      functionName: "mint",
      args: [seller.account.address, parseUnits("1000", 18)]
    });
    await client.waitForTransactionReceipt({ hash: mintAHash });

    const mintBHash = await seller.writeContract({
      ...tokenB,
      functionName: "mint",
      args: [buyer.account.address, parseUnits("1000", 18)]
    });
    await client.waitForTransactionReceipt({ hash: mintBHash });
  });

  it("deploys with EIP-712 domain name", async () => {
    const domainName = await client.readContract({
      ...exchange,
      functionName: "eip712Domain"
    });

    expect(domainName[1]).toBe("SellOnlyLimitOrderExchange");
  });

  it("fills a signed order partially", async () => {
    const amountSell = parseUnits("10", 18);
    const amountBuy = parseUnits("20", 18);

    const order = {
      seller: seller.account.address,
      tokenSell: tokenA.address,
      tokenBuy: tokenB.address,
      amountSell,
      amountBuy,
      expiry: BigInt(Math.floor(Date.now() / 1000) + 3600),
      nonce: 1n
    };

    const signature = await seller.signTypedData({
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

    const approveSellHash = await seller.writeContract({
      ...tokenA,
      functionName: "approve",
      args: [exchange.address, amountSell]
    });
    await client.waitForTransactionReceipt({ hash: approveSellHash });

    const approveBuyHash = await buyer.writeContract({
      ...tokenB,
      functionName: "approve",
      args: [exchange.address, amountBuy]
    });
    await client.waitForTransactionReceipt({ hash: approveBuyHash });

    const publishHash = await seller.writeContract({
      ...exchange,
      functionName: "publishOrder",
      args: [order, signature]
    });
    await client.waitForTransactionReceipt({ hash: publishHash });

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

    const sellerTokenABalance = await client.readContract({
      ...tokenA,
      functionName: "balanceOf",
      args: [seller.account.address]
    });
    const buyerTokenABalance = await client.readContract({
      ...tokenA,
      functionName: "balanceOf",
      args: [buyer.account.address]
    });

    const sellerTokenBBalance = await client.readContract({
      ...tokenB,
      functionName: "balanceOf",
      args: [seller.account.address]
    });
    const buyerTokenBBalance = await client.readContract({
      ...tokenB,
      functionName: "balanceOf",
      args: [buyer.account.address]
    });

    expect(sellerTokenABalance).toBe(parseUnits("994", 18));
    expect(buyerTokenABalance).toBe(parseUnits("6", 18));
    expect(sellerTokenBBalance).toBe(parseUnits("12", 18));
    expect(buyerTokenBBalance).toBe(parseUnits("988", 18));

    const isFillable = await client.readContract({
      ...exchange,
      functionName: "isFillable",
      args: [order, signature, parseUnits("4", 18), third.account.address]
    });
    expect(isFillable).toBe(false);
  });
});
