import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RPC = "https://testnet.dplabs-internal.com";
export const provider = new ethers.JsonRpcProvider(RPC);

export const GAS_LIMIT = 700000;
export const GAS_PRICE = ethers.parseUnits("1", "gwei");

export const privateKeys = fs.readFileSync(path.join(__dirname, "../privatekey.txt"), "utf-8")
  .split("\n")
  .map(k => k.trim())
  .filter(k => k.length > 0);

export const receivers = fs.readFileSync(path.join(__dirname, "../receivers.txt"), "utf-8")
  .split("\n")
  .map(k => k.trim())
  .filter(k => k.length > 0);

export function generateAddresses(count) {
  const wallets = [];
  for (let i = 0; i < count; i++) {
    const wallet = ethers.Wallet.createRandom();
    wallets.push({ address: wallet.address, privateKey: wallet.privateKey });
  }
  return wallets;
}

export const baseHeaders = {
  accept: "application/json, text/plain, */*",
  origin: "https://testnet.pharosnetwork.xyz",
  referer: "https://testnet.pharosnetwork.xyz/",
  "sec-gpc": "1",
};

export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const prefixes = [
  'Neo', 'Meta', 'Alpha', 'Turbo', 'Proto', 'Quantum', 'Mega', 'Hyper', 'Ultra', 'Cryo',
  'Astro', 'Cyber', 'Nano', 'Zen', 'Giga', 'Omni', 'Vortex', 'Luna', 'Volt', 'Solar',
  'Pixel', 'Dark', 'Light', 'Myst', 'Pluto', 'Nova', 'Zero', 'Echo', 'Core', 'Flux',
  'Iron', 'Steel', 'Ghost', 'Sky', 'Storm', 'Chrono', 'Blade', 'Shadow', 'Crystal', 'Aero',
  'Pyro', 'Glitch', 'Frost', 'Byte', 'Fire', 'Spark', 'Wisp', 'Draco', 'Dust', 'AstroX',
  'Bio', 'Orbital', 'Fusion', 'Titan', 'Rogue', 'Lucid', 'Singularity', 'Prism', 'Hydro', 'Ion',
  'Omega', 'Nebula', 'Krypto', 'Stellar', 'Warp', 'Ignis', 'Magnet', 'Crypt', 'Pulse', 'Flash',
  'Arc', 'SkyNet', 'Aether', 'LightSpeed', 'Phase', 'QuantumX', 'Blitz', 'Nexus', 'StormX', 'Cyborg',
  'Onyx', 'Spectra', 'ShadowX', 'Void', 'Plasma', 'Inferno', 'Sonic', 'Mirage', 'Orbit', 'Tachyon',
  'Zenith', 'Eclipse', 'Radiant', 'Synthetix', 'Halo', 'Beacon', 'Carbon', 'Torque', 'Signal', 'Drift',
  'NovaX', 'Nebulon', 'Lambda', 'Fractal'
];

const suffixes = [
  'Core', 'X', 'Net', 'Byte', 'Chain', 'Verse', 'Token', 'Fi', 'Labs', 'Edge',
  'Storm', 'Link', 'Hub', 'Flow', 'OS', 'Pulse', 'Sync', 'Block', 'Dex', 'Vault',
  'Swap', 'SwapX', 'Boost', 'Launch', 'Beam', 'Pad', 'Dash', 'Rise', 'Spark', 'Jet',
  'Fuel', 'Stack', 'Craft', 'Zone', 'Forge', 'Mode', 'ByteX', 'Syncer', 'Engine', 'Connect',
  'Node', 'Shift', 'Sphere', 'Field', 'Port', 'Run', 'System', 'Wave', 'Matrix', 'Element',
  'Station', 'Beacon', 'Cloud', 'Warp', 'Crate', 'Mint', 'Loop', 'Lock', 'VaultX', 'Base',
  'Drop', 'Globe', 'Realm', 'Rocket', 'Force', 'Bridge', 'Tower', 'Scanner', 'Gate', 'Bank',
  'Market', 'Scan', 'Spin', 'Project', 'Coin', 'Bit', 'JetX', 'Track', 'LaunchX', 'FuelX',
  'LabsX', 'ModeX', 'Protocol', 'LinkX', 'ChainX', 'Cast', 'Dock', 'Rush', 'Line', 'FieldX',
  'Trade', 'Trust', 'Energy', 'Power', 'Heat', 'NodeX', 'CraftX', 'NetX', 'Signal', 'Vision'
];

export function randomTokenName() {
  const pre = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suf = suffixes[Math.floor(Math.random() * suffixes.length)];
  return pre + suf;
}

export function randomSymbol(name) {
  const upper = name.toUpperCase().replace(/[^A-Z]/g, '');
  let symbol = upper[0];
  if (upper.length > 2) symbol += upper[Math.floor(upper.length / 2)];
  if (upper.length > 3) symbol += upper.slice(-1);
  return symbol.slice(0, 4);
}

export const randomSupply = () => {
  const supplyrandom = ['10000000', '100000000', '1000000000', '1000000000', '2000000000', '4000000000', '10000000000'];
  return supplyrandom[Math.floor(Math.random() * supplyrandom.length)];
};

export function randomAmount(min, max, decimalPlaces) {
  return (Math.random() * (max - min) + min).toFixed(decimalPlaces);
}

export function randomdelay(min = 15000, max = 25000) {
  return Math.floor(Math.random() * (max - min) + min);
}

export function buildExactInputSingle({ tokenIn, tokenOut, fee, recipient, amountIn, amountOutMinimum, sqrtPriceLimitX96 }) {
  const selector = "0x04e45aaf";
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "uint24", "address", "uint256", "uint256", "uint160"],
    [tokenIn, tokenOut, fee, recipient, amountIn, amountOutMinimum, sqrtPriceLimitX96]
  );
  return selector + encoded.slice(2);
}
