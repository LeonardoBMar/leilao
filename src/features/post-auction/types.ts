import type { Cents } from "@/domain/money";
import type { ExpenseCategory, PortfolioSummary, PostAuctionStatus, RealizedPnl } from "@/domain/post-auction/pnl";

export type LotExpenseItem = {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: Cents;
  incurredAt: Date;
};

export type LotPostAuctionRecord = {
  status: PostAuctionStatus;
  paymentDueAt: Date | null;
  paidAt: Date | null;
  pickedUpAt: Date | null;
  docReceivedAt: Date | null;
  listedAt: Date | null;
  soldAt: Date | null;
  salePrice: Cents | null;
  privatePlate: string | null;
  notes: string | null;
  updatedAt: Date | null;
};

export type LotPostAuctionContext = {
  lotId: string;
  finalBid: Cents;
  acquiredAt: Date | null;
  analysisId: string | null;
  analysisVersion: number | null;
  record: LotPostAuctionRecord;
  expenses: LotExpenseItem[];
  pnl: RealizedPnl;
  isPaymentOverdue: boolean;
};

export type PortfolioLotItem = {
  lotId: string;
  lotNumber: string;
  title: string;
  auctionName: string;
  status: PostAuctionStatus;
  acquiredAt: Date | null;
  paymentDueAt: Date | null;
  paidAt: Date | null;
  soldAt: Date | null;
  isPaymentOverdue: boolean;
  finalBid: Cents;
  totalExpenses: Cents;
  totalInvested: Cents;
  salePrice: Cents | null;
  realizedProfit: Cents | null;
  realizedRoiRatio: number | null;
  holdDays: number | null;
};

export type PortfolioOverview = {
  summary: PortfolioSummary;
  items: PortfolioLotItem[];
};
