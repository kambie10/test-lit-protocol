const { LitNodeClientNodeJs } = require('@lit-protocol/lit-node-client-nodejs');
const { LitNetwork, LIT_RPC } = require('@lit-protocol/constants');
const { 
  providers : ethersProviders,
  utils : ethersUtils,
  Wallet,
 } = require("ethers");
const { LitContracts } = require("@lit-protocol/contracts-sdk");  
const {
  createSiweMessageWithRecaps,
  generateAuthSig,
  LitAbility,
  LitAccessControlConditionResource,
  LitActionResource,
  LitPKPResource,
} = require("@lit-protocol/auth-helpers");

const litActionCode = `
(async () => {
  // test an access control condition
  const testResult = await Lit.Actions.checkConditions({
    conditions,
    authSig,
    chain,
  });

  if (!testResult) {
    LitActions.setResponse({ response: "address does not have 1 or more Wei on Ethereum Mainnet" });
    return
  }

  const sigShare = await LitActions.signEcdsa({
    toSign: dataToSign,
    publicKey,
    sigName: "sig",
  });
})();
`;

(async () => {
  let litNodeClient
  try {
    const wallet = getWallet();
    litNodeClient = await getLitNodeClient();

    const sessionSigs = await getSessionSigs(litNodeClient, wallet);
    console.log("Got Session Signatures!");

    const authSig = await genAuthSig(litNodeClient, wallet);
    console.log("Got Auth Sig for Lit Action conditional check!", authSig);

    const litActionSignatures = await litNodeClient.executeJs({
      sessionSigs,
      code: litActionCode,
      jsParams: {
        conditions: [
          {
            conditionType: "evmBasic",
            contractAddress: "",
            standardContractType: "",
            chain: "ethereum",
            method: "eth_getBalance",
            parameters: [":userAddress", "latest"],
            returnValueTest: {
              comparator: ">=",
              value: "1",
            },
          },
        ],
        authSig,
        chain: "ethereum",
        dataToSign: ethersUtils.arrayify(
          ethersUtils.keccak256([1, 2, 3, 4, 5])
        ),
        publicKey: await getPkpPublicKey(wallet),
      },
    });
    console.log("litActionSignatures", litActionSignatures);

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

async function getPkpPublicKey(ethersSigner) {
  if (
    process.env.PKP_PUBLIC_KEY !== undefined &&
    process.env.PKP_PUBLIC_KEY !== ""
  )
    return process.env.PKP_PUBLIC_KEY;

  const pkp = await mintPkp(ethersSigner);
  console.log("Minted PKP!", pkp);
  return pkp.publicKey;
}

async function mintPkp(ethersSigner) {
  console.log("Minting new PKP...");
  const litContracts = new LitContracts({
    signer: ethersSigner,
    network: LitNetwork.DatilDev,
  });

  await litContracts.connect();

  return (await litContracts.pkpNftContractUtils.write.mint()).pkp;
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

async function getSessionSigs(litNodeClient, ethersSigner) {
  console.log("Getting Session Signatures...");
  return litNodeClient.getSessionSigs({
    chain: "ethereum",
    expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // 24 hours
    resourceAbilityRequests: [
      {
        resource: new LitPKPResource("*"),
        ability: LitAbility.PKPSigning,
      },
      {
        resource: new LitActionResource("*"),
        ability: LitAbility.LitActionExecution,
      },
    ],
    authNeededCallback: getAuthNeededCallback(litNodeClient, ethersSigner),
  });
}

function getAuthNeededCallback(litNodeClient, ethersSigner) {
  return async ({ resourceAbilityRequests, expiration, uri }) => {
    const toSign = await createSiweMessageWithRecaps({
      uri,
      expiration,
      resources: resourceAbilityRequests,
      walletAddress: await ethersSigner.getAddress(),
      nonce: await litNodeClient.getLatestBlockhash(),
      litNodeClient,
    });

    return await generateAuthSig({
      signer: ethersSigner,
      toSign,
    });
  };
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
