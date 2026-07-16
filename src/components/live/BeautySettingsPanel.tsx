import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Sparkles, RotateCcw } from "lucide-react";
import {
  BeautySettings,
  DEFAULT_BEAUTY,
  saveBeauty,
} from "@/lib/beautyFilter";

type Props = {
  value: BeautySettings;
  onChange: (next: BeautySettings) => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
};

export function BeautySettingsPanel({ value, onChange, trigger, open, onOpenChange }: Props) {
  function update<K extends keyof BeautySettings>(k: K, v: BeautySettings[K]) {
    const next = { ...value, [k]: v };
    onChange(next);
    saveBeauty(next);
  }
  function reset() {
    onChange({ ...DEFAULT_BEAUTY, enabled: value.enabled });
    saveBeauty({ ...DEFAULT_BEAUTY, enabled: value.enabled });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Beauty
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Beauty Mode</Label>
              <p className="text-[11px] text-muted-foreground">
                Applies a natural enhancement to your outgoing video.
              </p>
            </div>
            <Switch
              checked={value.enabled}
              onCheckedChange={(v) => update("enabled", v)}
            />
          </div>

          <div className={value.enabled ? "space-y-5" : "space-y-5 opacity-50 pointer-events-none"}>
            <BeautySlider label="Skin Smoothing" value={value.smoothing} min={0} max={100} onChange={(v) => update("smoothing", v)} />
            <BeautySlider label="Brightness" value={value.brightness} min={60} max={160} onChange={(v) => update("brightness", v)} display={(v) => `${v}%`} />
            <BeautySlider label="Skin Tone" value={value.skinTone} min={50} max={180} onChange={(v) => update("skinTone", v)} display={(v) => `${v}%`} />
            <BeautySlider label="Sharpness" value={value.sharpness} min={70} max={160} onChange={(v) => update("sharpness", v)} display={(v) => `${v}%`} />

            <div className="pt-1 border-t">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3 mt-3">Optional</p>
              <div className="space-y-5">
                <BeautySlider label="Face Slimming" value={value.faceSlim} min={0} max={100} onChange={(v) => update("faceSlim", v)} />
                <BeautySlider label="Eye Enhancement" value={value.eyeEnhance} min={0} max={100} onChange={(v) => update("eyeEnhance", v)} />
              </div>
            </div>
          </div>

          <Button variant="outline" size="sm" className="w-full gap-2" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset to Default
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BeautySlider({
  label,
  value,
  min,
  max,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  display?: (v: number) => string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <span className="text-xs text-muted-foreground tabular-nums">
          {display ? display(value) : value}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}
