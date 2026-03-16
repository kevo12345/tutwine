import { useEffect, useState } from "react";
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
  maxAge: number | null;
  maxDistanceKm: number;
};

interface DiscoverFiltersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: DiscoverFilters;
  matchCount: number;
  onChange: (filters: DiscoverFilters) => void;
  onReset: () => void;
}

const genderValueMap = {
  Man: "man",
  Woman: "woman",
  "Non-binary": "non-binary",
  Other: "other",
} as const;

const MAX_AGE_LIMIT = 80;

export function DiscoverFiltersSheet({
  open,
  onOpenChange,
  filters,
  matchCount,
  onChange,
  onReset,
}: DiscoverFiltersSheetProps) {
  const [minAgeInput, setMinAgeInput] = useState(String(filters.minAge));
  const [maxAgeInput, setMaxAgeInput] = useState(filters.maxAge?.toString() ?? "");
  const [isMinAgeFocused, setIsMinAgeFocused] = useState(false);
  const [isMaxAgeFocused, setIsMaxAgeFocused] = useState(false);

  useEffect(() => {
    if (!isMinAgeFocused) {
      setMinAgeInput(String(filters.minAge));
    }

    if (!isMaxAgeFocused) {
      setMaxAgeInput(filters.maxAge?.toString() ?? "");
    }
  }, [filters.minAge, filters.maxAge, open, isMinAgeFocused, isMaxAgeFocused]);

  const updateFilter = <K extends keyof DiscoverFilters>(key: K, value: DiscoverFilters[K]) => {
    onChange({ ...filters, [key]: value });
  };

  const handleMinAgeChange = (rawValue: string) => {
    const sanitizedValue = rawValue.replace(/\D/g, "");
    setMinAgeInput(sanitizedValue);

    if (!sanitizedValue) return;

    const parsed = Number(sanitizedValue);
    if (Number.isNaN(parsed) || parsed < 18) return;

    const nextMinAge = Math.min(parsed, MAX_AGE_LIMIT);

    if (filters.maxAge !== null && filters.maxAge < nextMinAge) {
      onChange({ ...filters, minAge: nextMinAge, maxAge: nextMinAge });
      if (!isMaxAgeFocused) {
        setMaxAgeInput(String(nextMinAge));
      }
      return;
    }

    updateFilter("minAge", nextMinAge);
  };

  const handleMaxAgeChange = (rawValue: string) => {
    const sanitizedValue = rawValue.replace(/\D/g, "");
    setMaxAgeInput(sanitizedValue);

    if (!sanitizedValue) {
      updateFilter("maxAge", null);
      return;
    }

    const parsed = Number(sanitizedValue);
    if (Number.isNaN(parsed) || parsed < filters.minAge) return;

    updateFilter("maxAge", Math.min(parsed, MAX_AGE_LIMIT));
  };

  const commitMinAge = (rawValue: string) => {
    const sanitizedValue = rawValue.replace(/\D/g, "");
    const parsed = Number(sanitizedValue);
    const nextMinAge = Number.isNaN(parsed) || !sanitizedValue ? 18 : Math.max(18, Math.min(parsed, MAX_AGE_LIMIT));
    setMinAgeInput(String(nextMinAge));

    if (filters.maxAge !== null && filters.maxAge < nextMinAge) {
      onChange({ ...filters, minAge: nextMinAge, maxAge: nextMinAge });
      setMaxAgeInput(String(nextMinAge));
      return;
    }

    updateFilter("minAge", nextMinAge);
  };

  const commitMaxAge = (rawValue: string) => {
    const sanitizedValue = rawValue.replace(/\D/g, "");

    if (!sanitizedValue) {
      setMaxAgeInput("");
      updateFilter("maxAge", null);
      return;
    }

    const parsed = Number(sanitizedValue);
    const nextMaxAge = Number.isNaN(parsed)
      ? filters.minAge
      : Math.max(filters.minAge, Math.min(parsed, MAX_AGE_LIMIT));

    setMaxAgeInput(String(nextMaxAge));
    updateFilter("maxAge", nextMaxAge);
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
              <Label htmlFor="discover-min-age">Minimum age</Label>
              <Input
                id="discover-min-age"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={minAgeInput}
                onFocus={() => setIsMinAgeFocused(true)}
                onChange={(event) => handleMinAgeChange(event.target.value)}
                onBlur={(event) => {
                  setIsMinAgeFocused(false);
                  commitMinAge(event.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discover-max-age">Maximum age</Label>
              <Input
                id="discover-max-age"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Any age"
                value={maxAgeInput}
                onFocus={() => setIsMaxAgeFocused(true)}
                onChange={(event) => handleMaxAgeChange(event.target.value)}
                onBlur={(event) => {
                  setIsMaxAgeFocused(false);
                  commitMaxAge(event.target.value);
                }}
              />
              <p className="text-xs text-muted-foreground">Leave blank to search {filters.minAge}+.</p>
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

        <SheetFooter className="mt-8 gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{matchCount}</span> {matchCount === 1 ? "profile matches" : "profiles match"}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onReset}>
              Reset
            </Button>
            <Button className="gradient-warm border-0 text-primary-foreground" onClick={() => onOpenChange(false)}>
              Show matches
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
