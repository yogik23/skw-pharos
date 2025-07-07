import { ethers } from "ethers";
import axios from "axios";
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

export async function login(wallet, headers) {
  try {
    const signature = await wallet.signMessage("pharos");
    const url = `https://api.pharosnetwork.xyz/user/login?address=${wallet.address}&signature=${signature}&invite_code=09IYaHsUJYpxmTSW`;
    const response = await axios.post(url, {}, { headers });
    return response.data?.data?.jwt;
  } catch (error) {
    logger.fail("Login error: " + (error.response?.data || error.message));
    throw error;
  }
}

export async function verifyTask(token, headers, wallet, txHash) {
  try {
    const url = `https://api.pharosnetwork.xyz/task/verify?address=${wallet.address}&task_id=103&tx_hash=${txHash}`;
    const authHeaders = { ...headers, Authorization: `Bearer ${token}` };
    const response = await axios.post(url, null, { headers: authHeaders });
    return response.data?.msg;
  } catch (error) {
    logger.fail("Verify error: " + (error.response?.data || error.message));
    throw error;
  }
}

export async function verifySendCoin(token, headers, wallet) {
  try {
    const recipients = generateAddresses(15).map((w) => w.address);
    logger.start("Processing Send Coin to 15 random address");

    for (const recipient of recipients) {
      const txHash = await sendcoin(wallet, recipient);
      if (txHash) {
        const res = await verifyTask(token, headers, wallet, txHash);
        logger.info(`Sendcoin ${res}\n`);
      } else {
        logger.warn("Skip verify karena txHash undefined");
      }
    }
  } catch (err) {
    logger.fail("VerifySendCoin error: " + err.message);
  }
}

export async function daily(token, headers, wallet) {
  try {
    const url = `https://api.pharosnetwork.xyz/sign/in?address=${wallet.address}`;
    const authHeaders = { ...headers, Authorization: `Bearer ${token}` };
    const response = await axios.post(url, null, { headers: authHeaders });
    const msg = response.data?.msg;

    if (msg === "ok") {
      logger.succes(`Daily Login Berhasil\n`);
    } else if (msg === "already signed in today") {
      logger.info(`Sudah Login Hari Ini\n`);
    } else {
      logger.warn(`Respon tidak dikenali: ${msg}\n`);
    }

    return msg;
  } catch (error) {
    logger.fail('Error saat daily sign-in:', error.response?.data || error.message);
    throw error;
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
    logger.balance(`Balance ${name} : ${fixbalance} ${symbol}`)
    return { balancewei, decimal, symbol } ;
  } catch (err) {
    logger.fail(`Error Cek Balance : ${err.message || err}\n`);
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

  const sqrtPriceX96 = slot0.sqrtPriceX96;
  const tickCurrent = slot0.tick;

  return {
    token0,
    token1,
    fee,
    liquidity,
    sqrtPriceX96,
    tickCurrent,
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

export function getAmount1FromAmount0(amount0Str, sqrtPriceX96, decimals0, decimals1) {
  const sqrtPrice = Number(sqrtPriceX96.toString());
  const price = (sqrtPrice / 2 ** 96) ** 2; 
  const amount0 = Number(ethers.parseUnits(amount0Str, decimals0));
  const amount1 = amount0 * price;
  const formattedAmount1 = ethers.formatUnits(amount1.toString(), decimals1);
  return formattedAmount1;
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

