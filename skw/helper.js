import { ethers } from "ethers";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();
import { logger } from "./logger.js";
import {
 ZENITH_ADDRESS,
 explorer,
} from "./contract.js";

import {
 provider,
 delay,
 randomdelay,
 buildExactInputSingle,
 generateAddresses,
} from "./config.js";

import {
 erc20Abi,
 SWAP_ABI,
 POOL_ABI,
 LP_ROUTER_ABI,
 nftAbi,
} from "./abis.js";

export async function sendcoin(wallet, toAddress) {
  try {
    const getBalance = await provider.getBalance(wallet.address);
    const balance = parseFloat(ethers.formatUnits(getBalance, 18)).toFixed(5);

    logger.balance(`Balance PHRS: ${balance}`);

    const amount = "0.00001";
    const value = ethers.parseEther(amount);

    if (getBalance > value) {

      logger.start(`Send ${amount} PHRS to ${toAddress}`);
      const tx = await wallet.sendTransaction({
        to: toAddress,
        value: value,
        gasLimit: 300000,
        gasPrice: ethers.parseUnits('1', 'gwei'),
      });

      logger.send(`Tx dikirim! ->> ${explorer}${tx.hash}`);

      await tx.wait();
      logger.succes(`Send Berhasil`);
      await delay(randomdelay());
      return tx.hash;
    } else {
    logger.warn(`Saldo tidak cukup untuk send\n`);
    }

  } catch (err) {
    logger.fail(`Error during sendcoin ${err.message}\n`);
  }
}

export async function balanceETH(wallet) {
  try {
    const getBalance = await provider.getBalance(wallet.address);
    const Balance = ethers.formatUnits(getBalance,18);
    const formatbalance = parseFloat(Balance).toFixed(3);
    logger.balance(`Balance Pharos: ${formatbalance}`);
    return getBalance;
  } catch (err) {
    logger.fail(`Error Cek BalanceETH : ${err.message || err}\n`);
  }
}

export async function approve(wallet, tokenAddress, spenderAddress, amount) {
  const token = new ethers.Contract(tokenAddress, erc20Abi, wallet);
  const decimals = await token.decimals();
  const symbol = await token.symbol();

  const allowance = await token.allowance(wallet.address, spenderAddress);
  if (allowance >= amount) {
    return;
  }

  logger.start(`Approve ${symbol} Dahulu...`);

  try {
    const tx = await token.approve(spenderAddress, amount);
    logger.send(`Tx dikirim ->> ${explorer}${tx.hash}`);
    await tx.wait();
    logger.succes(`Approve berhasil`);
  } catch (err) {
    logger.fail(`Gagal approve: ${err.message || err}`);
  }
}

export async function cekbalance(wallet, tokenIn) {
  try {
    const contract = new ethers.Contract(tokenIn, erc20Abi, wallet);
    const decimal = await contract.decimals();
    const name = await contract.name();
    const symbol = await contract.symbol();

    const balancewei = await contract.balanceOf(wallet.address);
    const formatbalance = ethers.formatUnits(balancewei, decimal);
    const fixbalance = parseFloat(formatbalance).toFixed(5);
    logger.balance(`Balance ${symbol} : ${fixbalance} `)
    return { balancewei, decimal, symbol } ;
  } catch (err) {
    logger.fail(`Error Cek Balance : ${err.message || err}\n`);
  }
}

export async function deposit(wallet, tokenIn, amount) {
  try {
    const getBalance = await balanceETH(wallet);
    const balance = parseFloat(ethers.formatUnits(getBalance, 18)).toFixed(5);
    const { balancewei, decimal } = await cekbalance(wallet, tokenIn);

    const abi = ["function deposit() external payable"];
    const contract = new ethers.Contract(tokenIn, abi, wallet);

    logger.start(`Swap ${amount} PHRS ke WPHRS `);
    const tx = await contract.deposit({
      value: ethers.parseEther(amount),
      gasLimit: 100_000,
    });

    logger.send(`Tx dikirim! ->> ${explorer}${tx.hash}`);
    await tx.wait();
    logger.succes(`Swap Berhasil\n`);

  } catch (err) {
    logger.fail(`Error during deposit : ${err.message}\n`);
  }
}

export async function getPoolAddress(token0, token1, router, fee) {
  const manager = new ethers.Contract(router, POOL_ABI, provider);
  const factoryAddress = await manager.factory();

  const factory = new ethers.Contract(factoryAddress, POOL_ABI, provider);
  const poolAddress = await factory.getPool(token0, token1, fee);

  return { factoryAddress, poolAddress };
}

export async function getPoolInfo(poolAddress, tokenA, tokenB) {
  const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
  const [token0, token1, fee, liquidity, slot0] = await Promise.all([
    pool.token0(),
    pool.token1(),
    pool.fee(),
    pool.liquidity(),
    pool.slot0(),
  ]);

  const tokensInPool = [token0.toLowerCase(), token1.toLowerCase()];
  if (!tokensInPool.includes(tokenA.toLowerCase()) || !tokensInPool.includes(tokenB.toLowerCase())) {
    throw new Error("Pool tidak mengandung tokenA dan tokenB yang diminta");
  }

  const address0 = new ethers.Contract(token0, erc20Abi, provider)
  const decimal0 = await address0.decimals();
  const address1 = new ethers.Contract(token1, erc20Abi, provider)
  const decimal1 = await address1.decimals();

  const tickCurrent = slot0.tick;

  const sqrtPriceX96 = slot0.sqrtPriceX96
  const price = (Number(sqrtPriceX96) ** 2) / (2 ** 192)
  const adjustedPrice = price * (10 ** (Number(decimal0) - Number(decimal1)))

  const tokenAToTokenB = tokenA.toLowerCase() === token0.toLowerCase() ? adjustedPrice : 1/adjustedPrice
  const tokenBToTokenA = 1 / tokenAToTokenB


  return {
    token0,
    token1,
    fee,
    liquidity,
    sqrtPriceX96,
    tickCurrent,
    tokenAToTokenB,
    tokenBToTokenA,
  };
}

export async function getTokenIds(wallet) {
  const contract = new ethers.Contract(ZENITH_ADDRESS, nftAbi, wallet);
  const positionManager = new ethers.Contract(ZENITH_ADDRESS, LP_ROUTER_ABI, wallet);

  const balance = await contract.balanceOf(wallet.address);
  const tokenIds = [];

  for (let i = 0; i < balance; i++) {
    const tokenId = await contract.tokenOfOwnerByIndex(wallet.address, i);

    try {
      const pos = await positionManager.positions(tokenId);

      const liquidity = pos.liquidity;

      if (liquidity > 0) {
        tokenIds.push(tokenId.toString());
      }
    } catch (err) {
      logger.fail(`Error getTokenIds : ${err.message || err}\n`);
    }
  }

  return tokenIds;
}

export async function getLiquidity(wallet, tokenIds) {
  try {
    const positionManager = new ethers.Contract(ZENITH_ADDRESS, LP_ROUTER_ABI, wallet);
    const pos = await positionManager.positions(tokenIds);
    return pos.liquidity.toString();
  } catch (err) {
    logger.fail(`Error getLiquidity : ${err.message || err}\n`);
    return null;
  }
}

export async function sendTG(address, txCount, totalPoint) {
  if (process.env.SEND_TO_TG !== "true") {
    logger.info("Pengirim pesan Telegram dinonaktifkan");
    return;
  }

  const retries = 5;
  const date = new Date().toISOString().split("T")[0];
  const escape = (text) => text.toString().replace(/([_*[\]()~`>#+-=|{}.!])/g, "\\$1");

  const message = `🌐 *Pharos Testnet*\n📅 *${escape(date)}*\n👛 *${escape(address)}*\n🔣 *Total TX: ${escape(txCount)}*\n🎰 *Total Point: ${escape(totalPoint)}*`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
        {
          chat_id: process.env.CHAT_ID,
          text: message,
          parse_mode: "MarkdownV2",
        }
      );
      logger.succes(`Message sent to Telegram successfully!\n`);
      return response.data;
    } catch (error) {
      logger.fail(`Error sendTG : ${error.message || error}\n`);
      if (attempt < retries) {
        await delay(3000); 
      } else {
        return null;
      }
    }
  }
}
