import { ethers } from "ethers";
import { logger } from "../skw/logger.js";
import {
 ZENITH_ROUTER,
 ZENITH_ADDRESS,
 explorer,
} from "../skw/contract.js";

import {
 provider,
 delay,
 buildExactInputSingle,
 GAS_LIMIT,
 GAS_PRICE,
} from "../skw/config.js";

import {
 SWAP_ABI,
 POOL_ABI,
 LP_ROUTER_ABI,
 nftAbi,
} from "../skw/abis.js";

import {
 approve,
 cekbalance,
 getPoolAddress,
 getPoolInfo,
 getTokenIds,
 getLiquidity,
} from "../skw/helper.js";

export async function swap(wallet, tokenIn, tokenOut, amount) {
  logger.start(`Processing Swap on Zenith`);
  const { balancewei: balanceweiIn, symbol: symbolIn, decimal: decimalIn } = await cekbalance(wallet, tokenIn);
  const { balancewei: balanceweiOut, symbol: symbolOut, decimal: decimalOut } = await cekbalance(wallet, tokenOut);
  const amountIn = ethers.parseUnits(amount, decimalIn);

  const calldata = buildExactInputSingle({
    tokenIn: tokenIn,
    tokenOut: tokenOut,
    fee: 500,
    recipient: wallet.address,
    amountIn,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0,
  });

  const contract = new ethers.Contract(ZENITH_ROUTER, SWAP_ABI, wallet);
  await approve(wallet, tokenIn, ZENITH_ROUTER, amountIn);

  if (balanceweiIn > amountIn) {
    try {
      logger.start(`Starting swap ${amount} ${symbolIn} to ${symbolOut}...`);
      const tx = await contract.multicall(
        Math.floor(Date.now() / 1000) + 60,
        [calldata],
        {
          gasLimit: 1_000_000,
          gasPrice: 0,
        }
      );

      logger.send(`Tx dikirim! ->> ${explorer}${tx.hash}`);
      await tx.wait();
      logger.succes(`Swap Berhasil\n`);
    } catch (err) {
      logger.fail(`Error during swap for ${wallet.address}: ${err.message}\n`);
    }
  } else {
    logger.warn(`Saldo tidak cukup untuk swap\n`);
  }
}

export async function addLiquidity(wallet, tokenIn, tokenOut, amount0Desired, fee) {
  logger.start(`Processing Add New Liquidity`);
  const { symbol: symbol0, decimal: decimals0 } = await cekbalance(wallet, tokenIn);
  const { symbol: symbol1, decimal: decimals1 } = await cekbalance(wallet, tokenOut);
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
  const { poolAddress } = await getPoolAddress(tokenIn, tokenOut, ZENITH_ADDRESS, fee);

  const positionManager = new ethers.Contract(ZENITH_ADDRESS, LP_ROUTER_ABI, wallet);
  const poolInfo = await getPoolInfo(poolAddress, tokenIn, tokenOut);

  const amount1Desired1 = amount0Desired * poolInfo.tokenAToTokenB;
  const amount1Desired = amount1Desired1.toFixed(4);

  const parsedAmount1 = ethers.parseUnits(amount0Desired, decimals0);
  const parsedAmount0 = ethers.parseUnits(amount1Desired, decimals1);

  await approve(wallet, poolInfo.token0, ZENITH_ADDRESS, ethers.MaxUint256);
  await approve(wallet, poolInfo.token1, ZENITH_ADDRESS, ethers.MaxUint256);
  logger.start(`Starting Add LP ${amount0Desired} ${symbol0} dan ${amount1Desired} ${symbol1}`);

  const tickLower = -887220;
  const tickUpper = 887220;

  const amount0Min = parsedAmount0 * 98n / 100n;
  const amount1Min = parsedAmount1 * 98n / 100n;
 
  try {
    const params = {
      token0: poolInfo.token0,
      token1: poolInfo.token1,
      fee,
      tickLower,
      tickUpper,
      amount0Desired: parsedAmount0,
      amount1Desired: parsedAmount1,
      amount0Min,
      amount1Min,
      recipient: wallet.address,
      deadline,
    };

    const gasLimit = 700000;

    const tx = await positionManager.mint(params, {
      gasLimit: GAS_LIMIT,
      gasPrice: GAS_PRICE
    });

   logger.send(`Tx dikirim ->> ${explorer}${tx.hash}`);

    const receipt = await tx.wait();
    const iface = new ethers.Interface(["event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"]);
    let tokenId = null;
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed.name === "Transfer" && parsed.args.from === ethers.ZeroAddress) {
          tokenId = parsed.args.tokenId;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (tokenId) {
      logger.succes(`Add New Liquidity berhasil`);
      logger.info(`Posisi New Liquidity id : ${tokenId}\n`);
    } else {
      logger.warn(`TokenId tidak ditemukan dari event Transfer\n`);
    }
  } catch (err) {
    logger.fail(`Gagal add liquidity: ${err.reason || err.message || 'unknown error'}\n`);
  }
}

export async function colectfee(wallet) {
  try {
    logger.start(`Processing Colectfee `);
    const tokenIds = await getTokenIds(wallet);
    if (tokenIds.length === 0) {
      logger.warn(`Wallet tidak punya LP token`);
      return;
    }

    const selectedTokenId = tokenIds[Math.floor(Math.random() * tokenIds.length)];
    logger.info(`Pool yg dicollect ${selectedTokenId}`);

    const manager = new ethers.Contract(ZENITH_ADDRESS, LP_ROUTER_ABI, wallet);
    const iface = new ethers.Interface(LP_ROUTER_ABI);
    const maxUint128 = (2n ** 128n - 1n).toString();

    const collectCalldata = iface.encodeFunctionData("collect", [
      {
        tokenId: selectedTokenId,
        recipient: wallet.address,
        amount0Requested: maxUint128,
        amount1Requested: maxUint128,
      },
    ]);

    const multicalls = [collectCalldata];

    logger.start(`Starting Colectfee `);
    const tx = await manager.multicall(
      multicalls,
      {
        gasLimit: GAS_LIMIT,
        gasPrice: GAS_PRICE
      }
    );
    logger.send(`Tx dikirim ->> ${explorer}${tx.hash}`);
    await tx.wait();
    logger.succes(`Colectfee berhasil\n`);
  } catch (err) {
    logger.fail(`Gagal Colectfee: ${err.reason || err.message || 'unknown error'}\n`);
  }
}

export async function removeLiquidity(wallet) {
  try {
    logger.start(`Processing Remove Liquidity `);
    logger.info(`Mengecek Pool yg Tersedia`);
    const tokenIds = await getTokenIds(wallet);
    if (tokenIds.length === 0) {
      logger.warn(`Wallet tidak punya LP token`);
      return;
    }

    const selectedTokenId = tokenIds[tokenIds.length - 1];
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
    logger.info(`Pool yg Tersedia ${tokenIds}`);
    logger.info(`Pool yg diremove ${selectedTokenId}`);

    const liquidity = await getLiquidity(wallet, selectedTokenId);

    const manager = new ethers.Contract(ZENITH_ADDRESS, LP_ROUTER_ABI, wallet);
    const iface = new ethers.Interface(LP_ROUTER_ABI);
    const maxUint128 = (2n ** 128n - 1n).toString();

    const decreaseCalldata = iface.encodeFunctionData("decreaseLiquidity", [
      {
        tokenId: selectedTokenId,
        liquidity,
        amount0Min: 0,
        amount1Min: 0,
        deadline,
      },
    ]);

    const collectCalldata = iface.encodeFunctionData("collect", [
      {
        tokenId: selectedTokenId,
        recipient: wallet.address,
        amount0Requested: maxUint128,
        amount1Requested: maxUint128,
      },
    ]);

    const multicalls = [decreaseCalldata, collectCalldata];

    logger.start(`Remove Liquidity `);
    const tx = await manager.multicall(
      multicalls,
      {
        gasLimit: GAS_LIMIT,
        gasPrice: GAS_PRICE
      }
    );
    logger.send(`Tx dikirim ->> ${explorer}${tx.hash}`);
    await tx.wait();
    logger.succes(`Remove Liquidity berhasil\n`);
  } catch (err) {
    logger.fail(`Gagal remove liquidity: ${err.reason || err.message || 'unknown error'}\n`);
  }
}
