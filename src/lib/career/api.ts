import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { emptyCareerData, type Career, type CareerData, type CareerState, type SetKind } from "./types";

type CareerRow = {
  id: string;
  name: string;
  state: string;
  season: number;
  data: unknown;
  updated_at: string;
};

const toCareer = (row: CareerRow): Career & { updatedAt: string } => ({
  id: row.id,
  name: row.name,
  state: row.state as CareerState,
  season: row.season,
  data: { ...emptyCareerData(), ...(row.data as CareerData) },
  updatedAt: row.updated_at,
});

export function useCareers() {
  return useQuery({
    queryKey: ["careers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("careers")
        .select("id,name,state,season,data,updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data as CareerRow[]).map(toCareer);
    },
  });
}

export function useCareer(id: string) {
  return useQuery({
    queryKey: ["career", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("careers")
        .select("id,name,state,season,data,updated_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Career not found");
      return toCareer(data as CareerRow);
    },
  });
}

export function useCreateCareer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("careers")
        .insert({
          name,
          user_id: auth.user!.id,
          state: "PRESEASON",
          season: 1,
          data: emptyCareerData() as never,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["careers"] }),
  });
}

export function useSaveCareer(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { data?: CareerData; state?: CareerState; season?: number; name?: string }) => {
      const payload: Record<string, unknown> = {};
      if (patch.data) payload.data = patch.data;
      if (patch.state) payload.state = patch.state;
      if (patch.season) payload.season = patch.season;
      if (patch.name) payload.name = patch.name;
      const { error } = await supabase.from("careers").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["career", id] });
      qc.invalidateQueries({ queryKey: ["careers"] });
    },
  });
}

export function useDeleteCareer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("careers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["careers"] }),
  });
}

/* ---------------- reusable database sets ---------------- */

export type DbSet = { id: string; kind: SetKind; name: string; data: unknown[] };

export function useSets(kind?: SetKind) {
  return useQuery({
    queryKey: ["db_sets", kind ?? "all"],
    queryFn: async () => {
      let q = supabase.from("db_sets").select("id,kind,name,data").order("name");
      if (kind) q = q.eq("kind", kind);
      const { data, error } = await q;
      if (error) throw error;
      return data as DbSet[];
    },
  });
}

export function useSaveSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, name, data }: { kind: SetKind; name: string; data: unknown[] }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("db_sets")
        .insert({ kind, name, data: data as never, user_id: auth.user!.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["db_sets"] }),
  });
}

export function useDeleteSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("db_sets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["db_sets"] }),
  });
}

/* ---------------- global track library ---------------- */

export type TrackRow = {
  id: string;
  country: string;
  city: string;
  ac_exact_id: string;
  ac_approx_id: string;
};

export function useGlobalTracks() {
  return useQuery({
    queryKey: ["tracks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracks")
        .select("id,country,city,ac_exact_id,ac_approx_id")
        .order("country");
      if (error) throw error;
      return data as TrackRow[];
    },
  });
}

export function useUpsertTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: Omit<TrackRow, "id"> & { id?: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (t.id) {
        const { error } = await supabase.from("tracks").update(t).eq("id", t.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tracks").insert({ ...t, user_id: auth.user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracks"] }),
  });
}

export function useDeleteTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tracks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracks"] }),
  });
}
