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
    const { uploadId } = await req.json();
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

    const sheets = workbook.SheetNames.slice(0, 8).map((sheetName) => {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null }) as unknown[][];
      const preview = rows.slice(0, 25);
      const matches = rows
        .flatMap((row, rowIndex) => row.map((cell, colIndex) => ({ rowIndex, colIndex, value: String(cell ?? "") })))
        .filter((cell) => /sector|industria|industry|precio objetivo|target price|15%|retorno|return|dividend|earnings|resultado/i.test(cell.value))
        .slice(0, 50);

      return {
        sheetName,
        preview,
        matches,
      };
    });

    return new Response(JSON.stringify({
      fileName: upload.file_name,
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
