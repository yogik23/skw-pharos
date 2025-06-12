import chalk from "chalk";

const RPC = "https://testnet.dplabs-internal.com";
const provider = new ethers.JsonRpcProvider(RPC);

const ROUTER = "0x1A4DE519154Ae51200b0Ad7c90F7faC75547888a";
const LP_ROUTER_ADDRESS = "0xf8a1d4ff0f9b9af7ce58e1fc1833688f3bfd6115";

const tokens = {
  USDC: { address: "0xad902cf99c2de2f1ba5ec4d642fd7e49cae9ee37", decimals: 18 },
  WPHRS: { address: "0x76aaada469d23216be5f7c596fa25f282ff9b364", decimals: 18 },
  USDT: { address: "0xed59de2d7ad9c043442e381231ee3646fc3c2939", decimals: 18 },
};

const pairs = [
  { from: "WPHRS", to: "USDC", amount: "0.0001" },
  { from: "WPHRS", to: "USDT", amount: "0.0001" },
  { from: "USDT", to: "WPHRS", amount: "0.03" },
  { from: "USDT", to: "USDC", amount: "0.03" },
  { from: "USDC", to: "WPHRS", amount: "0.03" },
  { from: "USDC", to: "USDT", amount: "0.03" },
];

const erc20_abi = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function deposit() external payable",
];

const SWAP_ABI = ["function multicall(uint256, bytes[])"];

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

async function Retry(asyncFn, label = "Operation", retries = 10, timeout = 30000) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await asyncFn();
    } catch (err) {
      attempt++;
      const waitTime = timeout * attempt;

      if (attempt < retries) {
        await delay(waitTime);
      } else {
        console.error(chalk.red(`❌ [${label}] Failed after ${retries} attempts\n`));
        throw err;
      }
    }
  }
}

export {
  provider,
  tokens,
  pairs,
  ROUTER,
  LP_ROUTER_ADDRESS,
  SWAP_ABI,
  erc20_abi,
  POOL_ABI,
  LP_ROUTER_ABI,
  nftAbi,
  delay,
  Retry
};
