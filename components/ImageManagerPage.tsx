"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useRef, useState } from "react";

const buttonStyle: React.CSSProperties = {
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid #555",
    background: "#1e1e1e",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
};

const primaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    border: "1px solid #555",
};

const dangerButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    border: "1px solid #a33",
};

export default function ImageManagerPage() {
    const [images, setImages] = useState<any[]>([]);
    const [url, setUrl] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState("{}");
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [highlightId, setHighlightId] = useState<string | null>(null);
    const [lastDeletedImage, setLastDeletedImage] = useState<any | null>(null);
    const [showUndo, setShowUndo] = useState(false);

    const bucket = process.env.NEXT_PUBLIC_IMAGE_BUCKET || "images";

    const sortedImages = useMemo(() => {
        if (!highlightId) return images;

        const selected = images.find((img) => img.id === highlightId);
        const others = images.filter((img) => img.id !== highlightId);

        return selected ? [selected, ...others] : images;
    }, [images, highlightId]);

    const load = async () => {
        setLoading(true);

        const { data, error } = await supabase.from("images").select("*").limit(100);

        if (error) {
            alert(error.message);
            setImages([]);
        } else {
            setImages(data || []);
        }

        setLoading(false);
    };

    useEffect(() => {
        load();
    }, []);

    const createFromUrl = async () => {
        if (!url.trim()) return;

        const { data, error } = await supabase
            .from("images")
            .insert({ url: url.trim() })
            .select()
            .single();

        if (error) {
            alert(error.message);
            return;
        }

        setUrl("");
        setMessage("Image row created from URL.");
        setHighlightId(data?.id || null);
        setShowUndo(false);
        setLastDeletedImage(null);

        if (data) setImages((prev) => [data, ...prev]);
        else load();
    };

    const uploadFile = async () => {
        if (!file) {
            alert("Please choose a file first.");
            return;
        }

        const filePath = `admin-uploads/${Date.now()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(filePath, file, { upsert: false });

        if (uploadError) {
            alert(uploadError.message);
            return;
        }

        const { data: publicUrlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(filePath);

        const { data, error: insertError } = await supabase
            .from("images")
            .insert({ url: publicUrlData.publicUrl })
            .select()
            .single();

        if (insertError) {
            alert(insertError.message);
            return;
        }

        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";

        setMessage("Image uploaded and image row created.");
        setHighlightId(data?.id || null);
        setShowUndo(false);
        setLastDeletedImage(null);

        if (data) setImages((prev) => [data, ...prev]);
        else load();
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
                .from("images")
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
            setMessage("Image row updated.");
            setHighlightId(data?.id || editingId);
            setShowUndo(false);
            setLastDeletedImage(null);

            if (data) {
                setImages((prev) => {
                    const filtered = prev.filter((img) => img.id !== data.id);
                    return [data, ...filtered];
                });
            } else {
                load();
            }
        } catch {
            alert("Invalid JSON");
        }
    };

    const deleteImage = async (imageRow: any) => {
        const confirmed = window.confirm("Delete this image row?");
        if (!confirmed) return;

        const { error } = await supabase.from("images").delete().eq("id", imageRow.id);

        if (error) {
            alert(error.message);
            return;
        }

        setImages((prev) => prev.filter((img) => img.id !== imageRow.id));
        setLastDeletedImage(imageRow);
        setShowUndo(true);
        setMessage("Image row deleted.");

        if (highlightId === imageRow.id) setHighlightId(null);
    };

    const undoDelete = async () => {
        if (!lastDeletedImage) return;

        const { data, error } = await supabase
            .from("images")
            .insert(lastDeletedImage)
            .select()
            .single();

        if (error) {
            alert(`Could not undo delete: ${error.message}`);
            return;
        }

        setImages((prev) => [data, ...prev]);
        setHighlightId(data?.id || null);
        setMessage("Delete undone.");
        setShowUndo(false);
        setLastDeletedImage(null);
    };

    return (
        <div>
            <h2>Images</h2>

            <div style={{ marginBottom: 20 }}>
                <button onClick={load}>Reload</button>
            </div>

            {message && (
                <div
                    style={{
                        marginBottom: 20,
                        padding: 12,
                        border: "1px solid #555",
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                    }}
                >
                    <span>{message}</span>

                    {showUndo && lastDeletedImage && (
                        <button onClick={undoDelete} style={buttonStyle}>
                            Undo Delete
                        </button>
                    )}
                </div>
            )}

            <div
                style={{
                    border: "1px solid #444",
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 24,
                }}
            >
                <h3>Create Image From URL</h3>

                <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://..."
                    style={{ width: "100%", maxWidth: 500 }}
                />

                <br />

                <button
                    onClick={createFromUrl}
                    style={{ ...primaryButtonStyle, marginTop: 10 }}
                >
                    Create Image Row
                </button>
            </div>

            <div
                style={{
                    border: "1px solid #444",
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 24,
                }}
            >
                <h3>Upload New Image File</h3>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                />

                <div
                    style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        flexWrap: "wrap",
                        marginTop: 10,
                    }}
                >
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={buttonStyle}
                    >
                        Choose File
                    </button>

                    <span style={{ fontSize: 13, opacity: 0.85 }}>
                        {file ? file.name : "No file chosen"}
                    </span>
                </div>

                <button
                    onClick={uploadFile}
                    style={{ ...primaryButtonStyle, marginTop: 10 }}
                >
                    Upload File and Create Row
                </button>
            </div>

            {loading && <p>Loading...</p>}

            <div style={{ display: "grid", gap: 20 }}>
                {sortedImages.map((img, index) => (
                    <div
                        key={img.id || index}
                        style={{
                            border: img.id === highlightId ? "2px solid #888" : "1px solid #444",
                            padding: 16,
                            borderRadius: 8,
                        }}
                    >
                        {img.url && (
                            <div style={{ marginBottom: 12 }}>
                                <img
                                    src={img.url}
                                    alt=""
                                    style={{ maxWidth: 300, maxHeight: 300, objectFit: "contain" }}
                                />
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
                            {JSON.stringify(img, null, 2)}
                        </pre>

                        <div style={{ marginTop: 12 }}>
                            <button onClick={() => startEdit(img)} style={buttonStyle}>
                                Edit Row
                            </button>

                            <button
                                onClick={() => deleteImage(img)}
                                style={{ ...dangerButtonStyle, marginLeft: 8 }}
                            >
                                Delete Row
                            </button>
                        </div>

                        {editingId === img.id && (
                            <div style={{ marginTop: 12 }}>
                                <textarea
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    rows={12}
                                    style={{ width: "100%", maxWidth: 800 }}
                                />

                                <br />

                                <button
                                    onClick={saveChanges}
                                    style={{ ...primaryButtonStyle, marginTop: 10 }}
                                >
                                    Save Changes
                                </button>

                                <button
                                    onClick={() => {
                                        setEditingId(null);
                                        setEditText("{}");
                                    }}
                                    style={{ ...buttonStyle, marginLeft: 8 }}
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