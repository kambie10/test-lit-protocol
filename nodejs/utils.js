const { LIT_CHAINS } = require("@lit-protocol/constants");

const getEnv = (name) => {
  const env = process.env[name];
  if (name === "ETHEREUM_PRIVATE_KEY" && (env === undefined || env === "")) {
    throw new Error(
      `${name} ENV is not defined, please define it in the .env file`
    );
  } else if (env === undefined || env === "") {
    return "";
  } else {
    return env;
  }
};

const getChainInfo = (
  chain
) => {
  if (LIT_CHAINS[chain] === undefined)
    throw new Error(`Chain: ${chain} is not supported by Lit`);

  return {
    rpcUrl: LIT_CHAINS[chain].rpcUrls[0],
    chainId: LIT_CHAINS[chain].chainId,
  };
};

module.exports = { getEnv, getChainInfo }