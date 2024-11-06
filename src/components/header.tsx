import { ConnectButton } from "@rainbow-me/rainbowkit"
import { Button } from "./ui/button"
import { useAccount, useReadContract, useWriteContract } from "wagmi"
import { toast } from "sonner"
import { GovernanceAbi, GovernanceAddress } from "./abi/governance.abi"
import { waitForTransactionReceipt } from "@wagmi/core"
import { config } from "./app-provider"
import { useQueryClient } from "@tanstack/react-query"
import { MyTokenAbi, MyTokenAddress } from "./abi/my-token.abi"

const Header = () => {
  const { address } = useAccount()
  const queryClient = useQueryClient()
  const { writeContractAsync } = useWriteContract()
  const { queryKey: balanceQueryKey } = useReadContract({
    abi: MyTokenAbi,
    address: MyTokenAddress,
    functionName: 'balanceOf',
    args: [address],
    account: address
  })
  const { data: tokenToRelease, refetch: refetchTokenToRelease } = useReadContract({
    abi: GovernanceAbi,
    address: GovernanceAddress,
    functionName: 'tokenToRelease',
    account: address
  })
  const { data: proposals, queryKey: proposalsQueryKey } = useReadContract({
    abi: GovernanceAbi,
    address: GovernanceAddress,
    functionName: 'getActiveProposals',
    account: address
  })
  const handleReleaseTokens = async () => {

    const releaseTokens = async () => {
      const tx = await writeContractAsync({
        abi: GovernanceAbi,
        address: GovernanceAddress,
        functionName: 'releaseTokens',
        account: address
      })
      await waitForTransactionReceipt(config, {
        hash: tx,
        confirmations: 3
      })

      await refetchTokenToRelease()
      await queryClient.invalidateQueries({ queryKey: balanceQueryKey })
    }
    toast.promise(releaseTokens(), {
      loading: 'Releasing tokens... ',
      success: 'Tokens released successfully',
      error(data) {
        if (data?.shortMessage) {
          return data?.shortMessage
        }
        return 'Release failed'
      },
    })
  }
  const handleRemoveExpired = async () => {

    const removeExpired = async () => {
      const tx = await writeContractAsync({
        abi: GovernanceAbi,
        address: GovernanceAddress,
        functionName: 'autoExecuteExpiredProposals',
        account: address
      })
      await waitForTransactionReceipt(config, {
        hash: tx,
        confirmations: 3
      })

      await refetchTokenToRelease()

      queryClient.invalidateQueries({ queryKey: proposalsQueryKey })
    }
    toast.promise(removeExpired(), {
      loading: 'Removing expired proposals... ',
      success: 'Expired proposals removed successfully',
      error(data) {
        if (data?.shortMessage) {
          return data?.shortMessage
        }
        return 'Remove failed'
      },
    })
  }
  return (
    <header className="fixed top-0 left-0 right-0 px-4 py-2">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-3xl font-bold">Governance</h3>
        </div>
        <div className="flex gap-x-2">
          <Button onClick={handleRemoveExpired} disabled={!(proposals as Array<unknown>)?.length}>Remove Expired</Button>
          <Button onClick={handleReleaseTokens} disabled={!tokenToRelease}>Release Tokens</Button>
          <ConnectButton chainStatus={'icon'} />
        </div>
      </div>
    </header>
  )
}

export default Header