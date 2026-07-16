import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GripVertical, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Gift = {
  id: string;
  key: string;
  label: string;
  emoji: string;
  token_price: number;
  sort_order: number;
  active: boolean;
};

const giftSchema = z.object({
  key: z.string().trim().min(1).max(40).regex(/^[a-z0-9_-]+$/, "lowercase letters, digits, _ or -"),
  label: z.string().trim().min(1).max(40),
  emoji: z.string().trim().min(1).max(8),
  token_price: z.coerce.number().positive().max(100000),
  sort_order: z.coerce.number().int().min(0).max(9999),
  active: z.boolean(),
});

const empty = { key: "", label: "", emoji: "", token_price: 1, sort_order: 100, active: true };

export default function GiftCatalogPage() {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Gift | null>(null);
  const [form, setForm] = useState<z.input<typeof giftSchema>>(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("gift_catalog")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) toast.error(error.message);
    setGifts((data as Gift[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function openEdit(g: Gift) {
    setEditing(g);
    setForm({ key: g.key, label: g.label, emoji: g.emoji, token_price: g.token_price, sort_order: g.sort_order, active: g.active });
    setOpen(true);
  }

  async function save() {
    const parsed = giftSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setSaving(true);
    const payload = parsed.data as Required<z.infer<typeof giftSchema>>;
    const { error } = editing
      ? await supabase.from("gift_catalog").update(payload).eq("id", editing.id)
      : await supabase.from("gift_catalog").insert([payload as any]);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Gift updated" : "Gift added");
    setOpen(false);
    void load();
  }

  async function remove(g: Gift) {
    if (!confirm(`Delete "${g.label}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("gift_catalog").delete().eq("id", g.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    void load();
  }

  async function toggleActive(g: Gift) {
    const { error } = await supabase.from("gift_catalog").update({ active: !g.active }).eq("id", g.id);
    if (error) return toast.error(error.message);
    void load();
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Gift Catalog</h1>
          <p className="text-sm text-muted-foreground">Gifts viewers can send in lives. Prices are in tokens (1 token = $1).</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New gift</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-2">
          {gifts.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">No gifts yet — add one.</p>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={gifts.map((g) => g.id)} strategy={verticalListSortingStrategy}>
              {gifts.map((g) => (
                <SortableRow
                  key={g.id}
                  gift={g}
                  onToggle={() => toggleActive(g)}
                  onEdit={() => openEdit(g)}
                  onDelete={() => remove(g)}
                />
              ))}
            </SortableContext>
          </DndContext>
          {savingOrder && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving order…
            </p>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit gift" : "New gift"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Key</Label>
                <Input
                  value={form.key}
                  disabled={!!editing}
                  onChange={(e) => setForm((f) => ({ ...f, key: e.target.value.toLowerCase() }))}
                  placeholder="rose"
                  maxLength={40}
                />
              </div>
              <div>
                <Label>Emoji</Label>
                <Input value={form.emoji} onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))} placeholder="🌹" maxLength={8} />
              </div>
            </div>
            <div>
              <Label>Label</Label>
              <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Rose" maxLength={40} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Price (tokens)</Label>
                <Input type="number" min={1} value={form.token_price}
                  onChange={(e) => setForm((f) => ({ ...f, token_price: e.target.value as any }))} />
              </div>
              <div>
                <Label>Sort order</Label>
                <Input type="number" min={0} value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value as any }))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
              <Label>Active (shown to viewers)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
