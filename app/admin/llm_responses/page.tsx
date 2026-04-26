"use client";

import AdminResourcePage from "@/components/AdminResourcePage";

export default function LlmResponsesPage() {
    return (
        <AdminResourcePage
            title="LLM Responses"
            tableName="llm_model_responses"
            mode="read"
        />
    );
}