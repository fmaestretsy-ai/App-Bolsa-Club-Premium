const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface StockData {
  price: number | null;
  week52High: number | null;
  week52Low: number | null;
}

async function fetchFromGoogleFinance(ticker: string): Promise<StockData> {
  // Try different exchange prefixes
  const exchanges = ['NASDAQ', 'NYSE', 'EPA', 'BIT', 'TSE', 'AMS', 'SWX', 'TPE'];
  const cleanTicker = ticker.includes(':') ? ticker : null;
  
  const urls = cleanTicker 
    ? [`https://www.google.com/finance/quote/${cleanTicker}`]
    : exchanges.map(ex => `https://www.google.com/finance/quote/${ticker}:${ex}`);

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      if (!res.ok) continue;
      const html = await res.text();

      // Extract current price
      const priceMatch = html.match(/data-last-price="([^"]+)"/);
      const price = priceMatch ? parseFloat(priceMatch[1]) : null;
      if (!price) continue;

      // Extract 52-week range
      const highMatch = html.match(/data-52-week-high="([^"]+)"/);
      const lowMatch = html.match(/data-52-week-low="([^"]+)"/);
      const week52High = highMatch ? parseFloat(highMatch[1]) : null;
      const week52Low = lowMatch ? parseFloat(lowMatch[1]) : null;

      return { price, week52High, week52Low };
    } catch {
      continue;
    }
  }
  return { price: null, week52High: null, week52Low: null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticker } = await req.json();
    if (!ticker) {
      return new Response(
        JSON.stringify({ success: false, error: 'Ticker is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching price for:', ticker);
    const data = await fetchFromGoogleFinance(ticker);

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching stock price:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
