import { ethers } from "ethers";
import axios from "axios";
import { logger } from "../skw/logger.js";
import {
 FAROSWAP_ADDRESS,
 explorer,
} from "../skw/contract.js";

import {
 provider,
 delay,
 GAS_LIMIT,
 GAS_PRICE,
} from "../skw/config.js";

import {
 LP_FAROSWAP_ABI,
} from "../skw/abis.js";

import {
 approve,
 cekbalance,
 balanceETH,
} from "../skw/helper.js";


export async function getrouter(toToken, fromToken, amountIn, userAddr) {
  const DEADLINE = Math.floor(Date.now() / 1000) + 60 * 10;
  const ROUTE_API = `https://api.dodoex.io/route-service/v2/widget/getdodoroute?chainId=688688&deadLine=${DEADLINE}&apikey=a37546505892e1a952&slippage=40&source=dodoV2AndMixWasm&toTokenAddress=${toToken}&fromTokenAddress=${fromToken}&userAddr=${userAddr}&estimateGas=false&fromAmount=${amountIn}`;
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await axios.get(ROUTE_API, { timeout: 10000 });
      await delay(3000);
      const route = res.data?.data;
      return route;
    } catch (err) {
      logger.warn(`Percobaan ${attempt} gagal: ${err.message}`);
      await delay(3000);
    }
  }
  logger.fail("Gagal mendapatkan route setelah beberapa kali percobaan.");
}

export async function swapFaroswap(wallet, tokenIn, tokenOut, amount) {
  try {
    const getBalance = await balanceETH(wallet);
    const { symbol } = await cekbalance(wallet, tokenOut);
    const amountIn = ethers.parseUnits(amount, 18);

    if (getBalance < amountIn) {
      logger.warn(`Saldo PHRS tidak cukup untuk swap < ${amount}`);
      return;
    }

    const route = await getrouter(tokenOut, tokenIn, amountIn, wallet.address);

    const resAmount = parseFloat(route.resAmount);
    logger.start(`Starting swap ${amount} PHRS to ${resAmount.toFixed(8)} ${symbol}`);

    const tx = await wallet.sendTransaction({
      to: route.to,
      data: route.data,
      value: route.value,
      gasLimit: GAS_LIMIT,
      gasPrice: GAS_PRICE
    });

    logger.send(`Tx dikirim ->> ${explorer}${tx.hash}`);
    await tx.wait();
    logger.succes(`Swap Berhasil\n`);
  } catch (err) {
    logger.fail(`swapFaroswap error ${err.message || err}`);
  }
}

export async function swapERC20Faroswap(wallet, tokenIn, tokenOut, amount) {
  try {
    logger.start(`Processing Swap in Faroswap`);
    const { balancewei: balanceweiIn, symbol: symbolIn, decimal: decimalIn } = await cekbalance(wallet, tokenIn);
    const { symbol: symbolOut, decimal: decimalOut } = await cekbalance(wallet, tokenOut);
    const amountIn = ethers.parseUnits(amount, decimalIn);

    if (balanceweiIn < amountIn) {
      logger.warn(`Saldo ${symbolIn} tidak cukup untuk swap < ${amount}`);
      return;
    }

    const route = await getrouter(tokenOut, tokenIn, amountIn, wallet.address);
    const routecontract = route.to;
    const inpudata = route.data;
    const resAmount = parseFloat(route.resAmount);

    await approve(wallet, tokenIn, routecontract, amountIn);
    logger.start(`Starting swap ${amount} ${symbolIn} to ${resAmount.toFixed(8)} ${symbolOut}`);

    const tx = await wallet.sendTransaction({
      to: routecontract,
      data: inpudata,
      gasLimit: GAS_LIMIT,
      gasPrice: GAS_PRICE
    });

    logger.send(`Tx dikirim ->> ${explorer}${tx.hash}`);
    await tx.wait();
    logger.succes(`Swap Berhasil\n`);
  } catch (err) {
    logger.fail(`swapERC20Faroswap error ${err.message || err}`);
  }
}

export async function addLiquidityFaroswap(wallet, tokenIn, tokenOut, amount) {
  try {
    logger.start(`Processing Add Liquidity`);
    const { balancewei: balanceweiIn, symbol: symbolIn, decimal: decimalIn } = await cekbalance(wallet, tokenIn);
    const { symbol: symbolOut, decimal: decimalOut } = await cekbalance(wallet, tokenOut);
    const amountIn = ethers.parseUnits(amount, decimalIn);

    const flag = 30;
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
    const contract = new ethers.Contract(FAROSWAP_ADDRESS, LP_FAROSWAP_ABI, wallet);

    const route = await getrouter(tokenOut, tokenIn, amountIn, wallet.address);
    const resAmount = parseFloat(route.resAmount);
    const resAmountFixed = resAmount.toFixed(6);

    const amountOut = ethers.parseUnits(resAmountFixed, decimalOut);

    const slippage = 0.40;
    const slippageBps = BigInt(Math.round(slippage * 10000));
    const base = BigInt(10000);

    const amountInMin = amountIn * (base - slippageBps) / base;
    const amountOutMin = amountOut * (base - slippageBps) / base;

    await approve(wallet, tokenIn, FAROSWAP_ADDRESS, ethers.MaxUint256);
    await approve(wallet, tokenOut, FAROSWAP_ADDRESS, ethers.MaxUint256);
    logger.start(`Starting Add Liquidity ${amount} ${symbolIn} to ${resAmount} ${symbolOut}`);

    const tx = await contract.addLiquidity(
      tokenIn,
      tokenOut,
      flag,
      amountIn,
      amountOut,
      amountInMin,
      amountOutMin,
      wallet.address,
      deadline,
      {
        gasLimit: GAS_LIMIT,
        gasPrice: GAS_PRICE
      }
    );
   
    logger.send(`Tx dikirim ->> ${explorer}${tx.hash}`);
    await tx.wait();
    logger.succes(`addLiquidity Berhasil\n`);
  } catch (err) {
    logger.fail(`Gagal add liquidity: ${err.reason || err.message || 'unknown error'}\n`);
  }
}
