import { useAccount, useReadContract, useWriteContract } from "wagmi"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { FormEvent } from "react";
import { toast } from "sonner";
import { GovernanceAbi, GovernanceAddress } from "./abi/governance.abi";
import { waitForTransactionReceipt } from "@wagmi/core";
import { config } from "./app-provider";
import { MyTokenAbi, MyTokenAddress } from "./abi/my-token.abi";
import { useQueryClient } from "@tanstack/react-query";


const AddProposalForm = () => {
    const queryClient = useQueryClient();
    const { address } = useAccount();
    const { queryKey: balanceQueryKey } = useReadContract({
        abi: MyTokenAbi,
        address: MyTokenAddress,
        functionName: 'balanceOf',
        args: [address],
        account: address
    })
    const { queryKey } = useReadContract({
        abi: GovernanceAbi,
        address: GovernanceAddress,
        functionName: "getActiveProposals",
        // args: [],
    });

    const { data: mintTokensToParticipate } = useReadContract({
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

    const { writeContractAsync } = useWriteContract();

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
            await queryClient.invalidateQueries({ queryKey: balanceQueryKey })
        }

        toast.promise(approve(), {
            loading: 'Approving...',
            success: 'Approved successfully',
            error: 'Approval failed',
        })

    }

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const description = formData.get("description") as string;
        const durationInMins = parseInt(formData.get("durationInMins") as string);
        const targetMinTokens = parseInt(formData.get("targetMinTokens") as string);

        if (allowed === 0n) {
            await handleApproval(mintTokensToParticipate as bigint);
        }
        if (!description.length) {
            toast.warning("Please enter a description");
            return;
        }
        if (isNaN(durationInMins) || isNaN(targetMinTokens)) {
            toast.warning("Please enter valid numbers");
            return;
        }

        const handleAdd = async () => {
            const hash = await writeContractAsync({
                abi: GovernanceAbi,
                address: GovernanceAddress,
                functionName: "createProposal",
                args: [description, BigInt(durationInMins), BigInt(targetMinTokens)],
                account: address
            })

            await waitForTransactionReceipt(config, {
                hash,
                confirmations: 3
            })

            await queryClient.invalidateQueries({ queryKey });
        }

        toast.promise(handleAdd(), {
            loading: "Adding proposal",
            success: "Proposal added successfully",
            error(data) {
                console.log(data.message);

                if (data?.shortMessage) {
                    return data?.shortMessage
                }
                return 'Error adding proposal'
            },
        })
    }
    return (
        <div className="max-w-3xl mx-auto mt-12">
            <form className="flex gap-x-3" onSubmit={handleSubmit}>
                <Input type="text" placeholder="Description" name="description" />
                <Input type="text" placeholder="Duration in mins" name="durationInMins" />
                <Input type="text" placeholder="Minimum Token" name="targetMinTokens" />
                <Button>Add</Button>
            </form>
        </div>
    )
}

export default AddProposalForm