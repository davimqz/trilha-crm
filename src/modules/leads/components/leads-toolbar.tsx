"use client";

import { FilterIcon, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { OptionSelect } from "@/components/form/option-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { LEAD_PERIOD_LABELS, LEAD_PERIODS, LEAD_SEARCH_MAX, LEAD_SORT_LABELS, LEAD_SORTS } from "../constants";
import type { AssignableUser } from "../service";
import type { ListLeadsQuery } from "../validators";

import { useLeadsUrl } from "./use-leads-url";

type LeadsToolbarProps = { query: ListLeadsQuery; users: AssignableUser[] };

const SEARCH_DEBOUNCE_MS = 300;

export function LeadsToolbar({ query, users }: LeadsToolbarProps) {
  const { hrefWith, replace } = useLeadsUrl();
  const [search, setSearch] = useState(query.q);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(debounce.current), []);

  function onSearchChange(value: string) {
    setSearch(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => replace({ q: value.trim() || null, lead: null }), SEARCH_DEBOUNCE_MS);
  }

  const ownerOptions = [
    { value: "all", label: "Todos" },
    { value: "me", label: "Meus leads" },
    ...users.map((user) => ({ value: user.id, label: user.name })),
  ];
  const activeFilters = Number(query.owner !== "all") + Number(query.period !== "any");

  const tabClass = (active: boolean) =>
    cn(
      "rounded-md px-3 py-1 text-sm font-medium transition-colors",
      active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="grid gap-3">
      <nav aria-label="Visualização" className="inline-flex w-fit rounded-lg bg-muted p-1">
        <Link href={hrefWith({ view: null, lead: null, tab: null })} className={tabClass(!query.archived)} aria-current={!query.archived ? "page" : undefined}>
          Ativos
        </Link>
        <Link href={hrefWith({ view: "archived", lead: null, tab: null })} className={tabClass(query.archived)} aria-current={query.archived ? "page" : undefined}>
          Arquivados
        </Link>
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Label htmlFor="leads-search" className="sr-only">
            Buscar por nome
          </Label>
          <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="leads-search"
            type="search"
            placeholder="Buscar por nome…"
            value={search}
            maxLength={LEAD_SEARCH_MAX}
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-8"
          />
        </div>

        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline">
                <FilterIcon />
                Filtros
                {activeFilters > 0 && <Badge className="ml-1 h-5 min-w-5 px-1">{activeFilters}</Badge>}
              </Button>
            }
          />
          <PopoverContent align="start" className="w-72">
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="filter-owner">Responsável</Label>
                <OptionSelect
                  id="filter-owner"
                  label="Responsável"
                  value={query.owner}
                  options={ownerOptions}
                  onValueChange={(value) => replace({ owner: value === "all" ? null : value, lead: null })}
                  className="w-full"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="filter-period">Criado em</Label>
                <OptionSelect
                  id="filter-period"
                  label="Criado em"
                  value={query.period}
                  options={LEAD_PERIODS.map((period) => ({ value: period, label: LEAD_PERIOD_LABELS[period] }))}
                  onValueChange={(value) => replace({ period: value === "any" ? null : value, lead: null })}
                  className="w-full"
                />
              </div>
              {activeFilters > 0 && (
                <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => replace({ owner: null, period: null })}>
                  <XIcon />
                  Limpar filtros
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-2">
          <Label htmlFor="leads-sort" className="text-sm whitespace-nowrap text-muted-foreground">
            Ordenar por
          </Label>
          <OptionSelect
            id="leads-sort"
            label="Ordenar por"
            value={query.sort}
            options={LEAD_SORTS.map((sort) => ({ value: sort, label: LEAD_SORT_LABELS[sort] }))}
            onValueChange={(value) => replace({ sort: value === "updated_desc" ? null : value })}
          />
        </div>
      </div>
    </div>
  );
}
