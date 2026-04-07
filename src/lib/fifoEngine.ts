import { supabase } from "@/integrations/supabase/client";

interface TaxLot {
  id: string;
  purchase_date: string;
  shares_remaining: number;
  cost_per_share_base: number;
}

/**
 * Create a tax lot when buying shares.
 */
export async function createTaxLot(params: {
  userId: string;
  companyId: string;
  portfolioId: string;
  tradeId?: string;
  purchaseDate: string;
  shares: number;
  costPerShare: number;
  costPerShareBase: number;
  currency: string;
  fxRate: number;
}) {
  const { error } = await supabase.from("tax_lots").insert({
    user_id: params.userId,
    company_id: params.companyId,
    portfolio_id: params.portfolioId,
    trade_id: params.tradeId || null,
    purchase_date: params.purchaseDate,
    shares_remaining: params.shares,
    shares_original: params.shares,
    cost_per_share: params.costPerShare,
    cost_per_share_base: params.costPerShareBase,
    currency: params.currency,
    fx_rate_to_base: params.fxRate,
  } as any);
  if (error) throw error;
}

/**
 * Consume tax lots via FIFO when selling shares.
 * Returns the realized gain/loss in base currency.
 */
export async function consumeLotsForSale(params: {
  userId: string;
  companyId: string;
  portfolioId: string;
  sellTradeId?: string;
  sellDate: string;
  sharesToSell: number;
  sellPriceBase: number; // price per share in base currency
}): Promise<{ gainLossBase: number; costBasisBase: number; proceedsBase: number }> {
  // Fetch lots ordered by purchase_date ASC (FIFO)
  const { data: lots, error } = await supabase
    .from("tax_lots")
    .select("*")
    .eq("user_id", params.userId)
    .eq("company_id", params.companyId)
    .eq("portfolio_id", params.portfolioId)
    .gt("shares_remaining", 0)
    .order("purchase_date", { ascending: true });

  if (error) throw error;
  if (!lots || lots.length === 0) {
    // No lots to consume — just record with zero cost basis
    const proceeds = params.sharesToSell * params.sellPriceBase;
    await recordRealizedGain({
      ...params,
      proceedsBase: proceeds,
      costBasisBase: 0,
      gainLossBase: proceeds,
      lotsConsumed: [],
    });
    return { gainLossBase: proceeds, costBasisBase: 0, proceedsBase: proceeds };
  }

  let remaining = params.sharesToSell;
  let totalCostBasis = 0;
  const lotsConsumed: Array<{ lot_id: string; shares: number; cost_per_share_base: number }> = [];

  for (const lot of lots as any[]) {
    if (remaining <= 0) break;

    const available = Number(lot.shares_remaining);
    const consume = Math.min(available, remaining);
    const costBase = Number(lot.cost_per_share_base);

    totalCostBasis += consume * costBase;
    remaining -= consume;

    lotsConsumed.push({ lot_id: lot.id, shares: consume, cost_per_share_base: costBase });

    const newRemaining = available - consume;
    if (newRemaining <= 0) {
      await supabase.from("tax_lots").delete().eq("id", lot.id);
    } else {
      await supabase.from("tax_lots").update({ shares_remaining: newRemaining } as any).eq("id", lot.id);
    }
  }

  const proceedsBase = params.sharesToSell * params.sellPriceBase;
  const gainLossBase = proceedsBase - totalCostBasis;

  await recordRealizedGain({
    ...params,
    proceedsBase,
    costBasisBase: totalCostBasis,
    gainLossBase,
    lotsConsumed,
  });

  return { gainLossBase, costBasisBase: totalCostBasis, proceedsBase };
}

async function recordRealizedGain(params: {
  userId: string;
  companyId: string;
  portfolioId: string;
  sellTradeId?: string;
  sellDate: string;
  sharesToSell: number;
  proceedsBase: number;
  costBasisBase: number;
  gainLossBase: number;
  lotsConsumed: any[];
}) {
  const { error } = await supabase.from("realized_gains").insert({
    user_id: params.userId,
    company_id: params.companyId,
    portfolio_id: params.portfolioId,
    sell_trade_id: params.sellTradeId || null,
    sell_date: params.sellDate,
    shares_sold: params.sharesToSell,
    proceeds_base: params.proceedsBase,
    cost_basis_base: params.costBasisBase,
    gain_loss_base: params.gainLossBase,
    lots_consumed: params.lotsConsumed,
  } as any);
  if (error) throw error;
}

/**
 * Adjust lots for a stock split: multiply shares by ratio, divide cost by ratio.
 */
export async function adjustLotsForSplit(params: {
  userId: string;
  companyId: string;
  portfolioId: string;
  ratio: number;
}) {
  const { data: lots, error } = await supabase
    .from("tax_lots")
    .select("*")
    .eq("user_id", params.userId)
    .eq("company_id", params.companyId)
    .eq("portfolio_id", params.portfolioId)
    .gt("shares_remaining", 0);

  if (error) throw error;
  if (!lots) return;

  for (const lot of lots as any[]) {
    await supabase.from("tax_lots").update({
      shares_remaining: Number(lot.shares_remaining) * params.ratio,
      shares_original: Number(lot.shares_original) * params.ratio,
      cost_per_share: Number(lot.cost_per_share) / params.ratio,
      cost_per_share_base: Number(lot.cost_per_share_base) / params.ratio,
    } as any).eq("id", lot.id);
  }
}
