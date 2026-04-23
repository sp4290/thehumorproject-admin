"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useState } from "react";

type Mode = "read" | "update" | "crud";

type StatsConfig = {
    enabled: boolean;
    ratingsTable: string;
    ratingCaptionForeignKey: string;
    captionTextField?: string;
    ratingValueField?: string;
};

type Props = {
    title: string;
    tableName: string;
    mode: Mode;
    previewImageField?: string;
    statsConfig?: StatsConfig;
};

type CaptionStat = {
    captionId: string;
    ratingCount: number;
    averageRating: number | null;
    minRating: number | null;
    maxRating: number | null;
};

type StatsSummary = {
    totalRows: number;
    totalRatedRows: number;
    totalRatings: number;
    overallAverageRating: number | null;

    mostRatedCaptionId: string | null;
    mostRatedCaptionCount: number;

    highestAverageCaptionId: string | null;
    highestAverageCaptionValue: number | null;

    lowestAverageCaptionId: string | null;
    lowestAverageCaptionValue: number | null;
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

export default function AdminResourcePage({
                                              title,
                                              tableName,
                                              mode,
                                              previewImageField,
                                              statsConfig,
                                          }: Props) {
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

    const [statsLoading, setStatsLoading] = useState(false);
    const [statsError, setStatsError] = useState("");
    const [statsByCaptionId, setStatsByCaptionId] = useState<Record<string, CaptionStat>>({});
    const [statsSummary, setStatsSummary] = useState<StatsSummary | null>(null);

    const sortedRows = useMemo(() => {
        if (!highlightId) return rows;

        const selected = rows.find((row) => row.id === highlightId);
        const others = rows.filter((row) => row.id !== highlightId);

        return selected ? [selected, ...others] : rows;
    }, [rows, highlightId]);

    const formatNumber = (value: number | null) => {
        if (value === null) return "—";

        const rounded = Number(value.toFixed(2));
        if (Object.is(rounded, -0)) return "0.00";

        return rounded.toFixed(2);
    };

    const getRowTitle = (row: any) => {
        if (!row) return "—";

        const captionField = statsConfig?.captionTextField || "content";

        if (row?.[captionField]) {
            return String(row[captionField]);
        }

        if (row?.content) return String(row.content);
        if (row?.caption) return String(row.caption);
        if (row?.title) return String(row.title);
        if (row?.name) return String(row.name);

        return row?.id ? `Row ${row.id}` : "Untitled row";
    };

    const loadStats = async (captionRows: any[]) => {
        if (!statsConfig?.enabled) {
            setStatsByCaptionId({});
            setStatsSummary(null);
            setStatsError("");
            return;
        }

        setStatsLoading(true);
        setStatsError("");

        try {
            const captionIds = captionRows.map((row) => row.id).filter(Boolean);

            if (captionIds.length === 0) {
                setStatsByCaptionId({});
                setStatsSummary({
                    totalRows: 0,
                    totalRatedRows: 0,
                    totalRatings: 0,
                    overallAverageRating: null,

                    mostRatedCaptionId: null,
                    mostRatedCaptionCount: 0,

                    highestAverageCaptionId: null,
                    highestAverageCaptionValue: null,

                    lowestAverageCaptionId: null,
                    lowestAverageCaptionValue: null,
                });
                return;
            }

            const { data: ratingsData, error: ratingsError } = await supabase
                .from(statsConfig.ratingsTable)
                .select("*")
                .in(statsConfig.ratingCaptionForeignKey, captionIds)
                .limit(10000);

            if (ratingsError) {
                setStatsError(ratingsError.message);
                setStatsByCaptionId({});
                setStatsSummary(null);
                return;
            }

            const firstRatingRow = ratingsData?.[0];
            const detectedValueField =
                statsConfig.ratingValueField ||
                (firstRatingRow ? guessRatingValueField(firstRatingRow) : null);

            if (!detectedValueField) {
                setStatsError(
                    `Could not find a numeric rating column in ${statsConfig.ratingsTable}.`
                );
                setStatsByCaptionId({});
                setStatsSummary(null);
                return;
            }

            const grouped: Record<string, number[]> = {};

            for (const item of ratingsData || []) {
                const captionId = item?.[statsConfig.ratingCaptionForeignKey];
                const rawValue = item?.[detectedValueField];

                if (!captionId) continue;

                const numericValue =
                    typeof rawValue === "number"
                        ? rawValue
                        : rawValue !== null && rawValue !== undefined && rawValue !== ""
                            ? Number(rawValue)
                            : NaN;

                if (!grouped[captionId]) {
                    grouped[captionId] = [];
                }

                if (!Number.isNaN(numericValue)) {
                    grouped[captionId].push(numericValue);
                }
            }

            const nextStatsByCaptionId: Record<string, CaptionStat> = {};
            let totalRatings = 0;
            let totalRatingSum = 0;
            let totalRatedRows = 0;

            let mostRatedCaptionId: string | null = null;
            let mostRatedCaptionCount = 0;

            let highestAverageCaptionId: string | null = null;
            let highestAverageCaptionValue: number | null = null;
            let lowestAverageCaptionId: string | null = null;
            let lowestAverageCaptionValue: number | null = null;

            for (const row of captionRows) {
                const values = grouped[row.id] || [];
                const ratingCount = values.length;
                const ratingSum = values.reduce((sum, value) => sum + value, 0);
                const averageRating = ratingCount > 0 ? ratingSum / ratingCount : null;
                const minRating = ratingCount > 0 ? Math.min(...values) : null;
                const maxRating = ratingCount > 0 ? Math.max(...values) : null;

                nextStatsByCaptionId[row.id] = {
                    captionId: row.id,
                    ratingCount,
                    averageRating,
                    minRating,
                    maxRating,
                };

                if (ratingCount > 0) {
                    totalRatedRows += 1;
                    totalRatings += ratingCount;
                    totalRatingSum += ratingSum;
                }

                if (ratingCount > mostRatedCaptionCount) {
                    mostRatedCaptionCount = ratingCount;
                    mostRatedCaptionId = row.id;
                }

                if (
                    averageRating !== null &&
                    (highestAverageCaptionValue === null ||
                        averageRating > highestAverageCaptionValue)
                ) {
                    highestAverageCaptionValue = averageRating;
                    highestAverageCaptionId = row.id;
                }

                if (
                    averageRating !== null &&
                    (lowestAverageCaptionValue === null ||
                        averageRating < lowestAverageCaptionValue)
                ) {
                    lowestAverageCaptionValue = averageRating;
                    lowestAverageCaptionId = row.id;
                }
            }

            setStatsByCaptionId(nextStatsByCaptionId);
            setStatsSummary({
                totalRows: captionRows.length,
                totalRatedRows,
                totalRatings,
                overallAverageRating: totalRatings > 0 ? totalRatingSum / totalRatings : null,

                mostRatedCaptionId,
                mostRatedCaptionCount,

                highestAverageCaptionId,
                highestAverageCaptionValue,

                lowestAverageCaptionId,
                lowestAverageCaptionValue,
            });
        } catch (e: any) {
            setStatsError(e?.message || "Failed to load statistics");
            setStatsByCaptionId({});
            setStatsSummary(null);
        } finally {
            setStatsLoading(false);
        }
    };

    const load = async () => {
        setLoading(true);
        setError("");

        try {
            const { data, error } = await supabase.from(tableName).select("*").limit(100);

            if (error) {
                setError(error.message);
                setRows([]);
                setStatsByCaptionId({});
                setStatsSummary(null);
            } else {
                const nextRows = data || [];
                setRows(nextRows);

                if (statsConfig?.enabled) {
                    await loadStats(nextRows);
                } else {
                    setStatsByCaptionId({});
                    setStatsSummary(null);
                    setStatsError("");
                }
            }
        } catch (e: any) {
            setError(e?.message || "Failed to load data");
            setRows([]);
            setStatsByCaptionId({});
            setStatsSummary(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [tableName]);

    const createRow = async () => {
        try {
            const payload = JSON.parse(createText);

            const { data, error } = await supabase
                .from(tableName)
                .insert(payload)
                .select()
                .single();

            if (error) {
                alert(error.message);
                return;
            }

            setCreateText("{}");
            setMessage("Created successfully.");
            setHighlightId(data?.id || null);
            setShowUndo(false);
            setLastDeletedRow(null);

            if (data) {
                const nextRows = [data, ...rows];
                setRows(nextRows);

                if (statsConfig?.enabled) {
                    await loadStats(nextRows);
                }
            } else {
                await load();
            }
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

            if (data) {
                const nextRows = rows.map((row) => (row.id === data.id ? data : row));
                setRows(nextRows);

                if (statsConfig?.enabled) {
                    await loadStats(nextRows);
                }
            } else {
                await load();
            }
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

        const nextRows = rows.filter((r) => r.id !== row.id);
        setRows(nextRows);
        setLastDeletedRow(row);
        setShowUndo(true);
        setMessage("Row deleted.");

        if (highlightId === row.id) {
            setHighlightId(null);
        }

        if (statsConfig?.enabled) {
            await loadStats(nextRows);
        }
    };

    const undoDelete = async () => {
        if (!lastDeletedRow) return;

        const { data, error } = await supabase
            .from(tableName)
            .insert(lastDeletedRow)
            .select()
            .single();

        if (error) {
            alert(`Could not undo delete: ${error.message}`);
            return;
        }

        const nextRows = [data, ...rows];
        setRows(nextRows);
        setHighlightId(data?.id || null);
        setMessage("Delete undone.");
        setShowUndo(false);
        setLastDeletedRow(null);

        if (statsConfig?.enabled) {
            await loadStats(nextRows);
        }
    };

    const mostRatedCaptionTitle =
        statsSummary?.mostRatedCaptionId
            ? getRowTitle(rows.find((r) => r.id === statsSummary.mostRatedCaptionId))
            : null;

    const highestAverageCaptionTitle =
        statsSummary?.highestAverageCaptionId
            ? getRowTitle(rows.find((r) => r.id === statsSummary.highestAverageCaptionId))
            : null;

    const lowestAverageCaptionTitle =
        statsSummary?.lowestAverageCaptionId
            ? getRowTitle(rows.find((r) => r.id === statsSummary.lowestAverageCaptionId))
            : null;

    return (
        <div>
            <h2>{title}</h2>
            <p>Table: {tableName}</p>

            <div style={{ marginBottom: 20 }}>
                <button onClick={load}>Reload</button>
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

                    {statsLoading && <p>Loading statistics...</p>}
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
                                    <div style={{ fontSize: 14, opacity: 0.8 }}>Total captions shown</div>
                                    <div style={{ fontSize: 24, fontWeight: 700 }}>
                                        {statsSummary.totalRows}
                                    </div>
                                </div>

                                <div style={{ border: "1px solid #444", borderRadius: 8, padding: 12 }}>
                                    <div style={{ fontSize: 14, opacity: 0.8 }}>Captions with ratings</div>
                                    <div style={{ fontSize: 24, fontWeight: 700 }}>
                                        {statsSummary.totalRatedRows}
                                    </div>
                                </div>

                                <div style={{ border: "1px solid #444", borderRadius: 8, padding: 12 }}>
                                    <div style={{ fontSize: 14, opacity: 0.8 }}>Total ratings</div>
                                    <div style={{ fontSize: 24, fontWeight: 700 }}>
                                        {statsSummary.totalRatings}
                                    </div>
                                </div>

                                <div style={{ border: "1px solid #444", borderRadius: 8, padding: 12 }}>
                                    <div style={{ fontSize: 14, opacity: 0.8 }}>Overall average rating</div>
                                    <div style={{ fontSize: 24, fontWeight: 700 }}>
                                        {formatNumber(statsSummary.overallAverageRating)}
                                    </div>
                                </div>
                            </div>

                            <div style={{ border: "1px solid #444", borderRadius: 8, padding: 12 }}>
                                <p style={{ margin: "0 0 8px 0" }}>
                                    <b>Most rated caption:</b> {mostRatedCaptionTitle || "—"}
                                </p>
                                <p style={{ margin: 0 }}>
                                    Ratings: {statsSummary.mostRatedCaptionCount}
                                </p>
                            </div>

                            <div style={{ border: "1px solid #444", borderRadius: 8, padding: 12 }}>
                                <p style={{ margin: "0 0 8px 0" }}>
                                    <b>Highest average rated caption:</b>{" "}
                                    {highestAverageCaptionTitle || "—"}
                                </p>
                                <p style={{ margin: 0 }}>
                                    Average rating: {formatNumber(statsSummary.highestAverageCaptionValue)}
                                </p>
                            </div>

                            <div style={{ border: "1px solid #444", borderRadius: 8, padding: 12 }}>
                                <p style={{ margin: "0 0 8px 0" }}>
                                    <b>Lowest average rated caption:</b>{" "}
                                    {lowestAverageCaptionTitle || "—"}
                                </p>
                                <p style={{ margin: 0 }}>
                                    Average rating: {formatNumber(statsSummary.lowestAverageCaptionValue)}
                                </p>
                            </div>

                        </div>
                    )}
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
                        <button onClick={undoDelete}>Undo Delete</button>
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
                    <button onClick={createRow} style={{ marginTop: 10 }}>
                        Create Row
                    </button>
                </div>
            )}

            {loading && <p>Loading...</p>}
            {error && <p style={{ color: "red" }}>{error}</p>}
            {!loading && !error && sortedRows.length === 0 && <p>No rows found.</p>}

            <div style={{ display: "grid", gap: 20 }}>
                {sortedRows.map((row, index) => {
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
                                        <div><b>Ratings:</b> {stat?.ratingCount ?? 0}</div>
                                        <div><b>Average:</b> {formatNumber(stat?.averageRating ?? null)}</div>
                                        <div><b>Min:</b> {formatNumber(stat?.minRating ?? null)}</div>
                                        <div><b>Max:</b> {formatNumber(stat?.maxRating ?? null)}</div>
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
                                    <button onClick={() => startEdit(row)}>Edit Row</button>

                                    {mode === "crud" && (
                                        <button
                                            onClick={() => deleteRow(row)}
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
                                    <button onClick={saveChanges} style={{ marginTop: 10 }}>
                                        Save Changes
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingId(null);
                                            setEditText("{}");
                                        }}
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
        </div>
    );
}