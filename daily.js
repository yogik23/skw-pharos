import { ethers } from "ethers";
import chalk from "chalk";
import axios from "axios";
import dotenv from 'dotenv';
import userAgents from "./skw/userAgents.js";
import { delay } from './skw/config.js';

const baseHeaders = {
  "accept": "application/json, text/plain, */*",
  "origin": "https://testnet.pharosnetwork.xyz",
  "referer": "https://testnet.pharosnetwork.xyz/",
  "sec-gpc": "1"
};

async function login(wallet, headers) {
  try {
    const signature = await wallet.signMessage("pharos");
    const url = `https://api.pharosnetwork.xyz/user/login?address=${wallet.address}&signature=${signature}&invite_code=09IYaHsUJYpxmTSW`;
    const response = await axios.post(url, {}, { headers });
    return response.data?.data?.jwt;
  } catch (error) {
    console.error('❌ Error during login request:', error.response?.data || error.message);
    throw error;
  }
}

async function getProfil(token, wallet, headers) {
  try {
    const url = `https://api.pharosnetwork.xyz/user/profile?address=${wallet.address}`;
    const authHeaders = {
      ...headers,
      'Authorization': `Bearer ${token}`
    };
    const response = await axios.get(url, { headers: authHeaders });
    return response.data?.data;
  } catch (error) {
    console.error('❌ Error during profile request:', error.response?.data || error.message);
    throw error;
  }
}

async function daily(token, wallet, headers) {
  try {
    const url = `https://api.pharosnetwork.xyz/sign/in?address=${wallet.address}`;
    const authHeaders = {
      ...headers,
      'Authorization': `Bearer ${token}`
    };
    const response = await axios.post(url, {}, { headers: authHeaders });
    const msg = response.data?.msg;

    if (msg === "ok") {
      console.log(chalk.hex('#66CDAA')(`✅ Daily Login Berhasil`));
    } else if (msg === "already signed in today") {
      console.log(chalk.hex('#66CDAA')(`ℹ️ Sudah Login Hari Ini`));
    } else {
      console.log(chalk.hex('#66CDAA')(`❔ Respon tidak dikenali: ${msg}`));
    }

    return msg;
  } catch (error) {
    console.error('❌ Error saat daily sign-in:', error.response?.data || error.message);
    throw error;
  }
}

function escapeMarkdownV2(text) {
  return text.replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
}

async function sendTG(address, TotalPoints, retries = 3) {
  const date = escapeMarkdownV2(new Date().toISOString().split('T')[0]);
  const newpoint = escapeMarkdownV2(formatPoints(TotalPoints));
  const newAddress = escapeMarkdownV2(address);
  const message = `🚀 *PHAROS Testnet*\n📅 *${date}*\n💦 *${newAddress}*\n➡️ *Points: ${newpoint}*`;

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
      console.log(chalk.hex('#FF8C00')(`✅ Message sent to Telegram successfully!\n`));
      return response.data;
    } catch (error) {
      if (attempt < retries) await delay(2000);
      else return null;
    }
  }
}

async function rundaily(wallet) {
  const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
  const headers = {
    ...baseHeaders,
    'user-agent': userAgent
  };

  try {
    const token = await login(wallet, headers);
    await daily(token, wallet, headers);
    await delay(3000);

    const dataProfil = await getProfil(token, wallet, headers);
    const TotalPoints = dataProfil.user_info.TotalPoints;
    console.log(chalk.hex('#20B2AA')(`🏆 Total Points: ${TotalPoints}`));
    await sendTG(wallet.address, TotalPoints);

  } catch (err) {
    console.log(chalk.red(`❌ Gagal proses wallet ${wallet.address}: ${err.message}`));
  }

  await delay(7000);
}

export { rundaily };
