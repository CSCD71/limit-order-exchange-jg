import { createWalletClient, custom } from "https://esm.sh/viem@2.19.4";
import * as chains from "https://esm.sh/viem@2.19.4/chains";

const connectButton = document.getElementById("connectButton");
const walletStatus = document.getElementById("walletStatus");
const contractLine = document.getElementById("contractLine");
const etherscanLink = document.getElementById("etherscanLink");
const orderForm = document.getElementById("orderForm");
const signedPayload = document.getElementById("signedPayload");

let account = null;
let chainId = null;

function setStatus(text) {
  walletStatus.textContent = text;
}

function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

async function loadConfig() {
  const response = await fetch("config.json", { cache: "no-store" });
  if (!response.ok) return {};
  return response.json();
}

async function refreshContractLink() {
  const config = await loadConfig();
  if (!chainId || !config[String(chainId)]?.address) {
    contractLine.textContent = "Deploy address not configured for current chain.";
    etherscanLink.hidden = true;
    return;
  }

  const chain = Object.values(chains).find((c) => c?.id === Number(chainId));
  const explorer = chain?.blockExplorers?.default?.url;
  const address = config[String(chainId)].address;

  contractLine.textContent = `Exchange: ${address}`;

  if (explorer) {
    etherscanLink.href = `${explorer}/address/${address}`;
    etherscanLink.hidden = false;
  }
}

async function connectWallet() {
  if (!window.ethereum) {
    setStatus("MetaMask not detected.");
    return;
  }

  const walletClient = createWalletClient({ transport: custom(window.ethereum) });
  const [selected] = await walletClient.requestAddresses();
  const id = await walletClient.getChainId();

  account = selected;
  chainId = id;

  connectButton.textContent = "Connected";
  setStatus(`${shortAddress(account)} | Chain ID ${chainId}`);
  await refreshContractLink();
}

async function signOrder(event) {
  event.preventDefault();

  if (!window.ethereum || !account || !chainId) {
    signedPayload.textContent = "Please connect wallet first.";
    return;
  }

  const tokenSell = document.getElementById("tokenSell").value.trim();
  const tokenBuy = document.getElementById("tokenBuy").value.trim();
  const amountSell = BigInt(document.getElementById("amountSell").value.trim());
  const amountBuy = BigInt(document.getElementById("amountBuy").value.trim());
  const expiry = BigInt(document.getElementById("expiry").value.trim());
  const nonce = BigInt(document.getElementById("nonce").value.trim());

  const config = await loadConfig();
  const verifyingContract = config[String(chainId)]?.address;

  if (!verifyingContract) {
    signedPayload.textContent = "Missing contract address in config.json for current chain.";
    return;
  }

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

    signedPayload.textContent = JSON.stringify(
      {
        order: typedData.message,
        signature
      },
      null,
      2
    );
  } catch (error) {
    signedPayload.textContent = `Signature failed: ${error?.message ?? String(error)}`;
  }
}

connectButton.addEventListener("click", connectWallet);
orderForm.addEventListener("submit", signOrder);
