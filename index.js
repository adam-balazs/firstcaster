const { providers, Contract, utils } = require("ethers");
const got = require("got");

const validate = async (cast, registryContract) => {
  const stringifiedCastBody = JSON.stringify(cast.body);
  const calculatedHash = utils.keccak256(utils.toUtf8Bytes(stringifiedCastBody));
  const expectedHash = cast.merkleRoot;

  if (calculatedHash !== expectedHash) {
    console.log(`FAILED: the calculated hash ${calculatedHash} does not match the one in the cast: ${expectedHash}`);
  } else {
    console.log(`PASSED: the calculated hash ${calculatedHash} matches the one in the cast`);
  }

  const recoveredAddress = utils.verifyMessage(cast.merkleRoot, cast.signature);
  const expectedAddress = cast.body.address;

  if (recoveredAddress !== expectedAddress) {
    console.log(
      `Failed: the recovered address ${recoveredAddress} does not match the address  provided in the cast ${expectedAddress}`
    );
  } else {
    console.log(`PASSED: the recovered address ${recoveredAddress} matches the one in the cast`);
  }

  const encodedUsername = await registryContract.addressToUsername(expectedAddress);
  const expectedUsername = utils.parseBytes32String(encodedUsername);
  const castUsername = cast.body.username;

  if (expectedUsername !== castUsername) {
    console.log(`FAILED: ${expectedAddress} does not own ${castUsername}, it owns ${expectedUsername}`);
  } else {
    console.log(`PASSED: ${expectedAddress} owns ${castUsername}`);
  }
}

const doStuff = async () => {
  const ALCHEMY_SECRET = 'pxyLN_Jc2apGb-q41z4j7rvfy--DzBNP'; // Replace with your secret
  const provider = new providers.AlchemyProvider('rinkeby', ALCHEMY_SECRET);

  const block = await provider.getBlockNumber();
  console.log("The latest Ethereum block is:", block);
  const REGISTRY_CONTRACT_ADDRESS = '0xe3Be01D99bAa8dB9905b33a3cA391238234B79D1'
  const REGISTRY_ABI = [
    {
      name: 'getDirectoryUrl',
      inputs: [{ internalType: 'bytes32', name: 'username', type: 'bytes32' }],
      outputs: [{ internalType: 'string', name: '', type: 'string' }],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [{ internalType: 'address', name: '', type: 'address' }],
      name: 'addressToUsername',
      outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
      stateMutability: 'view',
      type: 'function',
    },
    { "inputs": [], "name": "usernamesLength", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint32", "name": "idx", "type": "uint32" }], "name": "usernameAtIndex", "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }], "name": "usernameToUrl", "outputs": [{ "internalType": "string", "name": "url", "type": "string" }, { "internalType": "bool", "name": "initialized", "type": "bool" }], "stateMutability": "view", "type": "function" }
  ];

  const registryContract = new Contract(REGISTRY_CONTRACT_ADDRESS, REGISTRY_ABI, provider);

  const userCount = await registryContract.usernamesLength();
  console.log("UserCount: %s", userCount)
  const map = {};
  for (var i = 0; i < 10; i++) {
    const usernameBytes = await registryContract.usernameAtIndex(i);
    console.log("Fetching user activity: %s", utils.toUtf8String(usernameBytes))
    const casts = await getUserActivity(usernameBytes, registryContract)
    casts.forEach(cast => {
      const text = cast.body.data.text
      const publishedAt = cast.body.publishedAt
      console.log("Parsing text: %s", text)
      const words = text.match(/\w+/g)
      if (words) {
        words.forEach(word => {
          if (map[word] === undefined || map[word].publishedAt > publishedAt) {
            map[word] = cast;
          }
        });
      }
    });
  }

  console.log(map)
}

const getUserActivity = async (usernameBytes, registryContract) => {
  const directoryUrl = await registryContract.getDirectoryUrl(usernameBytes);
  if (directoryUrl.indexOf("localhost") > -1) {
    return [];
  }
  const directoryResponse = await got(directoryUrl, { throwHttpErrors: false, timeout: { connect: 100 } }).on('error', (err) => {
    console.log(err)
  });
  const directory = JSON.parse(directoryResponse.body);

  const addressActivityUrl = directory.body.addressActivityUrl;
  const addressActivityResponse = await got(addressActivityUrl);
  const addressActivity = JSON.parse(addressActivityResponse.body);
  return addressActivity;
}

doStuff();