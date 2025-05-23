import { ethers } from "ethers";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  tokens,
  pairs,
  ROUTER,
  delay,
  erc20_abi,
  SWAP_ABI
} from './skw/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RPC = "https://testnet.dplabs-internal.com";
const provider = new ethers.JsonRpcProvider(RPC);

const privateKeys = fs.readFileSync(path.join(__dirname, "privatekey.txt"), "utf-8")
  .split("\n")
  .map(k => k.trim())
  .filter(k => k.length > 0);

const address = fs.readFileSync(path.join(__dirname, "address.txt"), "utf-8")
  .split("\n")
  .map(k => k.trim())
  .filter(k => k.length > 0);

async function approve(wallet, tokenAddress, spenderAddress, amountIn) {
  try {
    const Contract = new ethers.Contract(tokenAddress, erc20_abi, wallet);
    const allowance = await Contract.allowance(wallet.address, spenderAddress);
    if (allowance < amountIn) {
      console.log(chalk.hex('#20B2AA')(`🔓 Approving ${tokenAddress}`));
      const tx = await Contract.approve(spenderAddress, ethers.MaxUint256);
      await tx.wait();
      console.log(chalk.hex('#32CD32')(`✅ Approved`));
    }
  } catch (error) {
    console.error(`Failed to Approved token ${tokenAddress}:`, error);
  }
}

async function checkBalance(wallet, tokenAddress) {
  try {
    const Contract = new ethers.Contract(tokenAddress, erc20_abi, wallet);
    const balance = await Contract.balanceOf(wallet.address);
    return balance;
  } catch (error) {
    console.error(`Failed to check balance for token ${tokenAddress}:`, error);
  }
}

async function getFormattedBalance(wallet, tokenAddress, decimals) {
  const balanceRaw = await checkBalance(wallet, tokenAddress);
  return ethers.formatUnits(balanceRaw, decimals);
}

function buildExactInputSingle({ tokenIn, tokenOut, fee, recipient, amountIn, amountOutMinimum, sqrtPriceLimitX96 }) {
  const selector = "0x04e45aaf";
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "uint24", "address", "uint256", "uint256", "uint160"],
    [tokenIn, tokenOut, fee, recipient, amountIn, amountOutMinimum, sqrtPriceLimitX96]
  );
  return selector + encoded.slice(2);
}

async function deposit(wallet) {
  try {
    const WPHRSBalanceRaw = await getFormattedBalance(wallet, tokens.WPHRS.address, 18);
    const WPHRSBalance = parseFloat(WPHRSBalanceRaw).toFixed(5);

    const getBalance = await provider.getBalance(wallet.address);
    const toBalance = ethers.formatUnits(getBalance, 18);
    const balance = parseFloat(toBalance).toFixed(5);

    console.log(chalk.hex('#7B68EE')(`💰 Saldo ${balance} PHRS`));
    console.log(chalk.hex('#7B68EE')(`💰 Saldo ${WPHRSBalance} WPHRS`));

    const amount = "0.00001";
    const contract = new ethers.Contract(tokens.WPHRS.address, erc20_abi, wallet);

    console.log(chalk.hex('#20B2AA')(`🔁 Swap ${amount} PHRS ke WPHRS `));
    const tx = await contract.deposit({
      value: ethers.parseEther(amount),
      gasLimit: 100_000,
    });

    console.log(chalk.hex('#FF8C00')(`⏳ Tx dikirim ke blockchain!\n🌐 https://testnet.pharosscan.xyz/tx/${tx.hash}`));
    await tx.wait();
    console.log(chalk.hex('#66CDAA')(`✅ Swap Berhasil\n`));

    await delay(8000);
  } catch (err) {
    console.log(chalk.red("❌ Error during Swap:"), err.reason || err.message);
  }
}


async function swap(wallet, pair) {
  const fromToken = tokens[pair.from];
  const toToken = tokens[pair.to];

  if (!fromToken || !toToken) {
    console.error(chalk.red(`❌ Token tidak dikenali: ${pair.from} atau ${pair.to}`));
    return;
  }

  const amountIn = ethers.parseUnits(pair.amount, 18);
  const calldata = buildExactInputSingle({
    tokenIn: fromToken.address,
    tokenOut: toToken.address,
    fee: 500,
    recipient: wallet.address,
    amountIn,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0,
  });

  const contract = new ethers.Contract(ROUTER, SWAP_ABI, wallet);
  await approve(wallet, fromToken.address, ROUTER, amountIn);

  const fromBalanceRaw = await getFormattedBalance(wallet, fromToken.address, 18);
  const fromBalance = parseFloat(fromBalanceRaw).toFixed(3);

  const toBalanceRaw = await getFormattedBalance(wallet, toToken.address, 18);
  const toBalance = parseFloat(toBalanceRaw).toFixed(3);

  console.log(chalk.hex('#7B68EE')(`💰 Saldo ${pair.from}: ${fromBalance}`));
  console.log(chalk.hex('#7B68EE')(`💰 Saldo ${pair.to}: ${toBalance}`));

  if (fromBalance > (pair.amount)) {
    try {
      console.log(chalk.hex('#20B2AA')(`🔁 Swapping ${pair.amount} ${pair.from} to ${pair.to}...`));
      const tx = await contract.multicall(
        Math.floor(Date.now() / 1000),
        [calldata],
        {
          gasLimit: 1_000_000,
          gasPrice: 0,
        }
      );
      console.log(chalk.hex('#66CDAA')(`⏳ Tx dikirim ke blockchain!\n🌐 https://testnet.pharosscan.xyz/tx/${tx.hash}`));
      await tx.wait();
      console.log(chalk.hex('#32CD32')(`✅ Swap Berhasil\n`));
    } catch (err) {
      console.error(chalk.red(`❌ Error during swap for ${wallet.address}: ${err.message}\n`));
    }
  } else {
    console.log(chalk.yellow(`⚠️ Saldo ${pair.from} tidak cukup untuk swap sebesar ${pair.amount}\n`));
  }
}

async function sendcoin(wallet) {
  try {
    const repeat = 10;
    for (let i = 0; i < repeat; i++) {
      const getBalance = await provider.getBalance(wallet.address);
      const toBalance = ethers.formatUnits(getBalance, 18);
      const balance = parseFloat(toBalance).toFixed(5);

      console.log(chalk.hex('#7B68EE')(`💰 Saldo ${balance} PHRS`));

      const toAddress = address[Math.floor(Math.random() * address.length)];
      const amount = "0.00001";
      const value = ethers.parseEther(amount);

      if (getBalance > (value)) {

        console.log(chalk.hex('#20B2AA')(`🔁 Send ${amount} PHRS to ${toAddress}`));
        const tx = await wallet.sendTransaction({
          to: toAddress,
          value: value,
          gasLimit: 300000,
          gasPrice: ethers.parseUnits('0', 'gwei'),
        });

        console.log(chalk.hex('#FF8C00')(`⏳ Tx dikirim ke blockchain!\n🌐 https://testnet.pharosscan.xyz/tx/${tx.hash}`));
        await tx.wait();
        console.log(chalk.hex('#32CD32')(`✅ Send Berhasil\n`));
    
      await delay(3000);

      } else {
      console.log(chalk.yellow(`⚠️ Saldo PHRS tidak cukup untuk send sebesar ${amount}\n`));
      }
    }

  } catch (err) {
    console.error(chalk.red(`❌ Error during sendcoin for ${wallet.address}: ${err.message}\n`));
  }
}

async function swapandsend() {
  try {
    for (const pair of pairs) {
      const repeat = 10;
      for (let i = 0; i < repeat; i++) {
        await swap(wallet, pair);
        await delay(7000);
      }
    }

    await sendcoin(wallet);

    await delay(7000);
  } catch (error) {
    console.error(`❌ Error:`, error?.response?.data || error.message);
    throw error;
  }
}

export { swapandsend };
