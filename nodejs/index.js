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

const {
  createSiweMessageWithRecaps,
  generateAuthSig,
  LitAbility,
  LitAccessControlConditionResource,
  LitActionResource,
  LitPKPResource,
} = require("@lit-protocol/auth-helpers");

(async () => {
  let litNodeClient
  try {
    const wallet = getWallet();
    litNodeClient = await getLitNodeClient();

    const authSig = await genAuthSig(litNodeClient, wallet);
    console.log("Got Auth Sig for Lit Action conditional check!", authSig);
    
    const pkpPublicKey = await getPkpPublicKey(wallet, authSig);

    console.log("Got PKP Public Key!", pkpPublicKey);

  } catch (e) {
    console.log(e);
  } finally {
    litNodeClient.disconnect();
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

async function getLitNodeClient() {
  const litNodeClient = new LitNodeClientNodeJs({
    litNetwork: LitNetwork.DatilDev,
  });

  console.log("Connecting litNodeClient to network...");
  await litNodeClient.connect();

  console.log("litNodeClient connected!");
  return litNodeClient;
}

async function genAuthSig(litNodeClient, ethersSigner) {
  const toSign = await createSiweMessageWithRecaps({
    uri: "http://localhost",
    expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // 24 hours
    walletAddress: await ethersSigner.getAddress(),
    nonce: await litNodeClient.getLatestBlockhash(),
    litNodeClient: litNodeClient,
  });

  return await generateAuthSig({
    signer: ethersSigner,
    toSign,
  });
}

async function getPkpPublicKey(ethersSigner, authSig) {
  if (
    process.env.PKP_PUBLIC_KEY !== undefined &&
    process.env.PKP_PUBLIC_KEY !== ""
  )
    return process.env.PKP_PUBLIC_KEY;

  const pkp = await mintPkp(ethersSigner, authSig);
  console.log("Minted PKP!", pkp);
  return pkp.publicKey;
}

async function mintPkp(ethersSigner, authSig) {
  console.log("Minting new PKP...");
  const litContracts = new LitContracts({
    signer: ethersSigner,
    network: LitNetwork.DatilDev,
  });

  await litContracts.connect();

  const authMethod = {
    authMethodType: AuthMethodType.EthWallet,
    accessToken: JSON.stringify(authSig),
  };
  
  const mintInfo = await litContracts.mintWithAuth({
    authMethod: authMethod,
    scopes: [
        AuthMethodScope.SignAnything, 
        AuthMethodScope.PersonalSign
      ],
  });

  return mintInfo.pkp
}
