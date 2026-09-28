import { config, edgeFunctions } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import type { StaffPosition } from "@/types/auth";
import type {
  FeedPost,
  FeedPriority,
  FeedProfile
} from "@/features/feed/types";

type RawFeedPost = Omit<
  FeedPost,
  "author" | "resolvedBy" | "acknowledgedByMe" | "acknowledgementCount"
>;

type AckRow = {
  note_id: string;
  user_id: string;
  created_at: string;
};

function asProfileMap(rows: FeedProfile[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

export async function loadFeed() {
  const { data: { session } } = await supabase.auth.getSession();
  const currentUserId = session?.user.id || "";

  const { data, error } = await supabase
    .from("notes")
    .select(
      "id,shift_id,author_id,subject,body,priority,status,notify_all,notify_positions,resolved_by,resolved_at,created_at"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;

  const rows = (data || []) as RawFeedPost[];
  const noteIds = rows.map((row) => row.id);
  const profileIds = [
    ...new Set(
      rows
        .flatMap((row) => [row.author_id, row.resolved_by])
        .filter((value): value is string => Boolean(value))
    )
  ];

  let profiles = new Map<string, FeedProfile>();
  let acknowledgements: AckRow[] = [];

  if (profileIds.length) {
    const { data: profileRows, error: profileError } =
      await supabase
        .from("profiles")
        .select("id,first_name,last_name,position")
        .in("id", profileIds);

    if (profileError) throw profileError;
    profiles = asProfileMap((profileRows || []) as FeedProfile[]);
  }

  if (noteIds.length) {
    const { data: ackRows, error: ackError } =
      await supabase
        .from("feed_acknowledgements")
        .select("note_id,user_id,created_at")
        .in("note_id", noteIds);

    if (ackError) throw ackError;
    acknowledgements = (ackRows || []) as AckRow[];
  }

  const ackCount = new Map<string, number>();
  const mine = new Set<string>();

  acknowledgements.forEach((row) => {
    ackCount.set(row.note_id, (ackCount.get(row.note_id) || 0) + 1);
    if (row.user_id === currentUserId) mine.add(row.note_id);
  });

  return rows
    .map<FeedPost>((row) => ({
      ...row,
      author: profiles.get(row.author_id) || null,
      resolvedBy: row.resolved_by
        ? profiles.get(row.resolved_by) || null
        : null,
      acknowledgedByMe: mine.has(row.id),
      acknowledgementCount: ackCount.get(row.id) || 0
    }))
    .sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === "resolved") return 1;
        if (b.status === "resolved") return -1;
      }
      const pa = a.priority === "critical" ? 0 : 1;
      const pb = b.priority === "critical" ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
}

export async function createFeedPost(input: {
  subject: string;
  body: string;
  priority: Extract<FeedPriority, "normal" | "critical">;
  notifyAll: boolean;
  notifyPositions: StaffPosition[];
}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("unauthorized");

  const response = await fetch(edgeFunctions.handoverPush, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.supabasePublishableKey,
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify({
      action: "create",
      subject: input.subject,
      body: input.body,
      priority: input.priority,
      notify_all: input.notifyAll,
      notify_positions: input.notifyAll ? [] : input.notifyPositions
    })
  });

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    note?: unknown;
    error?: string;
  };

  if (!response.ok || !data.ok || !data.note) {
    throw new Error(data.error || "feed_create_failed");
  }
  return data.note;
}

export async function acknowledgeFeedPost(noteId: string) {
  const { data, error } = await supabase.rpc(
    "acknowledge_feed_post",
    { p_note_id: noteId }
  );
  if (error || !data) throw error || new Error("feed_ack_failed");
  return data;
}

export async function resolveFeedPost(noteId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("unauthorized");

  const response = await fetch(edgeFunctions.handoverPush, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.supabasePublishableKey,
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify({
      action: "resolve",
      note_id: noteId
    })
  });

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    note?: unknown;
    error?: string;
  };

  if (!response.ok || !data.ok || !data.note) {
    throw new Error(data.error || "feed_resolve_failed");
  }
  return data.note;
}

export function subscribeToFeed(onChange: () => void) {
  const notesChannel = supabase
    .channel("bfstaff-feed-notes")
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "notes"
    }, onChange)
    .subscribe();

  const ackChannel = supabase
    .channel("bfstaff-feed-acknowledgements")
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "feed_acknowledgements"
    }, onChange)
    .subscribe();

  return () => {
    void supabase.removeChannel(notesChannel);
    void supabase.removeChannel(ackChannel);
  };
}
