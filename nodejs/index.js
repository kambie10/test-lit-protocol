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

    const litContracts = await getLitContracts(wallet)

    const authSig = await genAuthSig(litNodeClient, wallet);
    console.log("Got Auth Sig for Lit Action conditional check!", authSig);

    const authMethod = {
      authMethodType: AuthMethodType.EthWallet,
      accessToken: JSON.stringify(authSig),
    };
    
    const pkp = await mintPkp(litContracts, authMethod);

    console.log("Got PKP Public Key!", pkp);

    console.log("🔄 Minting Capacity Credits NFT...");
    const capacityTokenId = (
      await litContracts.mintCapacityCreditsNFT({
        requestsPerKilosecond: 10,
        daysUntilUTCMidnightExpiration: 1,
      })
    ).capacityTokenIdStr;
    console.log(`✅ Minted new Capacity Credit with ID: ${capacityTokenId}`);

    console.log("🔄 Creating capacityDelegationAuthSig...");
    const { capacityDelegationAuthSig } =
      await litNodeClient.createCapacityDelegationAuthSig({
        dAppOwnerWallet: wallet,
        capacityTokenId,
        delegateeAddresses: [pkp.ethAddress],
        uses: "1",
      });
    console.log(`✅ Created the capacityDelegationAuthSig`, capacityDelegationAuthSig);

    const sessionSignatures = await litNodeClient.getPkpSessionSigs({
      pkpPublicKey: pkp.publicKey,
      capabilityAuthSigs: [capacityDelegationAuthSig],
      authMethods: [authMethod],
      resourceAbilityRequests: [
          {
            resource: new LitPKPResource("*"),
            ability: LitAbility.PKPSigning,
          },
      ],
      expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(), // 10 minutes
  });

    console.log("Got Session Signatures!", sessionSignatures);

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

async function mintPkp(litContracts, authMethod) {
  console.log("Minting new PKP...");
  const mintInfo = await litContracts.mintWithAuth({
    authMethod: authMethod,
    scopes: [
        AuthMethodScope.SignAnything, 
        AuthMethodScope.PersonalSign
      ],
  });

  return mintInfo.pkp
}
