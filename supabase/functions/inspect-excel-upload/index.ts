import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import * as XLSX from "npm:xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { uploadId, sheetFilter, rowStart, rowEnd } = await req.json();
    if (!uploadId) {
      return new Response(JSON.stringify({ error: "uploadId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const { data: upload, error: uploadError } = await supabase
      .from("excel_uploads")
      .select("id, file_name, file_path")
      .eq("id", uploadId)
      .single();

    if (uploadError || !upload) {
      throw uploadError ?? new Error("Upload not found");
    }

    const { data: fileData, error: fileError } = await supabase.storage
      .from("excel-uploads")
      .download(upload.file_path);

    if (fileError || !fileData) {
      throw fileError ?? new Error("File not found in storage");
    }

    const buffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });

    const sheetsToProcess = sheetFilter 
      ? workbook.SheetNames.filter((s: string) => s.toLowerCase().includes(sheetFilter.toLowerCase()))
      : workbook.SheetNames.slice(0, 8);

    const sheets = sheetsToProcess.map((sheetName: string) => {
      const allRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null }) as unknown[][];
      const start = rowStart ?? 0;
      const end = rowEnd ?? allRows.length;
      const rows = allRows.slice(start, end).map((row, i) => ({ rowIdx: start + i, cells: row }));

      return {
        sheetName,
        totalRows: allRows.length,
        rows,
      };
    });

    return new Response(JSON.stringify({
      fileName: upload.file_name,
      sheetNames: workbook.SheetNames,
      sheets,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
