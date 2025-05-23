import { ethers } from "ethers";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RPC = "https://testnet.dplabs-internal.com";
const provider = new ethers.JsonRpcProvider(RPC);

const privateKeys = fs.readFileSync(path.join(__dirname, "privatekey.txt"), "utf-8")
  .split("\n")
  .map(k => k.trim())
  .filter(k => k.length > 0);

const tokens = {
  USDC: { address: "0xad902cf99c2de2f1ba5ec4d642fd7e49cae9ee37", decimals: 18 },
  WPHRS: { address: "0x76aaada469d23216be5f7c596fa25f282ff9b364", decimals: 18 },
  USDT: { address: "0xed59de2d7ad9c043442e381231ee3646fc3c2939", decimals: 18 },
};

const LP_ROUTER_ADDRESS = "0xf8a1d4ff0f9b9af7ce58e1fc1833688f3bfd6115";

const erc20_abi = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
];

const POOL_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint24)",
  "function liquidity() view returns (uint128)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
];

const LP_ROUTER_ABI = [
  "function mint(tuple(address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
  "function increaseLiquidity(tuple(uint256 tokenId, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, uint256 deadline)) external payable returns (uint128 liquidity, uint256 amount0, uint256 amount1)",
  "function decreaseLiquidity(tuple(uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline)) external returns (uint256 amount0, uint256 amount1)",
  "function collect(tuple(uint256 tokenId, address recipient, uint128 amount0Requested, uint128 amount1Requested)) external returns (uint256 amount0, uint256 amount1)",
  "function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX96, uint256 feeGrowthInside1LastX96, uint128 tokensOwed0, uint128 tokensOwed1)",
  "function refundETH()",
  "function multicall(bytes[] calldata data) payable returns (bytes[] memory results)"
];

const nftAbi = [
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
];

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getTokenIds(wallet) {
  const contract = new ethers.Contract(LP_ROUTER_ADDRESS, nftAbi, wallet);
  const balance = await contract.balanceOf(wallet.address);

  const tokenIds = [];
  for (let i = 0; i < balance; i++) {
    const tokenId = await contract.tokenOfOwnerByIndex(wallet.address, i);
    tokenIds.push(tokenId.toString());
  }

  return tokenIds;
}

async function getLiquidity(wallet, tokenIds) {
  try {
    const positionManager = new ethers.Contract(LP_ROUTER_ADDRESS, LP_ROUTER_ABI, wallet);
    const pos = await positionManager.positions(tokenIds);
    return pos.liquidity.toString();
  } catch (err) {
    console.error(`Error getting liquidity for tokenIds:`, err);
    return null;
  }
}

async function getPoolInfo(poolAddress, tokenA, tokenB) {
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

function getAmount1FromAmount0(amount0Str, sqrtPriceX96, decimals0, decimals1) {
  const sqrtPrice = Number(sqrtPriceX96.toString());
  const price = (sqrtPrice / 2 ** 96) ** 2; 
  const amount0 = Number(ethers.parseUnits(amount0Str, decimals0));
  const amount1 = amount0 * price;
  const formattedAmount1 = ethers.formatUnits(amount1.toString(), decimals1);
  return formattedAmount1;
}

async function addLiquidity({
  wallet,
  poolAddress,
  token0,
  token1,
  fee,
  amount0Desired,
  deadline,
}) {
  const positionManager = new ethers.Contract(LP_ROUTER_ADDRESS, LP_ROUTER_ABI, wallet);

  const poolInfo = await getPoolInfo(poolAddress, token0, token1);

  let decimals0, decimals1;
  for (const t of Object.values(tokens)) {
    if (t.address.toLowerCase() === token0.toLowerCase()) decimals0 = t.decimals;
    if (t.address.toLowerCase() === token1.toLowerCase()) decimals1 = t.decimals;
  }
  if (decimals0 === undefined || decimals1 === undefined) {
    throw new Error("Token decimals tidak ditemukan");
  }

  const amount1Desired1 = getAmount1FromAmount0(amount0Desired, poolInfo.sqrtPriceX96, decimals0, decimals1);
  const amount1Desired = parseFloat(amount1Desired1).toFixed(6);
  console.log(`💡 Add LP 0.002 WPHRS dan ${amount1Desired} USDC`);

  const parsedAmount0 = ethers.parseUnits(amount0Desired, decimals0);
  const parsedAmount1 = ethers.parseUnits(amount1Desired, decimals1);

  const token0Contract = new ethers.Contract(token0, erc20_abi, wallet);
  const token1Contract = new ethers.Contract(token1, erc20_abi, wallet);

  const allowance0 = await token0Contract.allowance(wallet.address, LP_ROUTER_ADDRESS);
  if (allowance0 < parsedAmount0) {
    console.log(`🔄 Approving token0...`);
    const tx = await token0Contract.approve(LP_ROUTER_ADDRESS, ethers.MaxUint256);
    await tx.wait();
  }

  const allowance1 = await token1Contract.allowance(wallet.address, LP_ROUTER_ADDRESS);
  if (allowance1 < parsedAmount1) {
    console.log(`🔄 Approving token1...`);
    const tx = await token1Contract.approve(LP_ROUTER_ADDRESS, ethers.MaxUint256);
    await tx.wait();
  }

  const tickSpacing = 60n;
  const tickCurrent = BigInt(poolInfo.tickCurrent);
  const nearestTick = (tickCurrent / tickSpacing) * tickSpacing;
  const tickLower = nearestTick - tickSpacing * 10n;
  const tickUpper = nearestTick + tickSpacing * 10n;

  if (tickLower >= tickUpper) {
    throw new Error('tickLower harus lebih kecil dari tickUpper');
  }

  if (tickLower < -8388608 || tickUpper > 8388607) {
    throw new Error("tickLower atau tickUpper di luar range int24");
  }
 
  try {
    console.log(`🔄 Add New Liquidity`);

    const params = {
      token0,
      token1,
      fee,
      tickLower,
      tickUpper,
      amount0Desired: parsedAmount0,
      amount1Desired: parsedAmount1,
      amount0Min: 0,
      amount1Min: 0,
      recipient: wallet.address,
      deadline,
    };

    const gasLimit = 700000;
    const tx = await positionManager.mint(params, { gasLimit });
    console.log(`⏳ Tx Dikirim ke Blockcahin!\n🌐 https://testnet.pharosscan.xyz/tx/${tx.hash}`);

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
      console.log(chalk.green(`✅ Add New Liquidity berhasil!\n🔹 Posisi Liquidity: ${tokenId}\n`));
    } else {
      console.log(chalk.red("⚠️ TokenId tidak ditemukan dari event Transfer\n"));
    }
  } catch (e) {
    console.log(chalk.red(`❌ Gagal add liquidity: ${e.reason || e.message || 'unknown error'}`));
    console.log();
  }
}

async function increaseLiquidityNative({
  wallet,
  amount0Desired,
  poolAddress,
  token0,
  token1,
  deadline,
}) {

  try {
    const positionManager = new ethers.Contract(LP_ROUTER_ADDRESS, LP_ROUTER_ABI, wallet);
    const poolInfo = await getPoolInfo(poolAddress, token0, token1);

    const amount1Desired1 = getAmount1FromAmount0(amount0Desired, poolInfo.sqrtPriceX96, 18, 18);
    const amount1Desired = parseFloat(amount1Desired1).toFixed(6);
    console.log(`💡 Increase LP 0.002 PHRS dan ${amount1Desired} USDC`);

    const parsedAmount0 = ethers.parseUnits(amount0Desired, 18);
    const parsedAmount1 = ethers.parseUnits(amount1Desired, 18);

    const iface = new ethers.Interface(LP_ROUTER_ABI);

    const tokenIds = await getTokenIds(wallet);
    const selectedTokenId = tokenIds[0]; //Pertama
  //const selectedTokenId = tokenIds[Math.floor(Math.random() * tokenIds.length)]; // Atau random
  //const selectedTokenId = tokenIds[tokenIds.length - 1]; // Atau terakhir

    const increaseCallData = iface.encodeFunctionData("increaseLiquidity", [{
      tokenId: selectedTokenId,
      amount0Desired: parsedAmount0,
      amount1Desired: parsedAmount1,
      amount0Min: 0,
      amount1Min: 0,
      deadline,
    }]);

    const refundCallData = iface.encodeFunctionData("refundETH");

    const tx = await positionManager.multicall(
      [increaseCallData, refundCallData],
      {
        value: parsedAmount0,
        gasLimit: 600000,
      }
    );

    console.log(`⏳ Tx Dikirim ke Blockcahin!\n🌐 https://testnet.pharosscan.xyz/tx/${tx.hash}`);
    await tx.wait();
    console.log(`✅ Liquidity increased\n`);
  } catch (e) {
    console.log(chalk.red(`❌ Gagal increased liquidity: ${e.reason || e.message || 'unknown error'}`));
    console.log();
  }
}

async function removeLiquidity(wallet) {
  try {
    const tokenIds = await getTokenIds(wallet);
    if (tokenIds.length === 0) {
      console.log(chalk.yellow("⚠️  Wallet tidak punya LP token."));
      return;
    }

    const selectedTokenId = tokenIds[tokenIds.length - 1]; // Ambil tokenId terakhir

    const liquidity = await getLiquidity(wallet, selectedTokenId);

    const deadline = Math.floor(Date.now() / 1000) + 60 * 20
    const manager = new ethers.Contract(LP_ROUTER_ADDRESS, LP_ROUTER_ABI, wallet);
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

    // const unwrapWETH9Calldata = iface.encodeFunctionData("unwrapWETH9", [
    //   ethers.MaxUint256,
    //   recipient: wallet.address,
    // ]);
    // multicalls.push(unwrapWETH9Calldata);

    // const sweepTokenCalldata = iface.encodeFunctionData("sweepToken", [
    //   tokens.USDC.address,
    //   ethers.MaxUint256,
    //   recipient: wallet.address,
    // ]);
    // multicalls.push(sweepTokenCalldata);

    console.log(`💡 Remove Liquidity`);
    const tx = await manager.multicall(multicalls, { gasLimit: 600000 });
    console.log(`⏳ Tx Dikirim ke Blockcahin!\n🌐 https://testnet.pharosscan.xyz/tx/${tx.hash}`);
    await tx.wait();
    console.log(`✅ Remove Liquidity Berhasil\n`);
  } catch (e) {
    console.log(chalk.red(`❌ Gagal remove liquidity: ${e.reason || e.message || "unknown error"}`));
    console.log();
  }
}

async function addWPHRSUSDC(wallet) {
  console.clear();

  const poolAddressUSDCWPHRS = "0x0373a059321219745aee4fad8a942cf088be3d0e";

  await removeLiquidity(wallet);
  await delay(10000);

  await addLiquidity({
    wallet,
    poolAddress: poolAddressUSDCWPHRS,
    token0: tokens.WPHRS.address,
    token1: tokens.USDC.address,
    fee: 3000,
    amount0Desired: "0.002",
    deadline: Math.floor(Date.now() / 1000) + 60 * 20,
  });

  await delay(10000);

  await increaseLiquidityNative({
    wallet,
    amount0Desired: "0.002",
    poolAddress: poolAddressUSDCWPHRS,
    token0: tokens.WPHRS.address,
    token1: tokens.USDC.address,
    deadline: Math.floor(Date.now() / 1000) + 60 * 20,
  });
  await delay(10000);
}

async function main() {
  console.clear();

  const poolAddressUSDCWPHRS = "0x0373a059321219745aee4fad8a942cf088be3d0e";

  for (const pk of privateKeys) {
    const wallet = new ethers.Wallet(pk, provider);
    console.log(chalk.cyan(`🔑 Wallet: ${wallet.address}`));

    await addWPHRSUSDC(wallet);
    await delay(10000);
  }
}

main().catch(console.error);
