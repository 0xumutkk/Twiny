import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApprovalCard } from "./ApprovalCard";

const { sendTransactionMock } = vi.hoisted(() => ({
  sendTransactionMock: vi.fn(),
}));

vi.mock("@privy-io/react-auth", () => ({
  useSendTransaction: () => ({
    sendTransaction: sendTransactionMock,
  }),
}));

describe("ApprovalCard", () => {
  beforeEach(() => {
    sendTransactionMock.mockReset();
  });

  it("sends the prepared transaction and shows success state", async () => {
    sendTransactionMock.mockResolvedValue({ transactionHash: "0xabc123" });

    const onApprove = vi.fn();

    render(
      <ApprovalCard
        campaignName="Daily claim"
        rewardMON="1.5"
        estimatedMinutes={2}
        riskLevel="low"
        dataShared={["wallet address"]}
        onChainAction="claimReward(campaignId=campaign-1)"
        cloudUsed={false}
        blocked={false}
        txTo="0x1111111111111111111111111111111111111111"
        txData="0x1234"
        onApprove={onApprove}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /approve in wallet/i }));

    await waitFor(() => expect(sendTransactionMock).toHaveBeenCalledTimes(1));
    expect(sendTransactionMock).toHaveBeenCalledWith({
      to: "0x1111111111111111111111111111111111111111",
      data: "0x1234",
    });
    expect(onApprove).toHaveBeenCalledWith("0xabc123");
    expect(screen.getByText(/settled on monad/i)).toBeInTheDocument();
  });

  it("blocks approval when policy has stopped the action", () => {
    render(
      <ApprovalCard
        campaignName="Daily claim"
        rewardMON="1.5"
        estimatedMinutes={2}
        riskLevel="high"
        dataShared={["wallet address"]}
        onChainAction="claimReward(campaignId=campaign-1)"
        cloudUsed={false}
        blocked
        blockReason="Policy rejected the transfer"
        warnings={["Recipient is unknown"]}
        txTo="0x1111111111111111111111111111111111111111"
        txData="0x1234"
      />
    );

    const blockedButton = screen.getByRole("button", {
      name: /blocked by policy/i,
    });

    expect(blockedButton).toBeDisabled();
    expect(
      screen.getByText(/policy rejected the transfer/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/recipient is unknown/i)).toBeInTheDocument();
  });
});
