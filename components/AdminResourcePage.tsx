"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useState } from "react";

type Mode = "read" | "update" | "crud";
type SortDirection = "asc" | "desc";

type RatingSortMode =
    | "most"
    | "high"
    | "low"
    | "up"
    | "down"
    | "newest"
    | "oldest";

type StatsConfig = {
    enabled: boolean;
    ratingsTable: string;
    ratingCaptionForeignKey: string;
    captionTextField?: string;
    ratingValueField?: string;
};

type PaginationConfig = {
    enabled: boolean;
    pageSize?: number;
    sortField?: string;
    defaultDirection?: SortDirection;
};

type Props = {
    title: string;
    tableName: string;
    mode: Mode;
    previewImageField?: string;
    statsConfig?: StatsConfig;
    paginationConfig?: PaginationConfig;
};

type CaptionStat = {
    captionId: string;
    ratingCount: number;
    upVotes: number;
    downVotes: number;
    neutralVotes: number;
    scoreAverage: number | null;
    upvoteRatio: number | null;
};

type StatsSummary = {
    totalRows: number;
    totalRatedRows: number;
    totalRatingVotes: number;
    totalUpVotes: number;
    totalDownVotes: number;
    totalNeutralVotes: number;
    overallAverageScore: number | null;
    overallUpvoteRatio: number | null;

    mostRatedCaptionId: string | null;
    mostRatedCaptionText: string | null;
    mostRatedCaptionCount: number;

    highestRatioCaptionId: string | null;
    highestRatioCaptionText: string | null;
    highestRatioUpVotes: number;
    highestRatioDownVotes: number;
    highestRatioValue: number | null;

    lowestRatioCaptionId: string | null;
    lowestRatioCaptionText: string | null;
    lowestRatioUpVotes: number;
    lowestRatioDownVotes: number;
    lowestRatioValue: number | null;

    mostUpvotesCaptionId: string | null;
    mostUpvotesCaptionText: string | null;
    mostUpvotesCount: number;

    mostDownvotesCaptionId: string | null;
    mostDownvotesCaptionText: string | null;
    mostDownvotesCount: number;
};

function guessRatingValueField(row: any): string | null {
    const candidates = [
        "rating",
        "score",
        "value",
        "vote",
        "rating_value",
        "vote_value",
        "numeric_value",
    ];

    for (const key of candidates) {
        if (key in row) return key;
    }

    for (const [key, value] of Object.entries(row)) {
        if (
            typeof value === "number" &&
            key !== "id" &&
            !key.endsWith("_id") &&
            !key.includes("count")
        ) {
            return key;
        }
    }

    return null;
}

function normalizeVote(value: any): -1 | 0 | 1 | null {
    const numberValue =
        typeof value === "number"
            ? value
            : value !== null && value !== undefined && value !== ""
                ? Number(value)
                : NaN;

    if (Number.isNaN(numberValue)) return null;
    if (numberValue > 0) return 1;
    if (numberValue < 0) return -1;
    return 0;
}

function getUpvoteRatio(upVotes: number, downVotes: number) {
    const totalDirectionalVotes = upVotes + downVotes;
    if (totalDirectionalVotes === 0) return null;
    return upVotes / totalDirectionalVotes;
}

export default function AdminResourcePage({
                                              title,
                                              tableName,
                                              mode,
                                              previewImageField,
                                              statsConfig,
                                              paginationConfig,
                                          }: Props) {
    const pageSize = paginationConfig?.pageSize || 30;
    const sortField = paginationConfig?.sortField || "created_datetime_utc";

    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [createText, setCreateText] = useState("{}");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState("{}");
    const [highlightId, setHighlightId] = useState<string | null>(null);
    const [lastDeletedRow, setLastDeletedRow] = useState<any | null>(null);
    const [showUndo, setShowUndo] = useState(false);

    const [loadedLimit, setLoadedLimit] = useState(pageSize);
    const [sortDirection] = useState<SortDirection>(
        paginationConfig?.defaultDirection || "desc"
    );
    const [ratingSortMode, setRatingSortMode] = useState<RatingSortMode>("most");
    const [totalRowCount, setTotalRowCount] = useState<number | null>(null);

    const [statsLoading, setStatsLoading] = useState(false);
    const [statsError, setStatsError] = useState("");
    const [statsByCaptionId, setStatsByCaptionId] = useState<Record<string, CaptionStat>>({});
    const [statsSummary, setStatsSummary] = useState<StatsSummary | null>(null);

    const formatNumber = (value: number | null) => {
        if (value === null) return "—";
        const rounded = Number(value.toFixed(2));
        if (Object.is(rounded, -0)) return "0.00";
        return rounded.toFixed(2);
    };

    const formatPercent = (value: number | null) => {
        if (value === null) return "—";
        return `${(value * 100).toFixed(1)}%`;
    };

    const visibleRows = useMemo(() => {
        if (!highlightId) return rows;

        const selected = rows.find((row) => row.id === highlightId);
        const others = rows.filter((row) => row.id !== highlightId);

        return selected ? [selected, ...others] : rows;
    }, [rows, highlightId]);

    const fetchAllRatings = async () => {
        if (!statsConfig?.enabled) return [];

        const allRows: any[] = [];
        const batchSize = 1000;
        let from = 0;

        while (true) {
            const to = from + batchSize - 1;

            const { data, error } = await supabase
                .from(statsConfig.ratingsTable)
                .select("*")
                .range(from, to);

            if (error) throw error;

            allRows.push(...(data || []));

            if (!data || data.length < batchSize) break;

            from += batchSize;
        }

        return allRows;
    };

    const fetchCaptionTextByIds = async (captionIds: string[]) => {
        const uniqueIds = Array.from(new Set(captionIds.filter(Boolean)));

        if (uniqueIds.length === 0) return {};

        const captionField = statsConfig?.captionTextField || "content";

        const { data, error } = await supabase
            .from(tableName)
            .select(`id, ${captionField}`)
            .in("id", uniqueIds);

        if (error) throw error;

        const lookup: Record<string, string> = {};
        const rows = (data || []) as any[];

        for (const row of rows) {
            lookup[row.id] = row[captionField] || row.id;
        }

        return lookup;
    };

    const fetchCaptionRowsByIds = async (captionIds: string[]) => {
        const uniqueIds = Array.from(new Set(captionIds.filter(Boolean)));

        if (uniqueIds.length === 0) return [];

        const { data, error } = await supabase
            .from(tableName)
            .select("*")
            .in("id", uniqueIds);

        if (error) throw error;

        const orderMap = new Map(uniqueIds.map((id, index) => [id, index]));

        return (data || []).sort((a, b) => {
            return (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0);
        });
    };

    const buildGroupedStats = (allRatings: any[]) => {
        const firstRatingRow = allRatings[0];
        const detectedValueField =
            statsConfig?.ratingValueField ||
            (firstRatingRow ? guessRatingValueField(firstRatingRow) : null);

        if (!detectedValueField && allRatings.length > 0) {
            throw new Error(`Could not find a rating column in ${statsConfig?.ratingsTable}.`);
        }

        const grouped: Record<string, CaptionStat> = {};

        for (const item of allRatings) {
            const captionId = item?.[statsConfig!.ratingCaptionForeignKey];
            if (!captionId) continue;

            const normalizedVote = normalizeVote(item?.[detectedValueField!]);
            if (normalizedVote === null) continue;

            if (!grouped[captionId]) {
                grouped[captionId] = {
                    captionId,
                    ratingCount: 0,
                    upVotes: 0,
                    downVotes: 0,
                    neutralVotes: 0,
                    scoreAverage: null,
                    upvoteRatio: null,
                };
            }

            grouped[captionId].ratingCount += 1;

            if (normalizedVote > 0) grouped[captionId].upVotes += 1;
            else if (normalizedVote < 0) grouped[captionId].downVotes += 1;
            else grouped[captionId].neutralVotes += 1;
        }

        for (const stat of Object.values(grouped)) {
            stat.scoreAverage =
                stat.ratingCount > 0
                    ? (stat.upVotes - stat.downVotes) / stat.ratingCount
                    : null;

            stat.upvoteRatio = getUpvoteRatio(stat.upVotes, stat.downVotes);
        }

        return grouped;
    };

    const getSortedCaptionIds = (statsMap: Record<string, CaptionStat>) => {
        const stats = Object.values(statsMap);

        stats.sort((a, b) => {
            if (ratingSortMode === "most") {
                return b.ratingCount - a.ratingCount;
            }

            if (ratingSortMode === "up") {
                return b.upVotes - a.upVotes || b.ratingCount - a.ratingCount;
            }

            if (ratingSortMode === "down") {
                return b.downVotes - a.downVotes || b.ratingCount - a.ratingCount;
            }

            if (ratingSortMode === "high" || ratingSortMode === "low") {
                const aRatio = a.upvoteRatio;
                const bRatio = b.upvoteRatio;

                if (aRatio === null && bRatio === null) {
                    return b.ratingCount - a.ratingCount;
                }

                if (aRatio === null) return 1;
                if (bRatio === null) return -1;

                if (ratingSortMode === "high") {
                    return bRatio - aRatio || b.ratingCount - a.ratingCount;
                }

                return aRatio - bRatio || b.ratingCount - a.ratingCount;
            }

            // fallback
            return 0;
        });

        return stats.map((stat) => stat.captionId);
    };

    const buildStatsSummary = async (
        statsMap: Record<string, CaptionStat>,
        totalCaptionsCount: number
    ) => {
        const stats = Object.values(statsMap);

        let totalRatingVotes = 0;
        let totalUpVotes = 0;
        let totalDownVotes = 0;
        let totalNeutralVotes = 0;

        let mostRated: CaptionStat | null = null;
        let highestRatio: CaptionStat | null = null;
        let lowestRatio: CaptionStat | null = null;
        let mostUpvotes: CaptionStat | null = null;
        let mostDownvotes: CaptionStat | null = null;

        for (const stat of stats) {
            totalRatingVotes += stat.ratingCount;
            totalUpVotes += stat.upVotes;
            totalDownVotes += stat.downVotes;
            totalNeutralVotes += stat.neutralVotes;

            if (!mostRated || stat.ratingCount > mostRated.ratingCount) {
                mostRated = stat;
            }

            if (
                stat.upvoteRatio !== null &&
                (!highestRatio ||
                    highestRatio.upvoteRatio === null ||
                    stat.upvoteRatio > highestRatio.upvoteRatio ||
                    (stat.upvoteRatio === highestRatio.upvoteRatio &&
                        stat.ratingCount > highestRatio.ratingCount))
            ) {
                highestRatio = stat;
            }

            if (
                stat.upvoteRatio !== null &&
                (!lowestRatio ||
                    lowestRatio.upvoteRatio === null ||
                    stat.upvoteRatio < lowestRatio.upvoteRatio ||
                    (stat.upvoteRatio === lowestRatio.upvoteRatio &&
                        stat.ratingCount > lowestRatio.ratingCount))
            ) {
                lowestRatio = stat;
            }

            if (!mostUpvotes || stat.upVotes > mostUpvotes.upVotes) {
                mostUpvotes = stat;
            }

            if (!mostDownvotes || stat.downVotes > mostDownvotes.downVotes) {
                mostDownvotes = stat;
            }
        }

        const captionTextLookup = await fetchCaptionTextByIds([
            mostRated?.captionId || "",
            highestRatio?.captionId || "",
            lowestRatio?.captionId || "",
            mostUpvotes?.captionId || "",
            mostDownvotes?.captionId || "",
        ]);

        setStatsSummary({
            totalRows: totalCaptionsCount,
            totalRatedRows: stats.length,
            totalRatingVotes,
            totalUpVotes,
            totalDownVotes,
            totalNeutralVotes,
            overallAverageScore:
                totalRatingVotes > 0 ? (totalUpVotes - totalDownVotes) / totalRatingVotes : null,
            overallUpvoteRatio: getUpvoteRatio(totalUpVotes, totalDownVotes),

            mostRatedCaptionId: mostRated?.captionId || null,
            mostRatedCaptionText: mostRated
                ? captionTextLookup[mostRated.captionId] || mostRated.captionId
                : null,
            mostRatedCaptionCount: mostRated?.ratingCount || 0,

            highestRatioCaptionId: highestRatio?.captionId || null,
            highestRatioCaptionText: highestRatio
                ? captionTextLookup[highestRatio.captionId] || highestRatio.captionId
                : null,
            highestRatioUpVotes: highestRatio?.upVotes || 0,
            highestRatioDownVotes: highestRatio?.downVotes || 0,
            highestRatioValue: highestRatio?.upvoteRatio ?? null,

            lowestRatioCaptionId: lowestRatio?.captionId || null,
            lowestRatioCaptionText: lowestRatio
                ? captionTextLookup[lowestRatio.captionId] || lowestRatio.captionId
                : null,
            lowestRatioUpVotes: lowestRatio?.upVotes || 0,
            lowestRatioDownVotes: lowestRatio?.downVotes || 0,
            lowestRatioValue: lowestRatio?.upvoteRatio ?? null,

            mostUpvotesCaptionId: mostUpvotes?.captionId || null,
            mostUpvotesCaptionText: mostUpvotes
                ? captionTextLookup[mostUpvotes.captionId] || mostUpvotes.captionId
                : null,
            mostUpvotesCount: mostUpvotes?.upVotes || 0,

            mostDownvotesCaptionId: mostDownvotes?.captionId || null,
            mostDownvotesCaptionText: mostDownvotes
                ? captionTextLookup[mostDownvotes.captionId] || mostDownvotes.captionId
                : null,
            mostDownvotesCount: mostDownvotes?.downVotes || 0,
        });
    };

    const load = async (refreshStats = false) => {
        setLoading(true);
        setError("");
        setStatsError("");

        const alreadyHasStats =
            statsSummary !== null && Object.keys(statsByCaptionId).length > 0;

        const shouldReloadStats = refreshStats || !alreadyHasStats;

        if (shouldReloadStats && statsConfig?.enabled) {
            setStatsLoading(true);
        }

        try {
            const { count, error: countError } = await supabase
                .from(tableName)
                .select("id", { count: "exact", head: true });

            if (countError) throw countError;

            const totalCount = count ?? 0;
            setTotalRowCount(totalCount);

            if (statsConfig?.enabled && paginationConfig?.enabled) {
                if (ratingSortMode === "newest" || ratingSortMode === "oldest") {
                    const { data, error } = await supabase
                        .from(tableName)
                        .select("*")
                        .order(sortField, {
                            ascending: ratingSortMode === "oldest",
                        })
                        .range(0, loadedLimit - 1);

                    if (error) throw error;

                    setRows(data || []);
                    return;
                }

                let statsMap = statsByCaptionId;

                if (shouldReloadStats) {
                    const allRatings = await fetchAllRatings();
                    statsMap = buildGroupedStats(allRatings);
                    await buildStatsSummary(statsMap, totalCount);
                    setStatsByCaptionId(statsMap);
                }

                const sortedCaptionIds = getSortedCaptionIds(statsMap);
                const idsToLoad = sortedCaptionIds.slice(0, loadedLimit);
                const loadedRows = await fetchCaptionRowsByIds(idsToLoad);

                setRows(loadedRows);
                return;
            }

            let query = supabase.from(tableName).select("*");

            if (paginationConfig?.enabled) {
                query = query.range(0, loadedLimit - 1);
            } else {
                query = query.limit(100);
            }

            const { data, error } = await query;

            if (error) throw error;

            setRows(data || []);
        } catch (e: any) {
            setError(e?.message || "Failed to load data");
            setStatsError(e?.message || "Failed to load statistics");
            setRows([]);
            setStatsByCaptionId({});
            setStatsSummary(null);
            setTotalRowCount(null);
        } finally {
            setLoading(false);

            if (shouldReloadStats && statsConfig?.enabled) {
                setStatsLoading(false);
            }
        }
    };

    useEffect(() => {
        load(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableName, loadedLimit, ratingSortMode]);

    const createRow = async () => {
        try {
            const payload = JSON.parse(createText);

            const { error } = await supabase.from(tableName).insert(payload);

            if (error) {
                alert(error.message);
                return;
            }

            setCreateText("{}");
            setMessage("Created successfully.");
            await load(true);
        } catch {
            alert("Invalid JSON");
        }
    };

    const startEdit = (row: any) => {
        setEditingId(row.id);
        setEditText(JSON.stringify(row, null, 2));
        setMessage("");
        setShowUndo(false);
    };

    const saveChanges = async () => {
        if (!editingId) return;

        try {
            const payload = JSON.parse(editText);
            delete payload.id;

            const { data, error } = await supabase
                .from(tableName)
                .update(payload)
                .eq("id", editingId)
                .select()
                .single();

            if (error) {
                alert(error.message);
                return;
            }

            setEditingId(null);
            setEditText("{}");
            setMessage("Changes saved.");
            setHighlightId(data?.id || editingId);
            setShowUndo(false);
            setLastDeletedRow(null);

            await load(true);
        } catch {
            alert("Invalid JSON");
        }
    };

    const deleteRow = async (row: any) => {
        const confirmed = window.confirm("Delete this row?");
        if (!confirmed) return;

        const { error } = await supabase.from(tableName).delete().eq("id", row.id);

        if (error) {
            alert(error.message);
            return;
        }

        setLastDeletedRow(row);
        setShowUndo(true);
        setMessage("Row deleted.");

        if (highlightId === row.id) {
            setHighlightId(null);
        }

        await load(true);
    };

    const undoDelete = async () => {
        if (!lastDeletedRow) return;

        const { error } = await supabase.from(tableName).insert(lastDeletedRow);

        if (error) {
            alert(`Could not undo delete: ${error.message}`);
            return;
        }

        setHighlightId(lastDeletedRow?.id || null);
        setMessage("Delete undone.");
        setShowUndo(false);
        setLastDeletedRow(null);

        await load(true);
    };

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const scrollToBottom = () => {
        window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: "smooth",
        });
    };

    return (
        <div>
            <h2>{title}</h2>

            <div style={{ marginBottom: 20 }}>
                <button onClick={() => load(true)}>Reload</button>
            </div>

            {statsConfig?.enabled && (
                <div
                    style={{
                        marginBottom: 24,
                        border: "1px solid #444",
                        borderRadius: 8,
                        padding: 16,
                    }}
                >
                    <h3 style={{ marginTop: 0 }}>Caption Statistics</h3>

                    {statsLoading && <p>Loading total statistics...</p>}
                    {statsError && <p style={{ color: "red" }}>{statsError}</p>}

                    {!statsLoading && !statsError && statsSummary && (
                        <div style={{ display: "grid", gap: 12 }}>
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                                    gap: 12,
                                }}
                            >
                                <div style={{ border: "1px solid #444", borderRadius: 8, padding: 12 }}>
                                    <div style={{ fontSize: 14, opacity: 0.8 }}>Total captions</div>
                                    <div style={{ fontSize: 24, fontWeight: 700 }}>
                                        {statsSummary.totalRows}
                                    </div>
                                </div>

                                <div style={{ border: "1px solid #444", borderRadius: 8, padding: 12 }}>
                                    <div style={{ fontSize: 14, opacity: 0.8 }}>Captions with votes</div>
                                    <div style={{ fontSize: 24, fontWeight: 700 }}>
                                        {statsSummary.totalRatedRows}
                                    </div>
                                </div>

                                <div style={{ border: "1px solid #444", borderRadius: 8, padding: 12 }}>
                                    <div style={{ fontSize: 14, opacity: 0.8 }}>Total votes</div>
                                    <div style={{ fontSize: 24, fontWeight: 700 }}>
                                        {statsSummary.totalRatingVotes}
                                    </div>
                                </div>

                                <div style={{ border: "1px solid #444", borderRadius: 8, padding: 12 }}>
                                    <div style={{ fontSize: 14, opacity: 0.8 }}>Total upvotes</div>
                                    <div style={{ fontSize: 24, fontWeight: 700 }}>
                                        {statsSummary.totalUpVotes}
                                    </div>
                                </div>

                                <div style={{ border: "1px solid #444", borderRadius: 8, padding: 12 }}>
                                    <div style={{ fontSize: 14, opacity: 0.8 }}>Total downvotes</div>
                                    <div style={{ fontSize: 24, fontWeight: 700 }}>
                                        {statsSummary.totalDownVotes}
                                    </div>
                                </div>

                                <div style={{ border: "1px solid #444", borderRadius: 8, padding: 12 }}>
                                    <div style={{ fontSize: 14, opacity: 0.8 }}>Overall average score</div>
                                    <div style={{ fontSize: 24, fontWeight: 700 }}>
                                        {formatNumber(statsSummary.overallAverageScore)}
                                    </div>
                                </div>

                                <div style={{ border: "1px solid #444", borderRadius: 8, padding: 12 }}>
                                    <div style={{ fontSize: 14, opacity: 0.8 }}>Overall upvote ratio</div>
                                    <div style={{ fontSize: 24, fontWeight: 700 }}>
                                        {formatPercent(statsSummary.overallUpvoteRatio)}
                                    </div>
                                </div>
                            </div>

                            <div style={{ border: "1px solid #444", borderRadius: 8, padding: 12 }}>
                                <p style={{ margin: "0 0 8px 0" }}>
                                    <b>Caption with most votes:</b>{" "}
                                    {statsSummary.mostRatedCaptionText || "—"}
                                </p>
                                <p style={{ margin: 0 }}>
                                    Votes: {statsSummary.mostRatedCaptionCount}
                                </p>
                            </div>

                            <div style={{ border: "1px solid #444", borderRadius: 8, padding: 12 }}>
                                <p style={{ margin: "0 0 8px 0" }}>
                                    <b>Caption with most upvotes:</b>{" "}
                                    {statsSummary.mostUpvotesCaptionText || "—"}
                                </p>
                                <p style={{ margin: 0 }}>
                                    Upvotes: {statsSummary.mostUpvotesCount}
                                </p>
                            </div>

                            <div style={{ border: "1px solid #444", borderRadius: 8, padding: 12 }}>
                                <p style={{ margin: "0 0 8px 0" }}>
                                    <b>Caption with most downvotes:</b>{" "}
                                    {statsSummary.mostDownvotesCaptionText || "—"}
                                </p>
                                <p style={{ margin: 0 }}>
                                    Downvotes: {statsSummary.mostDownvotesCount}
                                </p>
                            </div>

                            <div style={{ border: "1px solid #444", borderRadius: 8, padding: 12 }}>
                                <p style={{ margin: "0 0 8px 0" }}>
                                    <b>Caption with highest upvote ratio:</b>{" "}
                                    {statsSummary.highestRatioCaptionText || "—"}
                                </p>
                                <p style={{ margin: 0 }}>
                                    Upvotes: {statsSummary.highestRatioUpVotes} | Downvotes:{" "}
                                    {statsSummary.highestRatioDownVotes} | Upvote ratio:{" "}
                                    {formatPercent(statsSummary.highestRatioValue)}
                                </p>
                            </div>

                            <div style={{ border: "1px solid #444", borderRadius: 8, padding: 12 }}>
                                <p style={{ margin: "0 0 8px 0" }}>
                                    <b>Caption with lowest upvote ratio:</b>{" "}
                                    {statsSummary.lowestRatioCaptionText || "—"}
                                </p>
                                <p style={{ margin: 0 }}>
                                    Upvotes: {statsSummary.lowestRatioUpVotes} | Downvotes:{" "}
                                    {statsSummary.lowestRatioDownVotes} | Upvote ratio:{" "}
                                    {formatPercent(statsSummary.lowestRatioValue)}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {paginationConfig?.enabled && (
                <div
                    style={{
                        marginBottom: 24,
                        display: "flex",
                        gap: 16,
                        flexWrap: "wrap",
                        alignItems: "center",
                    }}
                >
                    <select
                        value={ratingSortMode}
                        onChange={(e) => {
                            setRatingSortMode(e.target.value as RatingSortMode);
                            setLoadedLimit(pageSize);
                        }}
                    >
                        <option value="most">Most votes first</option>
                        <option value="high">Highest upvote ratio first</option>
                        <option value="low">Lowest upvote ratio first</option>
                        <option value="up">Most upvotes first</option>
                        <option value="down">Most downvotes first</option>
                        <option value="newest">Newest captions first</option>
                        <option value="oldest">Oldest captions first</option>
                    </select>

                    <span>
                        Showing {rows.length}
                        {totalRowCount !== null ? ` of ${totalRowCount}` : ""} captions
                    </span>
                </div>
            )}

            {message && (
                <div
                    style={{
                        marginBottom: 20,
                        padding: 12,
                        border: "1px solid #2d6a4f",
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                    }}
                >
                    <span>{message}</span>

                    {showUndo && lastDeletedRow && (
                        <button onClick={undoDelete} className="admin-btn">
                            Undo Delete
                        </button>
                    )}
                </div>
            )}

            {mode === "crud" && (
                <div style={{ marginBottom: 30 }}>
                    <h3>Create New Row</h3>
                    <p>Paste JSON for the row you want to insert.</p>
                    <textarea
                        value={createText}
                        onChange={(e) => setCreateText(e.target.value)}
                        rows={10}
                        style={{ width: "100%", maxWidth: 800 }}
                    />
                    <br />
                    <button onClick={createRow} className="admin-btn admin-btn-primary" style={{ marginTop: 10 }}>
                        Create Row
                    </button>
                </div>
            )}

            {loading && <p>Loading...</p>}
            {error && <p style={{ color: "red" }}>{error}</p>}
            {!loading && !error && visibleRows.length === 0 && <p>No rows found.</p>}

            <div style={{ display: "grid", gap: 20 }}>
                {visibleRows.map((row, index) => {
                    const stat = row.id ? statsByCaptionId[row.id] : null;

                    return (
                        <div
                            key={row.id || index}
                            style={{
                                border: row.id === highlightId ? "2px solid #888" : "1px solid #444",
                                padding: 16,
                                borderRadius: 8,
                            }}
                        >
                            {previewImageField && row[previewImageField] ? (
                                <div style={{ marginBottom: 12 }}>
                                    <img
                                        src={row[previewImageField]}
                                        alt=""
                                        style={{ maxWidth: 300, maxHeight: 300, objectFit: "contain" }}
                                    />
                                </div>
                            ) : null}

                            {statsConfig?.enabled && (
                                <div
                                    style={{
                                        marginBottom: 12,
                                        border: "1px solid #444",
                                        borderRadius: 8,
                                        padding: 12,
                                        background: "#151515",
                                    }}
                                >
                                    <h4 style={{ marginTop: 0, marginBottom: 10 }}>Rating Stats</h4>
                                    <div style={{ display: "grid", gap: 6 }}>
                                        <div>
                                            <b>Total votes:</b> {stat?.ratingCount ?? 0}
                                        </div>
                                        <div>
                                            <b>Upvotes:</b> {stat?.upVotes ?? 0}
                                        </div>
                                        <div>
                                            <b>Downvotes:</b> {stat?.downVotes ?? 0}
                                        </div>
                                        <div>
                                            <b>Average score:</b>{" "}
                                            {formatNumber(stat?.scoreAverage ?? null)}
                                        </div>
                                        <div>
                                            <b>Upvote ratio:</b>{" "}
                                            {formatPercent(stat?.upvoteRatio ?? null)}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <pre
                                style={{
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                    background: "#111",
                                    padding: 12,
                                    borderRadius: 8,
                                    overflowX: "auto",
                                }}
                            >
                                {JSON.stringify(row, null, 2)}
                            </pre>

                            {mode !== "read" && row.id ? (
                                <div style={{ marginTop: 12 }}>
                                    <button onClick={() => startEdit(row)} className="admin-btn">
                                        Edit Row
                                    </button>

                                    {mode === "crud" && (
                                        <button
                                            onClick={() => deleteRow(row)}
                                            className="admin-btn admin-btn-danger"
                                            style={{ marginLeft: 8 }}
                                        >
                                            Delete Row
                                        </button>
                                    )}
                                </div>
                            ) : null}

                            {editingId === row.id && (
                                <div style={{ marginTop: 12 }}>
                                    <textarea
                                        value={editText}
                                        onChange={(e) => setEditText(e.target.value)}
                                        rows={12}
                                        style={{ width: "100%", maxWidth: 800 }}
                                    />
                                    <br />
                                    <button onClick={saveChanges} className="admin-btn admin-btn-primary" style={{ marginTop: 10 }}>
                                        Save Changes
                                    </button>

                                    <button
                                        onClick={() => {
                                            setEditingId(null);
                                            setEditText("{}");
                                        }}
                                        className="admin-btn"
                                        style={{ marginLeft: 8 }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {paginationConfig?.enabled &&
                totalRowCount !== null &&
                rows.length < totalRowCount && (
                    <div style={{ marginTop: 24 }}>
                        <button
                            onClick={() => setLoadedLimit((prev) => prev + pageSize)}
                            className="admin-btn"
                        >
                            Load 30 more
                        </button>
                    </div>
                )}

            <div
                style={{
                    position: "fixed",
                    right: 24,
                    bottom: 24,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    zIndex: 9999,
                }}
            >
                <button
                    onClick={scrollToTop}
                    title="Scroll to top"
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        fontSize: 20,
                        cursor: "pointer",
                    }}
                >
                    ↑
                </button>

                <button
                    onClick={scrollToBottom}
                    title="Scroll to bottom"
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        fontSize: 20,
                        cursor: "pointer",
                    }}
                >
                    ↓
                </button>
            </div>
        </div>
    );
}
const buttonStyle: React.CSSProperties = {
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid #555",
    background: "#1e1e1e",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
};

const dangerButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    border: "1px solid #a33",
};