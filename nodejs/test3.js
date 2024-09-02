const { LitNodeClientNodeJs } = require('@lit-protocol/lit-node-client-nodejs');
const { LitNetwork, LIT_RPC, AuthMethodType, AuthMethodScope } = require('@lit-protocol/constants');
const { 
  providers : ethersProviders,
  utils : ethersUtils,
  Wallet,
  BigNumber,
 } = require("ethers");
const { LitContracts } = require("@lit-protocol/contracts-sdk");  
const { LitAuthClient } = require("@lit-protocol/lit-auth-client");
const fs = require("fs")
const { PinataSDK } = require("pinata")

const {
  createSiweMessageWithRecaps,
  generateAuthSig,
  LitAbility,
  LitAccessControlConditionResource,
  LitActionResource,
  LitPKPResource,
} = require("@lit-protocol/auth-helpers");
const { Blob } = require('buffer');

(async () => {
  try {
  const { base58_to_binary, binary_to_base58 } = await import("base58-js")

    const wallet = getWallet();
    const litContracts = await getLitContracts(wallet)

    const litActionCode = fs
    .readFileSync("./delegationAction/bundled.js")
    .toString()

    const uploadRes = await uploadLitAction(litActionCode)

    console.log("uploadRes:", uploadRes)

    const ipfsCid = uploadRes.IpfsHash
    const ipfsCidBytes = base58_to_binary(ipfsCid)
    console.log("uploadRes:", uploadRes, ipfsCidBytes)


  } catch (e) {
    console.log(e);
  }
})();

function getWallet(privateKey) {
  if (privateKey !== undefined)
    return new Wallet(
      privateKey,
      new ethersProviders.JsonRpcProvider(
        LIT_RPC.CHRONICLE_YELLOWSTONE
      )
    );

  if (process.env.PRIVATE_KEY === undefined)
    throw new Error("Please provide the env: PRIVATE_KEY");

  return new Wallet(
    process.env.PRIVATE_KEY,
    new ethersProviders.JsonRpcProvider(
      LIT_RPC.CHRONICLE_YELLOWSTONE
    )
  );
}

async function getLitContracts(signer) {
  const litContracts = new LitContracts({
    signer,
    network: LitNetwork.DatilDev,
  });

  console.log("Connecting litContracts to network...");
  await litContracts.connect();

  console.log("litContracts connected!");
  return litContracts
}

async function uploadLitAction(code) {
  try {
    const pinata = new PinataSDK({
      pinataJwt: process.env.PINATA_JWT,
      pinataGateway: process.env.PINATA_GATEWAY,
    });
    const blob = new Blob([code]);
    const file = new File([blob], "bundled", { type: "text/plain" });
    const upload = await pinata.upload.file(file);
    return upload
  } catch (error) {
    console.log(error);
  }
}
