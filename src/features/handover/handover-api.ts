import { config, edgeFunctions } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import type {
  HandoverCategory,
  HandoverNote,
  HandoverPriority,
  HandoverProfile
} from "@/features/handover/types";

type RawNote = Omit<
  HandoverNote,
  "author" | "acknowledgedBy" | "resolvedBy"
>;

function asProfileMap(rows: HandoverProfile[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

export async function loadHandoverFeed() {
  const { data, error } = await supabase
    .from("notes")
    .select(
      "id,shift_id,author_id,body,priority,category,status,acknowledged_by,acknowledged_at,resolved_by,resolved_at,created_at"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;

  const rows = (data || []) as RawNote[];
  const profileIds = [
    ...new Set(
      rows
        .flatMap((row) => [
          row.author_id,
          row.acknowledged_by,
          row.resolved_by
        ])
        .filter((value): value is string => Boolean(value))
    )
  ];

  let profiles = new Map<string, HandoverProfile>();

  if (profileIds.length) {
    const { data: profileRows, error: profileError } =
      await supabase
        .from("profiles")
        .select("id,first_name,last_name,position")
        .in("id", profileIds);

    if (profileError) throw profileError;

    profiles = asProfileMap(
      (profileRows || []) as HandoverProfile[]
    );
  }

  const statusRank = {
    new: 0,
    acknowledged: 1,
    resolved: 2
  } as const;

  return rows
    .map<HandoverNote>((row) => ({
      ...row,
      author: profiles.get(row.author_id) || null,
      acknowledgedBy:
        row.acknowledged_by
          ? profiles.get(row.acknowledged_by) || null
          : null,
      resolvedBy:
        row.resolved_by
          ? profiles.get(row.resolved_by) || null
          : null
    }))
    .sort((a, b) => {
      const byStatus =
        statusRank[a.status] - statusRank[b.status];

      if (byStatus !== 0) return byStatus;

      return (
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      );
    });
}

export async function createHandover(input: {
  body: string;
  category: HandoverCategory;
  priority: HandoverPriority;
}) {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("unauthorized");
  }

  const response = await fetch(edgeFunctions.handoverPush, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.supabasePublishableKey,
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify(input)
  });

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    note?: unknown;
    error?: string;
  };

  if (!response.ok || !data.ok || !data.note) {
    throw new Error(data.error || "handover_create_failed");
  }

  return data.note;
}

export async function acknowledgeHandover(
  noteId: string
) {
  const { data, error } = await supabase.rpc(
    "acknowledge_handover",
    { p_note_id: noteId }
  );

  if (error || !data) {
    throw error || new Error("handover_ack_failed");
  }

  return data;
}

export async function resolveHandover(
  noteId: string
) {
  const { data, error } = await supabase.rpc(
    "resolve_handover",
    { p_note_id: noteId }
  );

  if (error || !data) {
    throw error || new Error("handover_resolve_failed");
  }

  return data;
}

export function subscribeToHandovers(
  onChange: () => void
) {
  const channel = supabase
    .channel("bfstaff-handover-feed")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notes"
      },
      onChange
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
