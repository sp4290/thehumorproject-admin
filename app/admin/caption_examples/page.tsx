"use client";

import AdminResourcePage from "@/components/AdminResourcePage";

export default function CaptionExamplesPage() {
    return (
        <AdminResourcePage
            title="Caption Examples"
            tableName="caption_examples"
            mode="crud"
        />
    );
}