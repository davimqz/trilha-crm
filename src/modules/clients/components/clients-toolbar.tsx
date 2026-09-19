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
import { useLeadsUrl } from "@/modules/leads/components/use-leads-url";
import { LEAD_SEARCH_MAX } from "@/modules/leads/constants";
import type { AssignableUser } from "@/modules/leads/service";

import { ASSOCIATIVE_STATUS_LABELS, ASSOCIATIVE_STATUSES, CLIENT_SORT_LABELS, CLIENT_SORTS } from "../constants";
import type { ListClientsQuery } from "../validators";

const SEARCH_DEBOUNCE_MS = 300;

export function ClientsToolbar({ query, users }: { query: ListClientsQuery; users: AssignableUser[] }) {
  const { hrefWith, replace } = useLeadsUrl();
  const [search, setSearch] = useState(query.q);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(debounce.current), []);

  function onSearchChange(value: string) {
    setSearch(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => replace({ q: value.trim() || null, client: null }), SEARCH_DEBOUNCE_MS);
  }

  const activeFilters = Number(query.status !== "all") + Number(query.owner !== "all");
  const tabClass = (active: boolean) =>
    cn(
      "rounded-md px-3 py-1 text-sm font-medium transition-colors",
      active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="grid gap-3">
      <nav aria-label="Visualização" className="inline-flex w-fit rounded-lg bg-muted p-1">
        <Link href={hrefWith({ view: null, client: null, tab: null })} className={tabClass(!query.archived)} aria-current={!query.archived ? "page" : undefined}>
          Ativos
        </Link>
        <Link href={hrefWith({ view: "archived", client: null, tab: null })} className={tabClass(query.archived)} aria-current={query.archived ? "page" : undefined}>
          Arquivados
        </Link>
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Label htmlFor="clients-search" className="sr-only">
            Buscar por nome
          </Label>
          <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="clients-search"
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
                <Label htmlFor="filter-status">Status associativo</Label>
                <OptionSelect
                  id="filter-status"
                  label="Status associativo"
                  value={query.status}
                  options={[{ value: "all", label: "Todos" }, ...ASSOCIATIVE_STATUSES.map((status) => ({ value: status, label: ASSOCIATIVE_STATUS_LABELS[status] }))]}
                  onValueChange={(value) => replace({ status: value === "all" ? null : value, client: null })}
                  className="w-full"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="filter-owner">Responsável</Label>
                <OptionSelect
                  id="filter-owner"
                  label="Responsável"
                  value={query.owner}
                  options={[{ value: "all", label: "Todos" }, { value: "me", label: "Meus clientes" }, ...users.map((user) => ({ value: user.id, label: user.name }))]}
                  onValueChange={(value) => replace({ owner: value === "all" ? null : value, client: null })}
                  className="w-full"
                />
              </div>
              {activeFilters > 0 && (
                <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => replace({ status: null, owner: null })}>
                  <XIcon />
                  Limpar filtros
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-2">
          <Label htmlFor="clients-sort" className="text-sm whitespace-nowrap text-muted-foreground">
            Ordenar por
          </Label>
          <OptionSelect
            id="clients-sort"
            label="Ordenar por"
            value={query.sort}
            options={CLIENT_SORTS.map((sort) => ({ value: sort, label: CLIENT_SORT_LABELS[sort] }))}
            onValueChange={(value) => replace({ sort: value === "name_asc" ? null : value })}
          />
        </div>
      </div>
    </div>
  );
}
