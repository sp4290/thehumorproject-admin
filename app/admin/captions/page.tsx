"use client";

import AdminResourcePage from "@/components/AdminResourcePage";

export default function CaptionsPage() {
    return (
        <AdminResourcePage
            title="Captions"
            tableName="captions"
            mode="read"
            statsConfig={{
                enabled: true,
                ratingsTable: "caption_votes",
                ratingCaptionForeignKey: "caption_id",
                captionTextField: "content",
            }}
            paginationConfig={{
                enabled: true,
                pageSize: 30,
                sortField: "created_datetime_utc",
                defaultDirection: "desc",
            }}
        />
    );
}