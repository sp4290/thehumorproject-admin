"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useState } from "react";

type Mode = "read" | "update" | "crud";

type Props = {
    title: string;
    tableName: string;
    mode: Mode;
    previewImageField?: string;
};

export default function AdminResourcePage({
                                              title,
                                              tableName,
                                              mode,
                                              previewImageField,
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

    const sortedRows = useMemo(() => {
        if (!highlightId) return rows;

        const selected = rows.find((row) => row.id === highlightId);
        const others = rows.filter((row) => row.id !== highlightId);

        return selected ? [selected, ...others] : rows;
    }, [rows, highlightId]);

    const load = async () => {
        setLoading(true);
        setError("");

        try {
            const { data, error } = await supabase.from(tableName).select("*").limit(100);

            if (error) {
                setError(error.message);
                setRows([]);
            } else {
                setRows(data || []);
            }
        } catch (e: any) {
            setError(e?.message || "Failed to load data");
            setRows([]);
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
                setRows((prev) => [data, ...prev]);
            } else {
                load();
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
                setRows((prev) => {
                    const filtered = prev.filter((row) => row.id !== data.id);
                    return [data, ...filtered];
                });
            } else {
                load();
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

        setRows((prev) => prev.filter((r) => r.id !== row.id));
        setLastDeletedRow(row);
        setShowUndo(true);
        setMessage("Row deleted.");
        if (highlightId === row.id) {
            setHighlightId(null);
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

        setRows((prev) => [data, ...prev]);
        setHighlightId(data?.id || null);
        setMessage("Delete undone.");
        setShowUndo(false);
        setLastDeletedRow(null);
    };

    return (
        <div>
            <h2>{title}</h2>
            <p>Table: {tableName}</p>

            <div style={{ marginBottom: 20 }}>
                <button onClick={load}>Reload</button>
            </div>

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
                {sortedRows.map((row, index) => (
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
                ))}
            </div>
        </div>
    );
}