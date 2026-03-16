"use client";

import AdminResourcePage from "@/components/AdminResourcePage";

export default function CaptionRequestsPage() {
    return (
        <AdminResourcePage
            title="Caption Requests"
            tableName="caption_requests"
            mode="read"
        />
    );
}