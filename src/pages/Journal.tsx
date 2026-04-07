import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, BookOpen, Trash2, Edit, Building2, ArrowLeftRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies } from "@/hooks/useCompanyData";
import { toast } from "sonner";

export default function Journal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: companies = [] } = useCompanies();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ title: "", content: "", companyId: "", tradeId: "" });

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["journal-notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_notes")
        .select("*, companies(name, ticker)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const resetForm = () => { setForm({ title: "", content: "", companyId: "", tradeId: "" }); setEditId(null); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user || !form.title.trim()) throw new Error("El título es obligatorio");
      const payload = {
        user_id: user.id,
        title: form.title.trim(),
        content: form.content || null,
        company_id: form.companyId || null,
        trade_id: form.tradeId || null,
      };
      if (editId) {
        const { error } = await supabase.from("journal_notes").update(payload as any).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("journal_notes").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-notes"] });
      toast.success(editId ? "Nota actualizada" : "Nota creada");
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("journal_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-notes"] });
      toast.success("Nota eliminada");
    },
  });

  const openEdit = (note: any) => {
    setEditId(note.id);
    setForm({ title: note.title, content: note.content || "", companyId: note.company_id || "", tradeId: note.trade_id || "" });
    setDialogOpen(true);
  };

  const filtered = search.trim()
    ? notes.filter((n: any) =>
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        (n.content || "").toLowerCase().includes(search.toLowerCase()) ||
        (n.companies?.ticker || "").toLowerCase().includes(search.toLowerCase())
      )
    : notes;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Journal</h1>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nueva nota</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{editId ? "Editar nota" : "Nueva nota"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Título *</Label>
                  <Input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Título de la nota" />
                </div>
                <div>
                  <Label>Contenido</Label>
                  <Textarea rows={5} value={form.content} onChange={(e) => set({ content: e.target.value })} placeholder="Escribe tu nota de inversión..." />
                </div>
                <div>
                  <Label>Vincular a empresa (opcional)</Label>
                  <Select value={form.companyId} onValueChange={(v) => set({ companyId: v })}>
                    <SelectTrigger><SelectValue placeholder="Sin vínculo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sin vínculo</SelectItem>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.ticker} - {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.title.trim()} className="w-full">
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editId ? "Guardar cambios" : "Crear nota"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <Input placeholder="Buscar notas..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

        {filtered.length === 0 ? (
          <Card className="p-8 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Sin notas. Crea una para registrar tus ideas de inversión.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((note: any) => (
              <Card key={note.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground">{note.title}</h3>
                      {note.companies && (
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {note.companies.ticker}
                        </Badge>
                      )}
                      {note.trade_id && (
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <ArrowLeftRight className="h-3 w-3" />
                          Trade
                        </Badge>
                      )}
                    </div>
                    {note.content && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note.content}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(note.created_at).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(note)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(note.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
