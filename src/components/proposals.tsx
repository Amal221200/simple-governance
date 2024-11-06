'use client'
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { useAccount, useReadContract, useWriteContract } from 'wagmi'
import { GovernanceAbi, GovernanceAddress } from './abi/governance.abi'
import { waitForTransactionReceipt } from "@wagmi/core"
import { config } from "./app-provider"
import { MyTokenAbi, MyTokenAddress } from "./abi/my-token.abi"
import { useQueryClient } from "@tanstack/react-query"

interface Proposal {
    id: bigint;
    proposer: string;
    description: string;
    votesFor: bigint;
    votesAgainst: bigint;
    startTime: bigint;
    endTime: bigint;
    executed: boolean;
    targetMintTokens: bigint;
    hasVoted: boolean;
}

export default function Proposals() {

    const { address } = useAccount()
    const queryClient = useQueryClient()
    const { data: proposals, refetch: refetchProposals } = useReadContract({
        abi: GovernanceAbi,
        address: GovernanceAddress,
        functionName: 'getActiveProposals',
        // args: [],
        account: address,
        query: {
            refetchInterval: 60_000,

        },
    })
    
    const { data: balance, refetch: refecthBalance } = useReadContract({
        abi: MyTokenAbi,
        address: MyTokenAddress,
        functionName: 'balanceOf',
        args: [address],
        account: address
    })

    const { data: mintTokensToParticipate, refetch: refetchMintTokensToParticipate } = useReadContract({
        abi: GovernanceAbi,
        address: GovernanceAddress,
        functionName: 'mintTokensToParticipate',
        // args: [],
        account: address
    })

    const { data: allowed, refetch: refetchAllowed } = useReadContract({
        abi: GovernanceAbi,
        address: GovernanceAddress,
        functionName: 'getAllowance',
        // args: [],
        account: address
    })
    const { queryKey } = useReadContract({
        abi: GovernanceAbi,
        address: GovernanceAddress,
        functionName: 'tokenToRelease',
        // args: [],
        account: address
    })


    const { writeContractAsync } = useWriteContract()



    const formatAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`
    }

    const formatDate = (timestamp: number) => {
        const date = new Date(0);
        date.setSeconds(timestamp);
        return date.toLocaleString()
    }

    const getProposalStatus = (proposal: Proposal) => {
        const now = Math.floor(Date.now() / 1000)
        if (proposal.executed) return 'Executed'
        if (now < proposal.startTime) return 'Pending'
        if (now > proposal.endTime) return 'Ended'
        return 'Active'
    }

    const handleApproval = async (amount: bigint) => {
        const approve = async () => {
            const tx = await writeContractAsync({
                abi: MyTokenAbi,
                address: MyTokenAddress,
                functionName: 'approve',
                args: [GovernanceAddress, amount],
                account: address
            })

            await waitForTransactionReceipt(config, {
                hash: tx,
                confirmations: 3
            })
            await refetchAllowed()
        }

        toast.promise(approve(), {
            loading: 'Approving...',
            success: 'Approved successfully',
            error: 'Approval failed',
        })

    }

    const handleVote = async (proposal: Proposal, voteType: boolean) => {
        const amount = prompt("Enter amount of tokens to vote with");
        if (amount === null) {
            return;
        }
        if (isNaN(Number(amount))) {
            return;
        }

        if ((allowed as bigint) < proposal.targetMintTokens) {
            await handleApproval(BigInt(amount))
        }

        const vote = async () => {
            const tx = await writeContractAsync({
                abi: GovernanceAbi,
                address: GovernanceAddress,
                functionName: 'vote',
                args: [proposal.id, voteType, BigInt(amount)],
                account: address
            })

            await waitForTransactionReceipt(config, {
                hash: tx,
                confirmations: 3
            })

            await refetchProposals()
            await refetchAllowed()
            await refetchMintTokensToParticipate()
            await refecthBalance()
            await queryClient.invalidateQueries({ queryKey })
        }
        toast.promise(vote(), {
            loading: 'Voting...',
            success: 'Voted successfully',
            error(data) {
                console.log(data.message);

                if (data?.shortMessage) {
                    return data?.shortMessage
                }
                return 'Vote failed'
            },
        })
    }

    return (
        <div className="container mx-auto py-3">
            <h2 className="text-3xl font-bold mb-2">Proposals</h2>
            <h3 className="text-2xl font-bold mb-2">Token to participate: {mintTokensToParticipate?.toString()} MYT</h3>
            <h3 className="text-2xl font-bold mb-2">Your balance: {balance?.toString()} MYT</h3>
            {/* <button onClick={() => handleApproval(100n)}>Allow</button> */}
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Proposer</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Votes For</TableHead>
                        <TableHead>Votes Against</TableHead>
                        <TableHead>Start Time</TableHead>
                        <TableHead>End Time</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Target Min Tokens</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {(proposals as Proposal[] | undefined)?.map((proposal) => (
                        <TableRow key={proposal.id?.toString()}>
                            <TableCell>{proposal.id?.toString()}</TableCell>
                            <TableCell>{formatAddress(proposal.proposer)}</TableCell>
                            <TableCell>{proposal.description}</TableCell>
                            <TableCell>{proposal.votesFor?.toString()}</TableCell>
                            <TableCell>{proposal.votesAgainst?.toString()}</TableCell>
                            <TableCell>{formatDate(Number(proposal.startTime))}</TableCell>
                            <TableCell>{formatDate(Number(proposal.endTime))}</TableCell>
                            <TableCell>{getProposalStatus(proposal)}</TableCell>
                            <TableCell>{proposal?.targetMintTokens?.toString()}</TableCell>
                            <TableCell>
                                <div className="flex space-x-2">
                                    <Button
                                        onClick={() => handleVote(proposal, true)}
                                        disabled={proposal?.hasVoted || getProposalStatus(proposal) !== 'Active'}
                                    >
                                        Vote For
                                    </Button>
                                    <Button
                                        onClick={() => handleVote(proposal, false)}
                                        disabled={proposal?.hasVoted || getProposalStatus(proposal) !== 'Active'}
                                        variant="destructive"
                                    >
                                        Vote Against
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                    {
                        (proposals as Proposal[] | undefined)?.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={10} className="h-24 text-center">
                                    No proposals defined yet
                                </TableCell>
                            </TableRow>
                        )
                    }
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={10}>
                            <h3 className=" text-center font-semibold">If you have MYT tokens in any other chains, you can transfer it to bnb testnet from <a href="https://cross-chain-swap.vercel.app" className="hover:underline" target="_blank">CrossChain Swap</a></h3>
                        </TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    )
}