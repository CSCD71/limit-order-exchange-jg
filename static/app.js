import { createPublicClient, createWalletClient, custom, parseUnits, formatUnits } from "https://esm.sh/viem@2.19.4";
import * as chains from "https://esm.sh/viem@2.19.4/chains";

const connectButton = document.getElementById("connectButton");
const walletStatus = document.getElementById("walletStatus");
const contractLine = document.getElementById("contractLine");
const etherscanLink = document.getElementById("etherscanLink");
const orderForm = document.getElementById("orderForm");
const expiryInput = document.getElementById("expiry");
const expiryDatetimeInput = document.getElementById("expiryDatetime");
const approveSellTokenButton = document.getElementById("approveSellTokenButton");
const publishButton = document.getElementById("publishButton");
const signedPayload = document.getElementById("signedPayload");
const signMeta = document.getElementById("signMeta");
const orderStatus = document.getElementById("orderStatus");

const manualFillForm = document.getElementById("manualFillForm");
const manualOrderPayload = document.getElementById("manualOrderPayload");
const manualFillAmount = document.getElementById("manualFillAmount");
const approveBuyTokenButton = document.getElementById("approveBuyTokenButton");
const manualStatus = document.getElementById("manualStatus");

const cancelOrderForm = document.getElementById("cancelOrderForm");
const cancelOrderPayload = document.getElementById("cancelOrderPayload");
const cancelStatus = document.getElementById("cancelStatus");

const marketForm = document.getElementById("marketForm");
const marketTokenSell = document.getElementById("marketTokenSell");
const marketTokenBuy = document.getElementById("marketTokenBuy");
const marketTargetAmount = document.getElementById("marketTargetAmount");
const refreshOrdersButton = document.getElementById("refreshOrdersButton");
const marketStatus = document.getElementById("marketStatus");

const EXCHANGE_ABI = [
  {
    type: "function",
    name: "publishOrder",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "order",
        type: "tuple",
        components: [
          { name: "seller", type: "address" },
          { name: "tokenSell", type: "address" },
          { name: "tokenBuy", type: "address" },
          { name: "amountSell", type: "uint256" },
          { name: "amountBuy", type: "uint256" },
          { name: "expiry", type: "uint256" },
          { name: "nonce", type: "uint256" }
        ]
      },
      { name: "signature", type: "bytes" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "cancelOrder",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "order",
        type: "tuple",
        components: [
          { name: "seller", type: "address" },
          { name: "tokenSell", type: "address" },
          { name: "tokenBuy", type: "address" },
          { name: "amountSell", type: "uint256" },
          { name: "amountBuy", type: "uint256" },
          { name: "expiry", type: "uint256" },
          { name: "nonce", type: "uint256" }
        ]
      }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "fillOrder",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "order",
        type: "tuple",
        components: [
          { name: "seller", type: "address" },
          { name: "tokenSell", type: "address" },
          { name: "tokenBuy", type: "address" },
          { name: "amountSell", type: "uint256" },
          { name: "amountBuy", type: "uint256" },
          { name: "expiry", type: "uint256" },
          { name: "nonce", type: "uint256" }
        ]
      },
      { name: "signature", type: "bytes" },
      { name: "fillAmountSell", type: "uint256" }
    ],
    outputs: [{ name: "fillAmountBuy", type: "uint256" }]
  },
  {
    type: "function",
    name: "fillOrders",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "orders",
        type: "tuple[]",
        components: [
          { name: "seller", type: "address" },
          { name: "tokenSell", type: "address" },
          { name: "tokenBuy", type: "address" },
          { name: "amountSell", type: "uint256" },
          { name: "amountBuy", type: "uint256" },
          { name: "expiry", type: "uint256" },
          { name: "nonce", type: "uint256" }
        ]
      },
      { name: "signatures", type: "bytes[]" },
      { name: "fillAmountSellList", type: "uint256[]" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "isFillable",
    stateMutability: "view",
    inputs: [
      {
        name: "order",
        type: "tuple",
        components: [
          { name: "seller", type: "address" },
          { name: "tokenSell", type: "address" },
          { name: "tokenBuy", type: "address" },
          { name: "amountSell", type: "uint256" },
          { name: "amountBuy", type: "uint256" },
          { name: "expiry", type: "uint256" },
          { name: "nonce", type: "uint256" }
        ]
      },
      { name: "signature", type: "bytes" },
      { name: "fillAmountSell", type: "uint256" },
      { name: "buyer", type: "address" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    name: "canceledNonce",
    stateMutability: "view",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    name: "remainingAmountSell",
    stateMutability: "view",
    inputs: [
      {
        name: "order",
        type: "tuple",
        components: [
          { name: "seller", type: "address" },
          { name: "tokenSell", type: "address" },
          { name: "tokenBuy", type: "address" },
          { name: "amountSell", type: "uint256" },
          { name: "amountBuy", type: "uint256" },
          { name: "expiry", type: "uint256" },
          { name: "nonce", type: "uint256" }
        ]
      }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "hashOrder",
    stateMutability: "view",
    inputs: [
      {
        name: "order",
        type: "tuple",
        components: [
          { name: "seller", type: "address" },
          { name: "tokenSell", type: "address" },
          { name: "tokenBuy", type: "address" },
          { name: "amountSell", type: "uint256" },
          { name: "amountBuy", type: "uint256" },
          { name: "expiry", type: "uint256" },
          { name: "nonce", type: "uint256" }
        ]
      }
    ],
    outputs: [{ name: "", type: "bytes32" }]
  },
  {
    type: "event",
    name: "OrderPublished",
    inputs: [
      { indexed: true, name: "orderHash", type: "bytes32" },
      { indexed: true, name: "seller", type: "address" },
      { indexed: true, name: "tokenSell", type: "address" },
      { indexed: false, name: "tokenBuy", type: "address" },
      { indexed: false, name: "amountSell", type: "uint256" },
      { indexed: false, name: "amountBuy", type: "uint256" },
      { indexed: false, name: "expiry", type: "uint256" },
      { indexed: false, name: "nonce", type: "uint256" },
      { indexed: false, name: "signature", type: "bytes" }
    ]
  }
];

const ERC20_ABI = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }]
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }]
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  }
];

let account = null;
let chainId = null;
let walletClient = null;
let publicClient = null;
let exchangeAddress = null;
let latestSigned = null;
let knownOrders = [];
let chainPublishedOrders = [];

const TARGET_CHAIN_ID = 11155111;
const TARGET_CHAIN_HEX = "0xaa36a7";

const KNOWN_ORDERS_KEY = "loe-known-orders";

function setStatus(text) {
  walletStatus.textContent = text;
}

function setOrderStatus(text) {
  orderStatus.textContent = text;
}

function setManualStatus(text) {
  manualStatus.textContent = text;
}

function setCancelStatus(text) {
  cancelStatus.textContent = text;
}

function setMarketStatus(text) {
  marketStatus.textContent = text;
}

function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function toDatetimeLocalValueFromUnix(unixSeconds) {
  const date = new Date(Number(unixSeconds) * 1000);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toUnixFromDatetimeLocal(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.floor(ms / 1000);
}

function syncExpiryFromDatetime() {
  if (!expiryDatetimeInput || !expiryInput) return;
  const unix = toUnixFromDatetimeLocal(expiryDatetimeInput.value);
  if (unix === null) return;
  expiryInput.value = String(unix);
}

function syncDatetimeFromExpiry() {
  if (!expiryDatetimeInput || !expiryInput) return;
  const unix = Number(expiryInput.value);
  if (!Number.isFinite(unix) || unix <= 0) return;
  expiryDatetimeInput.value = toDatetimeLocalValueFromUnix(unix);
}

function initializeExpiryDefault() {
  if (!expiryDatetimeInput || !expiryInput) return;
  if (expiryDatetimeInput.value && expiryInput.value) return;
  const unix = Math.floor(Date.now() / 1000) + 3600;
  expiryInput.value = String(unix);
  expiryDatetimeInput.value = toDatetimeLocalValueFromUnix(unix);
}

function parseOrderPayload(text) {
  const payload = JSON.parse(text);
  if (!payload?.order || !payload?.signature) throw new Error("Payload requires order and signature");
  return {
    order: {
      seller: payload.order.seller,
      tokenSell: payload.order.tokenSell,
      tokenBuy: payload.order.tokenBuy,
      amountSell: BigInt(payload.order.amountSell),
      amountBuy: BigInt(payload.order.amountBuy),
      expiry: BigInt(payload.order.expiry),
      nonce: BigInt(payload.order.nonce)
    },
    signature: payload.signature
  };
}

function serializeOrderPayload(order, signature) {
  return JSON.stringify(
    {
      order: {
        seller: order.seller,
        tokenSell: order.tokenSell,
        tokenBuy: order.tokenBuy,
        amountSell: order.amountSell.toString(),
        amountBuy: order.amountBuy.toString(),
        expiry: order.expiry.toString(),
        nonce: order.nonce.toString()
      },
      signature
    },
    null,
    2
  );
}

function gcd(a, b) {
  let x = a;
  let y = b;
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

function floorFillToIntegral(fillAmountSell, order) {
  const unit = order.amountSell / gcd(order.amountSell, order.amountBuy);
  return (fillAmountSell / unit) * unit;
}

function getMarketItemLabel(order) {
  return `${shortAddress(order.seller)}#${order.nonce.toString()}`;
}

async function getMarketUnfillableReasons(exchange, order, signature, fillAmountSell) {
  const reasons = [];

  if (!order.seller || order.seller === "0x0000000000000000000000000000000000000000") {
    reasons.push("invalid seller");
    return reasons;
  }
  if (!order.tokenSell || !order.tokenBuy) {
    reasons.push("invalid token pair");
    return reasons;
  }
  if (order.tokenSell.toLowerCase() === order.tokenBuy.toLowerCase()) {
    reasons.push("tokenSell equals tokenBuy");
    return reasons;
  }
  if (order.amountSell <= 0n || order.amountBuy <= 0n) {
    reasons.push("invalid amount");
    return reasons;
  }

  // const now = BigInt(Math.floor(Date.now() / 1000));
  // if (order.expiry <= now) reasons.push("expired");

  // const canceled = await publicClient.readContract({
  //   ...exchange,
  //   functionName: "canceledNonce",
  //   args: [order.seller, order.nonce]
  // });
  // if (canceled) reasons.push("nonce canceled");

  const chainRemaining = await publicClient.readContract({
    ...exchange,
    functionName: "remainingAmountSell",
    args: [order]
  });
  if (chainRemaining === 0n) reasons.push("already filled");
  if (fillAmountSell === 0n) reasons.push("fill amount is zero");
  if (fillAmountSell > chainRemaining) reasons.push("fill exceeds remaining");

  if ((fillAmountSell * order.amountBuy) % order.amountSell !== 0n) {
    reasons.push("non-integral ratio");
  }

  const sellerAllowance = await publicClient.readContract({
    abi: ERC20_ABI,
    address: order.tokenSell,
    functionName: "allowance",
    args: [order.seller, exchange.address]
  });
  if (sellerAllowance < fillAmountSell) reasons.push(`Seller allowance too low with fillAmountSell ${fillAmountSell}, ${sellerAllowance}`);

  const sellerBalance = await publicClient.readContract({
    abi: ERC20_ABI,
    address: order.tokenSell,
    functionName: "balanceOf",
    args: [order.seller]
  });
  if (sellerBalance < fillAmountSell) reasons.push("seller balance low");

  return reasons;
}

function loadKnownOrders() {
  try {
    const raw = localStorage.getItem(KNOWN_ORDERS_KEY);
    if (!raw) return;
    const list = JSON.parse(raw);
    knownOrders = list.map((entry) => parseOrderPayload(JSON.stringify(entry)));
  } catch {
    knownOrders = [];
  }
}

function saveKnownOrders() {
  const list = knownOrders.map((entry) => ({
    order: {
      seller: entry.order.seller,
      tokenSell: entry.order.tokenSell,
      tokenBuy: entry.order.tokenBuy,
      amountSell: entry.order.amountSell.toString(),
      amountBuy: entry.order.amountBuy.toString(),
      expiry: entry.order.expiry.toString(),
      nonce: entry.order.nonce.toString()
    },
    signature: entry.signature
  }));
  localStorage.setItem(KNOWN_ORDERS_KEY, JSON.stringify(list));
}

function upsertKnownOrder(order, signature) {
  const index = knownOrders.findIndex(
    (entry) =>
      entry.order.seller.toLowerCase() === order.seller.toLowerCase() &&
      entry.order.nonce === order.nonce &&
      entry.order.tokenSell.toLowerCase() === order.tokenSell.toLowerCase() &&
      entry.order.tokenBuy.toLowerCase() === order.tokenBuy.toLowerCase()
  );
  if (index >= 0) {
    knownOrders[index] = { order, signature };
  } else {
    knownOrders.push({ order, signature });
  }
  saveKnownOrders();
}

async function ensureClients() {
  if (!window.ethereum) throw new Error("MetaMask not detected");
  if (!walletClient) {
    walletClient = createWalletClient({ transport: custom(window.ethereum) });
  }
  if (!publicClient) {
    publicClient = createPublicClient({ transport: custom(window.ethereum) });
  }
}

async function requestSwitchToSepolia() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: TARGET_CHAIN_HEX }]
    });
    return true;
  } catch {
    return false;
  }
}

function getExchangeContract() {
  if (!exchangeAddress) throw new Error("Exchange address missing for current chain in config.json");
  return {
    abi: EXCHANGE_ABI,
    address: exchangeAddress
  };
}

function getCurrentChainConfig() {
  return Object.values(chains).find((chain) => chain?.id === Number(chainId));
}

async function readTokenDecimals(address) {
  try {
    return Number(
      await publicClient.readContract({
        abi: ERC20_ABI,
        address,
        functionName: "decimals"
      })
    );
  } catch {
    return 18;
  }
}

async function readTokenSymbol(address) {
  try {
    return await publicClient.readContract({
      abi: ERC20_ABI,
      address,
      functionName: "symbol"
    });
  } catch {
    return "TOKEN";
  }
}

async function ensureAllowance(tokenAddress, owner, spender, requiredAmount, statusSetter) {
  const allowance = await publicClient.readContract({
    abi: ERC20_ABI,
    address: tokenAddress,
    functionName: "allowance",
    args: [owner, spender]
  });

  if (allowance >= requiredAmount) return;

  statusSetter("Approval required. Sending approve transaction...");
  const hash = await walletClient.writeContract({
    abi: ERC20_ABI,
    address: tokenAddress,
    functionName: "approve",
    args: [spender, requiredAmount],
    account,
    chain: getCurrentChainConfig()
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

async function loadConfig() {
  const response = await fetch("config.json", { cache: "no-store" });
  if (!response.ok) return {};
  return response.json();
}

async function refreshContractLink() {
  const config = await loadConfig();
  exchangeAddress = config["11155111"]?.address || null;

  if (!chainId || !exchangeAddress) {
    contractLine.textContent = `No deployed contract configured. Switch to Sepolia (11155111).`;
    etherscanLink.hidden = true;
    return;
  }

  const chain = Object.values(chains).find((c) => c?.id === Number(chainId));
  const explorer = chain?.blockExplorers?.default?.url;

  contractLine.textContent = `Exchange: ${exchangeAddress}`;

  if (explorer) {
    etherscanLink.href = `${explorer}/address/${exchangeAddress}`;
    etherscanLink.hidden = false;
  }
}

function disconnectWallet() {
  account = null;
  chainId = null;
  exchangeAddress = null;
  connectButton.textContent = "Connect Wallet";
  setStatus("Disconnected");
  contractLine.textContent = "Connect wallet to load contract address.";
  etherscanLink.hidden = true;
}

async function connectWallet() {
  await ensureClients();
  const [selected] = await walletClient.requestAddresses();
  let id = await walletClient.getChainId();

  account = selected;

  if (id !== TARGET_CHAIN_ID) {
    setStatus(`${shortAddress(account)} | Chain ID ${id} (requesting switch to Sepolia...)`);
    await requestSwitchToSepolia();
    id = await walletClient.getChainId();
  }

  chainId = id;

  connectButton.textContent = "Disconnect";
  setStatus(`${shortAddress(account)} | Chain ID ${chainId}`);
  if (chainId !== TARGET_CHAIN_ID) {
    setStatus(`${shortAddress(account)} | Chain ID ${chainId} (switch to Sepolia 11155111)`);
  }
  await refreshContractLink();
  await refreshPublishedHashes();
}

async function signOrder(event) {
  event.preventDefault();

  if (!window.ethereum || !account || !chainId) {
    signedPayload.textContent = "Please connect wallet first.";
    return;
  }

  await ensureClients();

  const tokenSell = document.getElementById("tokenSell").value.trim();
  const tokenBuy = document.getElementById("tokenBuy").value.trim();
  const amountSellHuman = document.getElementById("amountSell").value.trim();
  const amountBuyHuman = document.getElementById("amountBuy").value.trim();
  const expiryRaw = document.getElementById("expiry").value.trim();
  if (!expiryRaw) {
    syncExpiryFromDatetime();
  }
  const expiry = BigInt(document.getElementById("expiry").value.trim());
  const nonce = BigInt(document.getElementById("nonce").value.trim());

  const config = await loadConfig();
  const verifyingContract = config[String(chainId)]?.address;

  if (!verifyingContract) {
    signedPayload.textContent = "Missing contract address in config.json for current chain.";
    return;
  }

  const sellDecimals = await readTokenDecimals(tokenSell);
  const buyDecimals = await readTokenDecimals(tokenBuy);
  const sellSymbol = await readTokenSymbol(tokenSell);
  const buySymbol = await readTokenSymbol(tokenBuy);

  const amountSell = parseUnits(amountSellHuman, sellDecimals);
  const amountBuy = parseUnits(amountBuyHuman, buyDecimals);

  const typedData = {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" }
      ],
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
    primaryType: "Order",
    domain: {
      name: "SellOnlyLimitOrderExchange",
      version: "1",
      chainId,
      verifyingContract
    },
    message: {
      seller: account,
      tokenSell,
      tokenBuy,
      amountSell: amountSell.toString(),
      amountBuy: amountBuy.toString(),
      expiry: expiry.toString(),
      nonce: nonce.toString()
    }
  };

  try {
    const signature = await window.ethereum.request({
      method: "eth_signTypedData_v4",
      params: [account, JSON.stringify(typedData)]
    });

    const order = {
      seller: typedData.message.seller,
      tokenSell: typedData.message.tokenSell,
      tokenBuy: typedData.message.tokenBuy,
      amountSell: BigInt(typedData.message.amountSell),
      amountBuy: BigInt(typedData.message.amountBuy),
      expiry: BigInt(typedData.message.expiry),
      nonce: BigInt(typedData.message.nonce)
    };

    latestSigned = { order, signature };
    upsertKnownOrder(order, signature);

    signMeta.textContent = `Sell token: ${sellSymbol} (${sellDecimals} decimals), Buy token: ${buySymbol} (${buyDecimals} decimals)`;
    signedPayload.textContent = serializeOrderPayload(order, signature);
    manualOrderPayload.value = signedPayload.textContent;
    cancelOrderPayload.value = signedPayload.textContent;
    setOrderStatus("Order signed. You can publish it on-chain or share it off-chain.");
  } catch (error) {
    signedPayload.textContent = `Signature failed: ${error?.message ?? String(error)}`;
  }
}

async function approveSellTokenForOrder() {
  try {
    await ensureClients();
    if (!account || !chainId) throw new Error("Connect wallet first");

    const exchange = getExchangeContract();
    const tokenSell = document.getElementById("tokenSell").value.trim();
    const amountSellHuman = document.getElementById("amountSell").value.trim();
    if (!tokenSell || !amountSellHuman) throw new Error("Enter token sell address and amount sell first");

    const sellDecimals = await readTokenDecimals(tokenSell);
    const amountSell = parseUnits(amountSellHuman, sellDecimals);

    await ensureAllowance(tokenSell, account, exchange.address, amountSell, setOrderStatus);
    setOrderStatus("Sell token approved for exchange contract.");
  } catch (error) {
    setOrderStatus(`Approve sell token failed: ${error?.shortMessage ?? error?.message ?? String(error)}`);
  }
}

async function publishSignedOrder() {
  try {
    await ensureClients();
    if (!account || !chainId) throw new Error("Connect wallet first");
    if (!latestSigned) throw new Error("Sign an order first");

    const exchange = getExchangeContract();
    const { order, signature } = latestSigned;

    await ensureAllowance(order.tokenSell, account, exchange.address, order.amountSell, setOrderStatus);

    setOrderStatus("Publishing order on-chain...");
    const hash = await walletClient.writeContract({
      ...exchange,
      functionName: "publishOrder",
      args: [order, signature],
      account,
      chain: getCurrentChainConfig()
    });
    await publicClient.waitForTransactionReceipt({ hash });
      await refreshPublishedHashes();

    setOrderStatus(`Order published. Tx: ${hash}`);
  } catch (error) {
    setOrderStatus(`Publish failed: ${error?.shortMessage ?? error?.message ?? String(error)}`);
  }
}

async function parseManualOrderFromForm() {
  const payload = parseOrderPayload(manualOrderPayload.value.trim());
  upsertKnownOrder(payload.order, payload.signature);
  return payload;
}

async function cancelOrderOnChain(event) {
  event.preventDefault();

  try {
    await ensureClients();
    if (!account || !chainId) throw new Error("Connect wallet first");

    const payloadText = cancelOrderPayload.value.trim();
    const payload = parseOrderPayload(payloadText);
    const exchange = getExchangeContract();

    setCancelStatus("Submitting cancelOrder transaction...");
    const hash = await walletClient.writeContract({
      ...exchange,
      functionName: "cancelOrder",
      args: [payload.order],
      account,
      chain: getCurrentChainConfig()
    });
    await publicClient.waitForTransactionReceipt({ hash });
    setCancelStatus(`Order canceled. Tx: ${hash}`);
  } catch (error) {
    setCancelStatus(`Cancel failed: ${error?.shortMessage ?? error?.message ?? String(error)}`);
  }
}

async function approveManualBuyToken() {
  try {
    await ensureClients();
    if (!account || !chainId) throw new Error("Connect wallet first");

    const { order } = await parseManualOrderFromForm();
    const exchange = getExchangeContract();

    const remaining = await publicClient.readContract({
      ...exchange,
      functionName: "remainingAmountSell",
      args: [order]
    });
    if (remaining === 0n) throw new Error("Order already fully filled");

    const requestedHuman = manualFillAmount.value.trim();
    const sellDecimals = await readTokenDecimals(order.tokenSell);
    let fillAmountSell = remaining;
    if (requestedHuman) {
      fillAmountSell = parseUnits(requestedHuman, sellDecimals);
      if (fillAmountSell > remaining) {
        throw new Error(`Fill amount too large. Remaining sell amount is ${formatUnits(remaining, sellDecimals)}.`);
      }
    }
    fillAmountSell = floorFillToIntegral(fillAmountSell, order);
    if (fillAmountSell <= 0n) throw new Error("Fill amount rounds down to zero");

    const fillAmountBuy = (fillAmountSell * order.amountBuy) / order.amountSell;
    await ensureAllowance(order.tokenBuy, account, exchange.address, fillAmountBuy, setManualStatus);
    setManualStatus("Buy token approved for this fill amount.");
  } catch (error) {
    setManualStatus(`Approve failed: ${error?.shortMessage ?? error?.message ?? String(error)}`);
  }
}

async function executeManualFill(event) {
  event.preventDefault();

  try {
    await ensureClients();
    if (!account || !chainId) throw new Error("Connect wallet first");

    const { order, signature } = await parseManualOrderFromForm();
    const exchange = getExchangeContract();
    const remaining = await publicClient.readContract({
      ...exchange,
      functionName: "remainingAmountSell",
      args: [order]
    });
    if (remaining === 0n) throw new Error("Order already fully filled");

    const sellDecimals = await readTokenDecimals(order.tokenSell);
    const requestedHuman = manualFillAmount.value.trim();
    let fillAmountSell = remaining;
    if (requestedHuman) {
      fillAmountSell = parseUnits(requestedHuman, sellDecimals);
      if (fillAmountSell > remaining) {
        throw new Error(`Fill amount too large. Remaining sell amount is ${formatUnits(remaining, sellDecimals)}.`);
      }
    }

    fillAmountSell = floorFillToIntegral(fillAmountSell, order);
    if (fillAmountSell <= 0n) throw new Error("Fill amount rounds down to zero");

    const fillAmountBuy = (fillAmountSell * order.amountBuy) / order.amountSell;

    const isFillable = await publicClient.readContract({
      ...exchange,
      functionName: "isFillable",
      args: [order, signature, fillAmountSell, account]
    });

    if (!isFillable) {
      const reasons = [];
      const now = BigInt(Math.floor(Date.now() / 1000));
      if (order.expiry <= now) reasons.push("Order expired");

      const canceled = await publicClient.readContract({
        ...exchange,
        functionName: "canceledNonce",
        args: [order.seller, order.nonce]
      });
      if (canceled) reasons.push("Order nonce canceled by seller");

      const sellerAllowance = await publicClient.readContract({
        abi: ERC20_ABI,
        address: order.tokenSell,
        functionName: "allowance",
        args: [order.seller, exchange.address]
      });
      if (sellerAllowance < fillAmountSell) reasons.push(`Seller allowance too low with fillAmountSell ${fillAmountSell}, ${sellerAllowance}`);

      const sellerBalance = await publicClient.readContract({
        abi: ERC20_ABI,
        address: order.tokenSell,
        functionName: "balanceOf",
        args: [order.seller]
      });
      if (sellerBalance < fillAmountSell) reasons.push("Seller token balance too low with");

      const buyerAllowance = await publicClient.readContract({
        abi: ERC20_ABI,
        address: order.tokenBuy,
        functionName: "allowance",
        args: [account, exchange.address]
      });
      if (buyerAllowance < fillAmountBuy) reasons.push("Buyer allowance too low");

      const buyerBalance = await publicClient.readContract({
        abi: ERC20_ABI,
        address: order.tokenBuy,
        functionName: "balanceOf",
        args: [account]
      });
      if (buyerBalance < fillAmountBuy) reasons.push("Buyer token balance too low");

      if ((fillAmountSell * order.amountBuy) % order.amountSell !== 0n) reasons.push("Fill amount violates integral ratio");

      throw new Error(reasons.length ? `Order not fillable: ${reasons.join("; ")}` : "Order not fillable (signature/nonce/state mismatch)");
    }

    await ensureAllowance(order.tokenBuy, account, exchange.address, fillAmountBuy, setManualStatus);

    setManualStatus("Executing fillOrder...");
    const hash = await walletClient.writeContract({
      ...exchange,
      functionName: "fillOrder",
      args: [order, signature, fillAmountSell],
      account,
      chain: getCurrentChainConfig()
    });
    await publicClient.waitForTransactionReceipt({ hash });
    setManualStatus(`fillOrder success. Tx: ${hash}`);
  } catch (error) {
    setManualStatus(`fillOrder failed: ${error?.shortMessage ?? error?.message ?? String(error)}`);
  }
}

async function refreshPublishedHashes() {
  try {
    await ensureClients();
    if (!exchangeAddress) {
      setMarketStatus("Exchange address not loaded for current chain.");
      return 0;
    }

    const logs = await publicClient.getLogs({
      address: exchangeAddress,
      event: EXCHANGE_ABI.find((item) => item.type === "event" && item.name === "OrderPublished"),
      fromBlock: 0n,
      toBlock: "latest"
    });

    const latestByKey = new Map();
    for (const log of logs) {
      const order = {
        seller: String(log.args.seller),
        tokenSell: String(log.args.tokenSell),
        tokenBuy: String(log.args.tokenBuy),
        amountSell: BigInt(log.args.amountSell),
        amountBuy: BigInt(log.args.amountBuy),
        expiry: BigInt(log.args.expiry),
        nonce: BigInt(log.args.nonce)
      };
      const signature = String(log.args.signature);
      const key = `${order.seller.toLowerCase()}-${order.tokenSell.toLowerCase()}-${order.tokenBuy.toLowerCase()}-${order.nonce.toString()}`;
      latestByKey.set(key, { order, signature });
      upsertKnownOrder(order, signature);
    }

    chainPublishedOrders = Array.from(latestByKey.values());
    setMarketStatus(`Loaded ${chainPublishedOrders.length} published orders from chain.`);
    return chainPublishedOrders.length;
  } catch (error) {
    setMarketStatus(`Refresh failed: ${error?.shortMessage ?? error?.message ?? String(error)}`);
    return 0;
  }
}

async function executeMarketFill(event) {
  event.preventDefault();

  try {
    await ensureClients();
    if (!account || !chainId) throw new Error("Connect wallet first");

    await refreshContractLink();
    const publishedCount = await refreshPublishedHashes();
    if (!publishedCount) {
      throw new Error("No published orders found on current contract. Publish an order first.");
    }

    const tokenSell = marketTokenSell.value.trim().toLowerCase();
    const tokenBuy = marketTokenBuy.value.trim().toLowerCase();
    const targetHuman = marketTargetAmount.value.trim();
    const sellDecimals = await readTokenDecimals(marketTokenSell.value.trim());
    let remainingTarget = parseUnits(targetHuman, sellDecimals);

    const exchange = getExchangeContract();
    const candidates = [];

    for (const entry of chainPublishedOrders) {
      const order = entry.order;
      if (order.tokenSell.toLowerCase() !== tokenSell || order.tokenBuy.toLowerCase() !== tokenBuy) continue;

      const chainRemaining = await publicClient.readContract({
        ...exchange,
        functionName: "remainingAmountSell",
        args: [order]
      });
      if (chainRemaining === 0n) continue;

      candidates.push({ order, signature: entry.signature, remaining: chainRemaining });
    }

    if (!candidates.length) {
      throw new Error(
        `No matching published orders for this pair on current contract (tokenSell=${tokenSell}, tokenBuy=${tokenBuy}).`
      );
    }

    candidates.sort((a, b) => {
      const left = a.order.amountBuy * b.order.amountSell;
      const right = b.order.amountBuy * a.order.amountSell;
      if (left < right) return -1;
      if (left > right) return 1;
      return 0;
    });

    const selectedOrders = [];
    const selectedSignatures = [];
    const selectedFills = [];
    const skippedItems = [];
    let totalBuyTokenNeeded = 0n;

    for (const item of candidates) {
      if (remainingTarget <= 0n) break;
      let fillAmountSell = item.remaining < remainingTarget ? item.remaining : remainingTarget;
      fillAmountSell = floorFillToIntegral(fillAmountSell, item.order);
      if (fillAmountSell <= 0n) {
        skippedItems.push(`${getMarketItemLabel(item.order)}: fill rounds to zero (integral ratio)`);
        continue;
      }

      const isFillable = await publicClient.readContract({
        ...exchange,
        functionName: "isFillable",
        args: [item.order, item.signature, fillAmountSell, "0x0000000000000000000000000000000000000000"]
      });
      if (!isFillable) {
        const reasons = await getMarketUnfillableReasons(exchange, item.order, item.signature, fillAmountSell);
        skippedItems.push(`${getMarketItemLabel(item.order)}: ${reasons.join(", ")}`);
        continue;
      }

      const fillAmountBuy = (fillAmountSell * item.order.amountBuy) / item.order.amountSell;

      selectedOrders.push(item.order);
      selectedSignatures.push(item.signature);
      selectedFills.push(fillAmountSell);
      totalBuyTokenNeeded += fillAmountBuy;
      remainingTarget -= fillAmountSell;
    }

    if (!selectedOrders.length) {
      const diagnostics = skippedItems.length
        ? ` Skipped sample: ${skippedItems.slice(0, 5).join(" | ")}`
        : "";
      throw new Error(`No fillable published orders found.${diagnostics}`);
    }

    await ensureAllowance(marketTokenBuy.value.trim(), account, exchange.address, totalBuyTokenNeeded, setMarketStatus);

    setMarketStatus(`Executing fillOrders using ${selectedOrders.length} order(s)...`);
    const hash = await walletClient.writeContract({
      ...exchange,
      functionName: "fillOrders",
      args: [selectedOrders, selectedSignatures, selectedFills],
      account,
      chain: getCurrentChainConfig()
    });
    await publicClient.waitForTransactionReceipt({ hash });

    if (remainingTarget > 0n) {
      setMarketStatus(`Partial market fill executed. Tx: ${hash}`);
    } else {
      setMarketStatus(`Market fill executed successfully. Tx: ${hash}`);
    }
  } catch (error) {
    setMarketStatus(`Market execution failed: ${error?.shortMessage ?? error?.message ?? String(error)}`);
  }
}

function onConnectToggle() {
  if (account) {
    disconnectWallet();
    return;
  }
  connectWallet().catch((error) => {
    setStatus(`Connect failed: ${error?.shortMessage ?? error?.message ?? String(error)}`);
  });
}

if (window.ethereum) {
  window.ethereum.on("accountsChanged", (accounts) => {
    if (!accounts?.length) {
      disconnectWallet();
      return;
    }
    account = accounts[0];
    connectButton.textContent = "Disconnect";
    setStatus(`${shortAddress(account)} | Chain ID ${chainId ?? "?"}`);
  });

  window.ethereum.on("chainChanged", (newChainIdHex) => {
    chainId = Number(BigInt(newChainIdHex));
    refreshContractLink();
  });
}

loadKnownOrders();
initializeExpiryDefault();

if (expiryDatetimeInput) {
  expiryDatetimeInput.addEventListener("change", syncExpiryFromDatetime);
}
if (expiryInput) {
  expiryInput.addEventListener("input", syncDatetimeFromExpiry);
}

connectButton.addEventListener("click", onConnectToggle);
approveSellTokenButton.addEventListener("click", approveSellTokenForOrder);
orderForm.addEventListener("submit", signOrder);
publishButton.addEventListener("click", publishSignedOrder);
approveBuyTokenButton.addEventListener("click", approveManualBuyToken);
manualFillForm.addEventListener("submit", executeManualFill);
cancelOrderForm.addEventListener("submit", cancelOrderOnChain);
refreshOrdersButton.addEventListener("click", refreshPublishedHashes);
marketForm.addEventListener("submit", executeMarketFill);
