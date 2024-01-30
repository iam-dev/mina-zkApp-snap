/* eslint-disable no-bitwise */
/* eslint-disable no-case-declarations */
import { SLIP10Node } from '@metamask/key-tree';
import type { OnRpcRequestHandler } from '@metamask/snaps-sdk';
import { panel, text } from '@metamask/snaps-sdk';
import bs58check from 'bs58check';
import Client from 'mina-signer';

/**
 * Handle incoming JSON-RPC requests, sent through `wallet_invokeSnap`.
 *
 * @param args - The request handler args as object.
 * @param args.origin - The origin of the request, e.g., the website that
 * invoked the snap.
 * @param args.request - A validated JSON-RPC request object.
 * @returns The result of `snap_dialog`.
 * @throws If the request method is not valid for this snap.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({
  origin,
  request,
}) => {
  switch (request.method) {
    case 'mina_getPublicKey':
      const keypair = await getKeyPair();
      console.log('mina_getPublicKey', keypair.publicKey);
      const publicKey = keypair.publicKey;
      return { publicKey };
    case 'mina_createNullifier':
      const keyPair = await getKeyPair();
      console.log('mina_createNullifier', keyPair.privateKey);
      const client = new Client({ network: 'mainnet' });
    
      const requestMessage = (request.params as { message: string }).message;
      console.log('request.params.message', requestMessage);
      const message = Array.from(new BigInt64Array([BigInt(requestMessage)]));

      let jsonNullifier1 = client.createNullifier(
        message,
        keyPair.privateKey
      );
      const publicNullifier = jsonNullifier1.public;
      console.log('publicNullifier', publicNullifier);
      return publicNullifier; 
    case 'mina_zkapp':
        const { zkappAddress, zkappMethod } = request.params;
        console.log('mina_zkapp', zkappAddress, zkappMethod);
        break;
    case 'mina_hello':
      return snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel([
            text(`Hello, **${origin}**!`),
            text('This custom confirmation is just for display purposes.'),
            text(
              'But you can edit the snap source code to make it do something, if you want to!',
            ),
          ]),
        },
      });
    default:
      throw new Error('Method not found.');
  }
};

async function getKeyPair(): Promise<{publicKey: string, privateKey: string}> {
  const client = new Client({ network: 'mainnet' });
  const bip32Node: any = await snap.request({
    method: 'snap_getBip32Entropy',
    params: {
      path: ['m', "44'", `12586'`],
      curve: 'secp256k1',
    },
  });
  console.log('snap_getBip32Entropy result:', bip32Node);
  const minaSlip10Node = await SLIP10Node.fromJSON(bip32Node);
  const accountIndex = 0;
  const accountKey0 = await minaSlip10Node.derive([
    `bip32:${accountIndex}'`,
  ]);
  if (!accountKey0.privateKeyBytes) {
    // TODO: we should return error here
    return { publicKey: '', privateKey: '' };
  }
  accountKey0.privateKeyBytes[0] &= 0x3f;
  const reversed = Buffer.alloc(accountKey0.privateKeyBytes?.length);
  for (let i = accountKey0.privateKeyBytes.length; i > 0; i--) {
    reversed[accountKey0.privateKeyBytes.length - i] =
      accountKey0.privateKeyBytes[i - 1];
  }

  const childPrivateKey = reversed;
  const privateKeyHex = `5a01${childPrivateKey.toString('hex')}`;
  const privateKey = bs58check.encode(Buffer.from(privateKeyHex, 'hex'));
  const publicKey = client.derivePublicKey(privateKey);
  console.log('publicKey', publicKey);
  console.log('privateKey', privateKey);
  return { publicKey, privateKey };
}