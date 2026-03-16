"use client";

import AdminResourcePage from "@/components/AdminResourcePage";

export default function LlmProvidersPage() {
    return (
        <AdminResourcePage
            title="LLM Providers"
            tableName="llm_providers"
            mode="crud"
        />
    );
}