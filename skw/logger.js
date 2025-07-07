import chalk from "chalk";

export const logger = {
  account:     (msg) => console.log(chalk.hex('#A259FF')(`👛 ${msg}`)),
  balance: (msg) => console.log(chalk.hex('#FF4500')(`💰 ${msg}`)),
  start:       (msg) => console.log(chalk.hex('#1E90FF')(`🔄 ${msg}`)),
  send:     (msg) => console.log(chalk.hex('#48D1CC')(`📤 ${msg}`)),
  succes:  (msg) => console.log(chalk.hex('#00FF00')(`✅ ${msg}`)),
  fail:     (msg) => console.log(chalk.hex('#DC143C')(`❌ ${msg}`)),
  warn: (msg) => console.log(chalk.hex('#FFA500')(`⚠️ ${msg}`)),
  info:       (msg) => console.log(chalk.hex('#CCCCCC')(`ℹ️ ${msg}`)),
};
