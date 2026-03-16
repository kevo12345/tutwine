import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DISTANCE_OPTIONS, GENDER_OPTIONS } from "@/lib/constants";

export type DiscoverFilters = {
  gender: "any" | "man" | "woman" | "non-binary" | "other";
  minAge: number;
  maxAge: number;
  maxDistanceKm: number;
};

interface DiscoverFiltersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: DiscoverFilters;
  onChange: (filters: DiscoverFilters) => void;
  onReset: () => void;
}

const genderValueMap = {
  Man: "man",
  Woman: "woman",
  "Non-binary": "non-binary",
  Other: "other",
} as const;

export function DiscoverFiltersSheet({
  open,
  onOpenChange,
  filters,
  onChange,
  onReset,
}: DiscoverFiltersSheetProps) {
  const updateFilter = <K extends keyof DiscoverFilters>(key: K, value: DiscoverFilters[K]) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display">Discovery filters</SheetTitle>
          <SheetDescription>
            Narrow your feed by gender, age range, and distance.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="discover-gender">Gender</Label>
            <Select
              value={filters.gender}
              onValueChange={(value: DiscoverFilters["gender"]) => updateFilter("gender", value)}
            >
              <SelectTrigger id="discover-gender">
                <SelectValue placeholder="Any gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any gender</SelectItem>
                {GENDER_OPTIONS.map((option) => (
                  <SelectItem key={option} value={genderValueMap[option]}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="discover-min-age">Min age</Label>
              <Input
                id="discover-min-age"
                type="number"
                inputMode="numeric"
                min={18}
                max={80}
                value={filters.minAge}
                onChange={(event) => {
                  const nextValue = Number(event.target.value || 18);
                  updateFilter("minAge", Math.max(18, Math.min(nextValue, filters.maxAge)));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discover-max-age">Max age</Label>
              <Input
                id="discover-max-age"
                type="number"
                inputMode="numeric"
                min={18}
                max={80}
                value={filters.maxAge}
                onChange={(event) => {
                  const nextValue = Number(event.target.value || 80);
                  updateFilter("maxAge", Math.min(80, Math.max(nextValue, filters.minAge)));
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="discover-distance">Location radius</Label>
            <Select
              value={String(filters.maxDistanceKm)}
              onValueChange={(value) => updateFilter("maxDistanceKm", Number(value))}
            >
              <SelectTrigger id="discover-distance">
                <SelectValue placeholder="Select distance" />
              </SelectTrigger>
              <SelectContent>
                {DISTANCE_OPTIONS.map((distance) => (
                  <SelectItem key={distance} value={String(distance)}>
                    {distance} km
                  </SelectItem>
                ))}
                <SelectItem value="250">250 km</SelectItem>
                <SelectItem value="500">500 km</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <SheetFooter className="mt-8 gap-2">
          <Button variant="outline" onClick={onReset}>
            Reset
          </Button>
          <Button className="gradient-warm border-0 text-primary-foreground" onClick={() => onOpenChange(false)}>
            Show matches
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
