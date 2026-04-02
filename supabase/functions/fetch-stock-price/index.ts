const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface StockData {
  price: number | null;
  week52High: number | null;
  week52Low: number | null;
  sector: string | null;
}

async function fetchFromGoogleFinance(ticker: string): Promise<StockData> {
  const exchanges = ['NASDAQ', 'NYSE', 'EPA', 'BIT', 'TSE', 'AMS', 'SWX', 'TPE'];
  const cleanTicker = ticker.includes(':') ? ticker : null;

  const urls = cleanTicker
    ? [`https://www.google.com/finance/quote/${cleanTicker}`]
    : exchanges.map(ex => `https://www.google.com/finance/quote/${ticker}:${ex}`);

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (!res.ok) continue;
      const html = await res.text();

      // Extract current price
      const priceMatch = html.match(/data-last-price="([^"]+)"/);
      const price = priceMatch ? parseFloat(priceMatch[1]) : null;
      if (!price) continue;

      // Extract 52-week high and low using multiple patterns
      let week52High: number | null = null;
      let week52Low: number | null = null;

      // Pattern 1: data attributes
      const highMatch = html.match(/data-52-week-high="([^"]+)"/);
      const lowMatch = html.match(/data-52-week-low="([^"]+)"/);
      if (highMatch) week52High = parseFloat(highMatch[1]);
      if (lowMatch) week52Low = parseFloat(lowMatch[1]);

      // Pattern 2: Look for "52-week" section in the page content
      if (!week52High || !week52Low) {
        // Try to find 52 week range in format like "52-wk range ... $XXX.XX - $XXX.XX"
        const rangeMatch = html.match(/52[- ]?w(?:ee)?k[^<]*?(\d[\d,.]+)\s*[-–]\s*(\d[\d,.]+)/i);
        if (rangeMatch) {
          const low = parseFloat(rangeMatch[1].replace(/,/g, ''));
          const high = parseFloat(rangeMatch[2].replace(/,/g, ''));
          if (!isNaN(low) && !isNaN(high)) {
            week52Low = week52Low ?? low;
            week52High = week52High ?? high;
          }
        }
      }

      // Extract sector/industry from the "About" section
      let sector: string | null = null;
      // Google Finance shows sector in a data attribute or in structured content
      const sectorMatch = html.match(/data-sector="([^"]+)"/) 
        || html.match(/"sector"\s*:\s*"([^"]+)"/)
        || html.match(/Sector[^<]*<[^>]*>([^<]+)</);
      if (sectorMatch) sector = sectorMatch[1].trim();
      
      // Also try industry
      if (!sector) {
        const industryMatch = html.match(/data-industry="([^"]+)"/)
          || html.match(/"industry"\s*:\s*"([^"]+)"/)
          || html.match(/Industry[^<]*<[^>]*>([^<]+)/);
        if (industryMatch) sector = industryMatch[1].trim();
      }

      console.log(`${ticker}: price=${price}, 52wH=${week52High}, 52wL=${week52Low}, sector=${sector}`);
      return { price, week52High, week52Low, sector };
    } catch (e) {
      console.error(`Error fetching ${url}:`, e);
      continue;
    }
  }
  return { price: null, week52High: null, week52Low: null, sector: null };
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
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
