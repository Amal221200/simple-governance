import '@rainbow-me/rainbowkit/styles.css';
import {
    getDefaultConfig,
    midnightTheme,
    RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import {
    sepolia,
    bscTestnet
} from 'wagmi/chains';
import {
    QueryClientProvider,
    QueryClient,
} from "@tanstack/react-query";
import { PropsWithChildren } from 'react';
import { defineChain } from 'viem';


const sepoliaTestnet = defineChain({
    ...sepolia,
    name: 'Sepolia Testnet',
    rpcUrls: {
        default: {
            http: ['https://eth-sepolia.g.alchemy.com/v2/YO1bIajMUYQNoOMjxOMgfuqSbobq52Tf'],
        },
    },
})

// const chains = [sepolia, bscTestnet] as Chain[];
export const config = getDefaultConfig({
    appName: 'Governance',
    projectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID,
    chains: [sepoliaTestnet, bscTestnet],
});

const queryClient = new QueryClient();

export const AppProvider = ({ children }: PropsWithChildren) => {
    return (
        <WagmiProvider config={config} >
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider theme={midnightTheme({
                    accentColor: "#6f76f6",
                    accentColorForeground: "white",
                    borderRadius: "small",
                })}
                    initialChain={97}>
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
};