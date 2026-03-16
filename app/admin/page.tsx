"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

export default function AdminDashboardPage() {
    const [stats, setStats] = useState({
        users: 0,
        images: 0,
        captions: 0,
        votes: 0,
        terms: 0,
        captionRequests: 0,
        captionExamples: 0,
        llmModels: 0,
        llmProviders: 0,
    });

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);

            const [
                users,
                images,
                captions,
                votes,
                terms,
                captionRequests,
                captionExamples,
                llmModels,
                llmProviders,
            ] = await Promise.all([
                supabase.from("profiles").select("*", { count: "exact", head: true }),
                supabase.from("images").select("*", { count: "exact", head: true }),
                supabase.from("captions").select("*", { count: "exact", head: true }),
                supabase.from("caption_votes").select("*", { count: "exact", head: true }),
                supabase.from("terms").select("*", { count: "exact", head: true }),
                supabase.from("caption_requests").select("*", { count: "exact", head: true }),
                supabase.from("caption_examples").select("*", { count: "exact", head: true }),
                supabase.from("llm_models").select("*", { count: "exact", head: true }),
                supabase.from("llm_providers").select("*", { count: "exact", head: true }),
            ]);

            setStats({
                users: users.count || 0,
                images: images.count || 0,
                captions: captions.count || 0,
                votes: votes.count || 0,
                terms: terms.count || 0,
                captionRequests: captionRequests.count || 0,
                captionExamples: captionExamples.count || 0,
                llmModels: llmModels.count || 0,
                llmProviders: llmProviders.count || 0,
            });

            setLoading(false);
        };

        load();
    }, []);

    const cardStyle: React.CSSProperties = {
        border: "1px solid #444",
        borderRadius: 12,
        padding: 20,
        display: "block",
        textDecoration: "none",
        color: "inherit",
    };

    if (loading) {
        return <div>Loading dashboard...</div>;
    }

    return (
        <div>
            <h2>Admin Dashboard</h2>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
                    gap: 20,
                    marginTop: 20,
                }}
            >
                <a href="/admin/users" style={cardStyle}>
                    Total Users: {stats.users}
                </a>

                <a href="/admin/images" style={cardStyle}>
                    Total Images: {stats.images}
                </a>

                <div style={cardStyle}>Total Votes: {stats.votes}</div>

                <a href="/admin/terms" style={cardStyle}>
                    Terms: {stats.terms}
                </a>

                <a href="/admin/captions" style={cardStyle}>
                    Total Captions: {stats.captions}
                </a>

                <a href="/admin/caption_requests" style={cardStyle}>
                    Caption Requests: {stats.captionRequests}
                </a>

                <a href="/admin/caption_examples" style={cardStyle}>
                    Caption Examples: {stats.captionExamples}
                </a>

                <a href="/admin/llm_models" style={cardStyle}>
                    LLM Models: {stats.llmModels}
                </a>

                <a href="/admin/llm_providers" style={cardStyle}>
                    LLM Providers: {stats.llmProviders}
                </a>
            </div>
        </div>
    );
}